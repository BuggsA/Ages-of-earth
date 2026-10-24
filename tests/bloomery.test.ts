import { describe, expect, it } from 'vitest';
import { AGES, BLOOMERY, BUILDINGS } from '../src/sim/data';
import { asleep, buildBarred } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { trainCostFor } from '../src/sim/stats';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The Iron Age's Bloom Hearth (#727): bog iron smelted at it counts twice toward the edge, it arms spearmen, and kept it holds their price. */

const game = (age: AgeId = 'iron'): GameState => {
  const s = createGame({ seed: 1, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  const p = s.players[0];
  p.epoch = AGES[age].tier;
  p.age = age;
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 0 };
  return s;
};
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const hearth = (s: GameState, dx = 6): Building => placeBuilding(s, 0, 'bloomery', tc(s).tx + dx, tc(s).ty, true);

describe('the Bloom Hearth is the Iron Age\'s own building (#727)', () => {
  it('is raised only in the Iron Age, trains foot soldiers, takes gold, and is the age\'s keepsake', () => {
    expect(BUILDINGS.bloomery.ages).toEqual(['iron']);
    expect(BUILDINGS.bloomery.trains).toEqual(['infantry']);
    expect(BUILDINGS.bloomery.drop).toContain('gold');
    expect(AGES.iron.keepsake!.building).toBe('bloomery');
    expect(buildBarred(game().players[0], 'bloomery')).toBeNull();
    expect(buildBarred(game('bronze').players[0], 'bloomery')).not.toBeNull();
  });

  it('smelts the bog iron hauled to it: each bar counts again toward the edge', () => {
    const s = game();
    const h = hearth(s);
    h.built = true;
    h.hp = BUILDINGS.bloomery.hp;
    const p = s.players[0];
    const u = spawnUnit(s, 0, 'citizen', h.x, h.y + 2);
    const bars = 10;
    u.carryRes = 'gold';
    u.carry = bars * 2;
    u.order = { k: 'gather', tile: 0, res: 'gold', phase: 'drop', bog: true };
    p.stats.iron = 0;
    for (let i = 0; i < 60 && u.carry > 0; i++) step(s);
    expect(u.carry).toBe(0);
    expect(p.stats.iron).toBe(bars * (BLOOMERY.smelt - 1));
  });

  it('a plain gold miner at the hearth smelts nothing', () => {
    const s = game();
    const h = hearth(s);
    h.built = true;
    const u = spawnUnit(s, 0, 'citizen', h.x, h.y + 2);
    u.carryRes = 'gold';
    u.carry = 10;
    u.order = { k: 'gather', tile: 0, res: 'gold', phase: 'drop' };
    for (let i = 0; i < 60 && u.carry > 0; i++) step(s);
    expect(s.players[0].stats.iron ?? 0).toBe(0);
  });

  it('a kept hearth goes on arming spearmen at the Iron Age\'s price; one not kept pays full', () => {
    const s = game('middle');
    const full = trainCostFor(s, 0, 'infantry', 'bloomery', { x: 0, y: 0 });
    const kept = trainCostFor(s, 0, 'infantry', 'bloomery', { x: 0, y: 0, keep: 'iron' });
    expect(kept.food).toBe(Math.round(full.food! * AGES.iron.price!.infantry!));
    expect(trainCostFor(s, 0, 'infantry', 'bloomery', { x: 0, y: 0, keep: 'sail' })).toEqual(full);
  });

  it('sleeps outside the Iron Age unless it is the one kept', () => {
    const s = game('middle');
    const h = hearth(s);
    expect(asleep(s, h)).toBe(true);
    h.keep = 'iron';
    expect(asleep(s, h)).toBe(false);
  });
});
