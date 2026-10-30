import { describe, expect, it } from 'vitest';
import { AI_WILD, TEEM, WOLF } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { generateMap } from '../src/sim/mapgen';

/** The teeming wild (`TEEM`): more mammoths, boars and wolf dens on every map, laid last so nothing else on the map moves. */
describe('the teeming wild', () => {
  it('gives every town a mammoth and a wolf den of its own, and more of each kind in the open', () => {
    // Two and three towns: with four, a den laid in the open can fall in one town's band and blur the count.
    for (const players of [2, 3]) {
      for (const seed of [1, 4, 9]) {
        const m = generateMap(seed, 'medium', players);
        const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
        const nearest = (b: { x: number; y: number }) => m.starts.reduce((k, st, j) => (dist(b, st) < dist(b, m.starts[k]) ? j : k), 0);
        // Every town gets the same share: all of them, or (where a crowded map has no room for one) none.
        const shares = m.starts.map((st, k) => {
          const own = m.teem.filter((b) => nearest(b) === k);
          const mammoths = own.filter((b) => b.kind === 'mammoth' && dist(b, st) >= TEEM.mammothAt - 3 && dist(b, st) <= TEEM.mammothAt + 4).length;
          const dens = own.filter((b) => b.kind === 'wolf' && dist(b, st) >= TEEM.denAt - 4 && dist(b, st) <= TEEM.denAt + 9).length / WOLF.pack;
          return `${mammoths > 0} ${dens > 0}`;
        });
        expect(new Set(shares).size, `seed ${seed} ${players}p: ${shares.join(' | ')}`).toBe(1);
        if (players === 2) expect(shares[0]).toBe('true true');
        const wolves = m.teem.filter((b) => b.kind === 'wolf');
        expect(wolves.length % WOLF.pack).toBe(0);
        // Its dens lie past the computer's clearing reach: a pack it meets by choice.
        for (const w of wolves) for (const st of m.starts) expect(dist(w, st)).toBeGreaterThan(AI_WILD.clear);
        expect(m.teem.filter((b) => b.kind === 'boar').length).toBeGreaterThan(0);
      }
    }
  });

  it('moves nothing else on the map, keeps its own ids, and stays out of campaign chapters', () => {
    const m = generateMap(5, 'medium', 3);
    expect(generateMap(5, 'medium', 3).teem).toEqual(m.teem);
    expect(generateMap(5, 'small', 2, 'continental', false).teem).toEqual([]);
    const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const teem = s.animals.filter((a) => a.id >= TEEM.idBase);
    expect(teem.length).toBe(generateMap(5, 'medium', 2, 'continental', true, true, 'glade').teem.length);
    expect(teem.length).toBeGreaterThan(0);
    // Every other thing keeps an id below the range.
    expect(s.nextId).toBeLessThan(TEEM.idBase);
  });
});
