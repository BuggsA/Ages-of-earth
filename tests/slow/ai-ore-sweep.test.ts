import { describe, expect, it } from 'vitest';
import { ageOf } from '../../src/sim/ages';
import { createGame, step } from '../../src/sim/game';

/** #356: where the only blood-iron vein is far from home, the computer on the Path of Blood digs it from the Warband and still reaches Iron and Blood. */
describe('the computer and a far ore gate', () => {
  it('mines a distant blood-iron vein and opens the Age of Iron and Blood (seed 4, medium)', () => {
    const s = createGame({ seed: 4, size: 'medium', players: [{ name: 'N', ai: 'normal' }, { name: 'H', ai: 'hard' }] });
    expect(s.rares).toContain('bloodiron');
    for (let i = 0; i < 28 * 1200 && !s.over; i++) step(s);
    const hard = s.players[1];
    expect(hard.stats.mined?.bloodiron ?? 0).toBeGreaterThanOrEqual(50);
    expect(hard.walked).toContain('ironblood');
    expect(['ironblood', 'industrial']).toContain(ageOf(hard));
  }, 120_000);
});
