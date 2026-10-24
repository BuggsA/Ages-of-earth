import { describe, expect, it } from 'vitest';
import { ageOf, hasWalked } from '../../src/sim/ages';
import { secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import { restat } from '../../src/sim/world';

/**
 * The Water Road's fifth age end to end (#701 s5): hard computers that walked the Water Line and stand in the Industrial Age on lakes
 * maps turn into the Age of Locks, and raise a dam there.
 */
describe('the computer takes the Age of Locks (#701 s5)', () => {
  it('on lakes maps, some Industrial town that walked the Water Line turns into the Age of Locks and raises a dam', () => {
    let turned = 0;
    let dams = 0;
    for (const seed of [2]) {
      const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
      s.peaceUntil = 1e9;
      for (const p of s.players) {
        restat(s, p, () => {
          p.epoch = 4;
          p.age = 'industrial';
          p.walked = [...(p.walked ?? []), 'dykes', 'waterline', 'industrial'];
        });
        p.res = { food: 9000, wood: 7000, stone: 3000, gold: 5000 };
      }
      step(s);
      for (const p of s.players) s.ai[p.id].dyke = { plan: null, looked: true, since: -1e9 };
      for (let i = 0; i < secs(540) && !s.over; i++) step(s);
      for (const p of s.players) if (hasWalked(p, 'locks') || ageOf(p) === 'locks') turned++;
      dams += s.ents.filter((e) => e.kind === 'building' && e.type === 'dam' && e.built).length;
    }
    expect(turned).toBeGreaterThan(0);
    expect(dams).toBeGreaterThan(0);
  }, 300_000);
});
