import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { ageOf, ironTradeShare } from '../src/sim/ages';
import { AGES } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { tripGold } from '../src/sim/trade';
import type { GameState, TradePost } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

const game = (): GameState =>
  createGame({ seed: 11, size: 'small', startEpoch: 2, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

describe('iron on the cart', () => {
  it('merchants earn 5% more trade per 100 bog iron dug, up to six lots; other ages are untouched', () => {
    const s = game();
    const p = s.players[0];
    const spot = findSpot(s, 'market', p.startX, p.startY, 6, 24)!;
    const market = placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
    const post: TradePost = { id: 999, x: market.x + 70, y: market.y };
    p.age = 'merchant';
    p.statsVersion++;
    expect(ageOf(p)).toBe('merchant');
    const plain = tripGold(s, 0, market, post);
    p.stats.iron = 99;
    expect(ironTradeShare(s, 0)).toBe(1);
    p.stats.iron = 250;
    expect(ironTradeShare(s, 0)).toBeCloseTo(1.1);
    expect(tripGold(s, 0, market, post) / plain).toBeCloseTo(1.1, 1);
    p.stats.iron = 99999;
    const cap = AGES.merchant.ironTrade!;
    expect(ironTradeShare(s, 0)).toBeCloseTo(1 + cap.each * cap.most);
    p.age = undefined;
    p.statsVersion++;
    expect(ironTradeShare(s, 0)).toBe(1);
  });
});
