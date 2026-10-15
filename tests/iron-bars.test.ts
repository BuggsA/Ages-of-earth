import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { modsOf } from '../src/sim/stats';
import { AGES, ROADS } from '../src/sim/data';

/** Iron bars (#197): in the Iron Age, bog iron pays double gold. */
describe('iron bars', () => {
  const make = (age?: 'iron' | 'bronze') => {
    const s = createGame({ seed: 1, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    if (age) {
      s.players[0].epoch = 1;
      s.players[0].age = age;
    }
    return s;
  };
  it('doubles bog gold only in the Iron Age', () => {
    expect(modsOf(make(), 0).bogGold).toBe(1);
    expect(modsOf(make('iron'), 0).bogGold).toBe(2);
    expect(modsOf(make('bronze'), 0).bogGold).toBe(1);
  });
  it('says so in the age and its road', () => {
    expect(AGES.iron.blurb).toMatch(/twice/);
    expect(ROADS.find((r) => r.to === 'iron')!.blurb).toMatch(/double/);
  });
});
