import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { borderMap, landOwnerAt } from '../src/sim/borders';
import { AI_HORDE, TRIBUTE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { restat, placeBuilding, spawnUnit } from '../src/sim/world';
import type { Building, CivId, GameState, Unit } from '../src/sim/types';

/** The computer in the Age of the Horde (#322): the climb, tribute, and the answer to it. */

const tcOf = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const game = (civ: CivId = 'mongols', seed = 11): GameState => {
  const s = createGame({ seed, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ }, { name: 'B', ai: civ === 'mongols' ? null : 'hard', civ: 'romans' }] });
  const home = tcOf(s);
  for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', home.x + 3 + (i % 10) * 0.5, home.y + 3 + (i >> 4) * 0.5);
  s.players[0].res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 };
  return s;
};
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};
const nomads = (s: GameState, age: 'steppe' | 'horde' = 'steppe') =>
  restat(s, s.players[0], () => {
    s.players[0].age = age;
    s.players[0].epoch = age === 'steppe' ? 1 : 2;
    s.players[0].walked = age === 'steppe' ? ['steppe'] : ['steppe', 'horde'];
  });

describe('the road to the Horde', () => {
  it('a steppe people that milked and hunted enough climbs into the Horde, and stays a while', () => {
    const s = game();
    nomads(s);
    step(s);
    s.players[0].stats.milked = 200;
    s.players[0].stats.hunted = 800;
    for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'infantry', tcOf(s).x - 6 + (i % 6) * 0.5, tcOf(s).y + 6 + (i >> 3) * 0.5);
    placeBuilding(s, 0, 'stable', Math.round(tcOf(s).x) + 8, Math.round(tcOf(s).y) + 6, true);
    s.tick = secs(500);
    s.peaceUntil = secs(5000);
    run(s, 60);
    expect(ageOf(s.players[0])).toBe('horde');
    // It holds the Horde for `stay` seconds: tribute is what it came for.
    s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    run(s, 60);
    expect(ageOf(s.players[0])).toBe('horde');
    expect(s.ai[0].steppe?.horde).toBeDefined();
  });
});


describe('tribute', () => {
  /** Player 0, a horde with `n` idle riders at home, against player 1's town with its soldiers cleared out and gold in its coffers. */
  const raid = (n: number) => {
    const s = game();
    nomads(s, 'horde');
    s.peaceUntil = 0;
    // Its soldiers are cleared away, its King and citizens left.
    const gone = (e: { kind: string; owner: number; type?: string; id: number }) => e.kind === 'unit' && e.owner === 1 && e.type !== 'citizen' && !s.kings.includes(e.id);
    s.ents = s.ents.filter((e) => !gone(e));
    for (const [id, e] of s.byId) if (gone(e)) s.byId.delete(id);
    s.players[1].res.gold = 5000;
    s.players[0].res.gold = 0;
    const home = tcOf(s);
    // A second camp pitched toward the rival's town, so its land lies within the horde's supply.
    const foe = tcOf(s, 1);
    const dl = Math.hypot(home.x - foe.x, home.y - foe.y);
    placeBuilding(s, 0, 'towncenter', Math.round(foe.x + ((home.x - foe.x) / dl) * 30) - 1, Math.round(foe.y + ((home.y - foe.y) / dl) * 30) - 1, true);
    for (let i = 0; i < n; i++) spawnUnit(s, 0, 'cavalry', home.x + 4 + (i % 4) * 0.7, home.y - 4 + (i >> 2) * 0.7);
    return s;
  };

  it('a band of riders rides into the rival\'s land and stands there, taking gold', () => {
    const s = raid(TRIBUTE.most);
    run(s, 50);
    const band = s.ai[0].steppe?.band;
    expect(band?.length).toBeGreaterThan(0);
    const at = s.ai[0].steppe!.at!;
    expect(borderMap(s)[Math.floor(at.y) * s.w + Math.floor(at.x)]).toBe(1);
    expect(s.players[0].stats.tribute ?? 0).toBeGreaterThan(0);
  });

  it('too few riders do not set out', () => {
    const s = raid(AI_HORDE.riders - 1);
    run(s, 60);
    expect(s.ai[0].steppe?.band).toBeUndefined();
  });

  it('a band that is losing rides home', () => {
    const s = raid(TRIBUTE.most);
    run(s, 60);
    const band = s.ai[0].steppe!.band!;
    expect(band.length).toBeGreaterThan(0);
    const at = s.ai[0].steppe!.at!;
    // Rival soldiers close in on the standing riders.
    for (let i = 0; i < band.length + 2; i++) spawnUnit(s, 1, 'infantry', at.x + 3 + (i % 4) * 0.6, at.y + (i >> 2) * 0.6);
    run(s, 10);
    expect(s.ai[0].steppe?.band).toBeUndefined();
    expect(s.ai[0].steppe?.recalled).toBeDefined();
  });
});

describe('defence', () => {
  it('a computer drained by standing riders sends its army against them', () => {
    const s = createGame({ seed: 11, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'mongols' }] });
    restat(s, s.players[1], () => {
      s.players[1].age = 'horde';
      s.players[1].epoch = 2;
      s.players[1].walked = ['steppe', 'horde'];
    });
    s.peaceUntil = secs(5000);
    const home = tcOf(s, 0);
    const foot: Unit[] = [];
    for (let i = 0; i < 8; i++) foot.push(spawnUnit(s, 0, 'infantry', home.x - 4 + (i % 4) * 0.6, home.y + 5 + (i >> 2) * 0.6));
    const dir = Math.sign(s.w / 2 - home.x) || 1;
    const riders: Unit[] = [];
    for (let i = 0; i < 3; i++) riders.push(spawnUnit(s, 1, 'cavalry', home.x + dir * 12 + i * 0.5, home.y + 0.5));
    expect(landOwnerAt(s, Math.floor(riders[0].x), Math.floor(riders[0].y))).toBe(0);
    run(s, 8);
    expect(foot.some((u) => u.order.k === 'move' || u.order.k === 'attack' || Math.hypot(u.x - riders[0].x, u.y - riders[0].y) < 10)).toBe(true);
  });
});
