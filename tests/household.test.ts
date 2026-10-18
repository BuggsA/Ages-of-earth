import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { HOUSEHOLD, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { householdStep, mineable, raided, taxRate } from '../src/sim/household';
import { hurt } from '../src/sim/combat';
import { R_BOG, R_GOLD, R_TREE } from '../src/sim/types';
import type { Building, GameState, Unit } from '../src/sim/types';
import { countPop, placeBuilding, spawnUnit } from '../src/sim/world';
import { findResource } from '../src/sim/units';

// The household tax (#501, the Chinese): nobody mines gold; every house pays it, more on a street.
const game = () => createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'chinese' }, { name: 'B', ai: null, civ: 'greeks' }] });
const tcOf = (s: GameState, owner: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const house = (s: GameState, owner: number, dx: number, dy: number) => {
  const tc = tcOf(s, owner);
  const b = placeBuilding(s, owner, 'house', Math.floor(tc.x) + dx, Math.floor(tc.y) + dy, true);
  countPop(s);
  return b;
};

describe('the household tax', () => {
  it('lets Chinese citizens mine no gold or bog iron, and everyone else may', () => {
    const s = game();
    expect(mineable(s.players[0], R_GOLD)).toBe(false);
    expect(mineable(s.players[0], R_BOG)).toBe(false);
    expect(mineable(s.players[0], R_TREE)).toBe(true);
    expect(mineable(s.players[1], R_GOLD)).toBe(true);
  });

  it('refuses a gather order on a gold seam from a Chinese citizen, and takes it from a Greek one', () => {
    const s = game();
    const gold = findResource(s, R_GOLD, tcOf(s, 0).x, tcOf(s, 0).y, 60);
    expect(gold).toBeGreaterThanOrEqual(0);
    const cit = (o: number) => s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === o && e.type === 'citizen')!;
    const ch = cit(0);
    const gr = cit(1);
    applyCommand(s, { t: 'gather', p: 0, ids: [ch.id], tile: gold });
    applyCommand(s, { t: 'gather', p: 1, ids: [gr.id], tile: gold });
    expect(ch.order.k).not.toBe('gather');
    expect(gr.order.k).toBe('gather');
  });

  it('pays only a household people, and a lone house less than a house on a street', () => {
    const s = game();
    const p = s.players[0];
    const before = taxRate(s, 0);
    house(s, 0, 6, 6);
    const lone = taxRate(s, 0) - before;
    expect(lone).toBeGreaterThan(0);
    house(s, 0, 9, 6);
    house(s, 0, 6, 9);
    const three = taxRate(s, 0) - before;
    // Three houses side by side pay more than three scattered ones would: each has neighbours on its street.
    expect(three).toBeGreaterThan(lone * 3);
    expect(taxRate(s, 1)).toBe(0);
    expect(p.res.gold).toBeGreaterThanOrEqual(0);
  });

  it('counts a Market on the street as two houses', () => {
    const s = game();
    const h = house(s, 0, 6, 6);
    const alone = taxRate(s, 0);
    placeBuilding(s, 0, 'market', h.tx + 3, h.ty, true);
    countPop(s);
    expect(taxRate(s, 0)).toBeGreaterThan(alone);
  });

  it('pays into the treasury every few seconds, in proportion to a full town', () => {
    const s = game();
    house(s, 0, 6, 6);
    const p = s.players[0];
    const gold = p.res.gold;
    s.tick = secs(HOUSEHOLD.every) - 1;
    const rate = taxRate(s, 0);
    householdStep(s);
    expect(p.res.gold).toBe(gold);
    s.tick++;
    householdStep(s);
    expect(p.res.gold).toBeCloseTo(gold + rate * HOUSEHOLD.every, 6);
    expect(s.events.some((e) => e.k === 'tax' && e.owner === 0)).toBe(true);
    expect(p.stats.taxed).toBeGreaterThan(0);
  });

  it('takes a raid\'s share from the treasury when a rival razes a house, but not when it falls on its own', () => {
    const s = game();
    const h = house(s, 0, 6, 6);
    const p = s.players[0];
    const raider = spawnUnit(s, 1, 'infantry', h.x + 2, h.y + 2);
    p.res.gold = 100;
    s.players[1].res.gold = 0;
    expect(raided(s, h)).toBe(HOUSEHOLD.raid);
    hurt(s, h, 1e6, 1, raider);
    expect(p.res.gold).toBe(100 - HOUSEHOLD.raid);
    expect(s.players[1].res.gold).toBeGreaterThanOrEqual(HOUSEHOLD.raid);
    const h2 = house(s, 0, 9, 9);
    hurt(s, h2, 1e6, 0, null);
    expect(p.res.gold).toBe(100 - HOUSEHOLD.raid);
    // A Greek house razed costs its owner nothing extra.
    expect(raided(s, { type: 'house', owner: 1 })).toBe(0);
  });

  it('is deterministic over a stretch of play', () => {
    const run = () => {
      const s = createGame({ seed: 3, size: 'small', players: [{ name: 'A', ai: 'normal', civ: 'chinese' }, { name: 'B', ai: 'normal', civ: 'romans' }] });
      for (let i = 0; i < 20 * 60 * 3; i++) step(s);
      return [s.players[0].res.gold, s.players[0].stats.taxed ?? 0];
    };
    expect(run()).toEqual(run());
  });
});
