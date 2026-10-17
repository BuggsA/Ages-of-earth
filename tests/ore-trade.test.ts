import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { ORE_TRADE } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { applyCommand as apply } from '../src/sim/commands';
import { placeBuilding } from '../src/sim/world';

/** Rare ore sells at a Market for a flat price (#356 s5). */
const make = () => {
  const s = createGame({ seed: 1, size: 'small', startEpoch: 1, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  return s;
};

describe('selling rare ore', () => {
  it('needs a Market and a full lot, pays a flat price, and cannot be bought', () => {
    const s = make();
    const p = s.players[0];
    p.rare = { salt: ORE_TRADE.lot + 5 };
    const gold = p.res.gold;
    apply(s, { t: 'trade', p: 0, res: 'salt', buy: false });
    expect(p.res.gold).toBe(gold);
    const spot = findSpot(s, 'market', p.startX, p.startY, 6, 24)!;
    placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
    apply(s, { t: 'trade', p: 0, res: 'salt', buy: true });
    expect(p.rare.salt).toBe(ORE_TRADE.lot + 5);
    apply(s, { t: 'trade', p: 0, res: 'salt', buy: false });
    expect(p.res.gold).toBe(gold + ORE_TRADE.gold.salt);
    expect(p.rare.salt).toBe(5);
    apply(s, { t: 'trade', p: 0, res: 'salt', buy: false });
    expect(p.res.gold).toBe(gold + ORE_TRADE.gold.salt);
  });

  it('keeps the mined count that opens doors', () => {
    const s = make();
    const p = s.players[0];
    p.rare = { saltpetre: ORE_TRADE.lot };
    p.stats.mined = { saltpetre: 50 };
    const spot = findSpot(s, 'market', p.startX, p.startY, 6, 24)!;
    placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
    apply(s, { t: 'trade', p: 0, res: 'saltpetre', buy: false });
    expect(p.stats.mined.saltpetre).toBe(50);
    step(s);
  });

  it('a computer with a Market and ore in hand sells it', () => {
    const s = createGame({ seed: 1, size: 'small', startEpoch: 1, players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'britons' }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    const spot = findSpot(s, 'market', p.startX, p.startY, 6, 24)!;
    placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
    p.rare = { bloodiron: ORE_TRADE.lot * 2 };
    for (let i = 0; i < 400 && (p.rare.bloodiron ?? 0) > 0; i++) step(s);
    expect(p.rare.bloodiron ?? 0).toBe(0);
  });
});
