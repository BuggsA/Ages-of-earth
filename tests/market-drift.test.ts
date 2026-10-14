import { describe, expect, it } from 'vitest';
import { MARKET, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';

describe('Market prices recover', () => {
  it('drift back toward their start, from above and from below, and stop there', () => {
    const s = createGame({ seed: 3, size: 'small', startEpoch: 0, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    s.market.food = MARKET.start.food - 8;
    s.market.wood = MARKET.start.wood + 8;
    const run = (secs: number) => { for (let i = 0; i < secs * TICK_HZ; i++) step(s); };
    run(MARKET.every * 3 + 1);
    expect(s.market.food).toBe(MARKET.start.food - 8 + 3);
    expect(s.market.wood).toBe(MARKET.start.wood + 8 - 3);
    run(MARKET.every * 20);
    expect(s.market.food).toBe(MARKET.start.food);
    expect(s.market.wood).toBe(MARKET.start.wood);
    expect(s.market.stone).toBe(MARKET.start.stone);
  });
});
