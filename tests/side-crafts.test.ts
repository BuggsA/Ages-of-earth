import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { modsOf, techProblem } from '../src/sim/stats';

describe('side-age crafts', () => {
  const game = () => createGame({ seed: 11, size: 'small', startEpoch: 2, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  it.each([['ropewalk', 'sail', 'shipRange', 1], ['credit', 'merchant', 'techCost', 0.85]] as const)('%s works only in its age', (tech, age, mod, val) => {
    const s = game();
    const p = s.players[0];
    expect(techProblem(s, 0, tech)).toContain('Only in');
    p.age = age;
    p.statsVersion++;
    expect(techProblem(s, 0, tech)).toBeNull();
    p.techs.push(tech);
    p.statsVersion++;
    const here = modsOf(s, 0)[mod];
    p.age = undefined;
    p.statsVersion++;
    expect(modsOf(s, 0)[mod]).not.toBe(here);
    expect(here).toBeCloseTo(mod === 'techCost' ? val * (modsOf(s, 0).techCost) : val);
  });
});
