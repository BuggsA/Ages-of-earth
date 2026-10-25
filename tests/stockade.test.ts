import { describe, expect, it } from 'vitest';
import { AGES, BUILDINGS, SPOILS } from '../src/sim/data';
import { buildBarred } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { trainCostFor } from '../src/sim/stats';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The Warband's Spoils Stockade (#727): a forward bank paying three quarters of a pack, arming foot soldiers a tenth cheaper. */

const game = (age: AgeId = 'warband'): GameState => {
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
const stockade = (s: GameState, dx: number): Building => {
  const b = placeBuilding(s, 0, 'stockade', tc(s).tx + dx, tc(s).ty, true);
  b.built = true;
  b.hp = BUILDINGS.stockade.hp;
  return b;
};

describe('the Spoils Stockade is the Warband\'s own building (#727)', () => {
  it('is raised only in the Warband, trains foot soldiers, and is its keepsake', () => {
    expect(BUILDINGS.stockade.ages).toEqual(['warband']);
    expect(BUILDINGS.stockade.trains).toEqual(['infantry']);
    expect(AGES.warband.keepsake!.building).toBe('stockade');
    expect(buildBarred(game().players[0], 'stockade')).toBeNull();
    expect(buildBarred(game('middle').players[0], 'stockade')).not.toBeNull();
  });

  it('banks a laden soldier\'s pack at three quarters, far from any home', () => {
    const s = game();
    const b = stockade(s, 30);
    const u = spawnUnit(s, 0, 'infantry', b.x, b.y + 2);
    u.spoils = 80;
    for (let i = 0; i < 40 && u.spoils; i++) step(s);
    expect(u.spoils).toBeUndefined();
    expect(s.players[0].res.gold).toBe(Math.round(80 * SPOILS.stockadeCut));
  });

  it('a soldier out of reach of every bank keeps its pack, and one at the Town Center banks it whole', () => {
    const s = game();
    const far = spawnUnit(s, 0, 'infantry', tc(s).x + 30, tc(s).y + 30);
    far.spoils = 50;
    for (let i = 0; i < 40; i++) step(s);
    expect(far.spoils).toBe(50);
    const home = spawnUnit(s, 0, 'infantry', tc(s).x, tc(s).y + 3);
    home.spoils = 40;
    const before = s.players[0].res.gold;
    for (let i = 0; i < 40 && home.spoils; i++) step(s);
    expect(s.players[0].res.gold - before).toBe(40);
  });

  it('a kept stockade arms foot soldiers a tenth cheaper; one not kept in the Middle Ages pays full', () => {
    const s = game('middle');
    const full = trainCostFor(s, 0, 'infantry', 'barracks', { x: 0, y: 0 });
    const kept = trainCostFor(s, 0, 'infantry', 'stockade', { x: 0, y: 0, keep: 'warband' });
    expect(kept.food).toBe(Math.round(full.food! * 0.9));
  });
});
