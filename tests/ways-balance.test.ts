import { describe, expect, it } from 'vitest';
import { AI_WAYS } from '../src/sim/data';
import { rivalCamp } from '../src/sim/ai';
import { createGame } from '../src/sim/game';
import type { Building } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The Ways' balance (#486): the computer's Warband raids a rival's larder, but not one with soldiers standing by it. */

describe("the Warband's raid passes over a guarded larder", () => {
  it('takes an unguarded rival Storehouse, and not one with a rival soldier beside it', () => {
    const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'normal', civ: 'greeks' }] });
    for (const e of s.ents) if (e.kind === 'unit' && e.owner !== 0 && e.owner !== 1) e.hp = 0;
    s.animals = [];
    const a = s.players[0];
    const b = s.players[1];
    const home = { x: b.startX, y: b.startY };
    const at = { x: b.startX + (a.startX - b.startX) * 0.5, y: b.startY + (a.startY - b.startY) * 0.5 };
    const store = placeBuilding(s, 0, 'storehouse', Math.floor(at.x), Math.floor(at.y), true) as Building;
    expect(rivalCamp(s, b, home, AI_WAYS.raidAt, AI_WAYS.raidReach, true)).toBe(store);

    const guard = spawnUnit(s, 0, 'infantry', store.x + 2, store.y);
    expect(rivalCamp(s, b, home, AI_WAYS.raidAt, AI_WAYS.raidReach, true)).toBeNull();
    // A citizen of theirs is no guard.
    guard.hp = 0;
    spawnUnit(s, 0, 'citizen', store.x + 2, store.y);
    expect(rivalCamp(s, b, home, AI_WAYS.raidAt, AI_WAYS.raidReach, true)).toBe(store);
  });
});
