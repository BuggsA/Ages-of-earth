import { describe, expect, it } from 'vitest';
import { ROT, TICK_HZ } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { spoilingSites } from '../src/render/crows';

describe('carrion crows', () => {
  it('circle only carcasses that have begun to turn and are in sight', () => {
    const s = createGame({ seed: 3, size: 'small', players: [{ people: 'romans', ai: false }, { people: 'britons', ai: 'medium' }] } as never);
    const t = 5 * s.w + 5;
    const u = 9 * s.w + 9;
    s.amount[t] = 100;
    s.amount[u] = 100;
    s.carcasses = [{ tile: t, born: 0, full: 100 }, { tile: u, born: 0, full: 100 }];
    s.tick = ROT.grace * TICK_HZ - 1;
    expect(spoilingSites(s, () => true)).toHaveLength(0);
    s.tick = ROT.grace * TICK_HZ;
    expect(spoilingSites(s, () => true)).toHaveLength(2);
    expect(spoilingSites(s, (x) => x < 6)).toHaveLength(1);
    s.amount[t] = 0;
    expect(spoilingSites(s, () => true)).toHaveLength(1);
  });
});
