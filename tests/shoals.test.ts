import { describe, expect, it } from 'vitest';
import { AMOUNT, SEASON, YEAR, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { clearResource } from '../src/sim/grid';
import { R_FISH, T_WATER } from '../src/sim/types';
import type { GameState, HomelandId } from '../src/sim/types';

/** The mere spawns (#482): on the Shore, what a player spares of each shoal is next spring's catch. */

const game = (homeland: HomelandId, seed = 1): GameState =>
  createGame({ seed, size: 'small', homeland, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

const LEN = secs(SEASON.len);
/** Every shoal tile on the map, in tile order. */
const shoals = (s: GameState) => {
  const out: number[] = [];
  for (let i = 0; i < s.w * s.h; i++) if (s.res[i] === R_FISH) out.push(i);
  return out;
};
/** Play through the turn into spring `years` years in. */
const toSpring = (s: GameState, years = 1) => {
  s.tick = years * 4 * LEN - 1;
  s.events = [];
  step(s);
  step(s);
};
const near = (s: GameState, a: number, b: number) => Math.max(Math.abs((a % s.w) - (b % s.w)), Math.abs(Math.floor(a / s.w) - Math.floor(b / s.w)));

describe('the mere spawns (#482)', () => {
  it('each spring a shoal grows by what is left in it, a full one seeds another, and one fished out is gone', () => {
    const s = game('shore');
    const before = shoals(s);
    expect(before.length).toBeGreaterThan(4);
    const [gone, low, half, ...rest] = before;
    clearResource(s, gone);
    s.amount[low] = 30;
    s.amount[half] = 140;
    // The rest are fished down to their seed, so only one full shoal is left to seed.
    const [full, ...thin] = rest;
    for (const t of thin) s.amount[t] = YEAR.fishSpare;
    const pre = shoals(s);
    toSpring(s);
    // The stripped shoal doesn't grow back: at most a full neighbour seeds a new one in its place.
    if (s.res[gone] === R_FISH) expect(s.amount[gone]).toBe(Math.floor(AMOUNT.fish * YEAR.spawn));
    expect(s.amount[low]).toBe(30 + Math.floor(30 * YEAR.breed));
    expect(s.amount[half]).toBe(Math.min(AMOUNT.fish, 140 + Math.floor(140 * YEAR.breed)));
    expect(s.amount[full]).toBe(AMOUNT.fish);
    for (const t of thin) expect(s.amount[t]).toBe(Math.min(AMOUNT.fish, YEAR.fishSpare * (1 + YEAR.breed)));
    const born = shoals(s).filter((t) => !pre.includes(t));
    // New shoals: half-full, two tiles from a full shoal, on open water off the bank, a tile apart from the rest.
    for (const t of born) {
      expect(s.amount[t]).toBe(Math.floor(AMOUNT.fish * YEAR.spawn));
      const x = t % s.w;
      const y = Math.floor(t / s.w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(s.terrain[(y + dy) * s.w + x + dx]).toBe(T_WATER);
      for (const o of shoals(s)) if (o !== t) expect(near(s, t, o)).toBeGreaterThan(1);
      expect(before.some((p) => s.amount[p] >= AMOUNT.fish * YEAR.seedAt && near(s, p, t) === 2)).toBe(true);
    }
    expect(born.length).toBeGreaterThan(0);
    const ev = s.events.find((e) => e.k === 'spawned');
    expect(ev && ev.k === 'spawned' && ev.seeded).toBe(born.length);
  });

  it('a mere left alone fills out over the years, and one fished bare stays bare', () => {
    const kept = game('shore', 3);
    const n0 = shoals(kept).length;
    toSpring(kept, 1);
    const n1 = shoals(kept).length;
    expect(n1).toBeGreaterThan(n0);
    // Half-full new shoals grow full by the next spring and seed in their turn, until the water is crowded.
    toSpring(kept, 2);
    expect(shoals(kept).length).toBeGreaterThanOrEqual(n1);
    const bare = game('shore', 3);
    for (const t of shoals(bare)) clearResource(bare, t);
    toSpring(bare, 1);
    toSpring(bare, 2);
    expect(shoals(bare).length).toBe(0);
  });

  it('only the Shore spawns: the Glade and the other homelands keep their shoals as they are', () => {
    for (const hl of ['glade', 'herds', 'wood'] as HomelandId[]) {
      const s = game(hl, 2);
      const list = shoals(s);
      for (const t of list) s.amount[t] = 40;
      toSpring(s);
      expect(shoals(s), hl).toEqual(list);
      for (const t of list) expect(s.amount[t], hl).toBe(40);
      expect(s.events.some((e) => e.k === 'spawned'), hl).toBe(false);
    }
  });

  it('spawns the same way every time for a seed', () => {
    const run = () => {
      const s = game('shore', 5);
      const list = shoals(s);
      list.forEach((t, k) => (s.amount[t] = 20 + ((k * 37) % 230)));
      toSpring(s, 1);
      toSpring(s, 2);
      return shoals(s).map((t) => `${t}:${s.amount[t]}`).join(' ');
    };
    expect(run()).toBe(run());
  });
});
