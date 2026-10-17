import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { MERC, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { swordsOf, wageBill } from '../src/sim/merc';
import { deserialize, serialize } from '../src/sim/save';
import type { Building, GameState } from '../src/sim/types';
import { placeBuilding, restat } from '../src/sim/world';

/** Hired swords (the Age of Merchants) draw wages, and walk off if left unpaid. */
const merchants = (): { s: GameState; market: Building } => {
  const s = createGame({ seed: 11, size: 'small', startEpoch: 2, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.rares = [];
  const p = s.players[0];
  restat(s, p, () => { p.age = 'merchant'; p.epoch = 2; });
  p.res = { food: 0, wood: 0, stone: 0, gold: 9000 };
  p.cap = 200;
  const spot = findSpot(s, 'market', p.startX, p.startY, 6, 24)!;
  const market = placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
  return { s, market };
};
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const hire = (s: GameState, market: Building, n: number) => {
  for (let i = 0; i < n; i++) step(s, [{ t: 'train', p: 0, building: market.id, unit: 'infantry' }]);
  run(s, 40 + MERC.first);
};

describe('hired swords draw wages (Age of Merchants)', () => {
  it('marks a soldier hired at the Market, and not one trained at a Barracks', () => {
    const { s, market } = merchants();
    hire(s, market, 2);
    expect(swordsOf(s, 0).length).toBe(2);
    expect(wageBill(s, 0)).toBe(2 * MERC.wage);
    const rax = placeBuilding(s, 0, 'barracks', findSpot(s, 'barracks', s.players[0].startX, s.players[0].startY, 6, 24)!.tx, findSpot(s, 'barracks', s.players[0].startX, s.players[0].startY, 6, 24)!.ty, true);
    s.players[0].res = { food: 900, wood: 900, stone: 0, gold: 900 };
    step(s, [{ t: 'train', p: 0, building: rax.id, unit: 'infantry' }]);
    run(s, 40);
    expect(s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'infantry').length).toBe(3);
    expect(swordsOf(s, 0).length).toBe(2);
  });

  it('pays each sword every payday from the treasury', () => {
    const { s, market } = merchants();
    hire(s, market, 3);
    const before = s.players[0].res.gold;
    const paidBefore = s.players[0].stats.wages ?? 0;
    const start = s.tick;
    const paydays = Math.floor((start + secs(60)) / secs(MERC.every)) - Math.floor(start / secs(MERC.every));
    run(s, 60);
    expect(s.players[0].res.gold).toBe(before - paydays * 3 * MERC.wage);
    expect(s.players[0].stats.wages! - paidBefore).toBe(paydays * 3 * MERC.wage);
    expect(swordsOf(s, 0).every((u) => u.merc === 0)).toBe(true);
  });

  it('with the purse empty, falls a payday behind and then walks off', () => {
    const { s, market } = merchants();
    hire(s, market, 2);
    s.players[0].res.gold = 0;
    const saw: { late: number; gone: number }[] = [];
    for (let i = 0; i < secs(MERC.every * (MERC.patience + 1)); i++) {
      step(s);
      for (const ev of s.events) if (ev.k === 'wages') saw.push({ late: ev.late, gone: ev.gone });
    }
    expect(saw[0]).toEqual({ late: 2, gone: 0 });
    expect(saw[1]).toEqual({ late: 2, gone: 2 });
    expect(swordsOf(s, 0).length).toBe(0);
  });

  it('forgives a payday if the purse is filled in time', () => {
    const { s, market } = merchants();
    hire(s, market, 1);
    s.players[0].res.gold = 0;
    run(s, MERC.every);
    expect(swordsOf(s, 0)[0].merc).toBe(1);
    s.players[0].res.gold = 500;
    run(s, MERC.every);
    expect(swordsOf(s, 0)[0].merc).toBe(0);
  });

  it('survives a save', () => {
    const { s, market } = merchants();
    hire(s, market, 1);
    s.players[0].res.gold = 0;
    run(s, MERC.every);
    const back = deserialize(serialize(s));
    expect(swordsOf(back, 0)[0].merc).toBe(1);
  });
});
