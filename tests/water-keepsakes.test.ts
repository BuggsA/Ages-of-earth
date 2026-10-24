import { describe, expect, it } from 'vitest';
import { asleep } from '../src/sim/ages';
import { boardsAt } from '../src/sim/beggars';
import { AGES, RIVERS, TRUNK } from '../src/sim/data';
import { castProblem } from '../src/sim/floating';
import { createGame } from '../src/sim/game';
import { grinds } from '../src/sim/tides';
import { damIdle, fieldBoost, pumps, sluiceWorks } from '../src/sim/water';
import type { AgeId, Building, BuildingType, GameState } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

/**
 * Keepsakes along the Water Road (#783, s8 of #701): every age of the road, and its crossing, keeps one building, and each kept one
 * goes on working on another road, where one of its kind not kept stands idle.
 */

const WATER: AgeId[] = (Object.keys(AGES) as AgeId[]).filter((a) => AGES[a].routes?.includes('water'));

const game = (age: AgeId, epoch: number): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.players[0].age = age;
  s.players[0].epoch = epoch;
  return s;
};

/** Whether this building does its age's work now, read the way the rules read it. */
const works: Partial<Record<AgeId, (s: GameState, b: Building) => boolean>> = {
  rivers: (s, b) => fieldBoost(s, b) === RIVERS.farm,
  dykes: (s, b) => pumps(s, b),
  waterline: (s, b) => sluiceWorks(s, b),
  locks: (s, b) => !damIdle(s, b)?.startsWith('Dams turn only'),
  tides: (s, b) => grinds(s, b),
  floating: (s, b) => !castProblem(s, s.players[b.owner], b)?.startsWith('Only a floating people'),
  beggars: (s, b) => boardsAt(s, b.owner, b.x + 2, b.y),
};

describe('the Water Road\'s keepsakes (#783)', () => {
  it('the road has its six ages, every one a keepsake, none of them a trunk age', () => {
    expect(WATER.sort()).toEqual(['dykes', 'floating', 'locks', 'rivers', 'tides', 'waterline']);
    for (const a of [...WATER, 'beggars' as AgeId]) {
      expect(TRUNK).not.toContain(a);
      expect(AGES[a].keepsake, a).toBeDefined();
    }
  });

  it('every kept one works on another road, where one of its kind not kept is idle', () => {
    for (const a of [...WATER, 'beggars' as AgeId]) {
      // Another road at its tier: the plain road's age of that tier (the Floating Cities and the Tides stand at the Atomic's).
      const s = game(TRUNK[Math.min(AGES[a].tier, TRUNK.length - 1)], AGES[a].tier);
      const type = AGES[a].keepsake!.building as BuildingType;
      const b = placeBuilding(s, 0, type, 12, 12, true);
      const other = placeBuilding(s, 0, type, 30, 30, true);
      // A field is watered by a spring beside it.
      if (type === 'farm') s.springs = [12 * s.w + 11, 30 * s.w + 29];
      b.keep = a;
      expect(asleep(s, b), `${a}'s kept ${type} sleeps`).toBe(false);
      expect(works[a]!(s, b), `${a}'s kept ${type} works off its road`).toBe(true);
      expect(works[a]!(s, other), `${a}'s other ${type} works off its road`).toBe(false);
    }
  });
});
