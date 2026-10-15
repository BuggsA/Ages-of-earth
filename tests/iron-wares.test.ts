import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { ironTradeShare } from '../src/sim/ages';
import { AGES, IRON_TRADE } from '../src/sim/data';
import type { AgeId } from '../src/sim/types';

/** Iron wares: bog iron dug earlier raises trade in the trading ages. */
describe('iron wares', () => {
  const make = (age: AgeId, iron: number) => {
    const s = createGame({ seed: 1, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    s.players[0].epoch = AGES[age].tier;
    s.players[0].age = age;
    s.players[0].stats.iron = iron;
    return s;
  };
  it('pays more per steps of iron dug, up to a cap', () => {
    expect(ironTradeShare(make('merchant', 0), 0)).toBe(1);
    expect(ironTradeShare(make('merchant', IRON_TRADE.per - 1), 0)).toBe(1);
    expect(ironTradeShare(make('merchant', IRON_TRADE.per * 2), 0)).toBeCloseTo(1 + 2 * IRON_TRADE.each);
    expect(ironTradeShare(make('sail', 99999), 0)).toBeCloseTo(1 + IRON_TRADE.most * IRON_TRADE.each);
  });
  it('is for the trading ages only', () => {
    expect(ironTradeShare(make('middle', 500), 0)).toBe(1);
    expect(ironTradeShare(make('iron', 500), 0)).toBe(1);
    expect(ironTradeShare(make('fair', 150), 0)).toBeCloseTo(1 + 2 * IRON_TRADE.each);
  });
});
