import { describe, expect, it } from 'vitest';
import { ageOf, hasWalked } from '../../src/sim/ages';
import { AI_FLOAT, secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import { restat } from '../../src/sim/world';

/**
 * The Water Road's seventh age end to end (#770): hard computers that came down the Water Road and stand in the Age of Tides on lakes
 * maps keep the Tides a while, then turn into the Age of Floating Cities and moor a town on the water.
 */
describe('the computer takes the Age of Floating Cities (#770)', () => {
  it('on a lakes map, some town in the Age of Tides turns into the Age of Floating Cities and moors pontoons', () => {
    const s = createGame({ seed: 5, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
    s.peaceUntil = 1e9;
    // Rich towns at peace raise wonders: no wonder victory ends this match before the road is walked.
    s.wonderTime = 1e9;
    for (const p of s.players) {
      restat(s, p, () => {
        p.epoch = 5;
        p.age = 'tides';
        p.walked = [...(p.walked ?? []), 'waterline', 'locks', 'tides'];
      });
      p.res = { food: 6000, wood: 6000, stone: 3000, gold: 4000 };
    }
    let turnedAt = -1;
    for (let i = 0; i < secs(AI_FLOAT.after + 420) && !s.over; i++) {
      step(s);
      if (turnedAt < 0 && s.players.some((p) => ageOf(p) === 'floating')) turnedAt = s.tick;
    }
    const floating = s.players.filter((p) => hasWalked(p, 'floating') || ageOf(p) === 'floating');
    expect(floating.length).toBeGreaterThan(0);
    // Not before it has kept the Tides a while.
    expect(turnedAt).toBeGreaterThanOrEqual(secs(AI_FLOAT.after));
    const moored = s.ents.filter((e) => e.kind === 'building' && e.type === 'pontoon' && e.built && floating.some((p) => p.id === e.owner));
    expect(moored.length).toBeGreaterThan(0);
  }, 300_000);
});
