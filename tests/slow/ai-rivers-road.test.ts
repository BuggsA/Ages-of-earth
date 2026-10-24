import { describe, expect, it } from 'vitest';
import { hasWalked } from '../../src/sim/ages';
import { secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';

/**
 * The Water Road from the start (#701 s1): hard computers on ordinary maps, each with a spring by its town, decide on the Age of Rivers
 * on a coin of their own, raise the Farm that shows the road, take it instead of the Bronze Age, and dig their channel.
 */
describe('the computer takes the Age of Rivers (#701 s1)', () => {
  it('on continental maps, some town takes the Age of Rivers and digs its channel', () => {
    let took = 0;
    let dug = 0;
    for (const seed of [1, 2]) {
      const s = createGame({ seed, size: 'medium', mapType: 'continental', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
      s.peaceUntil = 1e9;
      for (let i = 0; i < secs(900); i++) step(s);
      for (const p of s.players) {
        if (hasWalked(p, 'rivers')) took++;
        dug += p.stats.dug ?? 0;
      }
    }
    expect(took).toBeGreaterThan(0);
    expect(dug).toBeGreaterThan(5);
  }, 240_000);
});
