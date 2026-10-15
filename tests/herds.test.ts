import { describe, expect, it } from 'vitest';
import { DEER, TICK_HZ, WOLF } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { landOwnerAt } from '../src/sim/borders';
import { spawnAnimal } from '../src/sim/animals';
import type { GameState } from '../src/sim/types';
import { walkable } from '../src/sim/grid';
import { R_MEAT, R_NONE } from '../src/sim/types';

/** Herds that drift from town to wild ground, and wolves that hunt deer. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** An open meadow clear of towns and their borders, an 11-tile square. */
function meadow(s: GameState): { x: number; y: number } {
  for (let y = 10; y < s.h - 10; y++) {
    for (let x = 10; x < s.w - 10; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 18) || landOwnerAt(s, x, y) >= 0) continue;
      let open = true;
      for (let dy = -5; dy <= 5 && open; dy++) for (let dx = -5; dx <= 5 && open; dx++) open = walkable(s, x + dx, y + dy) && s.res[(y + dy) * s.w + x + dx] === R_NONE;
      if (open) return { x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error('no meadow');
}

describe('herds', () => {
  it('deer that start together share a herd', () => {
    const s = game();
    const herds = new Set(s.animals.filter((a) => a.kind === 'deer').map((a) => a.herd));
    const deer = s.animals.filter((a) => a.kind === 'deer');
    expect(herds.size).toBeLessThan(deer.length);
    expect(herds.size).toBeGreaterThanOrEqual(2);
  });

  it('move on to new ground, never into a border, and not too far from where they began', () => {
    const s = game();
    const deer = s.animals.filter((a) => a.kind === 'deer');
    const before = deer.map((a) => ({ x: a.homeX, y: a.homeY }));
    run(s, DEER.every * 3);
    let moved = 0;
    deer.forEach((a, i) => {
      if (Math.hypot(a.homeX - before[i].x, a.homeY - before[i].y) >= DEER.min - 0.01) moved++;
      expect(landOwnerAt(s, Math.floor(a.homeX), Math.floor(a.homeY))).toBe(-1);
      expect(Math.hypot(a.homeX - (a.origX ?? 0), a.homeY - (a.origY ?? 0))).toBeLessThanOrEqual(DEER.range + 0.01);
    });
    expect(moved).toBeGreaterThan(0);
  });

  it('move as one: deer of a herd pick the same step', () => {
    const s = game();
    const first = s.animals.find((a) => a.kind === 'deer')!;
    const mates = s.animals.filter((a) => a.kind === 'deer' && a.herd === first.herd);
    expect(mates.length).toBeGreaterThan(1);
    const offsets = mates.map((a) => ({ x: a.homeX - first.homeX, y: a.homeY - first.homeY }));
    run(s, DEER.every + 5);
    mates.forEach((a, i) => {
      expect(a.homeX - first.homeX).toBeCloseTo(offsets[i].x, 5);
      expect(a.homeY - first.homeY).toBeCloseTo(offsets[i].y, 5);
    });
  });

  it('are the same on every run (deterministic)', () => {
    const a = game();
    const b = game();
    run(a, DEER.every * 2);
    run(b, DEER.every * 2);
    expect(a.animals.map((d) => [d.x, d.y])).toEqual(b.animals.map((d) => [d.x, d.y]));
  });
});

describe('wolves and deer', () => {
  it('a pack runs down a deer that grazes near its den and leaves the carcass', () => {
    const s = game();
    s.animals = [];
    const { x: cx, y: cy } = meadow(s);
    for (let i = 0; i < WOLF.pack; i++) spawnAnimal(s, cx + i * 0.3, cy, 'wolf');
    const deer = spawnAnimal(s, cx + 4, cy + 2, 'deer');
    run(s, 40);
    expect(s.animals.includes(deer)).toBe(false);
    let meat = 0;
    for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_MEAT) meat++;
    expect(meat).toBeGreaterThan(0);
    expect(s.animals.filter((a) => a.kind === 'wolf')).toHaveLength(WOLF.pack);
  });

  it('ignore deer beyond their hunting ground', () => {
    const s = game();
    s.animals = [];
    const { x, y } = meadow(s);
    for (let i = 0; i < WOLF.pack; i++) spawnAnimal(s, x + i * 0.3, y, 'wolf');
    const deer = spawnAnimal(s, x + WOLF.hunt + 1, y, 'deer');
    run(s, 8);
    expect(s.animals.includes(deer)).toBe(true);
  });
});
