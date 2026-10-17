import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { AGES, IRON_FORGE } from '../src/sim/data';
import { statsFor } from '../src/sim/stats';
import type { AgeId } from '../src/sim/types';

/** The Iron Age's forge: bog iron dug past the deed sharpens foot soldiers, up to a cap. */
describe('iron forge', () => {
  const make = (age: AgeId, iron: number) => {
    const s = createGame({ seed: 1, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    s.players[0].epoch = AGES[age].tier;
    s.players[0].age = age;
    s.players[0].stats.iron = iron;
    return s;
  };
  const edge = (age: AgeId, iron: number) => statsFor(make(age, iron), 0, 'infantry').attack;
  it('adds nothing at the deed, a step for each further `per` bars, and stops at the cap', () => {
    const base = edge('iron', IRON_FORGE.base);
    expect(edge('iron', IRON_FORGE.base + IRON_FORGE.per - 1)).toBe(base);
    expect(edge('iron', IRON_FORGE.base + IRON_FORGE.per)).toBe(base + IRON_FORGE.attack);
    expect(edge('iron', 99999)).toBe(base + IRON_FORGE.attack * IRON_FORGE.most);
  });
  it('is the Iron Age only', () => {
    expect(edge('stone', 99999)).toBe(edge('stone', 0));
  });
});
