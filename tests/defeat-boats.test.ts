import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { GameState } from '../src/sim/types';
import { T_WATER } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

const game = (): GameState => createGame({ seed: 4, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

/** Everything of player 1's falls (it is cleared away on the next step). */
function strip(s: GameState): void {
  for (const e of s.ents) if (e.owner === 1) e.hp = 0;
}

/** Open water somewhere on the map. */
function water(s: GameState): { x: number; y: number } {
  for (let i = 0; i < s.w * s.h; i++) if (s.terrain[i] === T_WATER) return { x: (i % s.w) + 0.5, y: Math.floor(i / s.w) + 0.5 };
  throw new Error('no water');
}

describe('who is beaten', () => {
  it('a people down to fishing boats and merchant ships is beaten: they can neither build nor fight', () => {
    const s = game();
    strip(s);
    const w = water(s);
    spawnUnit(s, 1, 'fisher', w.x, w.y);
    spawnUnit(s, 1, 'cog', w.x, w.y);
    for (let i = 0; i < TICK_HZ * 2 && !s.over; i++) step(s);
    expect(s.players[1].defeated).toBe(true);
    expect(s.winner).toBe(0);
  });

  it('a warship, or a citizen, still keeps them in the match', () => {
    for (const type of ['warship', 'citizen'] as const) {
      const s = game();
      strip(s);
      const at = type === 'warship' ? water(s) : { x: s.players[1].startX, y: s.players[1].startY };
      spawnUnit(s, 1, type, at.x, at.y);
      for (let i = 0; i < TICK_HZ * 2 && !s.over; i++) step(s);
      expect(s.players[1].defeated, type).toBe(false);
    }
  });
});
