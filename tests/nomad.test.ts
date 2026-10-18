import { describe, expect, it } from 'vitest';
import { buildBarred } from '../src/sim/ages';
import { landOwnerAt } from '../src/sim/borders';
import { CIVS, FLOCK, NOMAD, VERB_GAPS, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { addSheep, flockCap, flockOf } from '../src/sim/flocks';
import { createGame, step } from '../src/sim/game';
import { mineable } from '../src/sim/household';
import { isNomad } from '../src/sim/nomad';
import { isMobile } from '../src/sim/steppe';
import { modsOf } from '../src/sim/stats';
import { findResource } from '../src/sim/units';
import { restat, spawnUnit } from '../src/sim/world';
import { R_GOLD, R_STONE, R_TREE } from '../src/sim/types';
import type { Building, GameState, Unit } from '../src/sim/types';

// Born on the move (#501, the Mongols): the camp rolls on wagons from the first minute, the flock is the farm, riders take tribute.
const game = (rival: 'romans' | 'mongols' = 'romans') => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'mongols' }, { name: 'B', ai: null, civ: rival }] });
const tcOf = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const sheep = (s: GameState, owner = 0) => s.animals.filter((a) => a.kind === 'sheep' && a.owner === owner && a.hp > 0);
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const citizen = (s: GameState, owner = 0) => s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'citizen')!;

describe('born on the move', () => {
  it('has a verb and a door, and is no longer a gap in the verbs rubric', () => {
    expect(CIVS.mongols.nomad).toBe(true);
    expect(CIVS.mongols.verb).toBeTruthy();
    expect(CIVS.mongols.door).toBeTruthy();
    expect(VERB_GAPS.civs.mongols).toBeUndefined();
  });

  it('starts on wagons in the Stone Age, with its flock about the camp, and no one else does', () => {
    const s = game();
    expect(s.players[0].epoch).toBe(0);
    expect(isNomad(s.players[0])).toBe(true);
    expect(isMobile(s.players[0])).toBe(true);
    expect(isMobile(s.players[1])).toBe(false);
    expect(sheep(s, 0).length).toBe(NOMAD.start);
    expect(sheep(s, 1).length).toBe(0);
    expect(flockCap(s, 0)).toBe(NOMAD.cap);
  });

  it('packs the Town Center onto a wagon in the first minute and pitches it again elsewhere', () => {
    const s = game();
    const tc = tcOf(s);
    step(s, [{ t: 'pack', p: 0, building: tc.id }]);
    const wagon = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'wagon');
    expect(wagon?.packed).toBe('towncenter');
    expect(s.byId.has(tc.id)).toBe(false);
    step(s, [{ t: 'move', p: 0, ids: [wagon!.id], x: wagon!.x + 6, y: wagon!.y }]);
    run(s, 15);
    step(s, [{ t: 'pitch', p: 0, ids: [wagon!.id] }]);
    const camp = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter');
    expect(camp).toBeTruthy();
    expect(camp!.x).toBeGreaterThan(tc.x + 3);
  });

  it('tills no fields and raises no walls or gates, ever', () => {
    const s = game();
    for (const type of ['farm', 'wall', 'gate'] as const) expect(buildBarred(s.players[0], type), type).toBeTruthy();
    for (const type of ['farm', 'wall', 'gate'] as const) expect(buildBarred(s.players[1], type) ?? '', type).not.toContain('born on the move');
    const tc = tcOf(s);
    s.players[0].res.wood = 500;
    applyCommand(s, { t: 'build', p: 0, ids: [citizen(s).id], type: 'farm', tx: Math.floor(tc.x) + 5, ty: Math.floor(tc.y) + 5 });
    expect(s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'farm')).toBe(false);
  });

  it('digs no stone or gold, and a citizen sent to a seam stays idle; timber is fine', () => {
    const s = game();
    const tc = tcOf(s);
    expect(mineable(s.players[0], R_STONE)).toBe(false);
    expect(mineable(s.players[0], R_GOLD)).toBe(false);
    expect(mineable(s.players[0], R_TREE)).toBe(true);
    expect(mineable(s.players[1], R_STONE)).toBe(true);
    const stone = findResource(s, R_STONE, tc.x, tc.y, 60);
    expect(stone).toBeGreaterThanOrEqual(0);
    const c = citizen(s);
    applyCommand(s, { t: 'gather', p: 0, ids: [c.id], tile: stone });
    expect(c.order.k).not.toBe('gather');
    const tree = findResource(s, R_TREE, tc.x, tc.y, 60);
    applyCommand(s, { t: 'gather', p: 0, ids: [c.id], tile: tree });
    expect(c.order.k).toBe('gather');
  });
});

describe('the flock is the farm', () => {
  it('fills an udder faster than anyone else\'s flock, and holds more sheep for each Town Center', () => {
    const s = game();
    const tc = tcOf(s);
    s.animals = [];
    const ewe = addSheep(s, 0, tc.x + 4.5, tc.y + 0.5, false);
    const other = addSheep(s, 1, tcOf(s, 1).x + 4.5, tcOf(s, 1).y + 0.5, false);
    // The rival is a steppe people too for the length of the test, so its sheep graze alike.
    restat(s, s.players[1], () => { s.players[1].age = 'steppe'; s.players[1].epoch = 1; });
    run(s, FLOCK.bite * 3);
    expect(ewe.milk ?? 0).toBeGreaterThan((other.milk ?? 0) * 2);
    expect(NOMAD.cap).toBeGreaterThan(FLOCK.cap);
    for (let i = 0; i < NOMAD.cap; i++) addSheep(s, 0, tc.x + 3 + (i % 4), tc.y + 4 + (i >> 2), false);
    s.players[0].res.food = 999;
    step(s, [{ t: 'lamb', p: 0, building: tc.id }]);
    expect(flockOf(s, 0)).toBe(NOMAD.cap + 1);
  });
});

describe('tribute in gold and stone', () => {
  /** A rider of player 0 in player 1's land, out of its Town Center's arrows, the rival's people gone. */
  function rider(s: GameState): Unit {
    s.ents = s.ents.filter((e) => e.kind !== 'unit' || e.owner !== 1);
    for (const [id, e] of s.byId) if (e.kind === 'unit' && e.owner === 1) s.byId.delete(id);
    const home = tcOf(s, 1);
    const dir = Math.sign(s.w / 2 - home.x) || 1;
    const u = spawnUnit(s, 0, 'cavalry', home.x + dir * 11, home.y + 0.5);
    expect(landOwnerAt(s, Math.floor(u.x), Math.floor(u.y))).toBe(1);
    return u;
  }
  const bronze = (s: GameState) => restat(s, s.players[0], () => { s.players[0].epoch = 1; });

  it('takes both from a rival\'s stores, from the Bronze Age, with no Horde to climb to', () => {
    const s = game();
    bronze(s);
    rider(s);
    const p = s.players[0], q = s.players[1];
    p.res.gold = 0;
    p.res.stone = 0;
    q.res.gold = 500;
    q.res.stone = 500;
    run(s, 10);
    const rate = modsOf(s, 0).tribute;
    expect(rate).toBeGreaterThan(0);
    expect(p.res.gold).toBeGreaterThan(rate * 8);
    expect(p.res.stone).toBeGreaterThan(rate * NOMAD.stone * 8);
    expect(q.res.gold).toBeCloseTo(500 - p.res.gold, 6);
    expect(q.res.stone).toBeCloseTo(500 - p.res.stone, 6);
  });

  it('pays in stone alone when the rival\'s gold is spent, and takes no more than it holds', () => {
    const s = game('mongols');
    bronze(s);
    rider(s);
    const p = s.players[0], q = s.players[1];
    p.res.stone = 0;
    p.res.gold = 0;
    q.res.gold = 0;
    q.res.stone = 0.3;
    run(s, 10);
    expect(p.res.gold).toBe(0);
    expect(p.res.stone).toBeCloseTo(0.3, 6);
    expect(q.res.stone).toBeCloseTo(0, 6);
  });

  it('is taken by no one before the first Stable (no riders) and is not taken in the Silk Road\'s peace', () => {
    const s = game();
    const p = s.players[0];
    rider(s);
    p.res.gold = 0;
    s.players[1].res.gold = 500;
    restat(s, p, () => { p.age = 'silk'; p.epoch = 3; p.walked = ['steppe', 'horde', 'silk']; });
    run(s, 5);
    expect(p.res.gold).toBe(0);
  });
});
