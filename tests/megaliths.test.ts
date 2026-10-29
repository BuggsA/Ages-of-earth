import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, BUILDINGS, HENGE, MEGALITH, ROADS, SEASON, SHAFT, buildingCost, secs } from '../src/sim/data';
import { leadsOn, roadKnown, roadProblem } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { gathered, giftFor, inStone } from '../src/sim/henge';
import { bestSeam, groundAt } from '../src/sim/shafts';
import { shaftShare } from '../src/sim/shafts';
import { buildingCostFor } from '../src/sim/stats';
import { findSpot } from '../src/sim/ai';
import type { GameState, MapType } from '../src/sim/types';
import { R_STONE } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Deep Road's first age (#876 s1, #877): the Age of Megaliths off the Stone Age, a town in stone, Henges and the year's gathering. */

// A people that quarries (the Mongols quarry no stone, and the road is shut to them: tested below).
const make = (seed: number, mapType: MapType = 'continental') =>
  createGame({ seed, size: 'small', mapType, players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'romans' }] });
const enter = (s: GameState, o: number, age: 'megaliths' | 'bronze' | 'stone') => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec); i++) step(s);
};
const quiet = (s: GameState) => {
  s.peaceUntil = 1e9;
  s.animals = [];
  for (const p of s.players) p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
};

describe('the road (#877)', () => {
  it('is the Deep Road\'s tier 1, instead of the Bronze Age, with a verb, a door and a good line', () => {
    expect(AGES.megaliths.tier).toBe(AGES.bronze.tier);
    expect(AGES.megaliths.routes).toEqual(['deep']);
    expect(AGES.megaliths.verb && AGES.megaliths.door && AGES.megaliths.good).toBeTruthy();
    expect(AGES.megaliths.keepsake?.building).toBe('henge');
    expect(leadsOn('megaliths').map((r) => r.to)).toContain('middle');
    expect(ROADS.some((r) => r.from === 'megaliths' && r.to === 'bronze')).toBe(true);
  });

  it('is seen on every map once the first House (or a Storehouse) stands, with no ore, deed or coast', () => {
    const road = ROADS.find((r) => r.from === 'stone' && r.to === 'megaliths')!;
    expect(road.clue).toBe('house');
    expect(road.clueAlt).toBe('storehouse');
    expect(road.deed ?? road.found ?? road.ruin ?? road.coast ?? road.vein ?? road.ore ?? road.walked ?? road.crossing).toBeUndefined();
    for (const map of ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'] as MapType[]) {
      const s = make(5, map);
      const p = s.players[0];
      expect(roadKnown(s, p, road), map).toBe(false);
      const spot = findSpot(s, 'house', p.startX, p.startY, 4, 14, 1, (tx, ty) => !placeProblem(s, 'house', tx, ty, true, 0))!;
      placeBuilding(s, 0, 'house', spot.tx, spot.ty, true);
      expect(roadKnown(s, p, road), map).toBe(true);
      expect(roadProblem(s, p, road), map).toBeNull();
    }
  });

  it('is shut to a people that quarries no stone (the Mongols), with the reason on its button', () => {
    const s = createGame({ seed: 2, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null, civ: 'mongols' }, { name: 'B', ai: null }] });
    const road = ROADS.find((r) => r.from === 'stone' && r.to === 'megaliths')!;
    const p = s.players[0];
    const spot = findSpot(s, 'house', p.startX, p.startY, 4, 14, 1, (tx, ty) => !placeProblem(s, 'house', tx, ty, true, 0))!;
    placeBuilding(s, 0, 'house', spot.tx, spot.ty, true);
    expect(roadProblem(s, p, road)).toMatch(/quarries no stone/);
  });

  it('is paid in food and stone a fresh town can gather at home', () => {
    const road = ROADS.find((r) => r.from === 'stone' && r.to === 'megaliths')!;
    expect(road.cost.wood ?? 0).toBe(0);
    expect(road.cost.gold ?? 0).toBe(0);
    expect(road.cost.stone).toBeLessThanOrEqual(createGame({ seed: 1, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }] }).players[0].res.stone);
  });
});

describe('building in stone', () => {
  it('pays every building\'s timber in stone, but for the few that must be wood', () => {
    const s = make(1);
    enter(s, 0, 'megaliths');
    const house = buildingCostFor(s, 0, 'house');
    expect(house.wood ?? 0).toBe(0);
    expect(house.stone).toBe(Math.round((buildingCost('house', 1).wood ?? 0) * MEGALITH.stone));
    for (const t of MEGALITH.timber) expect(buildingCostFor(s, 0, t), t).toEqual(buildingCost(t, 1));
    // A Mine Shaft stays timber, so a people with no stone left can always sink one.
    expect(buildingCostFor(s, 0, 'shaft').stone ?? 0).toBe(0);
    // A rival in the Bronze Age pays timber as ever.
    enter(s, 1, 'bronze');
    expect(buildingCostFor(s, 1, 'house')).toEqual(buildingCost('house', 1));
  });

  it('keeps what a building costs besides its timber', () => {
    expect(inStone('towncenter', { wood: 275, stone: 150 })).toEqual({ stone: 150 + Math.round(275 * MEGALITH.stone) });
    expect(inStone('market', { wood: 100, gold: 20 })).toEqual({ stone: Math.round(100 * MEGALITH.stone), gold: 20 });
  });
});

describe('stone never runs short (the owner, 2026-10-29: "make sure to not make the resources impossible to get")', () => {
  it('lays open stone by every town on every map, more than the road and a Henge ask', () => {
    const road = ROADS.find((r) => r.from === 'stone' && r.to === 'megaliths')!;
    for (const map of ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'] as MapType[]) {
      for (const seed of [1, 7, 23]) {
        const s = createGame({ seed, size: 'small', mapType: map, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }, { name: 'C', ai: null }, { name: 'D', ai: null }] });
        for (const p of s.players) {
          let near = 0;
          for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.res[y * s.w + x] === R_STONE && (x - p.startX) ** 2 + (y - p.startY) ** 2 <= 15 * 15) near += s.amount[y * s.w + x];
          expect(near + p.res.stone, `${map} ${seed} ${p.id}`).toBeGreaterThanOrEqual((road.cost.stone ?? 0) + (BUILDINGS.henge.cost.stone ?? 0) * 3);
        }
      }
    }
  });

  it('digs stone from plain earth at a good grade in the age, so a town whose quarries ran dry sinks a shaft anywhere', () => {
    for (const map of ['continental', 'plains', 'sea', 'forest'] as MapType[]) {
      const s = make(3, map);
      enter(s, 0, 'megaliths');
      const p = s.players[0];
      const spot = findSpot(s, 'shaft', p.startX, p.startY, 4, 14, 1, (tx, ty) => !placeProblem(s, 'shaft', tx, ty, true, 0))!;
      expect(spot, map).toBeTruthy();
      const b = placeBuilding(s, 0, 'shaft', spot.tx, spot.ty, true);
      expect(shaftShare(s, b, 'stone'), map).toBeGreaterThanOrEqual(MEGALITH.grade);
      // A new shaft starts on stone in the age, where elsewhere a tie goes to gold.
      const g = groundAt(s, b);
      if (g.stone === g.gold) expect(bestSeam(s, b), map).toBe('stone');
      expect(MEGALITH.grade).toBeGreaterThan(SHAFT.grade.open);
      enter(s, 0, 'bronze');
      expect(shaftShare(s, b, 'stone')).toBeLessThan(MEGALITH.grade);
    }
  });
});

describe('Henges (#877)', () => {
  function hengeTown(seed = 2) {
    const s = make(seed);
    quiet(s);
    enter(s, 0, 'megaliths');
    const p = s.players[0];
    const spot = findSpot(s, 'henge', p.startX, p.startY, 5, 14, 1, (tx, ty) => !placeProblem(s, 'henge', tx, ty, true, 0))!;
    const b = placeBuilding(s, 0, 'henge', spot.tx, spot.ty, true);
    return { s, p, b };
  }

  it('are raised only in the Age of Megaliths, from stone', () => {
    expect(BUILDINGS.henge.ages).toEqual(['megaliths']);
    expect(Object.keys(BUILDINGS.henge.cost)).toEqual(['stone']);
  });

  it('hold the ground: a rival raises nothing in the ring, not even a Tower or a War Camp', () => {
    const { s, b } = hengeTown();
    const cx = b.tx + 1, cy = b.ty + 4;
    expect(placeProblem(s, 'tower', cx, cy, true, 1)).toBe('hallowed');
    expect(placeProblem(s, 'warcamp', cx, cy, true, 1)).toBe('hallowed');
    // Its own people builds there freely.
    expect(placeProblem(s, 'tower', cx, cy, true, 0)).not.toBe('hallowed');
    // Fallen, it holds nothing.
    b.hp = 0;
    expect(placeProblem(s, 'tower', cx, cy, true, 1)).not.toBe('hallowed');
  });

  it('gather the people at each turn of the year: food and gold for every citizen standing in the ring, twice at a solstice', () => {
    const { s, p, b } = hengeTown();
    for (const e of s.ents) if (e.kind === 'unit' && e.owner === 0) e.hp = 0;
    s.ents = s.ents.filter((e) => e.hp > 0);
    for (let i = 0; i < 5; i++) spawnUnit(s, 0, 'citizen', b.x + 0.5 + (i % 3) * 0.6, b.y + 2.4);
    // One far off, out of the ring.
    spawnUnit(s, 0, 'citizen', b.x + HENGE.reach + 6, b.y);
    expect(gathered(s, b)).toBe(5);
    const before = { ...p.res };
    // The year turns into summer at the first season's end: a solstice.
    while (s.tick <= secs(SEASON.len)) step(s);
    const gift = giftFor(5, 1);
    expect(gift.food).toBe((HENGE.gift.food ?? 0) * 5 * HENGE.solstice);
    expect(p.res.gold - before.gold).toBe(gift.gold);
    expect(p.stats.gathering).toBe((gift.food ?? 0) + (gift.gold ?? 0));
    // Autumn is no solstice: the plain gift.
    expect(giftFor(5, 2).gold).toBe((HENGE.gift.gold ?? 0) * 5);
  });

  it('counts at most `HENGE.most` citizens, and none who shelter inside', () => {
    const { s, b } = hengeTown();
    for (let i = 0; i < HENGE.most + 5; i++) spawnUnit(s, 0, 'citizen', b.x + (i % 4) * 0.5 - 1, b.y + 2 + Math.floor(i / 4) * 0.4);
    expect(gathered(s, b)).toBe(HENGE.most);
  });

  it('sleep once the people leaves the age, but for the one kept', () => {
    const { s, p, b } = hengeTown();
    for (let i = 0; i < 4; i++) spawnUnit(s, 0, 'citizen', b.x, b.y + 2.2);
    enter(s, 0, 'bronze');
    const gold = p.res.gold;
    while (s.tick <= secs(SEASON.len)) step(s);
    expect(p.res.gold).toBe(gold);
    b.keep = 'megaliths';
    const kept = p.res.gold;
    while (s.tick <= secs(SEASON.len) * 2) step(s);
    expect(p.res.gold).toBeGreaterThan(kept);
  });

  it('can be ordered built by a citizen, paid in stone', () => {
    const s = make(4);
    quiet(s);
    enter(s, 0, 'megaliths');
    const p = s.players[0];
    const spot = findSpot(s, 'henge', p.startX, p.startY, 5, 14, 1, (tx, ty) => !placeProblem(s, 'henge', tx, ty, true, 0))!;
    const worker = s.ents.find((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
    const stone = p.res.stone;
    applyCommand(s, { t: 'build', p: 0, ids: [worker.id], type: 'henge', tx: spot.tx, ty: spot.ty });
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'henge' && e.owner === 0)).toBe(true);
    expect(stone - p.res.stone).toBe(BUILDINGS.henge.cost.stone);
    run(s, 1);
  });
});
