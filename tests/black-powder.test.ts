import { describe, expect, it } from 'vitest';
import { TECHS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { techProblem, statsFor } from '../src/sim/stats';

/** Black Powder (#356): saltpetre's use. A tech behind an ore door, open only where the world holds the ore. */
const world = (seed: number) => createGame({ seed, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

describe('Black Powder', () => {
  it('is shut where the world has no saltpetre, and asks for mined ore where it has', () => {
    let with_ = 0, without = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = world(seed);
      const p = s.players[0];
      p.epoch = 3;
      const has = !!s.rares?.includes('saltpetre');
      if (has) {
        with_++;
        expect(techProblem(s, 0, 'blackPowder')).toMatch(/Mine 40 saltpetre first \(0\/40\)/);
        p.stats.mined = { saltpetre: 40 };
        expect(techProblem(s, 0, 'blackPowder')).toBeNull();
      } else {
        without++;
        p.stats.mined = { saltpetre: 40 };
        expect(techProblem(s, 0, 'blackPowder')).toMatch(/no saltpetre in this world/);
      }
    }
    expect(with_).toBeGreaterThan(0);
    expect(without).toBeGreaterThan(0);
  });

  it('hits harder: ranged +1, siege x1.15', () => {
    const s = world(1);
    const p = s.players[0];
    p.epoch = 3;
    const before = statsFor(s, 0, 'ranged').attack;
    const siege = statsFor(s, 0, 'siege').attack;
    p.techs.push('blackPowder');
    p.statsVersion++;
    expect(statsFor(s, 0, 'ranged').attack).toBeCloseTo(before + 1);
    expect(statsFor(s, 0, 'siege').attack).toBeCloseTo(siege * TECHS.blackPowder.mul!.siegeAttack!);
  });
});
