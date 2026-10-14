import { describe, expect, it } from 'vitest';
import { AMOUNT, DEER, secs } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { hitAnimal, spawnAnimal, updateAnimals } from '../src/sim/animals';
import type { GameState } from '../src/sim/types';
import { B_RES, R_MEAT, R_NONE } from '../src/sim/types';

function meadow(seed = 11): { s: GameState; x: number; y: number } {
  const s = createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.animals = [];
  // An open patch, eight tiles across, clear of trees, buildings and resources.
  for (let y = 8; y < s.h - 8; y++) {
    for (let x = 8; x < s.w - 8; x++) {
      let open = true;
      for (let dy = -4; dy <= 4 && open; dy++) for (let dx = -4; dx <= 4 && open; dx++) open = walkable(s, x + dx, y + dy) && s.res[(y + dy) * s.w + x + dx] === R_NONE;
      if (open) return { s, x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error('no meadow');
}

describe('deer', () => {
  it('graze and wander, but never far from home', () => {
    const { s, x, y } = meadow();
    const a = spawnAnimal(s, x, y);
    expect(s.animals).toEqual([a]);
    expect(a.hp).toBe(DEER.hp);
    let moved = false;
    for (let t = 0; t < secs(120); t++) {
      updateAnimals(s);
      if (a.x !== x || a.y !== y) moved = true;
      expect(Math.sqrt((a.x - a.homeX) ** 2 + (a.y - a.homeY) ** 2)).toBeLessThanOrEqual(3.6);
      expect(walkable(s, Math.floor(a.x), Math.floor(a.y))).toBe(true);
    }
    expect(moved).toBe(true);
  });

  it('wander the same way twice from the same match dice', () => {
    const run = () => {
      const { s, x, y } = meadow();
      const a = spawnAnimal(s, x, y);
      const path: number[] = [];
      for (let t = 0; t < secs(60); t++) {
        updateAnimals(s);
        path.push(a.x, a.y);
      }
      return path;
    };
    expect(run()).toEqual(run());
  });

  it('bolt away from a spear that does not kill, then settle where they stop', () => {
    const { s, x, y } = meadow();
    const a = spawnAnimal(s, x, y);
    hitAnimal(s, a, 1, x - 1, y);
    expect(a.hp).toBe(DEER.hp - 1);
    expect(a.state).toBe('flee');
    expect(a.fx).toBeCloseTo(1);
    expect(a.fy).toBeCloseTo(0);
    expect(a.hurt).toBe(s.tick);
    updateAnimals(s);
    expect(a.x).toBeGreaterThan(x);
    for (let t = 0; t < secs(3); t++) updateAnimals(s);
    expect(a.state).toBe('graze');
    expect(a.homeX).toBe(a.x);
    expect(a.homeY).toBe(a.y);
  });

  it('fall to a killing spear and leave a carcass to butcher', () => {
    const { s, x, y } = meadow();
    const a = spawnAnimal(s, x, y);
    const version = s.blockVersion;
    hitAnimal(s, a, DEER.hp, x - 1, y);
    expect(s.animals).toEqual([]);
    const tile = Math.floor(y) * s.w + Math.floor(x);
    expect(s.res[tile]).toBe(R_MEAT);
    expect(s.amount[tile]).toBe(AMOUNT.meat);
    expect(s.block[tile] & B_RES).toBe(B_RES);
    expect(s.blockVersion).toBe(version + 1);
    expect(s.events).toContainEqual(expect.objectContaining({ k: 'animalDie', id: a.id }));
    // A second spear into the fallen deer does nothing more.
    const events = s.events.length;
    hitAnimal(s, a, DEER.hp, x, y);
    expect(s.events.length).toBe(events);
  });

  it('leave the carcass beside a tile already taken', () => {
    const { s, x, y } = meadow();
    const a = spawnAnimal(s, x, y);
    const under = Math.floor(y) * s.w + Math.floor(x);
    hitAnimal(s, spawnAnimal(s, x, y), DEER.hp, x, y);
    expect(s.res[under]).toBe(R_MEAT);
    hitAnimal(s, a, DEER.hp, x, y);
    let carcasses = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (s.res[under + dy * s.w + dx] === R_MEAT) carcasses++;
    expect(carcasses).toBe(2);
  });
});
