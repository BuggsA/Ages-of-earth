import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { techProblem, modsOf } from '../src/sim/stats';

/** Salt Curing (#356): salt's everyday use. Behind an ore door, open only where the world holds salt. */
const world = (seed: number) => createGame({ seed, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

describe('Salt Curing', () => {
  it('is shut where the world has no salt, and asks for mined salt where it has', () => {
    let with_ = 0, without = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = world(seed);
      s.players[0].epoch = 1;
      if (s.rares?.includes('salt')) {
        with_++;
        expect(techProblem(s, 0, 'saltCuring')).toMatch(/Mine 30 salt first \(0\/30\)/);
        s.players[0].stats.mined = { salt: 30 };
        expect(techProblem(s, 0, 'saltCuring')).toBeNull();
      } else {
        without++;
        s.players[0].stats.mined = { salt: 30 };
        expect(techProblem(s, 0, 'saltCuring')).toMatch(/no salt in this world/);
      }
    }
    expect(with_).toBeGreaterThan(0);
    expect(without).toBeGreaterThan(0);
  });

  it('speeds hunting and foraging and adds to what citizens carry', () => {
    const s = world(1);
    const p = s.players[0];
    p.epoch = 1;
    const before = modsOf(s, 0);
    p.techs.push('saltCuring');
    p.statsVersion++;
    const after = modsOf(s, 0);
    expect(after.carry).toBe(before.carry + 2);
    expect(after.hunt).toBeCloseTo(before.hunt * 1.25);
    expect(after.forage).toBeCloseTo(before.forage * 1.15);
  });
});
