import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { TECHS, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { GameState } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

const game = (): GameState =>
  createGame({
    seed: 7,
    size: 'small',
    startEpoch: 1,
    players: [
      { name: 'A', ai: null, civ: 'romans' },
      { name: 'B', ai: null, civ: 'romans' },
    ],
  });

describe('Pilgrimage', () => {
  it('is researched at the Temple and doubles what a kept relic pays', () => {
    expect(TECHS.pilgrimage.at).toBe('temple');
    const gain = (tech: boolean): number => {
      const s = game();
      const p = s.players[0];
      if (tech) {
        p.techs.push('pilgrimage');
        p.statsVersion++;
      }
      const t = placeBuilding(s, 0, 'temple', findSpot(s, 'temple', p.startX, p.startY, 5, 20)!.tx, findSpot(s, 'temple', p.startX, p.startY, 5, 20)!.ty, true);
      s.relics[0].temple = t.id;
      const gold = p.res.gold;
      for (let i = 0; i < 20 * TICK_HZ; i++) step(s);
      return p.res.gold - gold;
    };
    const base = gain(false);
    expect(base).toBeGreaterThan(0);
    expect(gain(true)).toBe(base * 2);
  });
});
