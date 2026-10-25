import { describe, expect, it } from 'vitest';
import { secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';

// Split from tests/coppice.test.ts: the 9-minute computer match timed out at 15 s on the runner (#819).
const run = (s: ReturnType<typeof createGame>, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};

describe('the managed wood, played by the computer', () => {
  it('is played by the computer: a snare line walked by tenders, and no fields', () => {
    const s = createGame({ seed: 2, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'greeks' }] });
    run(s, 9 * 60);
    const mine = s.ents.filter((e) => e.owner === 0 && e.hp > 0);
    expect(mine.filter((e) => e.kind === 'building' && e.type === 'farm')).toEqual([]);
    expect(mine.filter((e) => e.kind === 'building' && e.type === 'snare' && e.built).length).toBeGreaterThanOrEqual(2);
    expect(mine.some((e) => e.kind === 'unit' && e.order.k === 'snare')).toBe(true);
    expect(s.players[0].stats.snared ?? 0).toBeGreaterThan(50);
  });
});
