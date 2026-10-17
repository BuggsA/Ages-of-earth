import { describe, expect, it } from 'vitest';
import { AI_LEVELS, HEART, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState } from '../src/sim/types';

/** The computer raises a spare Town Center before it loses its only one (#452). */

const game = (level: 'gentle' | 'normal', startEpoch = 1): GameState => {
  const s = createGame({ seed: 7, size: 'small', peaceMinutes: 0, startEpoch, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: level, civ: 'greeks' }] });
  s.animals = [];
  s.players[1].res = { food: 2000, wood: 2000, stone: 2000, gold: 2000 };
  return s;
};
const centers = (s: GameState): Building[] => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter' && e.hp > 0);
const run = (s: GameState, secs: number) => { for (let i = 0; i < secs * TICK_HZ; i++) step(s); };

describe('the computer\'s spare heart', () => {
  it('a Hard computer with the means lays a second Town Center on the side away from the rival', () => {
    const s = game('normal');
    run(s, 90);
    const tcs = centers(s);
    expect(tcs.length).toBe(2);
    const a = s.players[0];
    const d = (b: Building) => Math.hypot(b.x - a.startX, b.y - a.startY);
    expect(d(tcs[1])).toBeGreaterThanOrEqual(d(tcs[0]));
    expect(Math.hypot(tcs[1].x - tcs[0].x, tcs[1].y - tcs[0].y)).toBeGreaterThan(10);
  });

  it('survives losing the first Town Center', () => {
    const s = game('normal');
    run(s, 240);
    expect(centers(s).filter((b) => b.built).length).toBe(2);
    const first = centers(s)[0];
    first.hp = 0;
    run(s, HEART.grace + 20);
    expect(s.players[1].defeated).toBe(false);
  });

  it('rebuilds at once when the only one falls, spending what it has', () => {
    const s = game('normal');
    s.players[1].res = { food: 0, wood: 400, stone: 200, gold: 0 };
    for (const b of centers(s)) b.hp = 0;
    run(s, 10);
    expect(centers(s).length).toBe(1);
  });

  it('keeps a single one when the switch is off, or in the Stone Age on Easy', () => {
    const off = game('normal');
    AI_LEVELS.normal.spareHeart = false;
    try { run(off, 90); } finally { delete AI_LEVELS.normal.spareHeart; }
    expect(centers(off).length).toBe(1);
    const easy = game('gentle', 0);
    run(easy, 90);
    expect(centers(easy).length).toBe(1);
  });
});
