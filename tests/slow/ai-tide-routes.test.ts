import { describe, expect, it } from 'vitest';
import { AGES, secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import type { GameState } from '../../src/sim/types';
import { restat } from '../../src/sim/world';

/**
 * Routes that read the tide (#755): three hard computers in the Age of Tides on lakes maps send soldiers, citizens and traders over the
 * flats for 12 minutes. Before the routes read the tide, the flood swept 9 and 10 of them on these seeds; now their routes go round or
 * wait on the shore, and almost none is caught.
 */
describe('routes that read the tide, in computer matches (#755)', () => {
  it('on lakes maps, the flood sweeps almost nobody, and some wait on the shore', () => {
    for (const seed of [5, 6]) {
      const s: GameState = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
      for (const p of s.players) {
        restat(s, p, () => {
          p.epoch = AGES.tides.tier;
          p.age = 'tides';
        });
        p.res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 };
      }
      let swept = 0;
      let held = 0;
      for (let i = 0; i < secs(720) && !s.over; i++) {
        step(s);
        for (const e of s.events) {
          if (e.k === 'tideSwept') swept++;
          else if (e.k === 'tideHold') held++;
        }
      }
      expect(swept, `seed ${seed}`).toBeLessThanOrEqual(2);
      expect(held, `seed ${seed}`).toBeGreaterThan(0);
    }
  }, 240_000);
});
