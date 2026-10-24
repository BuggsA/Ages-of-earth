import { describe, expect, it } from 'vitest';
import { AGES, BUILDINGS, FLOAT, ROADS, STEPPE, secs, unitStats } from '../src/sim/data';
import { buildBarred } from '../src/sim/ages';
import { damageOf } from '../src/sim/combat';
import { checksum, createGame, step } from '../src/sim/game';
import { NAVAL, placeProblem, sails, walkable } from '../src/sim/grid';
import { castProblem, districtOf, isDeck, raisesCitizens } from '../src/sim/floating';
import { deserialize, serialize } from '../src/sim/save';
import type { AgeId, Building, GameState, Unit } from '../src/sim/types';
import { T_GRASS } from '../src/sim/types';
import { countPop, placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Age of Floating Cities (#770, s7 of the Water Road #701): pontoon districts that moor, link and tow. */

const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) step(s);
};
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
    p.walked = [...(p.walked ?? []), age];
  });
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
};

/** A lakes map with player 0 floating, nothing to fight, and the nearest spot off its shore a Pontoon may be raised. */
function harbour(seed = 1): { s: GameState; spot: { tx: number; ty: number } } {
  const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  enter(s, 0, 'floating');
  const p = s.players[0];
  let spot: { tx: number; ty: number } | null = null;
  let best = Infinity;
  for (let ty = 1; ty < s.h - 4; ty++)
    for (let tx = 1; tx < s.w - 4; tx++) {
      const d = (tx - p.startX) ** 2 + (ty - p.startY) ** 2;
      if (d < best && !placeProblem(s, 'pontoon', tx, ty, true, 0)) {
        best = d;
        spot = { tx, ty };
      }
    }
  return { s, spot: spot! };
}

/** Moor finished pontoons in a row going out from a spot, each beside the last, along whichever axis has the water. */
function row(s: GameState, from: { tx: number; ty: number }, n: number): Building[] {
  const out = [placeBuilding(s, 0, 'pontoon', from.tx, from.ty, true)];
  const steps = [
    [3, 0],
    [-3, 0],
    [0, 3],
    [0, -3],
  ];
  while (out.length < n) {
    const last = out[out.length - 1];
    const next = steps.map(([dx, dy]) => ({ tx: last.tx + dx, ty: last.ty + dy })).find((t) => !placeProblem(s, 'pontoon', t.tx, t.ty, true, 0));
    if (!next) break;
    out.push(placeBuilding(s, 0, 'pontoon', next.tx, next.ty, true));
  }
  return out;
}

const tile = (s: GameState, b: Building) => (b.ty + 1) * s.w + b.tx + 1;

describe('the Age of Floating Cities in the data (#770)', () => {
  it('is the Water Road past the Age of Tides, reached only from it, with roads back to the Tides and across to the Atomic', () => {
    expect(AGES.floating.tier).toBe(5);
    expect(AGES.floating.routes).toEqual(['water']);
    expect(AGES.floating.keepsake!.building).toBe('pontoon');
    expect(ROADS.filter((r) => r.to === 'floating').map((r) => r.from)).toEqual(['tides']);
    expect(ROADS.find((r) => r.to === 'floating')!.coast).toBeDefined();
    expect(ROADS.filter((r) => r.from === 'floating').map((r) => r.to).sort()).toEqual(['atomic', 'tides']);
  });

  it('opens the Pontoon, and shuts Houses on land and the Missile Silo', () => {
    const { s } = harbour();
    const p = s.players[0];
    expect(buildBarred(p, 'pontoon')).toBeNull();
    expect(buildBarred(p, 'house')).toBeTruthy();
    expect(buildBarred(p, 'silo')).toBeTruthy();
    enter(s, 0, 'tides');
    expect(buildBarred(p, 'pontoon')).toBeTruthy();
    expect(buildBarred(p, 'house')).toBeNull();
  });
});

describe('mooring a Pontoon', () => {
  it('goes only on open water a ship sails, beside the shore or its own deck', () => {
    const { s, spot } = harbour();
    const p = s.players[0];
    expect(placeProblem(s, 'pontoon', p.startX - 6, p.startY - 6, true, 0)).toBe('dry');
    // Out on the water with nothing to stand on beside it, its builders can't reach it.
    let far: { tx: number; ty: number } | null = null;
    for (let ty = 1; ty < s.h - 4 && !far; ty++) for (let tx = 1; tx < s.w - 4 && !far; tx++) if (placeProblem(s, 'pontoon', tx, ty, true, 0) === 'adrift') far = { tx, ty };
    expect(far).not.toBeNull();
    expect(placeProblem(s, 'pontoon', spot.tx, spot.ty, true, 0)).toBeNull();
  });

  it('is a deck its own people walk and ships go round, with room for 10', () => {
    const { s, spot } = harbour();
    countPop(s);
    const before = s.players[0].cap;
    const b = placeBuilding(s, 0, 'pontoon', spot.tx, spot.ty, true);
    const t = tile(s, b);
    expect(isDeck(s, t)).toBe(true);
    expect(walkable(s, t % s.w, Math.floor(t / s.w), s.players[0].team)).toBe(true);
    expect(walkable(s, t % s.w, Math.floor(t / s.w), s.players[1].team)).toBe(false);
    expect(walkable(s, t % s.w, Math.floor(t / s.w), NAVAL)).toBe(false);
    countPop(s);
    expect(s.players[0].cap - before).toBe(BUILDINGS.pontoon.pop);
  });
});

describe('linking a floating town', () => {
  it('raises citizens only in a district of three or more pontoons side by side', () => {
    const { s, spot } = harbour();
    const ps = row(s, spot, 3);
    expect(ps).toHaveLength(3);
    expect(districtOf(s, ps[0]).map((b) => b.id)).toEqual(ps.map((b) => b.id));
    // Two alone: no citizens.
    const third = ps.pop()!;
    third.hp = 0;
    run(s, 0.1);
    expect(raisesCitizens(s, ps[0])).toBe(false);
    step(s, [{ t: 'train', p: 0, building: ps[0].id, unit: 'citizen' }]);
    expect(ps[0].queue).toHaveLength(0);
    expect(s.events.some((e) => e.k === 'refused' && /Link 3 pontoons/.test(e.why))).toBe(true);
    // Moor the third back beside them: a floating town, and its citizen steps out onto the deck.
    const back = placeBuilding(s, 0, 'pontoon', third.tx, third.ty, true);
    expect(raisesCitizens(s, back)).toBe(true);
    const was = s.ents.filter((e) => e.kind === 'unit' && e.type === 'citizen' && e.owner === 0).length;
    step(s, [{ t: 'train', p: 0, building: ps[0].id, unit: 'citizen' }]);
    expect(ps[0].queue).toHaveLength(1);
    const citizens = () => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.type === 'citizen' && e.owner === 0);
    for (let i = 0; i < secs(60) && citizens().length === was; i++) step(s);
    const now = citizens();
    expect(now.length).toBe(was + 1);
    const born = now.reduce((a, b) => (b.id > a.id ? b : a));
    expect(isDeck(s, Math.floor(born.y) * s.w + Math.floor(born.x))).toBe(true);
  });

  it('launches fishing boats and takes in every kind of goods', () => {
    expect(BUILDINGS.pontoon.trains).toContain('fisher');
    expect(BUILDINGS.pontoon.drop.sort()).toEqual(['food', 'gold', 'stone', 'wood']);
  });
});

describe('towing a district', () => {
  it('casts off into a tow with its deck-hands aboard, and moors again where the tow lies', () => {
    const { s, spot } = harbour();
    const b = placeBuilding(s, 0, 'pontoon', spot.tx, spot.ty, true);
    const hands = [0, 1, 2].map((i) => spawnUnit(s, 0, 'citizen', b.tx + 0.5 + i, b.ty + 1.5));
    step(s, [{ t: 'pack', p: 0, building: b.id }]);
    expect(s.byId.has(b.id)).toBe(false);
    const tow = s.ents.find((e): e is Unit => e.kind === 'unit' && e.type === 'tow')!;
    expect(tow).toBeDefined();
    expect(tow.packed).toBe('pontoon');
    expect(tow.cargo.sort()).toEqual(hands.map((u) => u.id).sort());
    expect(hands.every((u) => u.inside === tow.id)).toBe(true);
    // The water under it is open sea again.
    expect(sails(s, tile(s, b))).toBe(true);
    // Moored where it lies: it raises itself, and its people step out onto the new deck.
    step(s, [{ t: 'pitch', p: 0, ids: [tow.id] }]);
    expect(s.byId.has(tow.id)).toBe(false);
    const moored = s.ents.find((e): e is Building => e.kind === 'building' && e.type === 'pontoon')!;
    expect(moored.built).toBe(false);
    run(s, STEPPE.pitch + 1);
    expect(moored.built).toBe(true);
    expect(hands.every((u) => !u.inside && u.hp > 0)).toBe(true);
    expect(hands.every((u) => isDeck(s, Math.floor(u.y) * s.w + Math.floor(u.x)))).toBe(true);
  });

  it('moors out on the open water too, where no builder could stand', () => {
    const { s, spot } = harbour();
    const b = placeBuilding(s, 0, 'pontoon', spot.tx, spot.ty, true);
    step(s, [{ t: 'pack', p: 0, building: b.id }]);
    const tow = s.ents.find((e): e is Unit => e.kind === 'unit' && e.type === 'tow')!;
    // Find water out of any builder's reach that the tow can sail to.
    let far: { tx: number; ty: number } | null = null;
    for (let ty = 1; ty < s.h - 4 && !far; ty++) for (let tx = 1; tx < s.w - 4 && !far; tx++) if (placeProblem(s, 'pontoon', tx, ty, true, 0) === 'adrift') far = { tx, ty };
    tow.x = far!.tx + 1.5;
    tow.y = far!.ty + 1.5;
    step(s, [{ t: 'pitch', p: 0, ids: [tow.id] }]);
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'pontoon')).toBe(true);
  });

  it('is cast off only by a floating people or its keepsake, and not while aground', () => {
    const { s, spot } = harbour();
    const b = placeBuilding(s, 0, 'pontoon', spot.tx, spot.ty, true);
    const p = s.players[0];
    expect(castProblem(s, p, b)).toBeNull();
    enter(s, 0, 'tides');
    expect(castProblem(s, p, b)).toMatch(/floating people/);
    b.keep = 'floating';
    expect(castProblem(s, p, b)).toBeNull();
    // With no open water round it (the tide out, or its own districts all round), it can't be towed out.
    for (let y = b.ty - 1; y <= b.ty + b.size; y++) for (let x = b.tx - 1; x <= b.tx + b.size; x++) if (x < b.tx || y < b.ty || x >= b.tx + b.size || y >= b.ty + b.size) s.terrain[y * s.w + x] = T_GRASS;
    expect(castProblem(s, p, b)).toMatch(/Aground/);
  });
});

describe('a district holed and sunk', () => {
  it('takes three times the damage from a ship that anything else would do', () => {
    const { s, spot } = harbour();
    const b = placeBuilding(s, 0, 'pontoon', spot.tx, spot.ty, true);
    const dock = placeBuilding(s, 0, 'dock', 2, 2, true);
    const st = unitStats('warship', 5);
    expect(damageOf(s, null, st, b, true)).toBeCloseTo(damageOf(s, null, st, dock, true) * FLOAT.hull);
    const foot = unitStats('infantry', 5);
    expect(damageOf(s, null, foot, b, false)).toBeCloseTo(damageOf(s, null, foot, dock, false));
  });

  it('leaves its deck-hands to swim for the shore, or drown out of reach', () => {
    const { s, spot } = harbour();
    const ps = row(s, spot, 3);
    const near = spawnUnit(s, 0, 'citizen', ps[0].x, ps[0].y);
    const far = spawnUnit(s, 0, 'citizen', ps[ps.length - 1].x, ps[ps.length - 1].y);
    // Sink the one out at the end first: from its middle the shore lies farther than a swim.
    const out = ps[ps.length - 1];
    ps[1].hp = 0;
    out.hp = 0;
    step(s);
    expect(s.events.some((e) => e.k === 'pontoon' && e.act === 'sink')).toBe(true);
    const walkOn = (u: Unit) => walkable(s, Math.floor(u.x), Math.floor(u.y), s.players[0].team);
    expect(far.hp <= 0 || walkOn(far)).toBe(true);
    // The one by the shore stands on its deck still.
    expect(near.hp).toBeGreaterThan(0);
    expect(walkOn(near)).toBe(true);
  });
});

describe('the floating city in online play and saves', () => {
  it('casts off, tows and moors the same way after a save', () => {
    const { s, spot } = harbour();
    const b = placeBuilding(s, 0, 'pontoon', spot.tx, spot.ty, true);
    spawnUnit(s, 0, 'citizen', b.x, b.y);
    step(s, [{ t: 'pack', p: 0, building: b.id }]);
    const t = deserialize(serialize(s));
    const tow = (g: GameState) => g.ents.find((e) => e.kind === 'unit' && e.type === 'tow')!.id;
    for (const g of [s, t]) {
      step(g, [{ t: 'pitch', p: 0, ids: [tow(g)] }]);
      run(g, STEPPE.pitch + 2);
    }
    expect(checksum(t)).toBe(checksum(s));
  });
});
