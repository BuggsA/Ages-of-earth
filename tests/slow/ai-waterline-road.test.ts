import { describe, expect, it } from 'vitest';
import { ageOf, hasWalked } from '../../src/sim/ages';
import { secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import { restat } from '../../src/sim/world';

/**
 * The Water Road's third age end to end (#701 s4): hard computers standing in the Age of Dykes on lakes maps go on down the road to
 * the Age of the Water Line, and set a sluice there. Their dyke work is taken as done, so only the climb is tried.
 */
describe('the computer takes the Water Line (#701 s4)', () => {
  it('on lakes maps, some town in the Age of Dykes climbs to the Water Line and sets a sluice', () => {
    let turned = 0;
    let sluices = 0;
    for (const seed of [2]) {
      const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
      s.peaceUntil = 1e9;
      for (const p of s.players) {
        restat(s, p, () => {
          p.epoch = 2;
          p.age = 'dykes';
          p.walked = [...(p.walked ?? []), 'dykes'];
        });
        p.res = { food: 5000, wood: 6000, stone: 2000, gold: 2500 };
      }
      // The Dykes' own work done (no bay to drain), so the climb is the question.
      step(s);
      for (const p of s.players) s.ai[p.id].dyke = { plan: null, looked: true, since: -1e9 };
      for (let i = 0; i < secs(720); i++) step(s);
      for (const p of s.players) if (hasWalked(p, 'waterline') || ageOf(p) === 'waterline') turned++;
      sluices += s.ents.filter((e) => e.kind === 'building' && e.type === 'sluice' && e.built).length;
    }
    expect(turned).toBeGreaterThan(0);
    expect(sluices).toBeGreaterThan(0);
  }, 300_000);
});
