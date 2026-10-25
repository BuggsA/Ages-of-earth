import { describe, expect, it } from 'vitest';
import { habitOf } from '../src/sim/ai';
import { AI_TEMPER, TICK_HZ } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { spawnUnit, townCenters } from '../src/sim/world';
import { rivalCardHtml, RivalLedger } from '../src/ui/rivalRoad';
import type { GameState } from '../src/sim/types';

// A habit with going back (#758): settled once on the first turn, and a baiter that steps back while its army waits at home.
const match = (seed: number, ai: 'hard' | 'easy' = 'hard') => createGame({ seed, size: 'small', players: [{ name: 'A', ai }, { name: 'B', ai }] });
const firstTurns = (s: GameState) => {
  while (s.tick < 40) step(s);
};
const withHabit = (habit: 'hoard' | 'hold' | 'bait'): GameState => {
  for (let seed = 1; seed <= 60; seed++) {
    const s = match(seed);
    firstTurns(s);
    if (s.ai[1].habit === habit) return s;
  }
  throw new Error(`no seed gives ${habit}`);
};

describe('a habit with going back', () => {
  it('is settled once, the same for a seed, in all three kinds and for some seats none', () => {
    const kinds = new Set<string | undefined>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = match(seed), b = match(seed);
      firstTurns(a);
      firstTurns(b);
      expect(a.ai[0].habit).toBeDefined();
      expect(a.ai[0].habit).toBe(b.ai[0].habit);
      kinds.add(a.ai[0].habit);
      kinds.add(a.ai[1].habit);
    }
    expect([...kinds].sort()).toEqual(['bait', 'hoard', 'hold', 'none']);
  });

  it('is never settled by a computer that is not clever, nor for a person', () => {
    const s = match(3, 'easy');
    firstTurns(s);
    expect(s.ai[0].habit).toBe('none');
    const t = createGame({ seed: 3, size: 'small', players: [{ name: 'Me', ai: null }, { name: 'B', ai: 'hard' }] });
    firstTurns(t);
    expect(habitOf(t, 0)).toBeNull();
  });

  it('shows on the rival card only once it has shown in play, a refusal only after a long stay', () => {
    const s = withHabit('hold');
    expect(habitOf(s, 1)).toBeNull();
    s.ai[1].habitSeen = s.tick;
    expect(habitOf(s, 1)).toBeNull();
    s.tick += (AI_TEMPER.holdShown + 1) * TICK_HZ;
    expect(habitOf(s, 1)).toBe('hold');
    expect(rivalCardHtml(s, 1, new RivalLedger())).toContain('Never retreats');
    const h = withHabit('hoard');
    h.ai[1].habitSeen = h.tick;
    expect(habitOf(h, 1)).toBe('hoard');
  });

  it('has a baiter step back while its army waits at home, and no other habit', () => {
    const setup = (habit: 'bait' | 'hoard') => {
      const s = withHabit(habit);
      const me = s.players[1];
      enterAge(s, me, 'bronze');
      enterAge(s, me, 'warband');
      const tc = townCenters(s, 1)[0];
      for (let i = 0; i < AI_TEMPER.baitArmy; i++) spawnUnit(s, 1, 'infantry', tc.x + 3 + (i % 4), tc.y + 3 + Math.floor(i / 4));
      for (const r of ['food', 'wood', 'stone', 'gold'] as const) me.res[r] = 5000;
      s.peaceUntil = 0;
      s.tick = (AI_TEMPER.baitFrom + 1) * TICK_HZ;
      s.ai[1].next = s.tick;
      for (let i = 0; i < 4; i++) step(s);
      return { s, going: townCenters(s, 1).some((b) => b.advance >= 0 && b.back) };
    };
    const baiter = setup('bait');
    expect(baiter.going).toBe(true);
    expect(baiter.s.ai[1].baited).toBeDefined();
    expect(habitOf(baiter.s, 1)).toBe('bait');
    const other = setup('hoard');
    expect(other.going).toBe(false);
  });
});
