import { describe, expect, it } from 'vitest';
import { ageOf, barred, pathAges, pathCarry, pathDepth, pathOf, pathRoads, roadKnown, roadProblem, roadTo } from '../src/sim/ages';
import { AGES, PATHS, ROADS, TRUNK, secs } from '../src/sim/data';
import { hurt } from '../src/sim/combat';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf, statsFor } from '../src/sim/stats';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Paths (#299): side ages chained across tiers. The first, the Path of Blood, opens with the Age of the Warband. */

const road = ROADS.find((r) => r.to === 'warband')!;
const game = (): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.players[0].epoch = 2;
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  return s;
};
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const raise = (s: GameState, type: 'barracks') => {
  const p = s.players[0];
  for (let r = 4; r < 20; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const tx = Math.round(p.startX) + dx;
        const ty = Math.round(p.startY) + dy;
        if (!placeProblem(s, type, tx, ty)) return placeBuilding(s, 0, type, tx, ty, true);
      }
  throw new Error('no room');
};
const enter = (s: GameState) => {
  raise(s, 'barracks');
  s.players[0].stats.slain = road.deed!.n;
  step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'warband' }]);
  for (let i = 0; i < secs(road.time) + 2; i++) step(s);
};
/** An enemy spearman slain by player 0, far from both towns. */
const slay = (s: GameState) => {
  const foe = spawnUnit(s, 1, 'infantry', s.players[1].startX, s.players[1].startY);
  hurt(s, foe, foe.hp + 100, 0, null);
  return foe;
};

describe('paths', () => {
  it('every path age names a known path, and a path is a chain of side ages, one per tier', () => {
    for (const id of Object.keys(AGES) as AgeId[]) {
      const path = AGES[id].path;
      if (!path) continue;
      expect(PATHS[path], id).toBeDefined();
      expect(TRUNK.includes(id), id).toBe(false);
    }
    for (const path of Object.keys(PATHS) as (keyof typeof PATHS)[]) {
      const tiers = pathAges(path).map((a) => AGES[a].tier);
      expect(tiers.length).toBeGreaterThan(0);
      expect(new Set(tiers).size).toBe(tiers.length);
    }
  });

  it('trunk and other side ages are on no path', () => {
    expect(pathOf('middle')).toBeUndefined();
    expect(pathOf('merchant')).toBeUndefined();
    expect(pathOf('warband')).toBe('blood');
    const s = game();
    expect(pathDepth(s.players[0])).toBe(0);
    expect(pathCarry(s.players[0])).toBeNull();
    expect(pathRoads(s.players[0])).toEqual([]);
  });
});

describe('the Age of the Warband', () => {
  it('turns off the Middle Ages with a Barracks for its clue and the enemy dead for its deed', () => {
    expect(road.from).toBe('middle');
    expect(AGES.warband.tier).toBe(2);
    expect(road.clue).toBe('barracks');
    expect(road.deed!.stat).toBe('slain');
    expect(ROADS.filter((r) => r.from === 'warband').map((r) => r.to).sort()).toEqual(['gunpowder', 'middle']);
  });

  it('stays hidden without a Barracks, then waits on the slain', () => {
    const s = game();
    const p = s.players[0];
    expect(roadKnown(s, p, road)).toBe(false);
    raise(s, 'barracks');
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadProblem(s, p, road)).toContain(`0/${road.deed!.n}`);
    p.stats.slain = road.deed!.n;
    expect(roadProblem(s, p, road)).toBeNull();
  });

  it('counts enemy units slain, not buildings, and pays no plunder off the path', () => {
    const s = game();
    const gold = s.players[0].res.gold;
    slay(s);
    expect(s.players[0].stats.slain).toBe(1);
    expect(s.players[0].res.gold).toBe(gold);
    expect(s.players[0].stats.plunder ?? 0).toBe(0);
  });

  it('turns a people to war: faster soldiers, plunder from the dead, no traders, thinner fields', () => {
    const s = game();
    const p = s.players[0];
    const time0 = statsFor(s, 0, 'infantry').time;
    enter(s);
    expect(ageOf(p)).toBe('warband');
    expect(p.epoch).toBe(2);
    expect(pathDepth(p)).toBe(1);
    expect(pathCarry(p)).toBeNull();
    expect(barred(p, 'trader')).toContain('warband');
    expect(barred(p, 'cavalry')).toBeNull();
    expect(statsFor(s, 0, 'infantry').time).toBeLessThan(time0);
    expect(modsOf(s, 0).farm).toBeLessThan(1);
    expect(roadTo(p)!.to).toBe('gunpowder');

    const gold = p.res.gold;
    const foe = slay(s);
    const c = statsFor(s, 1, foe.type).cost;
    const want = Math.floor(((c.food ?? 0) + (c.wood ?? 0) + (c.gold ?? 0) + (c.stone ?? 0)) * AGES.warband.add!.plunder!);
    expect(want).toBeGreaterThan(0);
    expect(p.res.gold).toBe(gold + want);
    expect(p.stats.plunder).toBe(want);
    expect(s.events.some((e) => e.k === 'plunder' && e.owner === 0 && e.gold === want)).toBe(true);
  });

  it('never plunders its own dead', () => {
    const s = game();
    enter(s);
    const p = s.players[0];
    const gold = p.res.gold;
    const own = spawnUnit(s, 0, 'infantry', p.startX, p.startY);
    hurt(s, own, own.hp + 100, 0, null);
    expect(p.res.gold).toBe(gold);
  });

  it('survives a save', () => {
    const s = game();
    enter(s);
    slay(s);
    const t = deserialize(serialize(s));
    expect(ageOf(t.players[0])).toBe('warband');
    expect(t.players[0].stats.plunder).toBe(s.players[0].stats.plunder);
    expect(pathDepth(t.players[0])).toBe(1);
  });

  it('the way back to the Middle Ages ends the plunder', () => {
    const s = game();
    enter(s);
    const back = ROADS.find((r) => r.from === 'warband' && r.to === 'middle')!;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'middle' }]);
    for (let i = 0; i < secs(back.time) + 2; i++) step(s);
    expect(ageOf(s.players[0])).toBe('middle');
    expect(modsOf(s, 0).plunder).toBe(0);
    expect(barred(s.players[0], 'trader')).toBeNull();
  });
});
