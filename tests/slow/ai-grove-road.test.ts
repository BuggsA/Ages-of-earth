import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../../src/sim/data';
import { ageOf, hasWalked } from '../../src/sim/ages';
import { createGame, step } from '../../src/sim/game';

/**
 * The Wild → Grove step (#742): a computer on the Wild route rears the Den's five beasts and takes the Grove, not the Middle Ages.
 * Judged across several maps, not one (#940): a single 15-minute match swings with anything on the map, such as the teeming wild.
 */
describe('the computer on the Wild route', () => {
  it('holds the Wild while its Den rears the deed, then takes the Grove, on most of several maps', () => {
    let maps = 0;
    for (const seed of [2, 3, 5, 7]) {
      const s = createGame({ seed, size: 'small', players: [{ name: 'Normal', ai: 'normal' }, { name: 'Hard', ai: 'hard' }] });
      const bredAtGrove: number[] = [];
      for (let i = 0; i < 20 * 60 * TICK_HZ && !s.over; i++) {
        for (const p of s.players) if (s.ai[p.id]) (s.ai[p.id].roads ??= {}).wild = true;
        step(s);
        for (const p of s.players) if (ageOf(p) === 'grove' && bredAtGrove[p.id] === undefined) bredAtGrove[p.id] = p.stats.bred ?? 0;
      }
      const grove = s.players.filter((p) => hasWalked(p, 'grove'));
      if (grove.length) maps++;
      for (const p of grove) {
        expect(hasWalked(p, 'wild'), `seed ${seed} ${p.name}`).toBe(true);
        expect(bredAtGrove[p.id], `seed ${seed} ${p.name}`).toBeGreaterThanOrEqual(5);
      }
      // Bound for the Grove, a Wild people never turns off to the Middle Ages instead.
      for (const p of s.players) if (hasWalked(p, 'wild')) expect(hasWalked(p, 'middle'), `seed ${seed} ${p.name}`).toBe(false);
    }
    expect(maps).toBeGreaterThanOrEqual(2);
  }, 900000);
});
