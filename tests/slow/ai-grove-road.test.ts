import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../../src/sim/data';
import { ageOf, hasWalked } from '../../src/sim/ages';
import { createGame, step } from '../../src/sim/game';

/** The Wild → Grove step (#742): a computer on the Wild route rears the Den's five beasts and takes the Grove, not the Middle Ages. */
describe('the computer on the Wild route', () => {
  it.each([
    [3, 20],
    [5, 15],
  ])('holds the Wild while its Den rears the deed, then takes the Grove (seed %i)', (seed, minutes) => {
    const s = createGame({ seed, size: 'small', players: [{ name: 'Normal', ai: 'normal' }, { name: 'Hard', ai: 'hard' }] });
    const bredAtGrove: number[] = [];
    for (let i = 0; i < minutes * 60 * TICK_HZ && !s.over; i++) {
      for (const p of s.players) if (s.ai[p.id]) (s.ai[p.id].roads ??= {}).wild = true;
      step(s);
      for (const p of s.players) if (ageOf(p) === 'grove' && bredAtGrove[p.id] === undefined) bredAtGrove[p.id] = p.stats.bred ?? 0;
    }
    const grove = s.players.filter((p) => hasWalked(p, 'grove'));
    expect(grove.length).toBeGreaterThan(0);
    for (const p of grove) {
      expect(hasWalked(p, 'wild')).toBe(true);
      expect(hasWalked(p, 'middle')).toBe(false);
      expect(bredAtGrove[p.id]).toBeGreaterThanOrEqual(5);
    }
  });
});
