import { describe, expect, it } from 'vitest';
import { CAVE, RARE, WOLF } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { RARE_OF_TILE } from '../src/sim/units';
import type { GameState } from '../src/sim/types';

/** Caves (#356 s2): rich ore tiles, some guarded by wolves. */
const world = (seed: number, size: 'small' | 'medium' = 'medium'): GameState =>
  createGame({ seed, size, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

describe('caves', () => {
  it('exist only where the world holds an ore, and every cave holds one of them richly', () => {
    let any = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = world(seed);
      if (!(s.rares ?? []).length) expect(s.caves ?? []).toHaveLength(0);
      for (const c of s.caves ?? []) {
        any++;
        expect(s.rares).toContain(c.ore);
        expect(RARE_OF_TILE[s.res[c.tile]]).toBe(c.ore);
        expect(s.amount[c.tile]).toBe(RARE[c.ore].amount * CAVE.rich);
      }
      expect((s.caves ?? []).length).toBeLessThanOrEqual(CAVE.count.medium);
    }
    expect(any).toBeGreaterThan(0);
  });

  it('keep clear of towns and of each other', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = world(seed);
      const cs = (s.caves ?? []).map((c) => ({ x: (c.tile % s.w) + 0.5, y: Math.floor(c.tile / s.w) + 0.5 }));
      for (const c of cs) for (const p of s.players) expect(Math.hypot(c.x - p.startX, c.y - p.startY)).toBeGreaterThanOrEqual(CAVE.away);
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) expect(Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y)).toBeGreaterThanOrEqual(CAVE.apart);
    }
  });

  it('a den cave has a wolf pack beside it, and some caves are dens and some are not', () => {
    let dens = 0;
    let quiet = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = world(seed);
      for (const c of s.caves ?? []) {
        const cx = (c.tile % s.w) + 0.5;
        const cy = Math.floor(c.tile / s.w) + 0.5;
        const wolves = s.animals.filter((a) => a.kind === 'wolf' && Math.hypot(a.x - cx, a.y - cy) < 3).length;
        if (c.den) {
          dens++;
          expect(wolves).toBeGreaterThanOrEqual(WOLF.pack);
        } else quiet++;
      }
    }
    expect(dens).toBeGreaterThan(0);
    expect(quiet).toBeGreaterThan(0);
  });

  it('the same seed digs the same caves', () => {
    expect(world(7).caves).toEqual(world(7).caves);
  });
});
