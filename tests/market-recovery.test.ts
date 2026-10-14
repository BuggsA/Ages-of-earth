import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { MARKET, secs } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { findSpot } from '../src/sim/ai';
import { placeBuilding } from '../src/sim/world';

const game = () => createGame({ seed: 7, size: 'small', startEpoch: 1, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
const interval = secs(MARKET.every);

describe('recovering market prices', () => {
  it('waits for the scheduled interval, restores low and high prices, and leaves baseline prices alone', () => {
    const s = game();
    s.market.food = MARKET.start.food - 4;
    s.market.wood = MARKET.start.wood + 4;
    for (let i = 0; i < interval; i++) step(s);
    expect(s.market).toEqual({ food: 96, wood: 104, stone: MARKET.start.stone });
    step(s);
    expect(s.market).toEqual({ food: 97, wood: 103, stone: MARKET.start.stone });
  });

  it('returns extreme prices to equilibrium without overshooting', () => {
    const s = game();
    s.market.food = MARKET.min; s.market.wood = MARKET.max;
    for (let i = 1; i <= MARKET.max; i++) {
      s.tick = i * interval; step(s);
      expect(s.market.food).toBeLessThanOrEqual(MARKET.start.food);
      expect(s.market.wood).toBeGreaterThanOrEqual(MARKET.start.wood);
    }
    expect(s.market).toEqual(MARKET.start);
  });

  it('does not recover on a paused or ended match', () => {
    const s = game(); s.tick = interval - 1; s.market.food = MARKET.min;
    const frozen = s.market.food;
    // Pausing leaves the rules unticked; finished matches reject ticks entirely.
    s.over = true; step(s);
    expect(s.market.food).toBe(frozen); expect(s.tick).toBe(interval - 1);
  });

  it('keeps recovery timing and all prices identical after save/load', () => {
    const s = game(); s.tick = interval - 2;
    s.market.food = MARKET.min; s.market.stone = MARKET.max;
    const loaded = deserialize(serialize(s));
    for (let i = 0; i < interval + 4; i++) { step(s); step(loaded); }
    expect(loaded.market).toEqual(s.market);
    expect(checksum(loaded)).toBe(checksum(s));
    expect(serialize(loaded)).toBe(serialize(s));
  });

  it('shares transaction shocks across players and preserves a loss on immediate round trips', () => {
    const s = game();
    for (const p of s.players) {
      const spot = findSpot(s, 'market', p.startX, p.startY, 5, 15)!;
      placeBuilding(s, p.id, 'market', spot.tx, spot.ty, true);
      p.res = { food: 1000, wood: 1000, stone: 1000, gold: 1000 };
    }
    const before = s.players[0].res.gold;
    applyCommand(s, { t: 'trade', p: 0, res: 'food', buy: true });
    expect(s.market.food).toBe(MARKET.start.food + MARKET.step);
    applyCommand(s, { t: 'trade', p: 0, res: 'food', buy: false });
    expect(s.market.food).toBe(MARKET.start.food);
    expect(s.players[0].res.gold).toBeLessThan(before);
    applyCommand(s, { t: 'trade', p: 1, res: 'food', buy: false });
    expect(s.market.food).toBe(MARKET.start.food - MARKET.step);
    s.tick = interval; step(s);
    expect(s.market.food).toBe(MARKET.start.food - MARKET.step + MARKET.recover);
    const beforeReverse = s.players[1].res.gold;
    applyCommand(s, { t: 'trade', p: 1, res: 'wood', buy: false });
    applyCommand(s, { t: 'trade', p: 1, res: 'wood', buy: true });
    expect(s.players[1].res.gold).toBeLessThan(beforeReverse);
  });
});
