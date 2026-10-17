import { describe, expect, it } from 'vitest';
import { AMOUNT, SEASON, secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import type { GameState, HomelandId } from '../../src/sim/types';

/** The computer reads the turning year (#479): it spares its herds on the Herd Plains and hunts the Deep Wood's yard. */

const LEN = secs(SEASON.len);
const match = (homeland: HomelandId, seed: number) => createGame({ seed, size: 'small', homeland, players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }] });
const until = (s: GameState, tick: number) => {
  while (s.tick < tick && !s.over) step(s);
};
const kept = (s: GameState, town: number) => s.animals.filter((a) => a.kind === 'deer' && a.town === town && a.hp > 0).length;

describe('the computer and the turning year', () => {
  it('on the Herd Plains it leaves some of its herds alive into spring, and they come home bigger', () => {
    for (const seed of [3, 8]) {
      const s = match('herds', seed);
      until(s, 4 * LEN - 1);
      const winter = s.players.map((p) => kept(s, p.id));
      for (const n of winter) expect(n, `seed ${seed}`).toBeGreaterThan(0);
      until(s, 4 * LEN + 2);
      s.players.forEach((p, k) => expect(kept(s, p.id), `seed ${seed}`).toBeGreaterThan(winter[k]));
    }
  });

  it('in the Deep Wood it hunts the yarded deer through the winter', () => {
    for (const seed of [3, 8]) {
      const s = match('wood', seed);
      until(s, 3 * LEN);
      const before = s.players.map((p) => p.stats.hunted ?? 0);
      until(s, 4 * LEN);
      s.players.forEach((p, k) => expect((p.stats.hunted ?? 0) - before[k], `seed ${seed} P${k}`).toBeGreaterThanOrEqual(AMOUNT.meat));
    }
  });
});
