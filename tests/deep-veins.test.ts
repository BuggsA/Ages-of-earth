import { describe, expect, it } from 'vitest';
import { CAVE, RARE } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { applyCommand } from '../src/sim/commands';
import { RARE_OF_TILE } from '../src/sim/units';
import { spawnUnit } from '../src/sim/world';
import { RARES } from '../src/sim/types';
import type { GameState } from '../src/sim/types';

/** Deep veins (#356): rare ores that only some seeds hold, mined and kept apart from the four stocks. */
const world = (seed: number, size: 'small' | 'medium' = 'medium'): GameState =>
  createGame({ seed, size, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const veinTiles = (s: GameState, id: string) => {
  const out: number[] = [];
  for (let i = 0; i < s.res.length; i++) if (RARE_OF_TILE[s.res[i]] === id) out.push(i);
  return out;
};

describe('deep veins', () => {
  it('the seed decides which ores a world holds, and some worlds hold none of one', () => {
    const seen = new Map<string, number>();
    for (let seed = 1; seed <= 40; seed++) for (const id of world(seed, 'small').rares ?? []) seen.set(id, (seen.get(id) ?? 0) + 1);
    for (const id of RARES) {
      expect(seen.get(id) ?? 0).toBeGreaterThan(0);
      expect(seen.get(id) ?? 0).toBeLessThan(40);
    }
  });

  it('a world lists exactly the ores it shows on the map, each with ore in it', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = world(seed);
      for (const id of RARES) {
        const tiles = veinTiles(s, id);
        expect(tiles.length > 0).toBe((s.rares ?? []).includes(id));
        for (const t of tiles) expect(s.amount[t]).toBe(RARE[id].amount * ((s.caves ?? []).some((c) => c.tile === t) ? CAVE.rich : 1));
      }
    }
  });

  it('the same seed lays the same veins', () => {
    const a = world(5);
    const b = world(5);
    expect(Array.from(a.res)).toEqual(Array.from(b.res));
    expect(a.rares).toEqual(b.rares);
  });

  it('veins keep clear of every town', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = world(seed);
      for (const id of s.rares ?? []) {
        for (const t of veinTiles(s, id)) {
          for (const p of s.players) {
            const d = Math.hypot((t % s.w) + 0.5 - p.startX, Math.floor(t / s.w) + 0.5 - p.startY);
            expect(d).toBeGreaterThanOrEqual(RARE[id].away - 3);
          }
        }
      }
    }
  });

  it('citizens mine a vein and pay the ore into the rare store, not the four stocks', () => {
    let s: GameState | null = null;
    let id = RARES[0];
    for (let seed = 1; seed <= 40 && !s; seed++) {
      const w = world(seed, 'small');
      if (w.rares?.length) {
        s = w;
        id = w.rares[0];
      }
    }
    expect(s).not.toBeNull();
    const g = s!;
    const tile = veinTiles(g, id)[0];
    const p = g.players[0];
    const before = { ...p.res };
    // Stand the miners at the vein with a Town Center-like drop beside them: a Storehouse on the spot.
    const c = spawnUnit(g, 0, 'citizen', (tile % g.w) + 0.5, Math.floor(tile / g.w) + 1.6);
    applyCommand(g, { t: 'gather', p: 0, ids: [c.id], tile });
    expect(c.order.k === 'gather' && c.order.res).toBe('stone');
    for (let i = 0; i < 4000 && !(p.rare?.[id] ?? 0); i++) step(g);
    expect(p.rare?.[id] ?? 0).toBeGreaterThan(0);
    expect(p.res.stone).toBe(before.stone);
  });
});
