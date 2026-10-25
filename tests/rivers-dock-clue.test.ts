import { describe, expect, it } from 'vitest';
import { roadKnown, roadProblem, cluesOf } from '../src/sim/ages';
import { ROADS } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { roadLabel } from '../src/ui/webMap';
import type { GameState } from '../src/sim/types';

const RIVERS = ROADS.find((r) => r.from === 'stone' && r.to === 'rivers')!;
const has = (s: GameState, type: string, built = true) => s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === type && (!built || e.built));

// The Age of Rivers shows at a Farm, or (#794) at a Dock for a people that raises no Farm: the Britons, a camp on the move, the Hunters' Way.
describe('the Age of Rivers has a second clue', () => {
  it('names a Farm or a Dock, and the road panel says so', () => {
    expect(cluesOf(RIVERS)).toEqual(['farm', 'dock']);
    expect(roadLabel(RIVERS)).toContain('Farm or a Dock');
  });

  it('is known to a town with a Dock and no Farm', () => {
    const s = createGame({ seed: 203, size: 'small', mapType: 'lakes', players: [{ name: 'Brit', ai: null, civ: 'britons' }, { name: 'Rival', ai: 'normal' }] });
    step(s);
    const p = s.players[0];
    expect(roadKnown(s, p, RIVERS)).toBe(false);
    expect(roadProblem(s, p, RIVERS)).toContain('Farm or a Dock');
  });

  it('a Briton computer bound for Rivers raises a Dock, not a Farm, to see it', () => {
    const s = createGame({ seed: 203, size: 'small', mapType: 'lakes', players: [{ name: 'Brit', ai: 'hard', civ: 'britons' }, { name: 'Rival', ai: 'normal' }] });
    step(s);
    s.ai[0].roads = { rivers: true };
    while (s.tick < 1200 * 8 && !has(s, 'dock')) step(s);
    expect(has(s, 'dock', false)).toBe(true);
    expect(has(s, 'farm', false)).toBe(false);
    while (s.tick < 1200 * 10 && !has(s, 'dock')) step(s);
    expect(roadKnown(s, s.players[0], RIVERS)).toBe(true);
  });
});
