import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import type { GameState, Unit } from '../../src/sim/types';

// Moved unchanged from tests/sim.test.ts: two 40-minute computer-vs-computer matches (about 40 s), the
// kind of test the slow tier is for (AGENTS.md §5). The rest of "the computer opponent" stays there.

const mine = (s: GameState, p: number) => s.ents.filter((e) => e.owner === p);
const citizens = (s: GameState, p: number) => mine(s, p).filter((e): e is Unit => e.kind === 'unit' && e.type === 'citizen');

describe('the computer opponent', () => {
  it('grows a town, advances and attacks; a hard opponent beats an easy one', () => {
    for (const seed of [21, 22]) {
      const s = createGame({ seed, size: 'small', players: [{ name: 'Hard', ai: 'hard' }, { name: 'Easy', ai: 'easy' }] });
      let maxCitizens = 0;
      for (let i = 0; i < 40 * 60 * TICK_HZ && !s.over; i++) {
        step(s);
        if (i % 1200 === 0) maxCitizens = Math.max(maxCitizens, citizens(s, 0).length);
      }
      expect(maxCitizens, `seed ${seed}`).toBeGreaterThan(20);
      expect(s.over, `seed ${seed}`).toBe(true);
      expect(s.winner, `seed ${seed}`).toBe(0);
      expect(s.players[0].epoch).toBeGreaterThanOrEqual(2);
    }
  }, 120000);
});
