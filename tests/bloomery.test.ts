import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { createGame } from '../src/sim/game';
import { modsOf, statsFor, techProblem } from '../src/sim/stats';
import type { GameState } from '../src/sim/types';

const game = (): GameState =>
  createGame({ seed: 11, size: 'small', startEpoch: 1, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

describe('Bloomery', () => {
  it('is an Iron Age craft: shut elsewhere, hardens foot soldiers there, lapses on leaving', () => {
    const s = game();
    const p = s.players[0];
    expect(techProblem(s, 0, 'bloomery')).toContain('Iron Age');
    p.age = 'iron';
    p.statsVersion++;
    expect(ageOf(p)).toBe('iron');
    expect(techProblem(s, 0, 'bloomery')).toBeNull();
    const before = statsFor(s, 0, 'infantry');
    p.techs.push('bloomery');
    p.statsVersion++;
    const after = statsFor(s, 0, 'infantry');
    expect(after.armor).toBe(before.armor + 1);
    expect(after.hp).toBe(Math.round(before.hp * 1.2));
    expect(modsOf(s, 0).infantryArmor).toBe(1);
    p.age = undefined;
    p.statsVersion++;
    expect(modsOf(s, 0).infantryArmor).toBe(0);
    expect(statsFor(s, 0, 'infantry').armor).toBe(before.armor);
  });
});
