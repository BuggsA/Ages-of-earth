import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { findSpot, fairSpot } from '../src/sim/ai';
import { fairground } from '../src/sim/fair';
import type { AgeId, Building, Difficulty } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

/** The computer and feast days (#379 s1): its Market goes up on the fairground, by the relic Temple. */
function setup(level: Difficulty, age: AgeId) {
  const s = createGame({ seed: 7, size: 'medium', peaceMinutes: 30, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: level, civ: 'greeks' }] });
  const p = s.players[1];
  p.epoch = 3;
  p.age = age;
  for (const r of ['food', 'wood', 'gold', 'stone'] as const) p.res[r] = 3000;
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
  const ts = findSpot(s, 'temple', tc.x, tc.y, 7, 12)!;
  const temple = placeBuilding(s, 1, 'temple', ts.tx, ts.ty, true);
  s.relics.push({ id: s.nextId++, x: temple.x, y: temple.y, carrier: 0, temple: temple.id });
  // A Market already standing, but on the far side of the Town Center: off the fairground.
  const ms = findSpot(s, 'market', 2 * tc.x - temple.x, 2 * tc.y - temple.y, 0, 8, 1, (tx, ty) => !fairground(s, 1, { x: tx + 2, y: ty + 2 }))!;
  placeBuilding(s, 1, 'market', ms.tx, ms.ty, true);
  return { s, temple };
}

const fairMarkets = (s: ReturnType<typeof setup>['s']) =>
  s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'market' && fairground(s, 1, e)).length;

describe('the computer keeps feast days', () => {
  it('finds a spot on the fairground only while a Temple keeps a relic', () => {
    const { s } = setup('normal', 'fair');
    const v = { p: s.players[1], buildings: s.ents.filter((e) => e.kind === 'building' && e.owner === 1) } as never;
    const spot = fairSpot(s, v)!;
    expect(spot).not.toBeNull();
    expect(fairground(s, 1, { x: spot.tx + 2, y: spot.ty + 2 })).toBe(true);
    s.relics[s.relics.length - 1].temple = 0;
    expect(fairSpot(s, v)).toBeNull();
  });

  it('in the Age of Fairs, raises a Market by the shrine when its first is off the fairground', () => {
    const { s } = setup('normal', 'fair');
    expect(fairMarkets(s)).toBe(0);
    for (let i = 0; i < 60 * TICK_HZ; i++) step(s);
    expect(fairMarkets(s)).toBe(1);
  });

  it('builds no second Market in another age, nor at Easy', () => {
    for (const [level, age] of [['normal', 'gunpowder'], ['easy', 'fair']] as const) {
      const { s } = setup(level, age);
      for (let i = 0; i < 60 * TICK_HZ; i++) step(s);
      expect(fairMarkets(s)).toBe(0);
    }
  });
});
