import { describe, expect, it } from 'vitest';
import { ROT, SEASON, SEASONS, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { hitAnimal, spawnAnimal } from '../src/sim/animals';
import { landOwnerAt } from '../src/sim/borders';
import { walkable } from '../src/sim/grid';
import { seasonAt } from '../src/sim/seasons';
import type { GameState } from '../src/sim/types';
import { R_NONE } from '../src/sim/types';

/** The year turns: summer for foraging, winter for the hunt. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const len = SEASON.len * TICK_HZ;

describe('seasons', () => {
  it('turn every SEASON.len seconds, through all four, from spring', () => {
    const s = game();
    const first = seasonAt(s, 0);
    const seen = [0, 1, 2, 3, 4].map((i) => seasonAt(s, i * len));
    expect(seen[0]).toBe(first);
    expect(seen[4]).toBe(first);
    expect(new Set(seen.slice(0, 4)).size).toBe(4);
    expect(seasonAt(s, len - 1)).toBe(first);
    expect(first).toBe(0);
    expect(SEASONS[first].name).toBe('Spring');
  });

  it('announces each turn once', () => {
    const s = game();
    const turns: number[] = [];
    for (let i = 0; i < len * 2 + 5; i++) {
      step(s);
      for (const e of s.events) if (e.k === 'season') turns.push(e.i);
    }
    expect(turns).toEqual([seasonAt(s, len), seasonAt(s, 2 * len)]);
  });

  it('keep meat longer in winter than in summer', () => {
    const rotted = (season: number): number => {
      const s = game();
      // Find a start tick inside the wanted season.
      s.tick = [0, 1, 2, 3, 4].map((i) => i * len).find((t) => seasonAt(s, t) === season)!;
      let spot = { x: 0, y: 0 };
      outer: for (let y = 10; y < s.h - 10; y++)
        for (let x = 10; x < s.w - 10; x++)
          if (landOwnerAt(s, x, y) < 0 && walkable(s, x, y) && s.res[y * s.w + x] === R_NONE && s.players.every((p) => Math.hypot(x - p.startX, y - p.startY) > 20)) {
            spot = { x: x + 0.5, y: y + 0.5 };
            break outer;
          }
      const a = spawnAnimal(s, spot.x, spot.y, 'mammoth');
      hitAnimal(s, a, 9999, spot.x - 1, spot.y);
      const c = s.carcasses![s.carcasses!.length - 1];
      const before = s.amount[c.tile];
      for (let i = 0; i < (ROT.grace + 30) * TICK_HZ; i++) step(s);
      return before - s.amount[c.tile];
    };
    const summer = rotted(SEASONS.findIndex((x) => x.name === 'Summer'));
    const winter = rotted(SEASONS.findIndex((x) => x.name === 'Winter'));
    expect(winter).toBeGreaterThan(0);
    expect(summer).toBeGreaterThan(winter * 2);
  });
});
