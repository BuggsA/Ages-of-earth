import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { techProblem, statsFor } from '../src/sim/stats';

/** Blood-Forged Blades (#356): blood-iron's use outside roads. A forge tech behind an ore door. */
const world = (seed: number) => createGame({ seed, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

describe('Blood-Forged Blades', () => {
  it('is shut where the world has no blood-iron, and asks for mined ore where it has', () => {
    let with_ = 0, without = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = world(seed);
      const p = s.players[0];
      p.epoch = 3;
      p.techs.push('forging', 'ironCasting');
      if (s.rares?.includes('bloodiron')) {
        with_++;
        expect(techProblem(s, 0, 'bloodForged')).toMatch(/Mine 30 blood-iron first \(0\/30\)/);
        p.stats.mined = { bloodiron: 30 };
        expect(techProblem(s, 0, 'bloodForged')).toBeNull();
      } else {
        without++;
        p.stats.mined = { bloodiron: 30 };
        expect(techProblem(s, 0, 'bloodForged')).toMatch(/no blood-iron in this world/);
      }
    }
    expect(with_).toBeGreaterThan(0);
    expect(without).toBeGreaterThan(0);
  });

  it('hits harder and shields: melee +1, armor +1', () => {
    const s = world(1);
    const p = s.players[0];
    p.epoch = 3;
    const before = statsFor(s, 0, 'infantry');
    p.techs.push('bloodForged');
    p.statsVersion++;
    const after = statsFor(s, 0, 'infantry');
    expect(after.attack).toBeCloseTo(before.attack + 1);
    expect(after.armor).toBeCloseTo(before.armor + 1);
  });
});
