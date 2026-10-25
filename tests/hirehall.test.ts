import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { AGES, BUILDINGS, HIREHALL, MERC, secs } from '../src/sim/data';
import { asleep, buildBarred } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { swordsOf } from '../src/sim/merc';
import { trainCostFor } from '../src/sim/stats';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding, restat } from '../src/sim/world';

/** The Merchants' Hire Hall (#727): swords signed there are paid once, dearer, and draw no wages. */

const game = (age: AgeId = 'merchant'): GameState => {
  const s = createGame({ seed: 11, size: 'small', startEpoch: 2, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.rares = [];
  s.peaceUntil = 1e9;
  const p = s.players[0];
  restat(s, p, () => { p.age = age; p.epoch = AGES[age].tier; });
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  p.cap = 200;
  return s;
};
const put = (s: GameState, type: 'hirehall' | 'market'): Building => {
  const p = s.players[0];
  const spot = findSpot(s, type, p.startX, p.startY, type === 'market' ? 6 : 12, 24)!;
  return placeBuilding(s, 0, type, spot.tx, spot.ty, true);
};

describe('the Hire Hall is the Age of Merchants\' own building (#727)', () => {
  it('is raised only in the Age of Merchants, trains the hired lines, and is the age\'s keepsake', () => {
    expect(BUILDINGS.hirehall.ages).toEqual(['merchant']);
    expect(BUILDINGS.hirehall.trains).toEqual(['infantry', 'ranged', 'cavalry']);
    expect(AGES.merchant.keepsake!.building).toBe('hirehall');
    expect(buildBarred(game().players[0], 'hirehall')).toBeNull();
    expect(buildBarred(game('bronze').players[0], 'hirehall')).not.toBeNull();
  });

  it('prices a sword in gold alone, dearer than the Market\'s hire; kept, it holds that price on any road', () => {
    const s = game();
    const market = trainCostFor(s, 0, 'infantry', 'market').gold!;
    const hall = trainCostFor(s, 0, 'infantry', 'hirehall', { x: 0, y: 0 });
    expect(Object.keys(hall)).toEqual(['gold']);
    expect(hall.gold!).toBeGreaterThan(market);
    expect(Math.abs(hall.gold! - market * HIREHALL.dear)).toBeLessThanOrEqual(5);
    const later = game('middle');
    expect(trainCostFor(later, 0, 'infantry', 'hirehall', { x: 0, y: 0, keep: 'merchant' })).toEqual(hall);
    expect(trainCostFor(later, 0, 'infantry', 'hirehall', { x: 0, y: 0 })).not.toEqual(hall);
  });

  it('a sword signed at the Hall draws no wages; one hired at the Market does', () => {
    const s = game();
    const hall = put(s, 'hirehall');
    const market = put(s, 'market');
    for (let i = 0; i < 2; i++) step(s, [{ t: 'train', p: 0, building: hall.id, unit: 'cavalry' }]);
    step(s, [{ t: 'train', p: 0, building: market.id, unit: 'infantry' }]);
    for (let i = 0; i < secs(60 + MERC.first); i++) step(s);
    const riders = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'cavalry');
    expect(riders.length).toBe(2);
    expect(riders.every((u) => u.kind === 'unit' && u.merc === undefined)).toBe(true);
    expect(swordsOf(s, 0).length).toBe(1);
  });

  it('sleeps outside the Age of Merchants unless it is the one kept', () => {
    const s = game('middle');
    const h = put(s, 'hirehall');
    expect(asleep(s, h)).toBe(true);
    h.keep = 'merchant';
    expect(asleep(s, h)).toBe(false);
  });
});
