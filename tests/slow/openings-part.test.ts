import { describe, expect, it } from 'vitest';
import { parting, playOpening } from '../../scripts/opening';
import type { HomelandId, WayId } from '../../src/sim/types';

/**
 * Two openings part ways by minute 15 (#481, goal 1 of #463): the same seed, two computers each held to a Way,
 * end up with different first buildings, a different mix of food and a different way of spending their people's days.
 * Thresholds sit well under the gaps measured on seeds 3 and 8 across all four homelands (0.06 to 0.41 in food,
 * 0.07 to 0.30 in work), so they catch a Way that stops changing what the people do, not a nudge in the numbers.
 */

const pairs: [HomelandId, WayId, WayId][] = [
  ['glade', 'hunt', 'hearth'],
  ['shore', 'hunt', 'warband'],
  ['herds', 'hunt', 'hearth'],
  ['wood', 'hunt', 'warband'],
];

describe('two openings part ways by minute 15', () => {
  for (const [homeland, a, b] of pairs) {
    it(`${a} against ${b} on the ${homeland}`, () => {
      const run = playOpening({ seed: 3, picks: [{ way: a }, { way: b }], minutes: 15, size: 'small', homeland });
      const gap = parting(run.towns[0], run.towns[1]);
      expect(gap.order, 'first four buildings in a different place').toBeGreaterThanOrEqual(2);
      expect(gap.food, 'food mix').toBeGreaterThan(0.1);
      expect(gap.work, 'work mix').toBeGreaterThan(0.1);
    }, 120_000);
  }

  it('on the Herd Plains a town that spares its herds is still hunting in the second spring; one that hunts them out is not', () => {
    for (const seed of [3, 8]) {
      const [spare, feast] = playOpening({ seed, picks: [{ way: 'hearth' }, { way: 'hearth', feast: true }], minutes: 15, size: 'small', homeland: 'herds' }).towns;
      // The feast ends the herds within three minutes; the sparing town keeps most of them through the winter.
      expect(feast.herd[3], `seed ${seed}`).toBeLessThanOrEqual(1);
      expect(spare.herd[10], `seed ${seed}`).toBeGreaterThanOrEqual(3);
      // Minutes 11 to 15 are the second spring: the calves come home and the sparing town's meat climbs again.
      const gain = (t: typeof spare) => t.hunted[15] - t.hunted[11];
      expect(gain(spare), `seed ${seed}`).toBeGreaterThan(200);
      expect(gain(feast), `seed ${seed}`).toBeLessThan(100);
    }
  }, 180_000);
});
