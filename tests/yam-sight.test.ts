import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { createGame } from '../src/sim/game';
import { statsFor } from '../src/sim/stats';

describe('Yam Relay sight', () => {
  it('lets riders see 3 tiles farther while it lasts, and no one else', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'mongols' }, { name: 'B', ai: null }] });
    s.players[0].epoch = 1;
    s.players[0].statsVersion++;
    const r0 = statsFor(s, 0, 'cavalry').sight;
    const f0 = statsFor(s, 0, 'infantry').sight;
    applyCommand(s, { t: 'greatWork', p: 0 });
    expect(statsFor(s, 0, 'cavalry').sight).toBe(r0 + 3);
    expect(statsFor(s, 0, 'infantry').sight).toBe(f0);
  });
});
