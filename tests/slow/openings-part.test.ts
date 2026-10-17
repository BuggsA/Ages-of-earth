import { describe, expect, it } from 'vitest';
import { FOODS, JOBS, firstBuilt, mix, over, playOpening, shares } from '../../scripts/opening';
import type { Opening, Pick } from '../../scripts/opening';
import type { HomelandId, WayId } from '../../src/sim/types';

/**
 * Goal 1 s4 (#481): two openings part ways. Two hard computers on one seed, the same seat played under one Way
 * in one match and another Way in the next (the rival swaps with it), so the map, the start and the neighbour's
 * Way are held and only the opening choice differs. Their timelines must differ in what the people do: which
 * buildings go up first, where the food comes from, and where the people work.
 *
 * Two seeds, two seats each: four comparisons a homeland. A claim that held in every comparison over three
 * seeds and every rival (`scripts/opening.ts`, the #481 log) must hold in all four; one that slipped once must
 * hold in three. Nothing here rests on one seed's numbers.
 */

const SEEDS = [3, 8];
const MIN = 10;

/** Seat-matched comparisons: [the town under `a`, the same seat under `b`], two per seed. */
function pairs(homeland: HomelandId, a: Pick, b: Pick, minutes = MIN): [Opening, Opening][] {
  const out: [Opening, Opening][] = [];
  for (const seed of SEEDS) {
    const ab = playOpening({ seed, picks: [a, b], minutes, size: 'small', homeland }).towns;
    const ba = playOpening({ seed, picks: [b, a], minutes, size: 'small', homeland }).towns;
    out.push([ab[0], ba[0]], [ba[1], ab[1]]);
  }
  for (const [x, y] of out) {
    for (const t of [x, y]) console.log(`${homeland} ${t.name.padEnd(18)} first ${firstBuilt(t).join(', ')} | food ${mix(over(t.foodBy, FOODS, 0, MIN), FOODS)}${t.raided ? ` +${t.raided} raided` : ''}${t.kin ? `, ${t.kin} kin` : ''} | work ${mix(t.work, JOBS)} | food workers ${t.reach.toFixed(1)} tiles out`);
  }
  return out;
}

const share = (t: Opening, f: (typeof FOODS)[number]) => shares(over(t.foodBy, FOODS, 0, MIN), FOODS)[f];
const at = (t: Opening, b: string) => t.first.find(([x]) => x === b)?.[1] ?? Infinity;
/** How many comparisons a claim holds in. */
const held = (ps: [Opening, Opening][], f: (a: Opening, b: Opening) => boolean) => ps.filter(([a, b]) => f(a, b)).length;
const way = (w: WayId): Pick => ({ way: w });

describe('two openings part ways by minute 15 (#481)', () => {
  for (const homeland of ['glade', 'shore', 'herds'] as HomelandId[]) {
    it(`${homeland}: the Hunters camp by the kill and eat meat; the Hearth calls its kin and eats from berries and fields`, () => {
      const ps = pairs(homeland, way('hunt'), way('hearth'));
      for (const [hunt, hearth] of ps) {
        // Different buildings first: the Hunters' camp stands among their first four; the Hearth raises none.
        expect(firstBuilt(hunt)).not.toEqual(firstBuilt(hearth));
        expect(at(hearth, 'huntcamp')).toBe(Infinity);
        // The Hearth's verb, and no one else's.
        expect(hearth.kin).toBeGreaterThanOrEqual(4);
        expect(hunt.kin).toBe(0);
        // Different food: more of the Hunters' first ten minutes of food is meat.
        expect(share(hunt, 'meat')).toBeGreaterThan(share(hearth, 'meat'));
      }
      expect(held(ps, (hunt) => firstBuilt(hunt).includes('huntcamp') && at(hunt, 'huntcamp') <= 5)).toBeGreaterThanOrEqual(3);
      expect(held(ps, (hunt, hearth) => share(hearth, 'fields') > share(hunt, 'fields'))).toBeGreaterThanOrEqual(3);
      // Different places: the Hunters' food workers range farther from home.
      expect(held(ps, (hunt, hearth) => hunt.reach > hearth.reach)).toBeGreaterThanOrEqual(3);
    }, 240_000);
  }

  it('wood: the Warband raises a Barracks first and raids; the Hunters camp and hunt', () => {
    const ps = pairs('wood', way('warband'), way('hunt'));
    for (const [band, hunt] of ps) {
      expect(band.first[0][0]).toBe('barracks');
      expect(at(band, 'barracks')).toBeLessThan(at(hunt, 'barracks'));
      expect(at(hunt, 'huntcamp')).toBeLessThanOrEqual(2.5);
      expect(firstBuilt(band)).not.toEqual(firstBuilt(hunt));
      expect(hunt.hunted[5]).toBeGreaterThan(band.hunted[5]);
      expect(share(hunt, 'meat')).toBeGreaterThan(share(band, 'meat'));
    }
    // The Warband's verb: food carried off from the rival, and a town whose foragers stay close.
    expect(held(ps, (band) => band.raided > 0)).toBeGreaterThanOrEqual(3);
    expect(held(ps, (band, hunt) => band.reach < hunt.reach)).toBeGreaterThanOrEqual(3);
  }, 240_000);

  it('herds: a town that spares its herd eats from it in the second spring; one that feasts opens its fields early and has none left', () => {
    // From #480: the home herds trek out in autumn and come home in spring, each deer with a calf; the second spring is minutes 10-12.5.
    const ps = pairs('herds', way('hunt'), { way: 'hunt', feast: true }, 13);
    for (const [spare, feast] of ps) {
      console.log(`herds  spare ${spare.herd.join(' ')} | feast ${feast.herd.join(' ')} | meat in the second spring ${spare.hunted[13] - spare.hunted[10]} vs ${feast.hunted[13] - feast.hunted[10]}`);
      expect(feast.herd[5]).toBe(0);
      // The Hunters sow nothing while the home herd grazes: hunting it out opens the fields early.
      expect(at(feast, 'farm')).toBeLessThan(at(spare, 'farm'));
      expect(spare.herd[10]).toBeGreaterThan(0);
      expect(spare.hunted[13] - spare.hunted[10]).toBeGreaterThan(feast.hunted[13] - feast.hunted[10]);
    }
  }, 240_000);
});
