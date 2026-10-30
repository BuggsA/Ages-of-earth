import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, ROADS, VENT, secs } from '../src/sim/data';
import { buildBarred, roadKnown, roadProblem, workRate } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { findSpot } from '../src/sim/ai';
import { forgeAt, forgeHot, scaldProblem, ventOf } from '../src/sim/forge';
import { generateMap } from '../src/sim/mapgen';
import { RES } from '../src/sim/types';
import type { AgeId, Building, BuildingType, GameEvent, GameState, MapType } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Deep Road's fourth age (#876 s4, #884): the Age of Deep Forges, vents by every town and the forges raised over them. */

const make = (seed = 2, mapType: MapType = 'continental', players = 2) =>
  createGame({ seed, size: 'small', mapType, players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, ai: null })) });
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
  p.walked = ['megaliths', 'delvings', 'undercity'];
  p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
};
/** A finished Vent Forge of `o`'s over its home vent. */
const forge = (s: GameState, o = 0): Building => {
  const at = forgeAt(s, s.vents![o]);
  expect(placeProblem(s, 'ventforge', at.tx, at.ty, true, o)).toBeNull();
  return placeBuilding(s, o, 'ventforge', at.tx, at.ty, true);
};
/** A finished building of `type` of `o`'s, its middle as near (x, y) as it fits, at least `near` tiles out. */
const raise = (s: GameState, type: BuildingType, x: number, y: number, o = 0, near = 0) => {
  const spot = findSpot(s, type, x, y, near, 30, 1, (tx, ty) => !placeProblem(s, type, tx, ty, true, o))!;
  return placeBuilding(s, o, type, spot.tx, spot.ty, true);
};
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec); i++) step(s);
};
const far = (b: Building, f: Building) => Math.sqrt((b.x - f.x) * (b.x - f.x) + (b.y - f.y) * (b.y - f.y));

describe('the road (#884)', () => {
  it('is the Deep Road\'s tier 4, instead of the Industrial Age: a climb from the Undercity, a turn from Industrial, and back at Industrial or Atomic', () => {
    expect(AGES.forges.tier).toBe(AGES.industrial.tier);
    expect(AGES.forges.routes).toEqual(['deep']);
    expect(AGES.forges.verb && AGES.forges.door && AGES.forges.good).toBeTruthy();
    expect(AGES.forges.keepsake?.building).toBe('ventforge');
    const climb = ROADS.find((r) => r.from === 'undercity' && r.to === 'forges')!;
    const turn = ROADS.find((r) => r.from === 'industrial' && r.to === 'forges')!;
    expect(climb.walked).toBe('undercity');
    expect(turn.walked).toBe('undercity');
    expect(ROADS.some((r) => r.from === 'forges' && r.to === 'industrial')).toBe(true);
    expect(ROADS.some((r) => r.from === 'forges' && r.to === 'atomic')).toBe(true);
    const s = make();
    enter(s, 0, 'undercity');
    const p = s.players[0];
    expect(roadKnown(s, p, climb)).toBe(true);
    expect(roadProblem(s, p, climb)).toBeNull();
    // A people that never lived below is not offered the turn.
    enter(s, 1, 'industrial');
    s.players[1].walked = [];
    expect(roadProblem(s, s.players[1], turn)).toBeTruthy();
  });

  it('needs nothing the map may lack: its roads and its forge cost only food, wood, stone and gold, with no deed, ore or clue; the forge burns no wood', () => {
    for (const r of ROADS.filter((r) => r.to === 'forges' || r.from === 'forges')) {
      for (const k of Object.keys(r.cost)) expect(RES).toContain(k);
      expect(r.deed).toBeUndefined();
      expect(r.ore).toBeUndefined();
      expect(r.found).toBeUndefined();
      expect(r.clue).toBeUndefined();
    }
    const s = make();
    expect(s.vents?.length).toBeGreaterThan(0);
    expect(createGame({ seed: 2, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] }).vents).toEqual(s.vents);
  });

  it('shuts the Airfield, keeps the tunnel going, and raises Vent Forges only in the age', () => {
    const s = make();
    enter(s, 0, 'forges');
    const p = s.players[0];
    expect(buildBarred(p, 'airfield')).toBeTruthy();
    expect(buildBarred(p, 'barrow')).toBeFalsy();
    expect(buildBarred(p, 'ventforge')).toBeFalsy();
    expect(buildBarred(p, 'stable')).toBeFalsy();
    enter(s, 1, 'industrial');
    expect(buildBarred(s.players[1], 'ventforge')).toBeTruthy();
    expect(buildBarred(s.players[1], 'airfield')).toBeFalsy();
  });
});

describe('a vent by every town (#884)', () => {
  it('lays one by every start on every kind of map, within reach, and a Vent Forge can be raised over it', () => {
    const types: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'];
    for (const mapType of types) {
      for (const [seed, n] of [[1, 2], [3, 3], [5, 4]] as const) {
        const s = make(seed, mapType, n);
        const vents = s.vents ?? [];
        // The towns' first, in start order, then one out on the map for every `VENT.per` towns.
        expect(vents.length, `${mapType} ${seed}`).toBe(n + Math.floor(n / VENT.per));
        for (const p of s.players) {
          const t = vents[p.id];
          const d = Math.sqrt(((t % s.w) - p.startX) ** 2 + (Math.floor(t / s.w) - p.startY) ** 2);
          expect(d, `${mapType} ${seed} P${p.id}`).toBeLessThanOrEqual(VENT.wide);
          const at = forgeAt(s, t);
          expect(placeProblem(s, 'ventforge', at.tx, at.ty, true, p.id), `${mapType} ${seed} P${p.id}`).toBeNull();
        }
        // The open ones lie well away from every town.
        for (const t of vents.slice(n)) for (const p of s.players) expect(Math.sqrt(((t % s.w) - p.startX) ** 2 + (Math.floor(t / s.w) - p.startY) ** 2)).toBeGreaterThanOrEqual(VENT.apart);
      }
    }
  });

  it('lays none on a campaign map, and the same ones for the same seed', () => {
    expect(generateMap(7, 'small', 2, 'continental', false, false).vents).toEqual([]);
    expect(generateMap(7, 'small', 2, 'continental', true, true).vents).toEqual(generateMap(7, 'small', 2, 'continental', true, true).vents);
  });

  it('takes a Vent Forge over a vent, one to a vent, nothing else on it, and a Deep Road people keeps the ground round it clear', () => {
    const s = make();
    const v = s.vents![0];
    const at = forgeAt(s, v);
    expect(placeProblem(s, 'ventforge', at.tx + 3, at.ty, true, 0)).toBe('vent');
    expect(placeProblem(s, 'ventforge', at.tx + 1, at.ty + 1, true, 0)).toBeNull();
    for (const type of ['house', 'barracks', 'wall'] as const) expect(placeProblem(s, type, v % s.w, Math.floor(v / s.w), true, 0)).toBe('hot');
    // Beside it: open to a people off the road, kept clear by one on it.
    expect(placeProblem(s, 'house', at.tx - 1, at.ty - 1, true, 0)).toBeNull();
    s.players[0].walked = ['megaliths'];
    expect(placeProblem(s, 'house', at.tx - 1, at.ty - 1, true, 0)).toBe('hot');
    const f = forge(s);
    expect(ventOf(s, f)).toBe(v);
    expect(placeProblem(s, 'ventforge', at.tx, at.ty, true, 1)).toBe('blocked');
  });
});

describe('the forges at work (#884)', () => {
  it('drives the buildings in reach half again as fast, and works the rest slow, only in the age', () => {
    const s = make();
    s.peaceUntil = 1e9;
    enter(s, 0, 'forges');
    const f = forge(s);
    const near = raise(s, 'barracks', f.x, f.y, 0, 3);
    const out = raise(s, 'range', f.x + (f.x < s.w / 2 ? 18 : -18), f.y, 0);
    expect(far(near, f)).toBeLessThanOrEqual(VENT.reach);
    expect(far(out, f)).toBeGreaterThan(VENT.reach);
    expect(forgeHot(s, f)).toBe(true);
    expect(workRate(s, near)).toBe(VENT.drive);
    expect(workRate(s, out)).toBe(VENT.cold);
    // A forge still rising drives nothing.
    f.built = false;
    expect(workRate(s, near)).toBe(VENT.cold);
    f.built = true;
    // Out of the age, the forge sleeps and nothing is slow.
    enter(s, 0, 'industrial');
    s.players[0].walked!.push('forges');
    expect(forgeHot(s, f)).toBe(false);
    expect(workRate(s, near)).toBe(100);
    expect(workRate(s, out)).toBe(100);
    // Kept, it drives on any road.
    f.keep = 'forges';
    expect(forgeHot(s, f)).toBe(true);
    expect(workRate(s, near)).toBe(VENT.drive);
    expect(workRate(s, out)).toBe(100);
  });

  it('trains faster by a hot forge than far from every one', () => {
    const s = make();
    s.peaceUntil = 1e9;
    enter(s, 0, 'forges');
    const f = forge(s);
    const near = raise(s, 'barracks', f.x, f.y, 0, 3);
    const out = raise(s, 'barracks', f.x + (f.x < s.w / 2 ? 18 : -18), f.y, 0);
    for (const b of [near, out]) applyCommand(s, { t: 'train', p: 0, building: b.id, unit: 'infantry' });
    const born = (b: Building) => s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'infantry' && far(e as unknown as Building, b) < 5).length;
    let first: Building | null = null;
    for (let i = 0; i < secs(120) && !first; i++) {
      step(s);
      if (born(near)) first = near;
      else if (born(out)) first = out;
    }
    expect(first).toBe(near);
  });

  it('goes cold while a rival\'s soldiers hold its vent, and warm again when one of its own stands there', () => {
    const s = make();
    s.peaceUntil = 1e9;
    enter(s, 0, 'forges');
    const f = forge(s);
    const near = raise(s, 'barracks', f.x, f.y, 0, 3);
    const v = ventOf(s, f);
    const foe = spawnUnit(s, 1, 'infantry', (v % s.w) + 0.5, Math.floor(v / s.w) + 0.5 + 2.4);
    foe.stance = 'stand';
    const seen: GameEvent[] = [];
    for (let i = 0; i < secs(2); i++) {
      step(s);
      seen.push(...s.events);
    }
    expect(f.held).toBe(true);
    expect(forgeHot(s, f)).toBe(false);
    expect(workRate(s, near)).toBe(VENT.cold);
    expect(seen.some((e) => e.k === 'vent' && e.what === 'cold' && e.by === 1)).toBe(true);
    const own = spawnUnit(s, 0, 'infantry', (v % s.w) + 0.5 + 2.4, Math.floor(v / s.w) + 0.5);
    own.stance = 'stand';
    run(s, 2);
    expect(f.held).toBeUndefined();
    expect(workRate(s, near)).toBe(VENT.drive);
  });

  it('scalds the rivals round its vent, then lies cold a while and can\'t scald again at once; its own are spared', () => {
    const s = make();
    s.peaceUntil = 0;
    enter(s, 0, 'forges');
    const f = forge(s);
    const v = ventOf(s, f);
    const cx = (v % s.w) + 0.5;
    const cy = Math.floor(v / s.w) + 0.5;
    const foe = spawnUnit(s, 1, 'infantry', cx, cy + 2.4);
    const far1 = spawnUnit(s, 1, 'infantry', cx, cy + VENT.scald + 3);
    const own = spawnUnit(s, 0, 'infantry', cx + 2.4, cy);
    const [hf, hfar, hown] = [foe.hp, far1.hp, own.hp];
    // Not the rival's to let out.
    expect(scaldProblem(s, 1, f)).toBeTruthy();
    applyCommand(s, { t: 'scald', p: 1, building: f.id });
    expect(foe.hp).toBe(hf);
    expect(scaldProblem(s, 0, f)).toBeNull();
    applyCommand(s, { t: 'scald', p: 0, building: f.id });
    expect(foe.hp).toBeLessThan(hf);
    expect(hf - foe.hp).toBeGreaterThanOrEqual(VENT.burn * 0.5);
    expect(far1.hp).toBe(hfar);
    expect(own.hp).toBe(hown);
    expect(s.players[0].stats.scalded).toBe(1);
    expect(forgeHot(s, f)).toBe(false);
    expect(scaldProblem(s, 0, f)).toMatch(/breathes again/);
    foe.hp = 0;
    run(s, VENT.spent + 1);
    expect(forgeHot(s, f)).toBe(true);
    run(s, VENT.again - VENT.spent);
    expect(scaldProblem(s, 0, f)).toBeNull();
  });
});
