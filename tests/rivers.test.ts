import { describe, expect, it } from 'vitest';
import { applyCommand, wallLine } from '../src/sim/commands';
import { AGES, AI_RIVERS, RIVERS, ROADS, SPRING, secs } from '../src/sim/data';
import { buildBarred, leadsOn, roadKnown, roadProblem } from '../src/sim/ages';
import { checksum, createGame, step } from '../src/sim/game';
import { NAVAL, placeProblem, walkable } from '../src/sim/grid';
import { channelPlan, coastHeld, fieldBoost, isChannel, isSpring, wading } from '../src/sim/water';
import { generateMap } from '../src/sim/mapgen';
import type { GameState, MapType } from '../src/sim/types';
import { T_WATER } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Water Road's first age (#701 s1): the Age of Rivers off the Stone Age, channels dug from any water, fields along them. */

const make = (seed: number, mapType: MapType = 'continental', ai: 'hard' | null = null) =>
  createGame({ seed, size: 'small', mapType, players: [{ name: 'A', ai }, { name: 'B', ai: null }] });
const enter = (s: GameState, o: number, age: 'rivers' | 'bronze') => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};
const fits = (s: GameState) => (x: number, y: number) => !placeProblem(s, 'channel', x, y);
/** A town in the Age of Rivers, with the channel it would dig from the water nearest home. */
function riverTown(seed = 1) {
  const s = make(seed);
  s.peaceUntil = 1e9;
  s.animals = [];
  const p = s.players[0];
  enter(s, 0, 'rivers');
  p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
  const plan = channelPlan(s, p.startX, p.startY, AI_RIVERS, wallLine, fits(s))!;
  return { s, p, plan };
}
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec); i++) step(s);
};
const nearestWater = (s: GameState, x0: number, y0: number) => {
  let best = Infinity;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.terrain[y * s.w + x] === T_WATER || isSpring(s, y * s.w + x)) best = Math.min(best, Math.sqrt((x - x0) ** 2 + (y - y0) ** 2));
  return best;
};

describe('the road (#701 s1)', () => {
  it('is the Water Road\'s tier 1, instead of the Bronze Age, on the water route, with a verb, a door and a good line', () => {
    expect(AGES.rivers.tier).toBe(AGES.bronze.tier);
    expect(AGES.rivers.routes).toEqual(['water']);
    expect(AGES.dykes.routes).toEqual(['water']);
    expect(AGES.rivers.verb && AGES.rivers.door && AGES.rivers.good).toBeTruthy();
    const road = ROADS.find((r) => r.from === 'stone' && r.to === 'rivers')!;
    // Open on every map: a Farm shows it, and no deed, find or coast is waited on.
    expect(road.clue).toBe('farm');
    expect(road.deed ?? road.found ?? road.ruin ?? road.coast ?? road.vein).toBeUndefined();
    expect(leadsOn('rivers').map((r) => r.to)).toEqual(expect.arrayContaining(['dykes', 'middle']));
    expect(ROADS.some((r) => r.from === 'rivers' && r.to === 'bronze')).toBe(true);
  });

  it('runs on to the Age of Dykes with no coast door: the trunk is never shut, even far from the shallows', () => {
    const road = ROADS.find((r) => r.from === 'rivers' && r.to === 'dykes')!;
    expect(road.coast).toBeUndefined();
    const s = make(1, 'highlands');
    const p = s.players.find((q) => !coastHeld(s, q)) ?? s.players[0];
    enter(s, p.id, 'rivers');
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadProblem(s, p, road)).toBeNull();
  });

  it('is seen from the Stone Age once a Farm stands, on any map', () => {
    const s = make(3);
    const p = s.players[0];
    const road = ROADS.find((r) => r.from === 'stone' && r.to === 'rivers')!;
    expect(roadKnown(s, p, road)).toBe(false);
    for (let r = 3; r < 12; r++) {
      const tx = Math.floor(p.startX) + r;
      const ty = Math.floor(p.startY);
      if (placeProblem(s, 'farm', tx, ty)) continue;
      placeBuilding(s, 0, 'farm', tx, ty, true);
      break;
    }
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadProblem(s, p, road)).toBeNull();
  });
});

describe('a spring by every town (#701 s1)', () => {
  it('puts water, or a spring head, within reach of every start, on every kind of map', () => {
    for (const mapType of ['continental', 'highlands', 'lakes', 'sea'] as MapType[])
      for (const seed of [1, 2, 3, 4]) {
        const s = make(seed, mapType);
        for (const p of s.players) expect(nearestWater(s, p.startX, p.startY), `${mapType} ${seed}`).toBeLessThanOrEqual(SPRING.near + 0.5);
      }
  });

  it('is the same for the same seed, and changes no ground: the map is as it was without it', () => {
    expect(make(5).springs).toEqual(make(5).springs);
    const m = generateMap(5, 'small', 2);
    const bare = generateMap(5, 'small', 2, 'continental', false);
    expect(m.springs.length).toBeGreaterThan(0);
    // A campaign map (no deposits) lays no spring; the ground under a full match's springs is open land.
    expect(bare.springs).toEqual([]);
    for (const t of m.springs) expect(m.terrain[t]).not.toBe(T_WATER);
  });

  it('fills a channel dug beside it, and opens into it', () => {
    for (let seed = 1; seed < 20; seed++) {
      const s = make(seed);
      const p = s.players.find((q) => s.springs?.some((t) => Math.abs((t % s.w) - q.startX) < 16 && Math.abs(Math.floor(t / s.w) - q.startY) < 16));
      if (!p) continue;
      const spring = s.springs!.find((t) => Math.abs((t % s.w) - p.startX) < 16 && Math.abs(Math.floor(t / s.w) - p.startY) < 16)!;
      enter(s, p.id, 'rivers');
      const x = (spring % s.w) + 1;
      const y = Math.floor(spring / s.w);
      expect(placeProblem(s, 'channel', x - 1, y)).toBe('blocked');
      placeBuilding(s, p.id, 'channel', x, y, true);
      run(s, 1);
      expect(isChannel(s, y * s.w + x)).toBe(true);
      expect(s.terrain[spring]).toBe(T_WATER);
      expect(isSpring(s, spring)).toBe(false);
      return;
    }
    throw new Error('no spring');
  });
});

describe('channels (#701 s1)', () => {
  it('are dug only in the Age of Rivers', () => {
    const s = make(1);
    expect(buildBarred(s.players[0], 'channel')).toBeTruthy();
    enter(s, 0, 'rivers');
    expect(buildBarred(s.players[0], 'channel')).toBeNull();
  });

  it('fill from the water a tile at a time once dug, into water that is waded on foot and sailed by no ship', () => {
    const { s, plan } = riverTown();
    expect(plan.tiles.length).toBeGreaterThanOrEqual(3);
    for (const t of plan.tiles) placeBuilding(s, 0, 'channel', t % s.w, Math.floor(t / s.w), true);
    // The water runs one tile a fill: after the first, only the tile beside the water is wet.
    let k = 0;
    while (!isChannel(s, plan.tiles[0]) && k++ < secs(1)) step(s);
    expect(isChannel(s, plan.tiles[0])).toBe(true);
    expect(isChannel(s, plan.tiles[plan.tiles.length - 1])).toBe(false);
    run(s, plan.tiles.length * RIVERS.fill + 1);
    for (const t of plan.tiles) {
      const x = t % s.w;
      const y = Math.floor(t / s.w);
      expect(s.terrain[t]).toBe(T_WATER);
      expect(isChannel(s, t)).toBe(true);
      expect(s.bldAt[t]).toBe(0);
      expect(walkable(s, x, y)).toBe(true);
      expect(walkable(s, x, y, NAVAL)).toBe(false);
      expect(wading(s, x + 0.5, y + 0.5)).toBe(RIVERS.wade);
    }
    // A spring head the line was dug from opens with it, and counts.
    expect(s.players[0].stats.dug).toBeGreaterThanOrEqual(plan.tiles.length);
  });

  it('are laid by citizens with a drag, as a wall is, and dug at the price of each tile', () => {
    const { s, p, plan } = riverTown();
    const wood = p.res.wood;
    const crew = [0, 1, 2].map((i) => spawnUnit(s, 0, 'citizen', plan.from.x + 0.5 + i * 0.3, plan.from.y + 1.5).id);
    applyCommand(s, { t: 'wall', p: 0, ids: crew, x0: plan.from.x, y0: plan.from.y, x1: plan.to.x, y1: plan.to.y, channel: true });
    const sites = s.ents.filter((e) => e.kind === 'building' && e.type === 'channel');
    expect(sites.length).toBe(plan.tiles.length);
    expect(p.res.wood).toBeLessThan(wood);
    run(s, 120);
    expect(plan.tiles.filter((t) => isChannel(s, t)).length).toBeGreaterThan(0);
  });

  it('slow a soldier wading through them', () => {
    const { s, plan } = riverTown();
    for (const t of plan.tiles) placeBuilding(s, 0, 'channel', t % s.w, Math.floor(t / s.w), true);
    run(s, plan.tiles.length * RIVERS.fill + 1);
    const t = plan.tiles[1];
    const x = (t % s.w) + 0.5;
    const y = Math.floor(t / s.w) + 0.5;
    expect(wading(s, x, y)).toBeLessThan(1);
    expect(wading(s, s.players[0].startX, s.players[0].startY)).toBe(1);
  });

  it('keep the match deterministic', () => {
    const a = riverTown(2);
    const b = riverTown(2);
    for (const r of [a, b]) for (const t of r.plan.tiles) placeBuilding(r.s, 0, 'channel', t % r.s.w, Math.floor(t / r.s.w), true);
    run(a.s, 10);
    run(b.s, 10);
    expect(checksum(a.s)).toBe(checksum(b.s));
  });
});

describe('fields by water (#701 s1)', () => {
  /** A farm spot with water within reach, and one far from any. */
  function spots(s: GameState) {
    let wet: { tx: number; ty: number } | null = null;
    let dry: { tx: number; ty: number } | null = null;
    const p = s.players[0];
    for (let r = 3; r < 20 && (!wet || !dry); r++)
      for (let ty = Math.floor(p.startY) - r; ty <= p.startY + r; ty++)
        for (let tx = Math.floor(p.startX) - r; tx <= p.startX + r; tx++) {
          if (placeProblem(s, 'farm', tx, ty)) continue;
          const near = nearestWater(s, tx + 1.5, ty + 1.5);
          if (!wet && near <= 2.5) wet = { tx, ty };
          if (!dry && near > 6) dry = { tx, ty };
        }
    return { wet: wet!, dry: dry! };
  }

  it('in the Age of Rivers, no Farm is laid away from water, and a watered one works faster', () => {
    const { s } = riverTown();
    const { wet, dry } = spots(s);
    expect(placeProblem(s, 'farm', dry.tx, dry.ty, true, 0)).toBe('parched');
    expect(placeProblem(s, 'farm', wet.tx, wet.ty, true, 0)).toBeNull();
    const f = placeBuilding(s, 0, 'farm', wet.tx, wet.ty, true);
    expect(fieldBoost(s, f)).toBe(RIVERS.farm);
    // In the Bronze Age a field goes anywhere, and water by it is no matter.
    enter(s, 0, 'bronze');
    expect(placeProblem(s, 'farm', dry.tx, dry.ty, true, 0)).toBeNull();
    expect(fieldBoost(s, f)).toBe(1);
  });

  it('a channel being dug counts as the water it will be, so the fields can follow the line', () => {
    const { s, plan } = riverTown();
    const end = plan.tiles[plan.tiles.length - 1];
    const ex = end % s.w;
    const ey = Math.floor(end / s.w);
    let spot: { tx: number; ty: number } | null = null;
    for (let ty = ey - 4; ty <= ey + 2 && !spot; ty++) for (let tx = ex - 4; tx <= ex + 2; tx++) if (!placeProblem(s, 'farm', tx, ty) && nearestWater(s, tx + 1.5, ty + 1.5) > 4) spot = { tx, ty };
    if (!spot) return;
    for (const t of plan.tiles) placeBuilding(s, 0, 'channel', t % s.w, Math.floor(t / s.w), false);
    expect(placeProblem(s, 'farm', spot.tx, spot.ty, true, 0)).toBeNull();
  });
});
