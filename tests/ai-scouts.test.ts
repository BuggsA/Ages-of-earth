import { describe, expect, it } from 'vitest';
import { AI_LEVELS, AI_SCOUT, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { spawnUnit } from '../src/sim/world';
import type { GameState, Unit } from '../src/sim/types';

/** The computer scouts and keeps watch (#454 s4). */
const game = (): GameState => {
  const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'normal', civ: 'romans' }] });
  const p = s.players[1];
  spawnUnit(s, 1, 'cavalry', p.startX + 3.5, p.startY + 3.5);
  for (let i = 0; i < 9; i++) spawnUnit(s, 1, 'infantry', p.startX + 2.5 + (i % 3), p.startY - 3.5 - Math.floor(i / 3));
  return s;
};
const mine = (s: GameState): Unit[] => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 1 && e.hp > 0);

describe('the computer scouts (#454 s4)', () => {
  it('sends a rider exploring and posts a pair on its border once the first minutes are past', () => {
    const s = game();
    while (s.tick < secs(AI_SCOUT.after + 20)) step(s);
    const u = mine(s);
    expect(u.filter((x) => x.order.k === 'explore').length).toBe(1);
    expect(u.filter((x) => x.order.k === 'patrol').length).toBe(AI_SCOUT.guards);
  });

  it('does neither when scouting is switched off', () => {
    const s = game();
    const was = AI_LEVELS.normal.scouts;
    AI_LEVELS.normal.scouts = false;
    try {
      while (s.tick < secs(AI_SCOUT.after + 20)) step(s);
    } finally {
      AI_LEVELS.normal.scouts = was;
    }
    const u = mine(s);
    expect(u.some((x) => x.order.k === 'explore' || x.order.k === 'patrol')).toBe(false);
  });
});
