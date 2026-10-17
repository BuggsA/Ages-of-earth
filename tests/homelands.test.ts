import { describe, expect, it } from 'vitest';
import { HOMELANDS, HOMELAND_IDS, MAP_TYPES } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { generateMap, rollHomeland, type MapData } from '../src/sim/mapgen';
import { findResource } from '../src/sim/units';
import { R_BERRY, R_FISH, R_GOLD, R_STONE, R_TREE, T_WATER } from '../src/sim/types';
import type { HomelandId, MapType } from '../src/sim/types';

/** Homelands (#473): what lies round every town at the start, rolled by the seed. */

/** Tiles of a resource (or, with `water`, water tiles: T_WATER and R_BERRY share a number) within `r` of a town. */
const within = (m: MapData, st: { x: number; y: number }, kind: number, r: number, water = false) => {
  let n = 0;
  for (let y = Math.max(0, st.y - r); y <= Math.min(m.h - 1, st.y + r); y++) {
    for (let x = Math.max(0, st.x - r); x <= Math.min(m.w - 1, st.x + r); x++) {
      if ((x + 0.5 - st.x) ** 2 + (y + 0.5 - st.y) ** 2 > r * r) continue;
      if (water ? m.terrain[y * m.w + x] === T_WATER : m.res[y * m.w + x] === kind) n++;
    }
  }
  return n;
};
const deerNear = (m: MapData, st: { x: number; y: number }, r: number) => m.deer.filter((d) => (d.x - st.x) ** 2 + (d.y - st.y) ** 2 <= r * r).length;
const mammothNear = (m: MapData, st: { x: number; y: number }) =>
  Math.min(...m.wild.filter((w) => w.kind === 'mammoth').map((w) => Math.sqrt((w.x - st.x) ** 2 + (w.y - st.y) ** 2)));
const map = (seed: number, hl: HomelandId, type: MapType = 'continental', players = 2) => generateMap(seed, 'small', players, type, true, true, hl);

describe('homelands (#473)', () => {
  it('rolls every homeland across seeds, by map type, the same each time for a seed', () => {
    const seen = new Set<HomelandId>();
    for (const type of Object.keys(MAP_TYPES) as MapType[]) {
      const here = new Set<HomelandId>();
      for (let seed = 1; seed <= 40; seed++) {
        const hl = rollHomeland(seed, type);
        seen.add(hl);
        here.add(hl);
        expect(rollHomeland(seed, type)).toBe(hl);
        // A map type that never holds a homeland never rolls it.
        expect(HOMELANDS[hl].weight[type]).toBeGreaterThan(0);
      }
      expect(here.size, type).toBeGreaterThanOrEqual(3);
    }
    expect([...seen].sort()).toEqual([...HOMELAND_IDS].sort());
    // The map is drawn for the homeland its seed rolls (or, where a Shore has no room for every mere, a Glade).
    for (const seed of [1, 2]) expect(['glade', rollHomeland(seed, 'continental')]).toContain(generateMap(seed, 'small', 2, 'continental', true, true).homeland);
  });

  it('keeps campaign maps as they were (the Glade), and a game remembers its homeland', () => {
    for (let seed = 1; seed <= 6; seed++) expect(generateMap(seed, 'small', 2, 'continental', false, false).homeland).toBe('glade');
    const players = [{ name: 'A', ai: null }, { name: 'B', ai: null }];
    expect(createGame({ seed: 3, size: 'small', homeland: 'herds', players }).homeland).toBe('herds');
    // A setup that names none (from before homelands) draws the Glade; a match from the menu rolls one.
    expect(createGame({ seed: 3, size: 'small', players }).homeland).toBe('glade');
    expect(['glade', rollHomeland(3, 'plains')]).toContain(createGame({ seed: 3, size: 'small', mapType: 'plains', homeland: 'random', players }).homeland);
  });

  it('gives every town the simple path on every homeland: berries, gold, stone and wood near home', () => {
    for (const hl of HOMELAND_IDS) {
      for (const type of Object.keys(MAP_TYPES) as MapType[]) {
        for (const seed of [2]) {
          const s = createGame({ seed, size: 'small', mapType: type, homeland: hl, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
          for (const p of s.players) {
            for (const kind of [R_BERRY, R_GOLD, R_STONE]) expect(findResource(s, kind, p.startX, p.startY, 14), `${hl} ${type} ${seed} ${kind}`).toBeGreaterThanOrEqual(0);
            expect(findResource(s, R_TREE, p.startX, p.startY, 16), `${hl} ${type} ${seed} wood`).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('the Shore: a mere with shoals by every town, and only a thin berry bush', () => {
    for (const type of ['continental', 'plains', 'lakes'] as MapType[]) {
      for (const seed of [1, 4, 8]) {
        const m = map(seed, 'shore', type);
        for (const st of m.starts) {
          expect(within(m, st, T_WATER, 20, true), `${type} ${seed}`).toBeGreaterThanOrEqual(40);
          expect(within(m, st, R_FISH, 20), `${type} ${seed}`).toBeGreaterThanOrEqual(4);
          expect(within(m, st, R_BERRY, 10)).toBeLessThanOrEqual(HOMELANDS.shore.berries);
        }
      }
    }
  });

  it('the Herd Plains: two herds and a mammoth close, few berries', () => {
    for (const seed of [1, 4, 8]) {
      const m = map(seed, 'herds', 'plains');
      for (const st of m.starts) {
        expect(deerNear(m, st, 16)).toBeGreaterThan(deerNear(map(seed, 'glade', 'plains'), st, 16));
        expect(mammothNear(m, st)).toBeLessThan(15);
        expect(within(m, st, R_BERRY, 10)).toBeLessThanOrEqual(HOMELANDS.herds.berries);
      }
    }
  });

  it('the Deep Wood: woods close in, a berry thicket, no herd near home', () => {
    for (const seed of [1, 4, 8]) {
      const m = map(seed, 'wood', 'forest');
      const g = map(seed, 'glade', 'forest');
      m.starts.forEach((st, k) => {
        expect(within(m, st, R_TREE, 10)).toBeGreaterThan(within(g, g.starts[k], R_TREE, 10));
        expect(within(m, st, R_BERRY, 13)).toBeGreaterThanOrEqual(HOMELANDS.wood.berries + HOMELANDS.wood.thicket - 2);
        expect(deerNear(m, st, 15)).toBe(0);
      });
    }
  });

  it('is fair: every town on a map gets the same kit', () => {
    for (const hl of HOMELAND_IDS) {
      for (const players of [2, 4]) {
        const m = map(5, hl, 'continental', players);
        const kit = m.starts.map((st) => [within(m, st, R_BERRY, 13), within(m, st, R_GOLD, 13), within(m, st, R_STONE, 13)].join());
        expect(new Set(kit).size, `${hl} ${players}: ${kit.join(' | ')}`).toBe(1);
      }
    }
  });

  it('the computer reads the Shore: a Dock and boats in the first minutes, which it does not rush on the Glade', () => {
    const run = (hl: HomelandId) => {
      const s = createGame({ seed: 4, size: 'small', homeland: hl, players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }] });
      for (let i = 0; i < 3 * 60 * 20; i++) step(s);
      const boats = s.ents.filter((e) => e.kind === 'unit' && e.type === 'fisher' && e.owner === 0).length;
      const dock = s.ents.some((e) => e.kind === 'building' && e.type === 'dock' && e.owner === 0);
      return { boats, dock, fished: s.players[0].stats.fished };
    };
    const shore = run('shore');
    expect(shore.dock).toBe(true);
    expect(shore.boats).toBeGreaterThanOrEqual(2);
    expect(shore.fished).toBeGreaterThan(0);
    expect(run('glade').dock).toBe(false);
  });
});
