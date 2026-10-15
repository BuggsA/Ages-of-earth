import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { modsOf, techProblem } from '../src/sim/stats';

describe('Litany', () => {
  it('quickens chanting only on the pilgrims\' road', () => {
    const s = createGame({ seed: 11, size: 'small', startEpoch: 2, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const p = s.players[0];
    expect(techProblem(s, 0, 'litany')).toContain('Only in');
    p.age = 'pilgrim';
    p.techs.push('litany');
    p.statsVersion++;
    expect(techProblem(s, 0, 'litany')).not.toBeNull();
    expect(modsOf(s, 0).chant).toBeCloseTo(1.3);
    expect(modsOf(s, 0).priest).toBeCloseTo(1.25);
    p.age = undefined;
    p.statsVersion++;
    expect(modsOf(s, 0).chant).toBe(1);
  });
});
