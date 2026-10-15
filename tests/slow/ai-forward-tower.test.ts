import { describe, expect, it } from 'vitest';
import { createGame, step } from '../../src/sim/game';
import { AI_RAID } from '../../src/sim/data';

describe('the computer raises a forward Tower (#132 s5)', () => {
  it('a Hard computer puts a tower out at the edge of its land', () => {
    let forward = 0;
    for (const seed of [3, 7]) {
      const s = createGame({ seed, size: 'small', startEpoch: 1, players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'normal' }] });
      for (let i = 0; i < 20 * 60 * 10; i++) step(s);
      const bs = s.ents.flatMap((e) => (e.kind === 'building' ? [e] : []));
      const tc = bs.find((e) => e.owner === 0 && e.type === 'towncenter');
      const far = bs.filter((e) => e.owner === 0 && e.type === 'tower' && tc && Math.hypot(e.tx - tc.tx, e.ty - tc.ty) >= AI_RAID.fort - 4);
      if (far.length) forward++;
    }
    expect(forward).toBeGreaterThan(0);
  }, 60000);
});
