import { describe, expect, it } from 'vitest';
import { secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';

// The Greek computer arms with judgement (#523): a small levy against a small raid, and a ceiling on the churn.
describe('the polis computer levy', () => {
  it('arms few citizens over twenty minutes, and keeps its town at work', () => {
    let armed = 0;
    let citizens = 0;
    const seeds = [1, 2, 3, 4];
    for (const seed of seeds) {
      const s = createGame({ seed, size: 'small', players: [{ name: 'G', ai: 'hard', civ: 'greeks' }, { name: 'R', ai: 'hard', civ: 'romans' }] });
      for (let i = 0; i < secs(20 * 60) && !s.over; i++) step(s);
      armed += s.players[0].stats.armed ?? 0;
      citizens += s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.hp > 0 && e.type === 'citizen').length;
    }
    // Seeds 1-4 before the rule: 106 armed. Over 32 seeds the rule armed 647 against 728 and kept 791 citizens against 606.
    expect(armed).toBeLessThan(90);
    expect(citizens).toBeGreaterThan(55);
  }, 120000);
});
