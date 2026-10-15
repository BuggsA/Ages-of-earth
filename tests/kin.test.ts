import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { favours, groveBoost, kinBonus } from '../src/sim/landmarks';
import { spawnUnit } from '../src/sim/world';

describe('peoples and their landmark', () => {
  it("strengthens only the favoured kind's bonus, for that people alone", () => {
    const s = createGame({ seed: 7, size: 'small', players: [{ name: 'C', ai: null, civ: 'chinese' }, { name: 'R', ai: null, civ: 'romans' }] });
    expect(favours(s, 0, 'grove')).toBe(true);
    expect(favours(s, 1, 'grove')).toBe(false);
    expect(kinBonus(s, 0, 'grove', 0.8)).toBeCloseTo(0.8 * LANDMARKS.kinMul);
    expect(kinBonus(s, 0, 'spring', 0.8)).toBe(0.8);
    const m = s.landmarks![0];
    m.kind = 'grove';
    m.owner = 0;
    const chinese = spawnUnit(s, 0, 'priest', m.x + 3, m.y);
    expect(groveBoost(s, chinese)).toBeCloseTo(1 + (LANDMARKS.grove.priest - 1) * LANDMARKS.kinMul);
    m.owner = 1;
    const roman = spawnUnit(s, 1, 'priest', m.x + 3, m.y);
    expect(groveBoost(s, roman)).toBe(LANDMARKS.grove.priest);
  });
});
