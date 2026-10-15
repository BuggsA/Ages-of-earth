import { describe, expect, it } from 'vitest';
import { AMOUNT, MAMMOTH, ROT, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { hitAnimal, spawnAnimal } from '../src/sim/animals';
import { landOwnerAt } from '../src/sim/borders';
import { walkable } from '../src/sim/grid';
import { techProblem } from '../src/sim/stats';
import type { GameState } from '../src/sim/types';
import { R_MEAT, R_NONE } from '../src/sim/types';

/** Meat spoils, and Drying Racks keep it. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** Fell a mammoth on open ground, outside every border; returns its carcass tile. */
function kill(s: GameState, x: number, y: number): number {
  const a = spawnAnimal(s, x, y, 'mammoth');
  hitAnimal(s, a, 9999, x - 1, y);
  const c = s.carcasses![s.carcasses!.length - 1];
  expect(s.res[c.tile]).toBe(R_MEAT);
  return c.tile;
}

function openGround(s: GameState): { x: number; y: number } {
  for (let y = 10; y < s.h - 10; y++)
    for (let x = 10; x < s.w - 10; x++)
      if (landOwnerAt(s, x, y) < 0 && walkable(s, x, y) && s.res[y * s.w + x] === R_NONE && s.players.every((p) => Math.hypot(x - p.startX, y - p.startY) > 20)) return { x: x + 0.5, y: y + 0.5 };
  throw new Error('no ground');
}

describe('rotting meat', () => {
  it('keeps through its grace, then shrinks', () => {
    const s = game();
    const { x, y } = openGround(s);
    const tile = kill(s, x, y);
    run(s, ROT.grace - 2);
    expect(s.amount[tile]).toBe(MAMMOTH.meat);
    run(s, 12);
    expect(s.amount[tile]).toBeLessThan(MAMMOTH.meat);
  });

  it('rots away entirely, and the tile frees', () => {
    const s = game();
    const { x, y } = openGround(s);
    const tile = kill(s, x, y);
    run(s, ROT.grace + Math.ceil(1 / ROT.rate) + 10);
    expect(s.res[tile]).toBe(R_NONE);
    expect(s.carcasses!.some((c) => c.tile === tile)).toBe(false);
  });

  it('a small carcass still shrinks', () => {
    const s = game();
    const { x, y } = openGround(s);
    const a = spawnAnimal(s, x, y, 'deer');
    hitAnimal(s, a, 9999, x - 1, y);
    const c = s.carcasses![0];
    expect(c.full).toBe(AMOUNT.meat);
    run(s, ROT.grace + 5);
    expect(s.amount[c.tile]).toBeLessThan(AMOUNT.meat);
  });

  it('Drying Racks slow the rot on held land', () => {
    const s = game();
    const p = s.players[0];
    const gx = Math.floor(p.startX) + 2;
    const gy = Math.floor(p.startY) + 5;
    expect(landOwnerAt(s, gx, gy)).toBe(0);
    // Two carcasses by the same town: one without racks, then one with.
    const free = (): { x: number; y: number } => {
      for (let r = 4; r < 12; r++)
        for (let dx = -r; dx <= r; dx++) {
          const x = gx + dx, y = gy;
          if (walkable(s, x, y) && s.res[y * s.w + x] === R_NONE && landOwnerAt(s, x, y) === 0) return { x: x + 0.5, y: y + 0.5 };
        }
      throw new Error('none');
    };
    const spot = free();
    const t1 = kill(s, spot.x, spot.y);
    run(s, ROT.grace + 20);
    const lostPlain = MAMMOTH.meat - s.amount[t1];
    p.techs.push('drying');
    p.statsVersion++;
    s.carcasses = [];
    s.amount[t1] = MAMMOTH.meat;
    s.carcasses.push({ tile: t1, born: s.tick, full: MAMMOTH.meat });
    run(s, ROT.grace + 20);
    const lostRacks = MAMMOTH.meat - s.amount[t1];
    expect(lostPlain).toBeGreaterThan(0);
    expect(lostRacks).toBeLessThan(lostPlain / 2);
  });

  it('the racks are a Stone Age research at the Town Center', () => {
    const s = game();
    expect(techProblem(s, 0, 'drying')).toBeFalsy();
  });

  it('is deterministic', () => {
    const go = () => {
      const s = game();
      const { x, y } = openGround(s);
      const t = kill(s, x, y);
      run(s, ROT.grace + 30);
      return s.amount[t];
    };
    expect(go()).toBe(go());
  });
});
