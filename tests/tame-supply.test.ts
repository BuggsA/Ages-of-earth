import { describe, expect, it } from 'vitest';
import { SEASON, TAME, secs } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { findSpot } from '../src/sim/ai';
import { wildBeast } from '../src/sim/tame';
import type { GameState, HomelandId, MapType } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

/**
 * The Wild's key resource is guaranteed (`docs/rulings.md`, 2026-10-29: the wild branch was "almost impossible to play because there
 * wasn't enough animals"): a Wild people with a Hunting Camp has every kind it can tame come to the camp within a year, on every
 * homeland, even when the map's own wild has been hunted out.
 */
const wildTown = (seed: number, homeland: HomelandId, mapType: MapType): { s: GameState; camp: { x: number; y: number } } => {
  const s = createGame({ seed, size: 'small', homeland, mapType, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  // Everything near home already hunted.
  s.animals = s.animals.filter((a) => !wildBeast(a));
  const p = s.players[0];
  enterAge(s, p, 'wild');
  const spot = findSpot(s, 'huntcamp', p.startX, p.startY, 8, 24)!;
  const b = placeBuilding(s, 0, 'huntcamp', spot.tx, spot.ty, true);
  return { s, camp: b };
};

describe('the call of the wild keeps every kind within reach', () => {
  const cases: [number, HomelandId, MapType][] = [[1, 'glade', 'continental'], [2, 'shore', 'lakes'], [3, 'herds', 'plains'], [4, 'wood', 'forest'], [5, 'glade', 'highlands']];
  for (const [seed, homeland, mapType] of cases) {
    it(`seed ${seed}, ${homeland}, ${mapType}: a wolf, a boar and a mammoth come to the camp within the first called season`, () => {
      const { s, camp } = wildTown(seed, homeland, mapType);
      const came = new Set<string>();
      while (s.tick < secs(SEASON.len * 2)) {
        step(s);
        for (const e of s.events) if (e.k === 'wildCry' && Math.hypot(e.x - camp.x, e.y - camp.y) <= TAME.callNear) came.add(e.kind);
      }
      expect([...came].sort()).toEqual(['boar', 'mammoth', 'wolf']);
    });
  }

  it('a kind already tamed makes way for the one still lacking', () => {
    const { s, camp } = wildTown(1, 'glade', 'continental');
    s.players[0].tamed = ['boar', 'mammoth'];
    const came: string[] = [];
    while (s.tick < secs(SEASON.len * 2)) {
      step(s);
      for (const e of s.events) if (e.k === 'wildCry' && Math.hypot(e.x - camp.x, e.y - camp.y) <= TAME.callNear) came.push(e.kind);
    }
    // Spring would bring a boar, but the people has one: a wolf comes first, and no mammoth outside winter.
    expect(came[0]).toBe('wolf');
    expect(came).not.toContain('mammoth');
  });
});
