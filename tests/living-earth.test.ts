import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, BUILDINGS, FAULT, FISSION, FUSION, LIVING, ROADS, SILO, UNDER, secs } from '../src/sim/data';
import { asleep, buildBarred, roadKnown, roadProblem } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { AIR, placeProblem, walkable } from '../src/sim/grid';
import { findSpot } from '../src/sim/ai';
import { crack, crackTiles, engineVent, isChasm, isRidge } from '../src/sim/fault';
import { districtAt, heaveProblem, levelRidges, stoneLimit, quakeProblem, quakeSeams, ridgeTiles, swallowProblem, vaulted } from '../src/sim/living';
import { RES } from '../src/sim/types';
import type { AgeId, Building, GameEvent, GameState, MapType } from '../src/sim/types';
import { maxHp, placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Deep Road's last age (#876 s6, #904): the Living Earth, a Heartstone by the vent that raises ridges, swallows districts and wakes the Quake. */

const make = (seed = 2, mapType: MapType = 'continental', players = 2) =>
  createGame({ seed, size: 'small', mapType, players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, ai: null })) });
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
  p.walked = ['megaliths', 'delvings', 'undercity', 'forges', 'faults'];
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
};
/** A finished Heartstone of `o`'s by its home vent. */
const heartstone = (s: GameState, o = 0): Building => {
  const v = s.vents![o];
  const spot = findSpot(s, 'heartstone', (v % s.w) + 0.5, Math.floor(v / s.w) + 0.5, 3, LIVING.tap - 2, 1, (tx, ty) => !placeProblem(s, 'heartstone', tx, ty, true, o))!;
  expect(spot).toBeTruthy();
  return placeBuilding(s, o, 'heartstone', spot.tx, spot.ty, true);
};
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec); i++) step(s);
};
/** A line `len` tiles long down the y axis that may all rise, clear of buildings and resources; null if none such near. */
function openLine(s: GameState, b: Building, len = 8): { x0: number; y0: number; x1: number; y1: number } | null {
  for (let r = 6; r < LIVING.reach - 2; r++)
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const x0 = Math.floor(b.x) + dx;
      const y0 = Math.floor(b.y) + dy - (len >> 1);
      const y1 = y0 + len - 1;
      const tiles = crackTiles(s, x0, y0, x0, y1);
      if (tiles.length !== len || tiles.some((t) => s.bldAt[t] || s.res[t])) continue;
      if (heaveProblem(s, b.owner, b, x0, y0, x0, y1)) continue;
      return { x0, y0, x1: x0, y1 };
    }
  return null;
}
const collect = (s: GameState, sec: number): GameEvent[] => {
  const seen: GameEvent[] = [];
  for (let i = 0; i < secs(sec); i++) {
    s.events = [];
    step(s);
    seen.push(...s.events);
  }
  return seen;
};

describe('the road (#904)', () => {
  it('is the Deep Road\'s last age, past the Faults at the Atomic tier: on from the Faults, back to them or across to the Atomic', () => {
    expect(AGES.living.tier).toBe(AGES.atomic.tier);
    expect(AGES.living.routes).toEqual(['deep']);
    expect(AGES.living.verb && AGES.living.door && AGES.living.good).toBeTruthy();
    expect(AGES.living.keepsake?.building).toBe('heartstone');
    const climb = ROADS.find((r) => r.from === 'faults' && r.to === 'living')!;
    expect(climb).toBeDefined();
    expect(ROADS.filter((r) => r.to === 'living')).toEqual([climb]);
    expect(ROADS.some((r) => r.from === 'living' && r.to === 'faults')).toBe(true);
    expect(ROADS.some((r) => r.from === 'living' && r.to === 'atomic')).toBe(true);
    // Deep Road roads go at the end of ROADS, so the other roads' seeded matches stand.
    expect(ROADS.indexOf(climb)).toBeGreaterThan(ROADS.findIndex((r) => r.to === 'faults'));
    const s = make();
    enter(s, 0, 'faults');
    expect(roadKnown(s, s.players[0], climb)).toBe(true);
    expect(roadProblem(s, s.players[0], climb)).toBeNull();
  });

  it('needs nothing the map may lack: its roads, its stone and its orders cost only food, wood, stone and gold', () => {
    for (const r of ROADS.filter((r) => r.to === 'living' || r.from === 'living')) {
      for (const k of Object.keys(r.cost)) expect(RES).toContain(k);
      expect(r.deed).toBeUndefined();
      expect(r.ore).toBeUndefined();
      expect(r.coast).toBeUndefined();
    }
    for (const c of [BUILDINGS.heartstone.cost, LIVING.ridgeCost, LIVING.quakeCost]) for (const k of Object.keys(c)) expect(RES).toContain(k);
  });

  it('shuts the Dock, the Airfield and the Missile Silo, keeps the engines, forges and tunnel, and raises one Heartstone', () => {
    const s = make();
    enter(s, 0, 'living');
    const p = s.players[0];
    for (const t of ['dock', 'airfield', 'silo'] as const) expect(buildBarred(p, t), t).toBeTruthy();
    for (const t of ['heartstone', 'faultengine', 'ventforge', 'barrow'] as const) expect(buildBarred(p, t), t).toBeNull();
    enter(s, 1, 'faults');
    expect(buildBarred(s.players[1], 'heartstone')).toBeTruthy();
    const b = heartstone(s);
    expect(asleep(s, b)).toBe(false);
    expect(engineVent(s, b)).toBe(s.vents![0]);
    expect(stoneLimit(s, 0, 'heartstone')).toMatch(/One/);
    const u = spawnUnit(s, 0, 'citizen', b.x + 4, b.y + 4);
    const before = s.ents.filter((e) => e.kind === 'building' && e.type === 'heartstone').length;
    applyCommand(s, { t: 'build', p: 0, ids: [u.id], type: 'heartstone', tx: Math.floor(b.x) + 6, ty: Math.floor(b.y) });
    expect(s.ents.filter((e) => e.kind === 'building' && e.type === 'heartstone').length).toBe(before);
  });

  it('finds a Heartstone\'s ground by every town\'s vent, on every kind of map', () => {
    const types: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'];
    for (const mapType of types) {
      for (const [seed, n] of [[1, 2], [3, 3], [5, 4]] as const) {
        const s = make(seed, mapType, n);
        for (const p of s.players) {
          enter(s, p.id, 'living');
          const v = s.vents![p.id];
          const spot = findSpot(s, 'heartstone', (v % s.w) + 0.5, Math.floor(v / s.w) + 0.5, 3, LIVING.tap - 2, 1, (tx, ty) => !placeProblem(s, 'heartstone', tx, ty, true, p.id));
          expect(spot, `${mapType} ${seed} P${p.id}`).toBeTruthy();
        }
      }
    }
  });
});

describe('a ridge (#904)', () => {
  it('charges where every people sees it, then rises into rock nothing crosses but fliers', () => {
    const s = make();
    enter(s, 0, 'living');
    s.peaceUntil = 0;
    const b = heartstone(s);
    const line = openLine(s, b)!;
    expect(line).toBeTruthy();
    expect(heaveProblem(s, 0, b, line.x0, line.y0, line.x0, line.y0 + LIVING.len + 1)).toMatch(/at most/);
    expect(heaveProblem(s, 1, b, line.x0, line.y0, line.x1, line.y1)).toMatch(/your own/);
    applyCommand(s, { t: 'heave', p: 0, building: b.id, ...line });
    expect(s.faults).toHaveLength(1);
    expect(s.faults![0].kind).toBe('ridge');
    expect(s.players[0].res.stone).toBe(9000 - LIVING.ridgeCost.stone!);
    expect(s.events.find((e) => e.k === 'fault' && e.what === 'charge')).toMatchObject({ kind: 'ridge' });
    const tiles = s.faults![0].line;
    collect(s, LIVING.rise - 0.5);
    expect(tiles.some((t) => isRidge(s, t))).toBe(false);
    const after = collect(s, 1);
    expect(after.find((e) => e.k === 'fault' && e.what === 'rise')).toMatchObject({ n: tiles.length, kind: 'ridge' });
    for (const t of tiles) {
      expect(isRidge(s, t)).toBe(true);
      expect(isChasm(s, t)).toBe(false);
      expect(walkable(s, t % s.w, Math.floor(t / s.w), 0)).toBe(false);
      expect(walkable(s, t % s.w, Math.floor(t / s.w), 1)).toBe(false);
      expect(walkable(s, t % s.w, Math.floor(t / s.w), AIR)).toBe(true);
    }
    expect(s.players[0].stats.raised).toBe(tiles.length);
    // Nothing is raised on it, not even a Bridge.
    expect(placeProblem(s, 'house', tiles[2] % s.w, Math.floor(tiles[2] / s.w), true, 0)).toBe('ridge');
    expect(placeProblem(s, 'bridge', tiles[2] % s.w, Math.floor(tiles[2] / s.w), true, 0)).toBeTruthy();
    expect(heaveProblem(s, 0, b, line.x0 + 1, line.y0, line.x0 + 1, line.y1)).toMatch(/raises again/);
  });

  it('closes a chasm on its line into plain ground again', () => {
    const s = make();
    enter(s, 0, 'living');
    s.peaceUntil = 0;
    const b = heartstone(s);
    const line = openLine(s, b)!;
    const tiles = crackTiles(s, line.x0, line.y0, line.x1, line.y1);
    crack(s, { engine: b.id, owner: 0, line: tiles, left: 0 });
    expect(tiles.every((t) => isChasm(s, t))).toBe(true);
    expect(ridgeTiles(s, line.x0, line.y0, line.x1, line.y1)).toEqual(tiles);
    applyCommand(s, { t: 'heave', p: 0, building: b.id, ...line });
    run(s, LIVING.rise + 0.5);
    for (const t of tiles) {
      expect(isChasm(s, t)).toBe(false);
      expect(isRidge(s, t)).toBe(false);
      expect(walkable(s, t % s.w, Math.floor(t / s.w), 1)).toBe(true);
    }
  });

  it('comes down to a keg, and the kept Heartstone raises ridges on any road', () => {
    const s = make();
    enter(s, 0, 'living');
    s.peaceUntil = 0;
    const b = heartstone(s);
    const line = openLine(s, b)!;
    applyCommand(s, { t: 'heave', p: 0, building: b.id, ...line });
    run(s, LIVING.rise + 0.5);
    const t = (line.y0 + 3) * s.w + line.x0;
    expect(isRidge(s, t)).toBe(true);
    expect(levelRidges(s, line.x0 + 0.5, line.y0 + 3.5, 1.2)).toBeGreaterThan(0);
    expect(isRidge(s, t)).toBe(false);
    expect(walkable(s, t % s.w, Math.floor(t / s.w), 1)).toBe(true);
    // Off the age it sleeps, unless kept; kept, it raises ridges but wakes no Quake.
    restat(s, s.players[0], () => {
      s.players[0].age = 'atomic';
    });
    run(s, LIVING.reraise + 1);
    expect(asleep(s, b)).toBe(true);
    b.keep = 'living';
    expect(asleep(s, b)).toBe(false);
    const again = openLine(s, b);
    expect(again).toBeTruthy();
    expect(heaveProblem(s, 0, b, again!.x0, again!.y0, again!.x1, again!.y1)).toBeNull();
    expect(quakeProblem(s, 0, b, again!.x0, again!.y0)).toMatch(/Living Earth/);
  });
});

describe('the Quake (#904)', () => {
  it('charges longer than any warhead\'s clock, and stalls while a rival holds the stone\'s vent', () => {
    expect(LIVING.quake).toBeGreaterThan(Math.max(SILO.fuse, FISSION.fuse, FUSION.fuse));
    const s = make();
    enter(s, 0, 'living');
    const b = heartstone(s);
    const q = s.players[1];
    s.peaceUntil = 1e9;
    expect(quakeProblem(s, 0, b, q.startX, q.startY)).toMatch(/peace/);
    s.peaceUntil = 0;
    expect(quakeProblem(s, 0, b, -1, 4)).toMatch(/map/);
    s.players[0].res.gold = 0;
    expect(quakeProblem(s, 0, b, Math.floor(q.startX), Math.floor(q.startY))).toMatch(/pay/);
    s.players[0].res.gold = 9000;
    applyCommand(s, { t: 'quake', p: 0, building: b.id, x: Math.floor(q.startX), y: Math.floor(q.startY) });
    expect(s.faults).toHaveLength(1);
    expect(s.faults![0].kind).toBe('quake');
    const v = engineVent(s, b);
    const band = [0, 1].map((i) => spawnUnit(s, 1, 'infantry', (v % s.w) + 0.5 + i, Math.floor(v / s.w) + 2.5));
    for (const u of band) u.stance = 'stand';
    run(s, 2);
    expect(s.faults![0].held).toBe(true);
    const left = s.faults![0].left;
    run(s, 5);
    expect(s.faults![0].left).toBe(left);
    b.hp = 0;
    const seen = collect(s, 2);
    expect(seen.find((e) => e.k === 'fault' && e.what === 'lost')).toMatchObject({ kind: 'quake' });
    expect(s.faults ?? []).toHaveLength(0);
  });

  it('splits the land in a cross of chasm and ridge, shakes the town round its heart, and shakes the caster\'s own ground', () => {
    const s = make();
    enter(s, 0, 'living');
    s.peaceUntil = 0;
    const b = heartstone(s);
    const q = s.players[1];
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    const own = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    // A sunk rival house beside the heart rides it far better than one on the surface.
    const sunk = placeBuilding(s, 1, 'house', Math.floor(q.startX) + 3, Math.floor(q.startY) + 3, true);
    sunk.sunk = true;
    const x = Math.floor(tc.x);
    const y = Math.floor(tc.y);
    const seams = quakeSeams(s, x, y);
    expect(seams.chasm.length).toBeGreaterThan(LIVING.wide);
    expect(seams.ridge.length).toBeGreaterThan(LIVING.wide);
    const hp = { tc: tc.hp, sunk: sunk.hp, own: own.hp, stone: b.hp };
    applyCommand(s, { t: 'quake', p: 0, building: b.id, x, y });
    run(s, LIVING.quake - 1);
    expect(tc.hp).toBe(hp.tc);
    const seen = collect(s, 2);
    expect(seen.some((e) => e.k === 'fault' && e.what === 'quake')).toBe(true);
    expect(s.players[0].stats.quakes).toBe(1);
    expect(seams.chasm.some((t) => isChasm(s, t))).toBe(true);
    expect(seams.ridge.some((t) => isRidge(s, t))).toBe(true);
    expect(tc.hp).toBeLessThanOrEqual(hp.tc - Math.round((maxHp(s, tc) * LIVING.shake) / 100) + 1);
    expect(hp.sunk - sunk.hp).toBeLessThan(Math.round((maxHp(s, sunk) * LIVING.shook) / 100));
    expect(hp.sunk - sunk.hp).toBeGreaterThan(0);
    // The caster's own Town Center lies near the stone: every great quake shakes its own ground. The stone itself stands.
    expect(own.hp).toBeLessThanOrEqual(hp.own - Math.round((maxHp(s, own) * LIVING.backlash) / 100) + 1);
    expect(b.hp).toBe(hp.stone);
    expect(quakeProblem(s, 0, b, x, y)).toMatch(/settling/);
  });

  it('is woken only in the age', () => {
    const s = make();
    enter(s, 0, 'faults');
    s.peaceUntil = 0;
    const b = placeBuilding(s, 0, 'heartstone', 2, 2, true);
    expect(quakeProblem(s, 0, b, 5, 5)).toMatch(/Living Earth/);
  });
});

describe('swallowing a district, and the deep vaults (#904)', () => {
  it('takes every building of its people that may sink round a point below at once, and nothing of a rival\'s', () => {
    const s = make();
    enter(s, 0, 'living');
    const b = heartstone(s);
    const p = s.players[0];
    const hx = Math.floor(b.x) + 8;
    const hy = Math.floor(b.y);
    const mine = [placeBuilding(s, 0, 'house', hx, hy, true), placeBuilding(s, 0, 'house', hx + 2, hy, true), placeBuilding(s, 0, 'storehouse', hx, hy + 2, true)];
    const theirs = placeBuilding(s, 1, 'house', hx - 2, hy, true);
    const at = { x: hx + 1, y: hy + 1 };
    const got = districtAt(s, 0, at.x, at.y);
    for (const m of mine) expect(got).toContain(m);
    expect(got).not.toContain(theirs);
    expect(swallowProblem(s, 1, b, at.x, at.y)).toMatch(/your own/);
    const stone = p.res.stone;
    applyCommand(s, { t: 'swallow', p: 0, building: b.id, x: at.x, y: at.y });
    expect(p.res.stone).toBe(stone - got.reduce((n, e) => n + LIVING.gulpCost * e.size * e.size, 0));
    expect(LIVING.gulp).toBeLessThan(UNDER.sink);
    run(s, LIVING.gulp + 0.5);
    for (const m of got) expect(m.sunk).toBe(true);
    expect(theirs.sunk).toBeFalsy();
    expect(swallowProblem(s, 0, b, at.x, at.y)).toMatch(/Nothing of yours/);
  });

  it('lets a sunk building of a people that walked the Living Earth ride out a warhead, and no one else\'s', () => {
    const s = make();
    enter(s, 0, 'living');
    const p = s.players[0];
    const hx = Math.floor(p.startX) + 6;
    const hy = Math.floor(p.startY) + 6;
    const vault = placeBuilding(s, 0, 'house', hx, hy, true);
    vault.sunk = true;
    const open = placeBuilding(s, 0, 'house', hx + 3, hy, true);
    expect(vaulted(s, vault)).toBe(true);
    expect(vaulted(s, open)).toBe(false);
    // A rival's warhead on them.
    const q = s.players[1];
    restat(s, q, () => {
      q.epoch = 5;
      q.age = 'atomic';
    });
    q.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    s.peaceUntil = 0;
    const silo = placeBuilding(s, 1, 'silo', Math.floor(q.startX) + 5, Math.floor(q.startY) + 5, true);
    const hp = { vault: vault.hp, open: open.hp };
    applyCommand(s, { t: 'launch', p: 1, silo: silo.id, x: hx + 1, y: hy + 1 });
    expect(s.launches?.length).toBe(1);
    const seen = collect(s, SILO.fuse + 2);
    expect(open.hp).toBeLessThan(hp.open);
    expect(vault.hp).toBe(hp.vault);
    expect(seen.find((e) => e.k === 'vault')).toMatchObject({ owner: 0, n: 1 });
    expect(p.stats.vaulted).toBe(1);
    // A people that never walked the age has no vaults.
    p.walked = ['megaliths', 'delvings', 'undercity'];
    restat(s, p, () => {
      p.age = 'undercity';
      p.epoch = AGES.undercity.tier;
    });
    expect(vaulted(s, vault)).toBe(false);
  });

  it('never moves the land in a match off the road', () => {
    const s = make(3, 'continental', 3);
    run(s, 30);
    expect(s.heaved).toBeUndefined();
    expect(s.faults).toBeUndefined();
    void FAULT;
  });
});
