import { describe, expect, it } from 'vitest';
import { AGES, AMOUNT, FIRE, HIVE, ROADS, SEASON, TICK_HZ, secs } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { placeProblem, walkable } from '../src/sim/grid';
import { barred, buildBarred } from '../src/sim/ages';
import { statsFor } from '../src/sim/stats';
import { gardenMul } from '../src/sim/grove';
import { envenom, hiveQuiet, stungPace } from '../src/sim/hive';
import { ignite } from '../src/sim/fire';
import type { Command, GameState } from '../src/sim/types';
import { B_RES, R_NONE, R_TREE, T_WATER } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The Age of the Hive (`docs/wild-road.md` §3): Hives that swarm a rival in your woods, honey and mead, pollination, venom, bears. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** Skips the clock to the start of a season (0 spring … 3 winter), as `step` would count it. */
const toSeason = (s: GameState, i: number) => {
  s.tick = secs(SEASON.len) * (4 + i);
};

/** Bare dry ground away from every town, player 0 walked from the Wild through the Grove into the Hive, player 1 in the Bronze Age. */
function meadow(seed = 11): { s: GameState; tx: number; ty: number } {
  const s = game(seed);
  s.animals = [];
  enterAge(s, s.players[0], 'wild');
  enterAge(s, s.players[0], 'grove');
  enterAge(s, s.players[0], 'hive');
  s.players[1].epoch = 1;
  for (let y = 12; y < s.h - 12; y++) {
    for (let x = 12; x < s.w - 12; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 20)) continue;
      let open = true;
      for (let dy = -9; dy <= 9 && open; dy++) for (let dx = -9; dx <= 9 && open; dx++) open = s.terrain[(y + dy) * s.w + x + dx] !== T_WATER && (walkable(s, x + dx, y + dy) || s.res[(y + dy) * s.w + x + dx] !== R_NONE);
      if (!open) continue;
      for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) setTile(s, (y + dy) * s.w + x + dx, false);
      return { s, tx: x, ty: y };
    }
  }
  throw new Error('no meadow');
}

function setTile(s: GameState, i: number, tree: boolean): void {
  s.res[i] = tree ? R_TREE : R_NONE;
  s.amount[i] = tree ? AMOUNT.tree : 0;
  if (tree) s.block[i] |= B_RES;
  else s.block[i] &= ~B_RES;
  s.blockVersion++;
}

/** A square wood `r` tiles each way round (tx, ty), with the listed tiles left open. */
function wood(s: GameState, tx: number, ty: number, r: number, open: [number, number][] = []): void {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) setTile(s, (ty + dy) * s.w + tx + dx, !open.some(([x, y]) => x === tx + dx && y === ty + dy));
}

/** A wood with a Hive of player 0 in its heart, and a clearing two tiles east where a rival can stand. */
function hiveInWood(season = 1) {
  const { s, tx, ty } = meadow();
  toSeason(s, season);
  wood(s, tx, ty, 3, [[tx, ty], [tx + 2, ty]]);
  const hive = placeBuilding(s, 0, 'hive', tx, ty, true);
  return { s, tx, ty, hive };
}

describe('the Age of the Hive', () => {
  it('is the Wild route\'s third age: off the Grove, shown by a Garden, opened by its harvest; no guns or cannon', () => {
    const road = ROADS.find((r) => r.from === 'grove' && r.to === 'hive');
    expect(road?.clue).toBe('garden');
    expect(road?.deed?.stat).toBe('gardened');
    expect(road?.walked).toBe('grove');
    expect(AGES.hive.tier).toBe(3);
    expect(AGES.hive.routes).toEqual(['wild']);
    expect(AGES.hive.verb && AGES.hive.door).toBeTruthy();
    expect(ROADS.some((r) => r.from === 'hive' && r.to === 'industrial')).toBe(true);
    expect(ROADS.some((r) => r.from === 'hive' && r.to === 'gunpowder')).toBe(true);
    expect(FIRE.burns).toContain('hive');
  });

  it('keeps bees, darts and bears for a people that has walked it, in every age after; guns wait', () => {
    const { s } = meadow();
    const [p, q] = s.players;
    expect(buildBarred(p, 'hive')).toBeNull();
    expect(buildBarred(q, 'hive')).toBeTruthy();
    expect(barred(p, 'blowpipe')).toBeNull();
    expect(barred(q, 'blowpipe')).toBeTruthy();
    expect(barred(p, 'cavebear')).toBeNull();
    expect(barred(q, 'cavebear')).toBeTruthy();
    expect(barred(p, 'ranged')).toBeTruthy();
    expect(barred(p, 'siege')).toBeTruthy();
    enterAge(s, p, 'industrial');
    expect(buildBarred(p, 'hive')).toBeNull();
    expect(barred(p, 'blowpipe')).toBeNull();
    expect(barred(p, 'ranged')).toBeNull();
  });

  it('a Hive is set only among standing trees, apart from the others', () => {
    const { s, tx, ty } = meadow();
    expect(placeProblem(s, 'hive', tx, ty)).toBe('bare');
    wood(s, tx, ty, 3, [[tx, ty], [tx + 2, ty + 2]]);
    expect(placeProblem(s, 'hive', tx, ty)).toBeNull();
    placeBuilding(s, 0, 'hive', tx, ty, true);
    expect(placeProblem(s, 'hive', tx + 2, ty + 2)).toBe('hives');
  });

  it('swarms a rival standing in its woods, past armour and slowing them; not in the open, not its own', () => {
    const { s, tx, ty } = hiveInWood();
    const foe = spawnUnit(s, 1, 'infantry', tx + 2.5, ty + 0.5);
    foe.stance = 'stand';
    const open = spawnUnit(s, 1, 'infantry', tx + 5.5, ty + 5.5);
    open.stance = 'stand';
    const mine = spawnUnit(s, 0, 'citizen', tx + 2.5, ty + 0.5);
    const hp = foe.hp;
    run(s, 5);
    expect(hp - foe.hp).toBeGreaterThanOrEqual(HIVE.sting * 4);
    expect(foe.stung).toBeGreaterThan(s.tick);
    expect(stungPace(s, foe)).toBe(HIVE.slow);
    expect(open.hp).toBe(hp);
    expect(mine.stung).toBeUndefined();
  });

  it('bees sleep in winter', () => {
    const { s, tx, ty, hive } = hiveInWood(3);
    const foe = spawnUnit(s, 1, 'infantry', tx + 2.5, ty + 0.5);
    foe.stance = 'stand';
    const hp = foe.hp;
    run(s, 4);
    expect(hiveQuiet(s, hive)).toBe('winter');
    expect(foe.hp).toBe(hp);
  });

  it('smoke from a fire nearby quiets a Hive for a while; fire takes the skep', () => {
    const { s, tx, ty, hive } = hiveInWood();
    const foe = spawnUnit(s, 1, 'infantry', tx + 2.5, ty + 0.5);
    foe.stance = 'stand';
    ignite(s, (ty - 3) * s.w + tx - 3, FIRE.run[1], 1, true);
    run(s, 2);
    expect(hiveQuiet(s, hive)).toBe('smoke');
    expect(hive.smoked).toBeGreaterThan(s.tick + secs(HIVE.quiet - 3));
    const hp = foe.hp;
    run(s, 3);
    expect(foe.hp).toBe(hp);
    expect(ignite(s, hive.ty * s.w + hive.tx, 0, 1, true)).toBe(true);
  });

  it('pays honey as food, or mead as gold while a Market stands near', () => {
    const { s, tx, ty } = hiveInWood();
    const p = s.players[0];
    p.res.food = 0;
    p.res.gold = 0;
    run(s, HIVE.every * 3);
    expect(p.res.food).toBeGreaterThanOrEqual(HIVE.honey * 2);
    expect(p.res.gold).toBe(0);
    placeBuilding(s, 0, 'market', tx + 5, ty + 5, true);
    const food = p.res.food;
    run(s, HIVE.every * 3);
    expect(p.res.gold).toBeGreaterThanOrEqual(HIVE.mead * 2);
    expect(p.res.food).toBe(food);
    expect(p.stats.honey).toBeGreaterThan(0);
  });

  it('doubles the Kitchen Gardens beside it in summer, and only in summer', () => {
    const { s, tx, ty } = hiveInWood();
    const g = placeBuilding(s, 0, 'garden', tx + 5, ty, true);
    run(s, 2);
    expect(gardenMul(g)).toBe(HIVE.pollen);
    toSeason(s, 2);
    run(s, 2);
    expect(gardenMul(g)).toBe(1);
  });

  it('a Blowpipe dart stacks venom that burns past armour and slows', () => {
    const { s, tx, ty } = meadow();
    const shooter = spawnUnit(s, 0, 'blowpipe', tx + 0.5, ty + 0.5);
    const rider = spawnUnit(s, 1, 'cavalry', tx + 3.5, ty + 0.5);
    rider.stance = 'stand';
    run(s, 6, [{ t: 'attack', p: 0, ids: [shooter.id], target: rider.id }]);
    expect(rider.venom?.n).toBeGreaterThanOrEqual(2);
    expect(stungPace(s, rider)).toBe(HIVE.slow);
    // Doses stack to the cap, and each burns its hit points a second whatever the armour.
    const bear = spawnUnit(s, 1, 'cavebear', tx + 6.5, ty + 6.5);
    bear.stance = 'stand';
    for (let i = 0; i < HIVE.doses + 2; i++) envenom(s, bear, 0);
    expect(bear.venom!.n).toBe(HIVE.doses);
    const hp = bear.hp;
    run(s, 3);
    expect(hp - bear.hp).toBeCloseTo(HIVE.dose * HIVE.doses * 3, 0);
    run(s, HIVE.venomFor + 1);
    expect(bear.venom).toBeUndefined();
  });

  it('the Den breeds Cave Bears, and War Wolves grow dire', () => {
    const { s, tx, ty } = meadow();
    const p = s.players[0];
    p.tamed = ['wolf'];
    p.res = { food: 5000, wood: 5000, stone: 0, gold: 5000 };
    const den = placeBuilding(s, 0, 'den', tx, ty, true);
    run(s, 40, [{ t: 'train', p: 0, building: den.id, unit: 'cavebear' }]);
    expect(s.ents.some((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'cavebear')).toBe(true);
    const wolf = statsFor(s, 0, 'warwolf');
    expect(wolf.name).toBe('Dire Wolf');
    expect(wolf.hp).toBeGreaterThan(statsFor(s, 1, 'warwolf').hp);
    expect(wolf.attack).toBeGreaterThan(statsFor(s, 1, 'warwolf').attack);
    expect(statsFor(s, 0, 'cavebear').parmor).toBeGreaterThan(statsFor(s, 0, 'tusker').parmor * 3);
  });

  it('counts a gardener\'s harvest toward the deed', () => {
    const { s, tx, ty } = meadow();
    enterAge(s, s.players[0], 'grove');
    placeBuilding(s, 0, 'storehouse', tx, ty, true);
    const g = placeBuilding(s, 0, 'garden', tx + 3, ty, true);
    const u = spawnUnit(s, 0, 'citizen', tx + 3.5, ty + 1.5);
    u.order = { k: 'farm', target: g.id, phase: 'go' };
    run(s, 60);
    expect(s.players[0].stats.gardened).toBeGreaterThan(0);
  });
});
