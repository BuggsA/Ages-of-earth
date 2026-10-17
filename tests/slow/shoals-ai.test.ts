import { describe, expect, it } from 'vitest';
import { YEAR } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import { R_FISH } from '../../src/sim/types';

/**
 * The mere spawns (#482): two clever computers fish the Shore for twenty minutes, two springs. Sparing each
 * shoal its seed keeps the meres alive into the third year; with sparing off, they fish them bare.
 */

const play = (spare: boolean) => {
  const keep = YEAR.fishSpare;
  (YEAR as { fishSpare: number }).fishSpare = spare ? keep : -1;
  const s = createGame({ seed: 4, size: 'small', homeland: 'shore', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }] });
  try {
    for (let i = 0; i < 20 * 60 * 20 + 40 && !s.over; i++) step(s);
  } finally {
    (YEAR as { fishSpare: number }).fishSpare = keep;
  }
  // Shoals within a mere's reach of each town.
  const home = s.players.map((p) => {
    let n = 0;
    for (let i = 0; i < s.w * s.h; i++) if (s.res[i] === R_FISH && Math.hypot((i % s.w) - p.startX, Math.floor(i / s.w) - p.startY) < 24) n++;
    return n;
  });
  return { home, fished: s.players.map((p) => p.stats.fished ?? 0) };
};

describe('the computer spares the mere (#482)', () => {
  const spared = play(true);
  const stripped = play(false);

  it('keeps shoals alive by every town into the third year, more than when it strips them', () => {
    for (const n of spared.home) expect(n).toBeGreaterThanOrEqual(3);
    expect(spared.home.reduce((a, b) => a + b, 0)).toBeGreaterThan(stripped.home.reduce((a, b) => a + b, 0));
  });

  it('still lives on its boats: most of what the stripping computer landed', () => {
    const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(total(spared.fished)).toBeGreaterThan(total(stripped.fished) * 0.8);
  });
});
