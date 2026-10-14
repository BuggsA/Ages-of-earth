import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { MAX_SCOUT_FLAGS, ScoutFlags } from '../src/ui/scoutFlags';

const world = () => createGame({
  seed: 31,
  size: 'small' as const,
  players: [{ name: 'Scout', ai: null }, { name: 'Rival', ai: null }],
});

describe('personal scout flags', () => {
  it('plants, changes, removes and resets flags without changing simulation state', () => {
    const s = world();
    const flags = new ScoutFlags();
    const x = s.players[0].startX, y = s.players[0].startY;
    const tick = s.tick;
    expect(flags.toggle(s, 0, x, y)).toBe('planted');
    expect(flags.all).toEqual([{ x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, kind: 'plan' }]);
    expect(flags.toggle(s, 0, x + 0.3, y, 'danger')).toBe('changed');
    expect(flags.all[0].kind).toBe('danger');
    expect(flags.toggle(s, 0, x, y, 'danger')).toBe('removed');
    expect(flags.all).toHaveLength(0);
    flags.toggle(s, 0, x, y);
    flags.reset();
    expect(flags.all).toHaveLength(0);
    expect(s.tick).toBe(tick);
    expect(s.events).toHaveLength(0);
  });

  it('requires explored, in-bounds, finite ground', () => {
    const s = world();
    const flags = new ScoutFlags();
    const hidden = s.players[0].seen.findIndex((v) => v === 0);
    expect(hidden).toBeGreaterThanOrEqual(0);
    const hx = hidden % s.w, hy = Math.floor(hidden / s.w);
    expect(flags.toggle(s, 0, hx + 0.5, hy + 0.5)).toBe('unexplored');
    for (const [x, y] of [[-1, 5], [s.w, 5], [0, s.h], [NaN, 3], [Infinity, 3]]) {
      expect(flags.toggle(s, 0, x, y)).toBe('unexplored');
    }
    expect(flags.all).toHaveLength(0);
  });

  it('evicts the oldest of six flags and toggles near an existing one', () => {
    const s = world();
    const flags = new ScoutFlags();
    const x = Math.floor(s.players[0].startX), y = Math.floor(s.players[0].startY);
    for (let i = 0; i < MAX_SCOUT_FLAGS; i++) {
      expect(flags.toggle(s, 0, x - 12 + i * 4, y)).toBe('planted');
    }
    const first = flags.all[0];
    expect(flags.toggle(s, 0, x + 12, y)).toBe('planted');
    expect(flags.all).toHaveLength(MAX_SCOUT_FLAGS);
    expect(flags.all).not.toContainEqual(first);
    expect(flags.toggle(s, 0, x + 12.7, y)).toBe('removed');
    expect(flags.all).toHaveLength(MAX_SCOUT_FLAGS - 1);
  });
});
