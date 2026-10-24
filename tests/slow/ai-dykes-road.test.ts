import { describe, expect, it } from 'vitest';
import { ageOf, hasWalked } from '../../src/sim/ages';
import { secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import { restat } from '../../src/sim/world';

/**
 * The Water Road end to end (#701 s1): hard computers standing in the Middle Ages on lakes maps decide on the Age of Dykes where a dyke
 * by home is worth it, raise the Dock that shows the road, turn, and pump land out of the water.
 */
describe('the computer takes the Water Road (#701 s1)', () => {
  it('on lakes maps, some town turns to the Age of Dykes and wins polder', () => {
    let turned = 0;
    let won = 0;
    for (const seed of [2, 3]) {
      const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
      s.peaceUntil = 1e9;
      for (const p of s.players) {
        restat(s, p, () => {
          p.epoch = 2;
          p.age = 'middle';
        });
        p.res = { food: 2000, wood: 2000, stone: 800, gold: 800 };
      }
      for (let i = 0; i < secs(600); i++) step(s);
      for (const p of s.players) {
        if (hasWalked(p, 'dykes') || ageOf(p) === 'dykes') turned++;
        won += p.stats.drained ?? 0;
      }
    }
    expect(turned).toBeGreaterThan(0);
    expect(won).toBeGreaterThan(10);
  }, 240_000);
});
