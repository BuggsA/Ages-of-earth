import { describe, expect, it } from 'vitest';
import { POLIS, secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import { seasonAt } from '../../src/sim/seasons';

// The Greek computer times its levy (#523): it brings the harvest in before it marches.
describe('the polis computer and the harvest', () => {
  it('sends no wave out in the harvest season', () => {
    let marched = 0;
    for (const seed of [4, 13]) {
      const s = createGame({ seed, size: 'small', players: [{ name: 'G', ai: 'hard', civ: 'greeks' }, { name: 'R', ai: 'hard', civ: 'romans' }] });
      let waves = 0;
      for (let i = 0; i < secs(16 * 60) && !s.over; i++) {
        step(s);
        const w = s.ai[0]?.wave ?? 0;
        if (w > waves) {
          waves = w;
          marched++;
          expect(seasonAt(s), `seed ${seed}: wave ${w} at ${(s.tick / 1200).toFixed(1)} min`).not.toBe(POLIS.harvest);
        }
      }
    }
    expect(marched).toBeGreaterThan(0);
  }, 60000);
});
