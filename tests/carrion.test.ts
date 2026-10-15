import { describe, expect, it } from 'vitest';
import { MAMMOTH, ROT, TICK_HZ, WOLF } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { hitAnimal, spawnAnimal } from '../src/sim/animals';
import { landOwnerAt } from '../src/sim/borders';
import { walkable } from '../src/sim/grid';
import type { GameState } from '../src/sim/types';
import { R_MEAT, R_NONE } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** Carrion: wolves scent a carcass on unheld land and eat it. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** An open meadow far from both towns, the wild cleared away. */
function meadow(): { s: GameState; x: number; y: number } {
  const s = game();
  s.animals = [];
  for (let y = 8; y < s.h - 8; y++)
    for (let x = 8; x < s.w - 8; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 18)) continue;
      let open = true;
      for (let dy = -4; dy <= 4 && open; dy++) for (let dx = -4; dx <= 4 && open; dx++) open = walkable(s, x + dx, y + dy) && s.res[(y + dy) * s.w + x + dx] === R_NONE && landOwnerAt(s, x + dx, y + dy) < 0;
      if (open) return { s, x: x + 0.5, y: y + 0.5 };
    }
  throw new Error('no meadow');
}

function fell(s: GameState, x: number, y: number): number {
  const a = spawnAnimal(s, x, y, 'mammoth');
  hitAnimal(s, a, 9999, x - 1, y);
  return s.carcasses![s.carcasses!.length - 1].tile;
}

describe('carrion', () => {
  it('a pack within scent comes and eats a carcass faster than it rots', () => {
    const { s, x, y } = meadow();
    const wolves = [0, 1, 2].map(() => spawnAnimal(s, x - 3, y, 'wolf'));
    const tile = fell(s, x + 3, y);
    // Fresh meat isn't scented.
    run(s, ROT.grace - 5);
    expect(wolves.every((w) => w.scav === undefined)).toBe(true);
    expect(s.amount[tile]).toBe(MAMMOTH.meat);
    run(s, 16);
    expect(wolves.every((w) => w.scav === tile)).toBe(true);
    const at = s.amount[tile];
    run(s, 10);
    // Three wolves gnaw about WOLF.gnaw each a second, well beyond what rot takes.
    expect(at - s.amount[tile]).toBeGreaterThan(8 * WOLF.pack * WOLF.gnaw);
  });

  it('eats it all, then goes home and forgets it', () => {
    const { s, x, y } = meadow();
    const w = spawnAnimal(s, x - 3, y, 'wolf');
    const tile = fell(s, x + 3, y);
    run(s, ROT.grace + Math.ceil(MAMMOTH.meat / WOLF.gnaw) + 20);
    expect(s.res[tile]).toBe(R_NONE);
    expect(w.scav).toBeUndefined();
    expect(s.carcasses!.some((c) => c.tile === tile)).toBe(false);
  });

  it('leaves meat inside a border alone', () => {
    const { s } = meadow();
    const p = s.players[0];
    let spot: { x: number; y: number } | null = null;
    for (let dy = 3; dy < 9 && !spot; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const x = Math.floor(p.startX) + dx, y = Math.floor(p.startY) + dy;
        if (walkable(s, x, y) && s.res[y * s.w + x] === R_NONE && landOwnerAt(s, x, y) === 0) { spot = { x: x + 0.5, y: y + 0.5 }; break; }
      }
    expect(spot).not.toBeNull();
    s.animals = [];
    const w = spawnAnimal(s, spot!.x + 2, spot!.y, 'wolf');
    const tile = fell(s, spot!.x, spot!.y);
    run(s, ROT.grace + 10);
    expect(w.scav).toBeUndefined();
    expect(s.res[tile]).toBe(R_MEAT);
  });

  it('a pack past its scent never comes', () => {
    const { s, x, y } = meadow();
    const w = spawnAnimal(s, x - 3, y, 'wolf');
    w.homeX = x - WOLF.scent - 2;
    fell(s, x + 3, y);
    run(s, ROT.grace + 10);
    expect(w.scav).toBeUndefined();
  });

  it('bites anyone who comes to butcher the meat', () => {
    const { s, x, y } = meadow();
    spawnAnimal(s, x - 3, y, 'wolf');
    const tile = fell(s, x + 3, y);
    const u = spawnUnit(s, 0, 'citizen', x + 2.2, y);
    u.hp = 500;
    run(s, ROT.grace + 14);
    expect(u.hp).toBeLessThan(500);
    expect(s.res[tile]).toBe(R_MEAT);
  });

  it('is deterministic', () => {
    const go = () => {
      const { s, x, y } = meadow();
      spawnAnimal(s, x - 3, y, 'wolf');
      const t = fell(s, x + 3, y);
      run(s, ROT.grace + 20);
      return s.amount[t];
    };
    expect(go()).toBe(go());
  });
});
