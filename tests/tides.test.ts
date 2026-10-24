import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, BUILDINGS, ROADS, TIDE, secs } from '../src/sim/data';
import { buildBarred, roadKnown, roadProblem } from '../src/sim/ages';
import { checksum, createGame, step } from '../src/sim/game';
import { NAVAL, placeProblem, walkable } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import { TIDE_CAUSEWAY, TIDE_TOP, aground, bared, isTidal, millShares, tidalLevel, tidalNear, tideClock, tideLevel, tideMillIdle } from '../src/sim/tides';
import type { AgeId, Building, GameState, MapType } from '../src/sim/types';
import { T_SAND, T_WATER } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Water Road's sixth age (#739): a tide clock everyone sees, flats that bare at low water, Tide Mills and causeways. */

const make = (seed = 1, mapType: MapType = 'lakes') =>
  createGame({ seed, size: 'medium', mapType, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) step(s);
};
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};
/** Seconds in one step of the tide. */
const STEP = TIDE.period / (2 * TIDE_TOP);

/** A lakes map with player 0 in the Age of Tides, the tide awake, and nothing to fight. */
function tidal(seed = 1): GameState {
  const s = make(seed);
  s.peaceUntil = 1e9;
  s.animals = [];
  enter(s, 0, 'tides');
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  step(s);
  return s;
}

/** Run the tide on to a level. */
function toLevel(s: GameState, level: number): void {
  for (let i = 0; i < secs(TIDE.period) * 2 && tideLevel(s) !== level; i++) step(s);
  expect(tideLevel(s)).toBe(level);
  // The turn itself is played on the next step.
  step(s);
}

/** Tidal tiles of a level, away from the map's edge. */
const tiles = (s: GameState, k: number) => [...s.tidal!.keys()].filter((i) => s.tidal![i] === k && i % s.w > 3 && i % s.w < s.w - 4 && i / s.w > 3 && i / s.w < s.h - 4);

describe('the tide clock', () => {
  it('stands still at high water until a people enters the Age of Tides', () => {
    const s = make();
    const before = Uint8Array.from(s.terrain);
    run(s, 30);
    expect(tideClock(s)).toBeNull();
    expect(s.tidal).toBeUndefined();
    expect(tideLevel(s)).toBe(TIDE_TOP);
    expect(Uint8Array.from(s.terrain)).toEqual(before);
  });

  it('wakes for everyone when one people enters, and falls to low water and back on a public clock', () => {
    const s = tidal();
    expect(s.tideFrom).toBeDefined();
    expect(tideClock(s)!.level).toBe(TIDE_TOP);
    const seen: number[] = [];
    for (let k = 0; k < 2 * TIDE_TOP; k++) {
      seen.push(tideLevel(s, s.tideFrom! + k * secs(STEP)));
    }
    expect(seen).toEqual([3, 2, 1, 0, 1, 2]);
    expect(tideLevel(s, s.tideFrom! + secs(TIDE.period))).toBe(TIDE_TOP);
    const c = tideClock(s)!;
    expect(c.rising).toBe(false);
    expect(c.toLow).toBeCloseTo(STEP * TIDE_TOP, 0);
  });
});

describe('the tidal ground', () => {
  it('is the open sea\'s shallows only, a level for each depth', () => {
    const s = tidal();
    for (let k = 1; k <= TIDE_TOP; k++) expect(tiles(s, k).length, `level ${k}`).toBeGreaterThan(10);
    for (const i of tiles(s, 1).concat(tiles(s, TIDE_TOP))) expect(s.terrain[i]).toBe(T_WATER);
  });

  it('bares the shallowest first as the tide falls, walked and not sailed, and covers it again as it rises, as it was', () => {
    const s = tidal();
    const terrain = Uint8Array.from(s.terrain);
    const height = Float32Array.from(s.height);
    const top = tiles(s, TIDE_TOP)[0];
    const deep = tiles(s, 1)[0];
    toLevel(s, TIDE_TOP - 1);
    expect(bared(s, top)).toBe(true);
    expect(bared(s, deep)).toBe(false);
    toLevel(s, 0);
    for (const t of [top, deep]) {
      expect(s.terrain[t]).toBe(T_SAND);
      expect(walkable(s, t % s.w, Math.floor(t / s.w))).toBe(true);
      expect(walkable(s, t % s.w, Math.floor(t / s.w), NAVAL)).toBe(false);
    }
    toLevel(s, TIDE_TOP);
    expect(Uint8Array.from(s.terrain)).toEqual(terrain);
    expect(Float32Array.from(s.height)).toEqual(height);
  });

  it('sweeps whoever stands on the flats ashore, hurt, when the water comes back', () => {
    const s = tidal();
    toLevel(s, 0);
    const t = tiles(s, 1).find((i) => bared(s, i))!;
    const u = spawnUnit(s, 1, 'infantry', (t % s.w) + 0.5, Math.floor(t / s.w) + 0.5);
    const hp = u.hp;
    toLevel(s, 1);
    expect(u.hp).toBeLessThan(hp);
    const at = Math.floor(u.y) * s.w + Math.floor(u.x);
    if (u.hp > 0) {
      expect(at).not.toBe(t);
      expect(walkable(s, Math.floor(u.x), Math.floor(u.y))).toBe(true);
    }
  });

  it('keeps buildings off ground the tide comes back to', () => {
    const s = tidal();
    toLevel(s, 0);
    const t = tiles(s, TIDE_TOP).find((i) => bared(s, i))!;
    expect(placeProblem(s, 'house', t % s.w, Math.floor(t / s.w), true, 0)).toBe('tidal');
  });
});

/** A spot for a Tide Mill with the most tidal ground in reach, near the first tidal tile. */
function millSpot(s: GameState): { tx: number; ty: number } {
  let best: { tx: number; ty: number } | null = null;
  let most = 0;
  for (let ty = 2; ty < s.h - 3; ty++)
    for (let tx = 2; tx < s.w - 3; tx++) {
      if (placeProblem(s, 'tidemill', tx, ty, true, 0)) continue;
      const n = tidalNear(s, { tx, ty, size: 2 }).length;
      if (n > most) {
        most = n;
        best = { tx, ty };
      }
    }
  return best!;
}

describe('Tide Mills', () => {
  it('grind gold each turn of the tide, more with more tidal ground near, and sleep out of the age', () => {
    const s = tidal();
    const at = millSpot(s);
    const mill = placeBuilding(s, 0, 'tidemill', at.tx, at.ty, true);
    expect(tideMillIdle(s, mill)).toBeNull();
    const share = millShares(s).get(mill.id)!;
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThanOrEqual(TIDE.mill.gold);
    const gold = s.players[0].res.gold;
    run(s, STEP * 2 + 1);
    expect(s.players[0].res.gold).toBeGreaterThanOrEqual(gold + share * 2 - 0.001);
    expect(s.players[0].stats.milled).toBeGreaterThan(0);
    // A second mill beside it shares the same ground: the two grind no more than the first did alone.
    const two = placeBuilding(s, 0, 'tidemill', at.tx, at.ty + (placeProblem(s, 'tidemill', at.tx, at.ty + 2, true, 0) ? -2 : 2), true);
    const shares = millShares(s);
    expect((shares.get(mill.id) ?? 0) + (shares.get(two.id) ?? 0)).toBeLessThanOrEqual(TIDE.mill.gold * 2);
    expect(shares.get(mill.id)).toBe(share);
    enter(s, 0, 'atomic');
    expect(tideMillIdle(s, mill)).toMatch(/Age of Tides/);
    expect(millShares(s).size).toBe(0);
  });
});

describe('causeways', () => {
  it('go on the shallow sea or the flats, never the deep', () => {
    const s = tidal();
    const t = tiles(s, 1)[0];
    expect(placeProblem(s, 'causeway', t % s.w, Math.floor(t / s.w), true, 0)).toBeNull();
    let deep = -1;
    for (let i = 0; i < s.w * s.h && deep < 0; i++) if (s.terrain[i] === T_WATER && !isTidal(s, i) && placeProblem(s, 'causeway', i % s.w, Math.floor(i / s.w), true, 0) === 'deep') deep = i;
    expect(deep).toBeGreaterThanOrEqual(0);
  });

  it('once laid are tidal ground of the top level: walked at every level but high water', () => {
    const s = tidal();
    const t = tiles(s, 1)[0];
    const tx = t % s.w;
    const ty = Math.floor(t / s.w);
    applyCommand(s, { t: 'wall', p: 0, ids: [], x0: tx, y0: ty, x1: tx, y1: ty, causeway: true });
    const site = s.ents.find((e) => e.kind === 'building' && e.type === 'causeway') as Building;
    expect(site).toBeDefined();
    site.built = true;
    site.hp = BUILDINGS.causeway.hp;
    run(s, 1);
    expect(s.byId.has(site.id)).toBe(false);
    expect(s.tidal![t]).toBe(TIDE_CAUSEWAY);
    expect(tidalLevel(s, t)).toBe(TIDE_TOP);
    expect(s.players[0].stats.causeways).toBe(1);
    toLevel(s, TIDE_TOP - 1);
    expect(bared(s, t)).toBe(true);
    toLevel(s, TIDE_TOP);
    expect(bared(s, t)).toBe(false);
  });
});

describe('the road and its door', () => {
  it('turns off the Atomic Age once a Dock stands by a shore, and leads back', () => {
    const r = ROADS.find((x) => x.from === 'atomic' && x.to === 'tides')!;
    expect(r.clue).toBe('dock');
    expect(ROADS.some((x) => x.from === 'tides' && x.to === 'atomic')).toBe(true);
    const s = make();
    enter(s, 0, 'atomic');
    expect(roadKnown(s, s.players[0], r)).toBe(false);
    expect(AGES.tides.routes).toEqual(['water']);
    void roadProblem;
  });

  it('raises no Missile Silo', () => {
    const s = tidal();
    expect(buildBarred(s.players[0], 'silo')).toMatch(/Missile Silo/);
  });

  it('a Dock with only bared flats beside it launches nothing until the water comes back', () => {
    const s = tidal();
    // A dock spot whose water beside it is all tidal ground.
    let dock: Building | null = null;
    for (let i = 0; i < s.w * s.h && !dock; i++) {
      const tx = i % s.w;
      const ty = Math.floor(i / s.w);
      if (placeProblem(s, 'dock', tx, ty, true, 0)) continue;
      let ok = true;
      for (let y = ty - 1; y <= ty + 2 && ok; y++)
        for (let x = tx - 1; x <= tx + 2; x++) {
          const j = y * s.w + x;
          if (s.terrain[j] === T_WATER && s.tidal![j] === 0) ok = false;
        }
      if (ok) dock = placeBuilding(s, 0, 'dock', tx, ty, true);
    }
    expect(dock).not.toBeNull();
    expect(aground(s, dock!)).toBe(false);
    toLevel(s, 0);
    expect(aground(s, dock!)).toBe(true);
    applyCommand(s, { t: 'train', p: 0, building: dock!.id, unit: 'fisher' });
    const ships = () => s.ents.filter((e) => e.kind === 'unit' && e.type === 'fisher').length;
    const before = ships();
    run(s, STEP - 2);
    expect(ships()).toBe(before);
    toLevel(s, 2);
    run(s, 1);
    expect(ships()).toBe(before + 1);
  });
});

describe('determinism', () => {
  it('saves and loads mid-tide, and plays out the same way', () => {
    const s = tidal();
    toLevel(s, 1);
    const saved = deserialize(serialize(s));
    run(saved, STEP * 3);
    run(s, STEP * 3);
    expect(checksum(saved)).toBe(checksum(s));
    expect(serialize(saved)).toBe(serialize(s));
  });
});
