import { describe, expect, it } from 'vitest';
import { BORDERS, BUILDINGS, ROT, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { hitAnimal, spawnAnimal } from '../src/sim/animals';
import { landOwnerAt } from '../src/sim/borders';
import { walkable } from '../src/sim/grid';
import type { GameState } from '../src/sim/types';
import { R_NONE } from '../src/sim/types';
import { nearestDrop, placeBuilding } from '../src/sim/world';

/** The Hunting Camp: a food drop and a small claim, raised by the herd or a far kill. */

const game = (ai: 'normal' | null = null): GameState =>
  createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai, civ: 'romans' }] });
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** An open spot `far` tiles from player 0's town, wild cleared, level ground for a 2x2 camp and a carcass. */
function field(s: GameState, from: number, far: number, span = 30): { x: number; y: number } {
  s.animals = [];
  const p = s.players[from];
  for (let y = 8; y < s.h - 8; y++)
    for (let x = 8; x < s.w - 8; x++) {
      const d = Math.hypot(x - p.startX, y - p.startY);
      if (d < far || d > far + span) continue;
      let open = true;
      for (let dy = -4; dy <= 4 && open; dy++) for (let dx = -4; dx <= 4 && open; dx++) open = walkable(s, x + dx, y + dy) && landOwnerAt(s, x + dx, y + dy) < 0;
      // Clear the trees and berries off the patch.
      if (open) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) s.res[(y + dy) * s.w + x + dx] = R_NONE;
      if (open) return { x, y };
    }
  throw new Error('no field');
}

describe('hunting camp', () => {
  it('takes in food, and nothing else', () => {
    expect(BUILDINGS.huntcamp.drop).toEqual(['food']);
    expect(BUILDINGS.huntcamp.epoch).toBe(0);
    const s = game();
    const { x, y } = field(s, 0, 20);
    const camp = placeBuilding(s, 0, 'huntcamp', x, y, true);
    expect(nearestDrop(s, 0, 'food', x + 3, y, false)).toBe(camp);
    expect(nearestDrop(s, 0, 'wood', x + 3, y, false)).not.toBe(camp);
  });

  it('claims land round it, and an unbuilt site claims none', () => {
    const s = game();
    const { x, y } = field(s, 0, 20);
    const site = placeBuilding(s, 0, 'huntcamp', x, y, false);
    expect(landOwnerAt(s, x + 3, y)).toBe(-1);
    site.built = true;
    expect(landOwnerAt(s, x + 3, y)).toBe(0);
    expect(landOwnerAt(s, x + 3 + BORDERS.huntcamp! + 2, y)).not.toBe(0);
  });

  it('keeps meat from wolves that a far kill would lose', () => {
    const s = game();
    const { x, y } = field(s, 0, 20);
    placeBuilding(s, 0, 'huntcamp', x, y, true);
    const w = spawnAnimal(s, x + 7, y + 2, 'wolf');
    const m = spawnAnimal(s, x + 2.5, y + 3.5, 'mammoth');
    hitAnimal(s, m, 9999, x + 1, y + 3);
    const tile = s.carcasses![s.carcasses!.length - 1].tile;
    expect(landOwnerAt(s, tile % s.w, Math.floor(tile / s.w))).toBe(0);
    run(s, ROT.grace + 12);
    expect(w.scav).toBeUndefined();
  });

  it('the computer raises one by a far kill', () => {
    const s = game('normal');
    const { x, y } = field(s, 1, 21, 2);
    const m = spawnAnimal(s, x + 0.5, y + 0.5, 'mammoth');
    hitAnimal(s, m, 9999, x, y);
    s.players[1].res.wood = 400;
    run(s, 150);
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'huntcamp' && e.owner === 1)).toBe(true);
  });

  it('the computer raises one by a kill as far as the far hunt goes', () => {
    const s = game('normal');
    const { x, y } = field(s, 1, 26, 4);
    const m = spawnAnimal(s, x + 0.5, y + 0.5, 'mammoth');
    hitAnimal(s, m, 9999, x, y);
    s.players[1].res.wood = 400;
    run(s, 200);
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'huntcamp' && e.owner === 1)).toBe(true);
  });
});
