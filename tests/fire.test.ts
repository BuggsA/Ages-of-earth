import { describe, expect, it } from 'vitest';
import { AMOUNT, FIRE, SEASON, TICK_HZ, secs } from '../src/sim/data';
import { checksum, createGame, enterAge, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { ignite, onFire, torchProblem } from '../src/sim/fire';
import type { Building, Command, GameState } from '../src/sim/types';
import { B_RES, R_NONE, R_TREE, T_WATER } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { torchGrowth } from '../src/sim/ai';

/** Fire (`src/sim/fire.ts`, the Wild route's step 3): torches, burning woods and living buildings, beating out, ash that regrows. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** Skips the clock to the start of a season (0 spring … 3 winter). */
const toSeason = (s: GameState, i: number) => {
  s.tick = secs(SEASON.len) * (4 + i);
};

/** Bare dry ground away from every town, player 0 in the Grove and player 1 in the Bronze Age. */
function meadow(seed = 11): { s: GameState; tx: number; ty: number } {
  const s = game(seed);
  s.animals = [];
  enterAge(s, s.players[0], 'wild');
  enterAge(s, s.players[0], 'grove');
  s.players[1].epoch = 1;
  for (let y = 12; y < s.h - 12; y++) {
    for (let x = 12; x < s.w - 12; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 20)) continue;
      let open = true;
      for (let dy = -9; dy <= 9 && open; dy++) for (let dx = -9; dx <= 9 && open; dx++) open = s.terrain[(y + dy) * s.w + x + dx] !== T_WATER && (walkable(s, x + dx, y + dy) || s.res[(y + dy) * s.w + x + dx] !== R_NONE);
      if (!open) continue;
      for (let dy = -9; dy <= 9; dy++)
        for (let dx = -9; dx <= 9; dx++) {
          const i = (y + dy) * s.w + x + dx;
          s.res[i] = R_NONE;
          s.amount[i] = 0;
          s.block[i] &= ~B_RES;
        }
      s.blockVersion++;
      return { s, tx: x, ty: y };
    }
  }
  throw new Error('no meadow');
}

/** A square wood of `r` tiles each way round (tx, ty). */
function wood(s: GameState, tx: number, ty: number, r: number): void {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const i = (ty + dy) * s.w + tx + dx;
      s.res[i] = R_TREE;
      s.amount[i] = AMOUNT.tree;
      s.block[i] |= B_RES;
    }
  s.blockVersion++;
}

/** Burns until nothing burns (or `most` seconds), and returns the tiles of the wood that are ash. */
function burnOut(s: GameState, tx: number, ty: number, r: number, most = 120): number[] {
  for (let i = 0; i < most && s.fires?.length; i++) run(s, 1);
  const ash: number[] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (s.res[(ty + dy) * s.w + tx + dx] !== R_TREE) ash.push((ty + dy) * s.w + tx + dx);
  return ash;
}

describe('fire', () => {
  it('is carried from the Bronze Age, to trees, roots and a rival\'s living buildings only', () => {
    const { s, tx, ty } = meadow();
    wood(s, tx, ty, 0);
    const tile = ty * s.w + tx;
    s.players[1].epoch = 0;
    expect(torchProblem(s, 1, { tile })).toMatch(/Bronze/);
    s.players[1].epoch = 1;
    expect(torchProblem(s, 1, { tile })).toBeNull();
    expect(torchProblem(s, 1, { tile: tile + 3 })).toBeTruthy();
    const hedge = placeBuilding(s, 0, 'thornwall', tx + 3, ty, true);
    const house = placeBuilding(s, 0, 'house', tx - 5, ty - 5, true);
    expect(torchProblem(s, 1, { target: hedge.id })).toBeNull();
    expect(torchProblem(s, 0, { target: hedge.id })).toMatch(/rival/);
    expect(torchProblem(s, 1, { target: house.id })).toMatch(/only what grows/);
    s.peaceUntil = s.tick + 100;
    expect(torchProblem(s, 1, { target: hedge.id })).toMatch(/peace/);
  });

  it('a torchbearer stands to light a rival\'s Thornwall, and unbeaten it burns down with its root', () => {
    const { s, tx, ty } = meadow();
    const hedge = placeBuilding(s, 0, 'thornwall', tx, ty, true);
    hedge.level = 3;
    const u = spawnUnit(s, 1, 'citizen', tx - 3.5, ty + 0.5);
    run(s, 1, [{ t: 'torch', p: 1, ids: [u.id], target: hedge.id }]);
    expect(onFire(s, hedge)).toBe(false);
    run(s, 2 + FIRE.light);
    expect(onFire(s, hedge)).toBe(true);
    expect(u.order.k).toBe('idle');
    expect(s.players[1].stats.torched).toBe(1);
    run(s, Math.ceil(1 / FIRE.bld) + 2);
    expect(hedge.hp).toBeLessThanOrEqual(0);
    expect(hedge.burnt).toBe(true);
    expect(s.roots ?? []).toHaveLength(0);
    expect(s.fires).toBeUndefined();
  });

  it('a Thornwall cut down leaves a root, and a torch burns the root away', () => {
    const { s, tx, ty } = meadow();
    s.roots = [{ tile: ty * s.w + tx, owner: 0, at: s.tick + secs(999) }];
    expect(torchProblem(s, 0, { tile: ty * s.w + tx })).toBeTruthy();
    const u = spawnUnit(s, 1, 'infantry', tx - 2.5, ty + 0.5);
    run(s, 2 + FIRE.light, [{ t: 'torch', p: 1, ids: [u.id], tile: ty * s.w + tx }]);
    expect(s.roots).toHaveLength(0);
  });

  it('a gardener beats out a fire on its own garden, and mending waits for the fire to go out', () => {
    const { s, tx, ty } = meadow();
    const g = placeBuilding(s, 0, 'garden', tx, ty, true);
    const gardener = spawnUnit(s, 0, 'citizen', tx + 0.5, ty + 0.5);
    gardener.order = { k: 'farm', target: g.id, phase: 'go' };
    ignite(s, ty * s.w + tx, 0, 1, true);
    expect(onFire(s, g)).toBe(true);
    run(s, FIRE.beat + 1);
    expect(onFire(s, g)).toBe(false);
    expect(g.hp).toBeGreaterThan(0);
    // Unwatched, it burns down.
    const g2 = placeBuilding(s, 0, 'garden', tx + 5, ty + 5, true);
    ignite(s, (ty + 5) * s.w + tx + 5, 0, 1, true);
    run(s, Math.ceil(1 / FIRE.bld) + 2);
    expect(g2.hp).toBeLessThanOrEqual(0);
  });

  it('one sent to mend a burning building beats it out instead', () => {
    const { s, tx, ty } = meadow();
    const o = placeBuilding(s, 0, 'orchard', tx, ty, true);
    ignite(s, ty * s.w + tx, 0, 1);
    const c = spawnUnit(s, 0, 'citizen', tx - 4.5, ty + 0.5);
    // A right-click on its own burning Orchard sends a citizen to mend it: it beats the fire, then mends.
    run(s, 10, [{ t: 'work', p: 0, ids: [c.id], target: o.id }]);
    expect(c.order.k === 'build' || c.order.k === 'idle').toBe(true);
    expect(onFire(s, o)).toBe(false);
    expect(o.hp).toBeGreaterThan(0);
  });

  it('runs through a wood tile by tile, no further than the season lets it, and leaves ash that grows back', () => {
    const { s, tx, ty } = meadow();
    toSeason(s, 1);
    wood(s, tx, ty, 8);
    ignite(s, ty * s.w + tx, 0, 1, true);
    const ash = burnOut(s, tx, ty, 8);
    expect(ash.length).toBeGreaterThan(5);
    for (const t of ash) expect(Math.abs((t % s.w) - tx) + Math.abs(Math.floor(t / s.w) - ty)).toBeLessThanOrEqual(FIRE.run[1]);
    expect(s.stools?.filter((t) => t.ash)).toHaveLength(ash.length);
    // Ash grows a tree again, in time.
    const t0 = ash[0];
    expect(s.res[t0]).toBe(R_NONE);
    run(s, FIRE.ash + 2);
    expect(s.res[t0]).toBe(R_TREE);
  });

  it('a dry summer fire runs further than a wet spring one', () => {
    const spread = (season: number) => {
      const { s, tx, ty } = meadow();
      toSeason(s, season);
      wood(s, tx, ty, 8);
      ignite(s, ty * s.w + tx, 0, 1, true);
      return burnOut(s, tx, ty, 8).length;
    };
    const spring = spread(0);
    const summer = spread(1);
    expect(spring).toBeLessThanOrEqual(2 * FIRE.run[0] * (FIRE.run[0] + 1) + 1);
    expect(summer).toBeGreaterThan(spring);
  });

  it('leaps from a burning wood to a living building beside it', () => {
    const { s, tx, ty } = meadow();
    toSeason(s, 1);
    wood(s, tx, ty, 1);
    const hedge = placeBuilding(s, 0, 'thornwall', tx + 2, ty, true);
    ignite(s, ty * s.w + tx + 1, 0, 1, true);
    let caught = false;
    for (let i = 0; i < FIRE.tree + 2 && !caught; i++) {
      run(s, 1);
      caught = onFire(s, hedge) || hedge.hp <= 0;
    }
    expect(caught).toBe(true);
  });

  it('scorches whoever stands in the flames', () => {
    const { s, tx, ty } = meadow();
    const g = placeBuilding(s, 0, 'garden', tx, ty, true);
    const rival = spawnUnit(s, 1, 'infantry', tx + 0.5, ty + 0.5);
    const hp = rival.hp;
    ignite(s, ty * s.w + tx, 0, 1);
    run(s, 2);
    expect(rival.hp).toBeLessThan(hp);
    expect(g.hp).toBeGreaterThan(0);
  });

  it('the computer sends foot soldiers out on campaign to torch a rival\'s Thornwall', () => {
    const { s, tx, ty } = meadow();
    s.players[1].ai = 'normal';
    const hedge = placeBuilding(s, 0, 'thornwall', tx, ty, true);
    const u = spawnUnit(s, 1, 'infantry', tx - 4.5, ty + 0.5);
    const issued: Command[] = [];
    // Its view, as the computer sees it: the soldier is out on campaign, far from home.
    const p = s.players[1];
    torchGrowth(s, { p, army: [u], home: { x: p.startX, y: p.startY } } as never, {} as never, (c) => issued.push(c));
    expect(issued).toEqual([{ t: 'torch', p: 1, ids: [u.id], target: hedge.id }]);
  });

  it('the computer sends a citizen to beat out a fire on its own garden', () => {
    const { s, tx, ty } = meadow();
    s.players[0].ai = 'normal';
    const g = placeBuilding(s, 0, 'garden', tx, ty, true);
    spawnUnit(s, 0, 'citizen', tx - 6.5, ty + 0.5);
    ignite(s, ty * s.w + tx, 0, 1, true);
    run(s, 12);
    expect(onFire(s, g)).toBe(false);
    expect(g.hp).toBeGreaterThan(0);
  });

  it('burns the same way on every machine', () => {
    const play = () => {
      const { s, tx, ty } = meadow();
      toSeason(s, 1);
      wood(s, tx, ty, 6);
      const b: Building = placeBuilding(s, 0, 'thornwall', tx + 7, ty, true);
      expect(b.hp).toBeGreaterThan(0);
      ignite(s, ty * s.w + tx, 0, 1, true);
      run(s, 40);
      return checksum(s);
    };
    expect(play()).toBe(play());
  });
});
