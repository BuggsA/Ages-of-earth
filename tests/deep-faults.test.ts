import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, BUILDINGS, FAULT, ROADS, secs } from '../src/sim/data';
import { asleep, buildBarred, roadKnown, roadProblem } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { AIR, placeProblem, walkable } from '../src/sim/grid';
import { findSpot } from '../src/sim/ai';
import { forgeAt } from '../src/sim/forge';
import { crackTiles, crackable, engineVent, faultProblem, isChasm } from '../src/sim/fault';
import { RES } from '../src/sim/types';
import type { AgeId, Building, BuildingType, GameEvent, GameState, MapType } from '../src/sim/types';
import { maxHp, placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Deep Road's fifth age (#876 s5, #900): the Age of Faults, engines by the vents that crack the ground into chasms. */

const make = (seed = 2, mapType: MapType = 'continental', players = 2) =>
  createGame({ seed, size: 'small', mapType, players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, ai: null })) });
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
  p.walked = ['megaliths', 'delvings', 'undercity', 'forges'];
  p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
};
/** A finished Fault Engine of `o`'s by its home vent. */
const engine = (s: GameState, o = 0): Building => {
  const v = s.vents![o];
  const spot = findSpot(s, 'faultengine', (v % s.w) + 0.5, Math.floor(v / s.w) + 0.5, 3, FAULT.tap - 2, 1, (tx, ty) => !placeProblem(s, 'faultengine', tx, ty, true, o))!;
  expect(spot).toBeTruthy();
  return placeBuilding(s, o, 'faultengine', spot.tx, spot.ty, true);
};
const raise = (s: GameState, type: BuildingType, x: number, y: number, o = 0) => {
  const spot = findSpot(s, type, x, y, 0, 30, 1, (tx, ty) => !placeProblem(s, type, tx, ty, true, o))!;
  return placeBuilding(s, o, type, spot.tx, spot.ty, true);
};
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec); i++) step(s);
};
/** A line `len` tiles long through (x, y), across the x axis, all of it crackable; null if none such near. */
function openLine(s: GameState, b: Building, len = 8): { x0: number; y0: number; x1: number; y1: number } | null {
  for (let r = 6; r < FAULT.reach - 2; r++)
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const x0 = Math.floor(b.x) + dx;
      const y0 = Math.floor(b.y) + dy - (len >> 1);
      const y1 = y0 + len - 1;
      const tiles = crackTiles(s, x0, y0, x0, y1);
      if (tiles.length !== len || tiles.some((t) => s.bldAt[t] || s.res[t])) continue;
      if (faultProblem(s, b.owner, b, x0, y0, x0, y1)) continue;
      return { x0, y0, x1: x0, y1 };
    }
  return null;
}

describe('the road (#900)', () => {
  it('is the Deep Road\'s tier 5, instead of the Atomic Age: a climb from the Deep Forges, a turn from Atomic, and back at Atomic', () => {
    expect(AGES.faults.tier).toBe(AGES.atomic.tier);
    expect(AGES.faults.routes).toEqual(['deep']);
    expect(AGES.faults.verb && AGES.faults.door && AGES.faults.good).toBeTruthy();
    expect(AGES.faults.keepsake?.building).toBe('faultengine');
    const climb = ROADS.find((r) => r.from === 'forges' && r.to === 'faults')!;
    const turn = ROADS.find((r) => r.from === 'atomic' && r.to === 'faults')!;
    expect(climb.walked).toBe('forges');
    expect(turn.walked).toBe('forges');
    expect(ROADS.some((r) => r.from === 'faults' && r.to === 'atomic')).toBe(true);
    // Deep Road roads go at the end of ROADS, so the other roads' seeded matches stand.
    expect(ROADS.indexOf(climb)).toBeGreaterThan(ROADS.findIndex((r) => r.to === 'forges'));
    const s = make();
    enter(s, 0, 'forges');
    expect(roadKnown(s, s.players[0], climb)).toBe(true);
    expect(roadProblem(s, s.players[0], climb)).toBeNull();
    enter(s, 1, 'atomic');
    s.players[1].walked = [];
    expect(roadProblem(s, s.players[1], turn)).toBeTruthy();
  });

  it('needs nothing the map may lack: its roads, its engine and its crack cost only food, wood, stone and gold', () => {
    for (const r of ROADS.filter((r) => r.to === 'faults' || r.from === 'faults')) {
      for (const k of Object.keys(r.cost)) expect(RES).toContain(k);
      expect(r.deed).toBeUndefined();
      expect(r.ore).toBeUndefined();
      expect(r.clue).toBeUndefined();
    }
    for (const k of Object.keys(BUILDINGS.faultengine.cost)) expect(RES).toContain(k);
    for (const k of Object.keys(FAULT.cost)) expect(RES).toContain(k);
  });

  it('shuts the Missile Silo, keeps the forges and the tunnel, and raises Fault Engines only in the age', () => {
    const s = make();
    enter(s, 0, 'faults');
    const p = s.players[0];
    expect(buildBarred(p, 'silo')).toBeTruthy();
    expect(buildBarred(p, 'faultengine')).toBeNull();
    expect(buildBarred(p, 'ventforge')).toBeNull();
    expect(buildBarred(p, 'barrow')).toBeNull();
    enter(s, 1, 'atomic');
    expect(buildBarred(s.players[1], 'faultengine')).toBeTruthy();
    expect(buildBarred(s.players[1], 'silo')).toBeNull();
  });
});

describe('the Fault Engine (#900)', () => {
  it('stands within reach of a vent on every kind of map, by every town', () => {
    const types: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'];
    for (const mapType of types) {
      for (const [seed, n] of [[1, 2], [3, 3], [5, 4]] as const) {
        const s = make(seed, mapType, n);
        for (const p of s.players) {
          enter(s, p.id, 'faults');
          const v = s.vents![p.id];
          const spot = findSpot(s, 'faultengine', (v % s.w) + 0.5, Math.floor(v / s.w) + 0.5, 3, FAULT.tap - 2, 1, (tx, ty) => !placeProblem(s, 'faultengine', tx, ty, true, p.id));
          expect(spot, `${mapType} ${seed} P${p.id}`).toBeTruthy();
        }
      }
    }
  });

  it('is raised only near a vent, and never on its hot ground', () => {
    const s = make();
    enter(s, 0, 'faults');
    const v = s.vents![0];
    const at = forgeAt(s, v);
    expect(placeProblem(s, 'faultengine', at.tx, at.ty, true, 0)).toBe('hot');
    // Somewhere on the map far from every vent, the engine has nothing to draw on.
    let far = 0;
    for (let ty = 1; ty < s.h - 4; ty += 3) for (let tx = 1; tx < s.w - 4; tx += 3) if (placeProblem(s, 'faultengine', tx, ty, true, 0) === 'tap') far++;
    expect(far).toBeGreaterThan(0);
    const b = engine(s);
    expect(engineVent(s, b)).toBe(v);
  });

  it('refuses a crack too long, too far, over nothing that cracks, or that it can\'t pay for', () => {
    const s = make();
    enter(s, 0, 'faults');
    s.peaceUntil = 0;
    const b = engine(s);
    const x = Math.floor(b.x);
    const y = Math.floor(b.y);
    expect(faultProblem(s, 0, b, x + 6, y - 7, x + 6, y + 7)).toMatch(/at most/);
    expect(faultProblem(s, 0, b, x + 30, y, x + 32, y)).toMatch(/within/);
    expect(faultProblem(s, 1, b, x + 6, y, x + 6, y + 4)).toMatch(/your own/);
    const line = openLine(s, b)!;
    expect(line).toBeTruthy();
    s.players[0].res.stone = 0;
    expect(faultProblem(s, 0, b, line.x0, line.y0, line.x1, line.y1)).toMatch(/pay/);
    // The ground round a vent, water and rock never crack.
    const v = s.vents![0];
    expect(crackable(s, v)).toBe(false);
    expect(crackable(s, v + 1)).toBe(false);
  });

  it('charges where every people sees it, then opens a chasm no one crosses on foot', () => {
    const s = make();
    enter(s, 0, 'faults');
    s.peaceUntil = 0;
    const b = engine(s);
    const line = openLine(s, b)!;
    const seen: GameEvent[] = [];
    applyCommand(s, { t: 'fault', p: 0, building: b.id, ...line });
    expect(s.faults).toHaveLength(1);
    expect(s.players[0].res.stone).toBe(5000 - FAULT.cost.stone!);
    expect(s.events.some((e) => e.k === 'fault' && e.what === 'charge')).toBe(true);
    // A second order while it charges is refused.
    expect(faultProblem(s, 0, b, line.x0, line.y0, line.x1, line.y1)).toMatch(/charging/);
    const tiles = s.faults![0].line;
    for (let i = 0; i < secs(FAULT.charge) - 1; i++) {
      s.events = [];
      step(s);
      seen.push(...s.events);
    }
    expect(tiles.some((t) => isChasm(s, t))).toBe(false);
    s.events = [];
    step(s);
    seen.push(...s.events);
    expect(seen.find((e) => e.k === 'fault' && e.what === 'crack')).toMatchObject({ n: tiles.length });
    expect(s.faults).toHaveLength(0);
    for (const t of tiles) {
      expect(isChasm(s, t)).toBe(true);
      expect(walkable(s, t % s.w, Math.floor(t / s.w), 0)).toBe(false);
      expect(walkable(s, t % s.w, Math.floor(t / s.w), 1)).toBe(false);
      expect(walkable(s, t % s.w, Math.floor(t / s.w), AIR)).toBe(true);
    }
    expect(s.players[0].stats.cracked).toBe(tiles.length);
    // Nothing but a Bridge is raised on it.
    expect(placeProblem(s, 'house', tiles[2] % s.w, Math.floor(tiles[2] / s.w), true, 0)).toBe('chasm');
    expect(faultProblem(s, 0, b, line.x0, line.y0, line.x1, line.y1)).toMatch(/cracks again/);
  });

  it('brings down half of what stands on the line, and throws whoever stands there clear', () => {
    const s = make();
    enter(s, 0, 'faults');
    s.peaceUntil = 0;
    const b = engine(s);
    const line = openLine(s, b)!;
    const t = line.y0 * s.w + line.x0;
    const mid = (line.y0 + 3) * s.w + line.x0;
    // One of its own people: the chasm spares no one.
    const u = spawnUnit(s, 0, 'infantry', (mid % s.w) + 0.5, Math.floor(mid / s.w) + 0.5);
    u.stance = 'stand';
    const hp = u.hp;
    // A rival's house over the line's first tiles.
    const h = placeBuilding(s, 1, 'house', line.x0, line.y0, true);
    const full = maxHp(s, h);
    applyCommand(s, { t: 'fault', p: 0, building: b.id, ...line });
    expect(s.faults![0].line).toContain(t);
    run(s, FAULT.charge + 0.1);
    expect(h.hp).toBeLessThanOrEqual(full - Math.round((full * FAULT.fall) / 100) + 1);
    expect(h.hp).toBeGreaterThan(0);
    expect(u.hp).toBe(hp - FAULT.hurl);
    expect(isChasm(s, Math.floor(u.y) * s.w + Math.floor(u.x))).toBe(false);
  });

  it('stalls while a rival holds its vent, and loses the charge if it falls', () => {
    const s = make();
    enter(s, 0, 'faults');
    s.peaceUntil = 0;
    const b = engine(s);
    const line = openLine(s, b)!;
    applyCommand(s, { t: 'fault', p: 0, building: b.id, ...line });
    const v = engineVent(s, b);
    const band = [0, 1].map((i) => spawnUnit(s, 1, 'infantry', (v % s.w) + 0.5 + i, Math.floor(v / s.w) + 2.5));
    for (const u of band) u.stance = 'stand';
    run(s, 2);
    expect(s.faults![0].held).toBe(true);
    const left = s.faults![0].left;
    run(s, 5);
    expect(s.faults![0].left).toBe(left);
    for (const u of band) u.hp = 0;
    run(s, 2);
    expect(s.faults![0].held).toBeUndefined();
    expect(s.faults![0].left).toBeLessThan(left);
    b.hp = 0;
    const seen: GameEvent[] = [];
    for (let i = 0; i < secs(2); i++) {
      s.events = [];
      step(s);
      seen.push(...s.events);
    }
    expect(seen.some((e) => e.k === 'fault' && e.what === 'lost')).toBe(true);
    expect(s.faults ?? []).toHaveLength(0);
    run(s, FAULT.charge);
    expect(line && s.chasm?.some((c) => c === 1)).toBeFalsy();
  });

  it('sleeps off the age but for the one kept', () => {
    const s = make();
    enter(s, 0, 'faults');
    const b = engine(s);
    restat(s, s.players[0], () => {
      s.players[0].age = 'atomic';
    });
    expect(asleep(s, b)).toBe(true);
    b.keep = 'faults';
    expect(asleep(s, b)).toBe(false);
  });
});

describe('the chasm (#900)', () => {
  it('is bridged by any people from the Middle Ages on, for its own feet only', () => {
    const s = make();
    enter(s, 0, 'faults');
    s.peaceUntil = 0;
    const b = engine(s);
    const line = openLine(s, b)!;
    applyCommand(s, { t: 'fault', p: 0, building: b.id, ...line });
    run(s, FAULT.charge + 0.1);
    const t = (line.y0 + 4) * s.w + line.x0;
    expect(isChasm(s, t)).toBe(true);
    // A rival in the Gunpowder Age lays a Bridge over it.
    const q = s.players[1];
    restat(s, q, () => {
      q.epoch = 3;
      q.age = 'gunpowder';
    });
    q.res = { food: 500, wood: 500, stone: 500, gold: 500 };
    expect(placeProblem(s, 'bridge', t % s.w, Math.floor(t / s.w), true, 1)).toBeNull();
    const u = spawnUnit(s, 1, 'citizen', line.x0 - 1.5, line.y0 + 4.5);
    applyCommand(s, { t: 'build', p: 1, ids: [u.id], type: 'bridge', tx: t % s.w, ty: Math.floor(t / s.w) });
    const br = s.ents.find((e): e is Building => e.kind === 'building' && e.type === 'bridge' && e.owner === 1);
    expect(br).toBeDefined();
    run(s, 40);
    expect(br!.built).toBe(true);
    expect(asleep(s, br!)).toBe(false);
    expect(walkable(s, t % s.w, Math.floor(t / s.w), q.team)).toBe(true);
    expect(walkable(s, t % s.w, Math.floor(t / s.w), s.players[0].team)).toBe(false);
    // Razed, it leaves the chasm as it was.
    br!.hp = 0;
    run(s, 1);
    expect(walkable(s, t % s.w, Math.floor(t / s.w), q.team)).toBe(false);
  });

  it('turns a walker round it', () => {
    const s = make();
    enter(s, 0, 'faults');
    s.peaceUntil = 0;
    const b = engine(s);
    const line = openLine(s, b)!;
    applyCommand(s, { t: 'fault', p: 0, building: b.id, ...line });
    run(s, FAULT.charge + 0.1);
    const set = new Set(crackTiles(s, line.x0, line.y0, line.x1, line.y1).concat(Array.from({ length: line.y1 - line.y0 + 1 }, (_, i) => (line.y0 + i) * s.w + line.x0)));
    const u = spawnUnit(s, 0, 'infantry', line.x0 - 1.5, line.y0 + 4.5);
    applyCommand(s, { t: 'move', p: 0, ids: [u.id], x: line.x0 + 2.5, y: line.y0 + 4.5 });
    let crossed = false;
    for (let i = 0; i < secs(40); i++) {
      step(s);
      if (set.has(Math.floor(u.y) * s.w + Math.floor(u.x))) crossed = true;
    }
    expect(crossed).toBe(false);
    expect(Math.abs(u.x - (line.x0 + 2.5)) + Math.abs(u.y - (line.y0 + 4.5))).toBeLessThan(2);
  });

  it('never opens in a match off the road', () => {
    const s = make(3, 'continental', 3);
    run(s, 30);
    expect(s.chasm).toBeUndefined();
    expect(s.faults).toBeUndefined();
  });
});
