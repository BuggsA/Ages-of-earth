import { describe, expect, it } from 'vitest';
import { TRADE } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { harborNear, tripGold } from '../src/sim/trade';
import type { GameState } from '../src/sim/types';

/** The Age of Sail's harbor trade: a Dock near a Market makes its trips pay more. */

const game = (): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.players[0].epoch = 2;
  return s;
};

describe('harbor trade', () => {
  it('pays more only in the Age of Sail with a finished Dock near the Market', () => {
    const s = game();
    const m = { x: 40, y: 40 };
    const post = { id: 1, x: 70, y: 40 } as never;
    const base = tripGold(s, 0, m, post);
    expect(harborNear(s, 0, m)).toBe(false);
    s.players[0].age = 'sail';
    expect(harborNear(s, 0, m)).toBe(false);
    // A built Dock standing within reach, by hand.
    s.ents.push({ kind: 'building', owner: 0, type: 'dock', built: true, hp: 100, x: 44, y: 40 } as never);
    expect(harborNear(s, 0, m)).toBe(true);
    expect(harborNear(s, 0, { x: 40 + TRADE.harbor.reach + 5, y: 40 })).toBe(false);
    expect(tripGold(s, 0, m, post)).toBeGreaterThan(base);
    s.players[0].age = undefined;
    expect(tripGold(s, 0, m, post)).toBe(base);
  });
});
