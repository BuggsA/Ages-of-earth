import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { CIV_IDS, WORK, WORKS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { modsOf } from '../src/sim/stats';
import { workProblem } from '../src/sim/works';
import type { CivId, GameState } from '../src/sim/types';

function game(civ: CivId): GameState {
  const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ }, { name: 'B', ai: null }] });
  s.players[0].epoch = 1;
  s.players[0].statsVersion++;
  return s;
}

describe('great works (seed #133)', () => {
  it('every people has one that changes a stat while it lasts and is spent for the epoch', () => {
    for (const civ of CIV_IDS) {
      const s = game(civ);
      const before = { ...modsOf(s, 0) };
      applyCommand(s, { t: 'greatWork', p: 0 });
      expect(s.events.some((e) => e.k === 'greatWork' && e.on)).toBe(true);
      const during = modsOf(s, 0);
      const changed = (Object.keys(before) as (keyof typeof before)[]).filter((k) => before[k] !== during[k]);
      expect(changed.length, civ).toBeGreaterThan(0);
      expect(WORKS[civ].blurb.length).toBeGreaterThan(20);
      expect(workProblem(s, s.players[0])).toMatch(/already at hand/);
      for (let i = 0; i < secs(WORK.duration) + 2; i++) step(s);
      expect(s.players[0].workEnd).toBeUndefined();
      expect(modsOf(s, 0)).toEqual(before);
      expect(workProblem(s, s.players[0])).toMatch(/called in this epoch/);
    }
  });

  it('waits for the first epoch it can be called in, and comes again with the next', () => {
    const s = game('egyptians');
    s.players[0].epoch = 0;
    s.players[0].statsVersion++;
    expect(workProblem(s, s.players[0])).toMatch(/next epoch/);
    applyCommand(s, { t: 'greatWork', p: 0 });
    expect(s.players[0].workEnd).toBeUndefined();
    expect(s.events.some((e) => e.k === 'refused')).toBe(true);
    s.players[0].epoch = 1;
    s.players[0].statsVersion++;
    applyCommand(s, { t: 'greatWork', p: 0 });
    expect(s.players[0].works).toEqual([1]);
    s.players[0].workEnd = undefined;
    s.players[0].epoch = 2;
    s.players[0].statsVersion++;
    expect(workProblem(s, s.players[0])).toBeNull();
  });

  it('the Nile flood raises farm work by 60%, and only for its owner', () => {
    const s = game('egyptians');
    const base = modsOf(s, 0).farm;
    const other = modsOf(s, 1).farm;
    applyCommand(s, { t: 'greatWork', p: 0 });
    expect(modsOf(s, 0).farm).toBeCloseTo(base * 1.6);
    expect(modsOf(s, 1).farm).toBe(other);
  });
});
