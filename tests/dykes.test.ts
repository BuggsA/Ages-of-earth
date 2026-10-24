import { describe, expect, it } from 'vitest';
import { applyCommand, wallLine } from '../src/sim/commands';
import { AGES, AI_DYKE, BUILDINGS, DT, POLDER, ROADS, secs } from '../src/sim/data';
import { gatherRate } from '../src/sim/units';
import { ageDef, buildBarred, roadKnown, roadProblem } from '../src/sim/ages';
import { findDockSpot } from '../src/sim/ai';
import { checksum, createGame, step } from '../src/sim/game';
import { NAVAL, placeProblem, walkable } from '../src/sim/grid';
import { findRoute } from '../src/sim/path';
import { basinOf, coastHeld, dykePlan, isPolder, millIdle, polderField, shallow, type DykePlan } from '../src/sim/water';
import type { Building, GameState, MapType } from '../src/sim/types';
import { B_TERRAIN, T_GRASS, T_WATER } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Water Road's first step (#701 s1): dykes on the shallows, windmills that pump the water out, polder where the sea was. */

const road = ROADS.find((r) => r.from === 'middle' && r.to === 'dykes')!;
const make = (seed: number, mapType: MapType) =>
  createGame({ seed, size: 'medium', mapType, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }, { name: 'C', ai: null }] });
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) step(s);
};
const enter = (s: GameState, o: number, age: 'dykes' | 'middle') => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};

/** A people's plan on a lakes map: a lake to pump as it is (`lake`), or a bay a dyke line shuts off. */
function planned(lake: boolean): { s: GameState; o: number; plan: DykePlan } {
  for (let seed = 1; seed < 30; seed++) {
    const s = make(seed, 'lakes');
    for (const p of s.players) {
      const plan = dykePlan(s, p.startX, p.startY, AI_DYKE.reach, AI_DYKE, wallLine);
      if (plan && (plan.line.length === 0) === lake) {
        s.peaceUntil = 1e9;
        s.animals = [];
        enter(s, p.id, 'dykes');
        p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
        return { s, o: p.id, plan };
      }
    }
  }
  throw new Error('no such map');
}

/** A spot for a windmill whose pull reaches this basin. */
function millSpot(s: GameState, o: number, basin: number[]): { tx: number; ty: number } {
  const first = basin[0];
  const bx = first % s.w;
  const by = Math.floor(first / s.w);
  for (let r = 1; r < 12; r++)
    for (let ty = by - r; ty <= by + r; ty++)
      for (let tx = bx - r; tx <= bx + r; tx++) {
        if (placeProblem(s, 'windmill', tx, ty, true, o)) continue;
        const got = basinOf(s, { tx, ty, size: 2 });
        if (got.length && got.includes(first)) return { tx, ty };
      }
  throw new Error('no mill spot');
}

const dykeUp = (s: GameState, o: number, plan: DykePlan) => {
  for (const t of plan.line) placeBuilding(s, o, 'dyke', t % s.w, Math.floor(t / s.w), true);
};

describe('the road (#701 s1)', () => {
  it('is a turn off the Middle Ages at its tier, with a verb, a door and a coast door', () => {
    expect(AGES.dykes.tier).toBe(AGES.middle.tier);
    expect(AGES.dykes.verb && AGES.dykes.door && AGES.dykes.good).toBeTruthy();
    expect(road.coast).toBeTruthy();
    expect(ROADS.some((r) => r.from === 'dykes' && r.to === 'middle')).toBe(true);
    expect(ROADS.some((r) => r.from === 'dykes' && r.to === 'gunpowder')).toBe(true);
  });

  it('is seen once a Dock stands, and shut by the coast: open by a lake, closed on dry highland', () => {
    const wet = make(1, 'lakes');
    const p = wet.players.find((q) => coastHeld(wet, q))!;
    enter(wet, p.id, 'middle');
    expect(roadKnown(wet, p, road)).toBe(false);
    const dock = findDockSpot(wet, p.startX, p.startY, 30)!;
    placeBuilding(wet, p.id, 'dock', dock.tx, dock.ty, true);
    expect(roadKnown(wet, p, road)).toBe(true);
    expect(roadProblem(wet, p, road)).toBeNull();
    const dry = make(1, 'highlands');
    const q = dry.players.find((x) => !coastHeld(dry, x))!;
    enter(dry, q.id, 'middle');
    placeBuilding(dry, q.id, 'dock', 2, 2, true);
    expect(roadProblem(dry, q, road)).toBe(road.coast);
  });

  it('shuts stone walls and gates, and only the Age of Dykes raises dykes and windmills', () => {
    const { s, o } = planned(false);
    const p = s.players[o];
    expect(buildBarred(p, 'wall')).toMatch(/dykes are its walls/);
    expect(buildBarred(p, 'gate')).toBeTruthy();
    expect(buildBarred(p, 'dyke')).toBeNull();
    expect(buildBarred(p, 'windmill')).toBeNull();
    enter(s, o, 'middle');
    expect(buildBarred(p, 'dyke')).toMatch(/Age of Dykes/);
  });
});

describe('dykes', () => {
  it('stand on shallow water or the shore beside it, never deep water or dry land', () => {
    const { s, o, plan } = planned(false);
    const t = plan.line[0];
    expect(placeProblem(s, 'dyke', t % s.w, Math.floor(t / s.w), true, o)).toBeNull();
    let deep = -1;
    let dry = -1;
    for (let i = s.w; i < s.w * (s.h - 1) && (deep < 0 || dry < 0); i++) {
      const x = i % s.w;
      if (x < 2 || x > s.w - 3) continue;
      if (deep < 0 && s.terrain[i] === T_WATER && !shallow(s, i)) deep = i;
      if (dry < 0 && s.terrain[i] === T_GRASS && s.res[i] === 0) {
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (s.terrain[i + dy * s.w + dx] === T_WATER) near = true;
        if (!near) dry = i;
      }
    }
    expect(placeProblem(s, 'dyke', deep % s.w, Math.floor(deep / s.w))).toBe('deep');
    expect(placeProblem(s, 'dyke', dry % s.w, Math.floor(dry / s.w))).toBe('dry');
  });

  it('a finished dyke is walked by its own people and passed by no rival or ship; gone, it is water again', () => {
    const { s, o, plan } = planned(false);
    const t = plan.line[0];
    const x = t % s.w;
    const y = Math.floor(t / s.w);
    expect(walkable(s, x, y, NAVAL)).toBe(true);
    const site = placeBuilding(s, o, 'dyke', x, y, false);
    const team = s.players[o].team;
    const rival = s.players.find((p) => p.team !== team)!.team;
    expect(walkable(s, x, y, team)).toBe(false);
    expect(walkable(s, x, y, NAVAL)).toBe(false);
    site.hp = 0;
    run(s, 0.1);
    const b = placeBuilding(s, o, 'dyke', x, y, true);
    expect(walkable(s, x, y, team)).toBe(true);
    expect(walkable(s, x, y, rival)).toBe(false);
    expect(walkable(s, x, y, NAVAL)).toBe(false);
    b.hp = 0;
    run(s, 0.1);
    expect(s.block[t]).toBe(B_TERRAIN);
    expect(walkable(s, x, y, NAVAL)).toBe(true);
    expect(walkable(s, x, y, team)).toBe(false);
  });

  it('are dragged out in a line, like a wall, onto the water', () => {
    const { s, o, plan } = planned(false);
    const crew = [0, 1, 2].map(() => spawnUnit(s, o, 'citizen', plan.from.x + 0.5, plan.from.y + 0.5));
    applyCommand(s, { t: 'wall', p: o, ids: crew.map((u) => u.id), x0: plan.from.x, y0: plan.from.y, x1: plan.to.x, y1: plan.to.y, dyke: true });
    const sites = s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'dyke');
    for (const t of plan.line) expect(sites.some((b) => b.tx === t % s.w && b.ty === Math.floor(t / s.w))).toBe(true);
    // The crew walk out along the finished crown to raise the far end.
    run(s, 150);
    const left = sites.filter((b) => !b.built);
    expect(left.length).toBe(0);
  });
});

describe('windmills (#701 s1)', () => {
  it('pump a lake dry, a tile at a time, nearest first, into polder anyone can walk', () => {
    const { s, o, plan } = planned(true);
    const at = millSpot(s, o, plan.basin);
    const mill = placeBuilding(s, o, 'windmill', at.tx, at.ty, true);
    expect(millIdle(s, mill)).toBeNull();
    const first = basinOf(s, mill)[0];
    run(s, POLDER.every + 0.5);
    expect(isPolder(s, first)).toBe(true);
    expect(s.terrain[first]).toBe(T_GRASS);
    const x = first % s.w;
    const y = Math.floor(first / s.w);
    expect(s.height[y * (s.w + 1) + x]).toBeGreaterThanOrEqual(POLDER.ground);
    expect(walkable(s, x, y, -1)).toBe(true);
    expect(walkable(s, x, y, NAVAL)).toBe(false);
    expect(s.players[o].stats.drained).toBe(1);
    run(s, POLDER.every * (plan.basin.length + 2));
    for (const t of plan.basin) expect(isPolder(s, t)).toBe(true);
    expect(millIdle(s, mill)).toMatch(/No water/);
  });

  it('pump nothing from the open sea, and only behind a finished dyke line', () => {
    const { s, o, plan } = planned(false);
    // Before the dykes, the bay is the sea's: a pull from inside it finds nothing it can pump there.
    const bay = { tx: plan.basin[0] % s.w, ty: Math.floor(plan.basin[0] / s.w), size: 1 };
    expect(basinOf(s, bay).includes(plan.basin[0])).toBe(false);
    dykeUp(s, o, plan);
    expect(basinOf(s, bay).includes(plan.basin[0])).toBe(true);
    const at = millSpot(s, o, plan.basin);
    const mill = placeBuilding(s, o, 'windmill', at.tx, at.ty, true);
    expect(basinOf(s, mill).length).toBe(plan.basin.length);
    run(s, POLDER.every * (plan.basin.length + 3));
    for (const t of plan.basin) expect(isPolder(s, t)).toBe(true);
    // The dykes still stand in the water, and nothing beyond them was pumped.
    for (const t of plan.line) expect(s.terrain[t]).toBe(T_WATER);
    let won = 0;
    for (let i = 0; i < s.w * s.h; i++) if (isPolder(s, i)) won++;
    expect(won).toBe(plan.basin.length);
    expect(s.players[o].stats.drained).toBe(plan.basin.length);
  });

  it('sleep outside the Age of Dykes, and pass over the tile a boat floats on', () => {
    const { s, o, plan } = planned(true);
    const at = millSpot(s, o, plan.basin);
    const mill = placeBuilding(s, o, 'windmill', at.tx, at.ty, true);
    const first = basinOf(s, mill)[0];
    const boat = spawnUnit(s, o, 'fisher', (first % s.w) + 0.5, Math.floor(first / s.w) + 0.5);
    boat.order = { k: 'idle' };
    enter(s, o, 'middle');
    run(s, POLDER.every * 3);
    expect(s.players[o].stats.drained ?? 0).toBe(0);
    enter(s, o, 'dykes');
    run(s, POLDER.every + 0.5);
    if (Math.floor(boat.y) * s.w + Math.floor(boat.x) === first) expect(isPolder(s, first)).toBe(false);
    expect(s.players[o].stats.drained).toBe(1);
  });

  it('a Farm on polder works half again as fast', () => {
    const { s, o, plan } = planned(true);
    const at = millSpot(s, o, plan.basin);
    placeBuilding(s, o, 'windmill', at.tx, at.ty, true);
    run(s, POLDER.every * (plan.basin.length + 2));
    // A 3×3 of polder for the field.
    let spot: { tx: number; ty: number } | null = null;
    for (const t of plan.basin) {
      const tx = t % s.w;
      const ty = Math.floor(t / s.w);
      if (!placeProblem(s, 'farm', tx, ty, true, o) && [0, 1, 2].every((dy) => [0, 1, 2].every((dx) => isPolder(s, (ty + dy) * s.w + tx + dx)))) {
        spot = { tx, ty };
        break;
      }
    }
    expect(spot).not.toBeNull();
    const field = placeBuilding(s, o, 'farm', spot!.tx, spot!.ty, true);
    expect(polderField(s, field)).toBe(true);
    const farmer = spawnUnit(s, o, 'citizen', field.x, field.y);
    farmer.order = { k: 'farm', target: field.id, phase: 'go' };
    let worked = 0;
    for (let i = 0; i < secs(20) && !worked; i++) {
      const before = farmer.frac;
      step(s);
      if (farmer.act === 'farm' && farmer.frac > before) worked = farmer.frac - before;
    }
    expect(worked).toBeCloseTo(gatherRate(s, farmer, 'farm') * POLDER.farm * DT, 6);
  });
});

describe('the land bridge (#701 s1)', () => {
  it('a route across a drained lake runs straight over the polder', () => {
    const { s, o, plan } = planned(true);
    // Two shore points on opposite sides of the lake.
    let a = plan.basin[0];
    let b = plan.basin[0];
    for (const t of plan.basin) {
      if (t % s.w < a % s.w) a = t;
      if (t % s.w > b % s.w) b = t;
    }
    const ax = (a % s.w) - 1;
    const ay = Math.floor(a / s.w);
    const bx = (b % s.w) + 1;
    const by = Math.floor(b / s.w);
    const goal = { x0: bx, y0: by, x1: bx, y1: by, px: bx + 0.5, py: by + 0.5 };
    const len = (pts: number[]) => {
      let d = 0;
      let px = ax + 0.5;
      let py = ay + 0.5;
      for (let i = 0; i < pts.length; i += 2) {
        d += Math.hypot(pts[i] - px, pts[i + 1] - py);
        px = pts[i];
        py = pts[i + 1];
      }
      return d;
    };
    const before = findRoute(s, ax + 0.5, ay + 0.5, goal, 20000, -1);
    const at = millSpot(s, o, plan.basin);
    placeBuilding(s, o, 'windmill', at.tx, at.ty, true);
    run(s, POLDER.every * (plan.basin.length + 2));
    const after = findRoute(s, ax + 0.5, ay + 0.5, goal, 20000, -1);
    expect(after.complete).toBe(true);
    expect(len(after.points)).toBeLessThanOrEqual(before.complete ? len(before.points) : Infinity);
    expect(len(after.points)).toBeLessThan(Math.hypot(bx - ax, by - ay) + 3);
  });
});

describe('determinism (#701 s1)', () => {
  it('the same pumping on the same seed gives the same match', () => {
    const go = () => {
      const { s, o, plan } = planned(false);
      dykeUp(s, o, plan);
      const at = millSpot(s, o, plan.basin);
      placeBuilding(s, o, 'windmill', at.tx, at.ty, true);
      run(s, 40);
      return checksum(s);
    };
    expect(go()).toBe(go());
  });

  it('the windmill kept on leaving the age pumps on any road (its keepsake)', () => {
    const { s, o, plan } = planned(true);
    const at = millSpot(s, o, plan.basin);
    const mill = placeBuilding(s, o, 'windmill', at.tx, at.ty, true);
    enter(s, o, 'middle');
    mill.keep = 'dykes';
    expect(AGES.dykes.keepsake?.building).toBe('windmill');
    run(s, POLDER.every + 0.5);
    expect(s.players[o].stats.drained).toBe(1);
  });

  it('a Golden Age that walked the Dykes keeps pumping (#703)', () => {
    const { s, o, plan } = planned(true);
    const p = s.players[o];
    p.walked = ['dykes', 'sail', 'pilgrim'];
    restat(s, p, () => {
      p.epoch = AGES.golden.tier;
      p.age = 'golden';
    });
    expect(ageDef(p).pumps).toBe(true);
    const at = millSpot(s, o, plan.basin);
    placeBuilding(s, o, 'windmill', at.tx, at.ty, true);
    run(s, POLDER.every + 0.5);
    expect(s.players[o].stats.drained).toBe(1);
  });

  it('the dyke and windmill are buildings like any other', () => {
    expect(BUILDINGS.dyke.ages).toEqual(['dykes']);
    expect(BUILDINGS.windmill.ages).toEqual(['dykes']);
  });
});
