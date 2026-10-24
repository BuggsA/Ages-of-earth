import { describe, expect, it } from 'vitest';
import { leanOf } from '../src/sim/ai';
import { AGES, STEP_BACK, TICK_HZ, TRUNK } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { spawnUnit, townCenters } from '../src/sim/world';
import { shownLean } from '../src/ui/rivalRoad';
import type { GameState } from '../src/sim/types';

// Rivals with a leaning (#749): a favoured route settled on the first turn, and a wave that strikes a step-back window.
const match = (seed: number, ai: 'hard' | 'easy' = 'hard', mapType: 'continental' | 'lakes' = 'continental') =>
  createGame({ seed, size: 'small', mapType, players: [{ name: 'A', ai }, { name: 'B', ai }] });
const firstTurns = (s: GameState) => {
  while (s.tick < 40) step(s);
};

describe('a computer leaning', () => {
  it('is settled once on the first turn, the same for a seed, and chooses its route\'s side ages', () => {
    const leans = [];
    for (let seed = 1; seed <= 12; seed++) {
      const a = match(seed), b = match(seed);
      firstTurns(a);
      firstTurns(b);
      expect(a.ai[0].lean).toBeDefined();
      expect(a.ai[0].lean).toBe(b.ai[0].lean);
      const lean = leanOf(a, 0);
      leans.push(lean);
      if (!lean) continue;
      // Navy and water want water near.
      expect(['navy', 'water']).not.toContain(lean);
      const chosen = Object.entries(a.ai[0].roads ?? {}).filter(([, v]) => v).map(([k]) => k);
      expect(chosen.some((x) => AGES[x as keyof typeof AGES].routes?.includes(lean))).toBe(true);
    }
    // Some seats lean and some keep an open mind.
    expect(leans.some((l) => l)).toBe(true);
    expect(leans.some((l) => !l)).toBe(true);
  });

  it('is never settled by a computer that is not clever, nor for a person', () => {
    const s = match(3, 'easy');
    firstTurns(s);
    expect(leanOf(s, 0)).toBeNull();
    const t = createGame({ seed: 3, size: 'small', players: [{ name: 'Me', ai: null }, { name: 'B', ai: 'hard' }] });
    firstTurns(t);
    expect(leanOf(t, 0)).toBeNull();
  });

  it('shows on the rival card only once the rival has walked an age on its route', () => {
    let s: GameState | null = null;
    for (let seed = 1; seed <= 30 && !s; seed++) {
      const t = match(seed);
      firstTurns(t);
      if (leanOf(t, 1)) s = t;
    }
    expect(s).not.toBeNull();
    const lean = leanOf(s!, 1)!;
    expect(shownLean(s!, 1)).toBeNull();
    const age = (Object.keys(AGES) as (keyof typeof AGES)[]).find((a) => !TRUNK.includes(a) && AGES[a].routes?.includes(lean))!;
    s!.players[1].walked = [age];
    expect(shownLean(s!, 1)).toBe(lean);
  });
});

describe('striking the window', () => {
  it('sends a smaller wave than usual at a rival inside its weak window, and none once it has closed', () => {
    const setup = (backAgo: number) => {
      const s = createGame({ seed: 5, size: 'small', players: [{ name: 'AI', ai: 'hard' }, { name: 'Me', ai: null }] });
      firstTurns(s);
      const me = s.players[0];
      const ids = Array.from({ length: 8 }, (_, i) => spawnUnit(s, 0, 'infantry', me.startX + 2 + (i % 4), me.startY + 2 + Math.floor(i / 4)).id);
      enterAge(s, s.players[1], 'bronze');
      enterAge(s, s.players[1], 'stone', true);
      s.players[1].backAt = s.tick - backAgo;
      s.ai[0].next = s.tick;
      step(s);
      const tc = townCenters(s, 1)[0];
      const marching = ids.filter((id) => {
        const u = s.byId.get(id);
        return u?.kind === 'unit' && ((u.order.k === 'move' && u.order.amove) || u.order.k === 'attack');
      });
      return { s, tc, marching, attacking: s.ai[0].attacking };
    };
    const open = setup(0);
    expect(open.attacking).toBe(true);
    expect(open.marching.length).toBe(8);
    const closed = setup((STEP_BACK.time + 1) * TICK_HZ);
    expect(closed.attacking).toBe(false);
  });
});
