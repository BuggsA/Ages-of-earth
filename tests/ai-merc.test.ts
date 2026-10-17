import { describe, expect, it } from 'vitest';
import { AI_MERC, MERC, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { findSpot } from '../src/sim/ai';
import { swordsOf } from '../src/sim/merc';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import { trainCostFor } from '../src/sim/stats';
import type { Building } from '../src/sim/types';

/** The computer's hired swords (#420): it hires at the Market only with the keep of every sword left in the purse. */
function setup(gold: number) {
  const s = createGame({ seed: 7, size: 'medium', peaceMinutes: 30, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'normal', civ: 'greeks' }] });
  s.rares = [];
  const p = s.players[1];
  restat(s, p, () => { p.age = 'merchant'; p.epoch = 2; });
  p.res = { food: 0, wood: 0, stone: 0, gold };
  p.cap = 200;
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
  // Enough citizens that it is past raising them (it trains soldiers only then).
  for (let i = 0; i < 6; i++) spawnUnit(s, 1, 'citizen', tc.x + 2 + i, tc.y + 4);
  const spot = findSpot(s, 'market', tc.x, tc.y, 6, 24)!;
  const market = placeBuilding(s, 1, 'market', spot.tx, spot.ty, true) as Building;
  return { s, market };
}
const run = (s: ReturnType<typeof setup>['s'], seconds: number) => { for (let i = 0; i < seconds * TICK_HZ; i++) step(s); };

describe('the computer hires swords only with their keep in the purse', () => {
  it('hires none one gold short of the cheapest hire and its keep, and one with the dearest and its keep', () => {
    const probe = setup(0).s;
    const prices = (['infantry', 'ranged', 'cavalry'] as const).map((u) => trainCostFor(probe, 1, u, 'market').gold ?? 0);
    const keep = AI_MERC.reserve * MERC.wage;
    const hired = (gold: number) => {
      const { s, market } = setup(gold);
      run(s, 30);
      return swordsOf(s, 1).length + market.queue.length;
    };
    expect(hired(Math.min(...prices) + keep - 1)).toBe(0);
    expect(hired(Math.max(...prices) + keep)).toBeGreaterThan(0);
  });

  it('hires with a full purse', () => {
    const { s } = setup(4000);
    run(s, 120);
    expect(swordsOf(s, 1).length).toBeGreaterThan(0);
  });
});
