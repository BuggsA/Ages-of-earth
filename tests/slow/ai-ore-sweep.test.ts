import { describe, expect, it } from 'vitest';
import { ageOf } from '../../src/sim/ages';
import { createGame, step } from '../../src/sim/game';

/**
 * #356: where the only blood-iron vein is far from home, the computer on the Path of Blood digs it from the Warband and still
 * reaches Iron and Blood. A proof that it can, not how often: it passes on any of a few medium seeds whose vein lies
 * about 30 tiles from the computer's start and whose people walk the Warband, so changes elsewhere in its play don't
 * flip it (the owner's ruling on #540, 2026-10-23; seed 4 alone first).
 */
const SEEDS = [4, 28, 17, 22];

describe('the computer and a far ore gate', () => {
  it('mines a distant blood-iron vein and opens the Age of Iron and Blood (any of seeds 4, 28, 17, 22, medium)', () => {
    const tried: string[] = [];
    const opened = SEEDS.some((seed) => {
      const s = createGame({ seed, size: 'medium', players: [{ name: 'N', ai: 'normal' }, { name: 'H', ai: 'hard' }] });
      expect(s.rares).toContain('bloodiron');
      for (let i = 0; i < 28 * 1200 && !s.over; i++) step(s);
      const hard = s.players[1];
      tried.push(`seed ${seed}: mined ${hard.stats.mined?.bloodiron ?? 0}, walked ${(hard.walked ?? []).join(',') || 'nothing'}, in ${ageOf(hard)}`);
      return (hard.stats.mined?.bloodiron ?? 0) >= 50 && !!hard.walked?.includes('ironblood') && ['ironblood', 'industrial'].includes(ageOf(hard));
    });
    expect(opened, tried.join('; ')).toBe(true);
  }, 300_000);
});
