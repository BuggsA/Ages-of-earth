import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { BuildingType, GameState, RareId } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer mines the ore a road's door asks for (#356 s5). */
const make = (seed: number, ore: RareId): GameState | null => {
  const s = createGame({ seed, size: 'small', startEpoch: 1, players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'britons' }] });
  if (!s.rares?.includes(ore)) return null;
  s.peaceUntil = 1e9;
  return s;
};
const raise = (s: GameState, type: BuildingType) => {
  const p = s.players[0];
  const spot = findSpot(s, type, p.startX, p.startY, 6, 24)!;
  return placeBuilding(s, 0, type, spot.tx, spot.ty, true);
};

describe('the computer and rare ore', () => {
  it('a town bound for the merchants digs salt where the world holds it', () => {
    let tried = 0;
    for (let seed = 1; seed <= 40 && tried < 2; seed++) {
      const s = make(seed, 'salt');
      if (!s) continue;
      tried++;
      const p = s.players[0];
      s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { merchant: true } };
      raise(s, 'storehouse');
      raise(s, 'market');
      for (let i = 0; i < 30; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
      p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
      for (let i = 0; i < secs(400) && !(p.stats.mined?.salt ?? 0); i++) step(s);
      expect(p.stats.mined?.salt ?? 0).toBeGreaterThan(0);
    }
    expect(tried).toBeGreaterThan(0);
  });

  it('a world without the ore sends nobody digging', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = make(seed, 'salt');
      if (s) continue;
      const w = createGame({ seed, size: 'small', startEpoch: 1, players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'britons' }] });
      w.peaceUntil = 1e9;
      for (let i = 0; i < secs(60); i++) step(w);
      expect(w.players[0].stats.mined?.salt ?? 0).toBe(0);
      return;
    }
  });
});
