import { describe, expect, it } from 'vitest';
import { AGES, AMOUNT, MYCELIUM, ORE_POST, ROADS, TICK_HZ, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { checksum, createGame, enterAge, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { barred, buildBarred, roadKnown, roadProblem, veinSeen } from '../src/sim/ages';
import { nearestEnemyUnit } from '../src/sim/combat';
import { torchProblem } from '../src/sim/fire';
import { webAt } from '../src/sim/mycelium';
import { Spatial } from '../src/sim/spatial';
import { trainCostFor } from '../src/sim/stats';
import type { Building, GameState } from '../src/sim/types';
import { B_RES, R_GLOWCAP, R_NONE, R_TREE, T_WATER } from '../src/sim/types';
import { canHit, nearestDrop, placeBuilding, spawnUnit } from '../src/sim/world';

/** The Age of the Mycelium (#800, `docs/wild-road.md` §R): the Glowcap hollow, the web, spores, rot, fire, and the short road to the Bloom. */

const game = (seed = 11, size: 'small' | 'medium' = 'small'): GameState =>
  createGame({ seed, size, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

function setTile(s: GameState, i: number, tree: boolean): void {
  s.res[i] = tree ? R_TREE : R_NONE;
  s.amount[i] = tree ? AMOUNT.tree : 0;
  if (tree) s.block[i] |= B_RES;
  else s.block[i] &= ~B_RES;
  s.blockVersion++;
}

/** Bare dry ground away from every town; player 0 walked the Wild into the Mycelium, player 1 in the Bronze Age; the peace is over. */
function meadow(seed = 11): { s: GameState; tx: number; ty: number } {
  const s = game(seed);
  s.animals = [];
  s.peaceUntil = 0;
  for (const a of ['wild', 'mycelium'] as const) enterAge(s, s.players[0], a);
  s.players[1].epoch = 1;
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  for (let y = 16; y < s.h - 16; y++) {
    for (let x = 16; x < s.w - 16; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 22)) continue;
      let open = true;
      for (let dy = -13; dy <= 13 && open; dy++) for (let dx = -13; dx <= 13 && open; dx++) open = s.terrain[(y + dy) * s.w + x + dx] !== T_WATER && (walkable(s, x + dx, y + dy) || s.res[(y + dy) * s.w + x + dx] !== R_NONE);
      if (!open) continue;
      for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) setTile(s, (y + dy) * s.w + x + dx, false);
      return { s, tx: x, ty: y };
    }
  }
  throw new Error('no meadow');
}

/** A meadow with player 0's house in it, its web grown full. */
function webbed(seed = 11): { s: GameState; house: Building; tx: number; ty: number } {
  const { s, tx, ty } = meadow(seed);
  const house = placeBuilding(s, 0, 'house', tx, ty, true);
  run(s, Math.ceil(MYCELIUM.reach / MYCELIUM.grow) + 1);
  return { s, house, tx, ty };
}

const spatial = (s: GameState) => {
  const sp = new Spatial();
  sp.rebuild(s);
  return sp;
};

describe('the Glowcap hollow', () => {
  it('lies on some worlds and not others, picked like an ore and kept apart from the four stocks', () => {
    let held = 0;
    for (let seed = 1; seed <= 40; seed++) if (game(seed).rares?.includes('glowcap')) held++;
    expect(held).toBeGreaterThan(8);
    expect(held).toBeLessThan(28);
    let s: GameState | null = null;
    for (let seed = 1; seed <= 40 && !s; seed++) if (game(seed).rares?.includes('glowcap')) s = game(seed);
    const tiles: number[] = [];
    for (let i = 0; i < s!.res.length; i++) if (s!.res[i] === R_GLOWCAP) tiles.push(i);
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('opens the road from the Wild once picked; where the world has none, a post sells the caps and the road is dearer, not shut', () => {
    const road = ROADS.find((r) => r.from === 'wild' && r.to === 'mycelium')!;
    expect(road.vein?.id).toBe('glowcap');
    expect(road.walked).toBe('wild');
    expect(ORE_POST.ores).toContain('glowcap');
    let withHollow: GameState | null = null;
    let without: GameState | null = null;
    for (let seed = 1; seed <= 40 && !(withHollow && without); seed++) {
      const s = createGame({ seed, size: 'medium', startEpoch: 1, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
      if (s.rares?.includes('glowcap')) withHollow ??= s;
      else if (s.posts.length) without ??= s;
    }
    for (const s of [withHollow!, without!]) {
      const p = s.players[0];
      enterAge(s, p, 'wild');
      expect(roadKnown(s, p, road)).toBe(false);
      p.techs.push('survey');
      expect(veinSeen(s, p, road)).toBe(true);
      expect(roadKnown(s, p, road)).toBe(true);
      expect(roadProblem(s, p, road)).toMatch(/glowcaps/);
      p.stats.mined = { glowcap: road.vein!.n };
      expect(roadProblem(s, p, road)).toBeNull();
    }
    expect(without!.posts.some((t) => t.sells?.includes('glowcap'))).toBe(true);
    expect(withHollow!.posts.some((t) => t.sells?.includes('glowcap'))).toBe(false);
  });
});

describe('the Age of the Mycelium', () => {
  it('is a rare gateway at tier 2 off the Wild, with roads to the trunk and the only short road to the Bloom', () => {
    expect(AGES.mycelium.tier).toBe(2);
    expect(AGES.mycelium.gateway).toBe(true);
    expect(AGES.mycelium.routes).toEqual(['wild']);
    expect(ROADS.some((r) => r.from === 'mycelium' && r.to === 'gunpowder')).toBe(true);
    expect(ROADS.some((r) => r.from === 'mycelium' && r.to === 'middle')).toBe(true);
    const bloom = ROADS.find((r) => r.from === 'mycelium' && r.to === 'bloom')!;
    expect(bloom.walked).toBe('mycelium');
    expect(bloom.deed?.stat).toBe('webbed');
    expect(bloom.shuns).toBe('leviathans');
    // The Bloom's own road keeps its clue and deed.
    const own = ROADS.find((r) => r.from === 'wildwood' && r.to === 'bloom')!;
    expect(own.clue).toBe('heart');
    expect(own.deed?.stat).toBe('spread');
  });

  it('grows a web from each hall, out to its reach, and the web withers when the people leaves', () => {
    const { s, tx, ty } = meadow();
    const house = placeBuilding(s, 0, 'house', tx, ty, true);
    const wall = placeBuilding(s, 0, 'wall', tx + 6, ty, true);
    run(s, 10);
    expect(house.web).toBeGreaterThan(0);
    expect(house.web).toBeLessThan(MYCELIUM.reach);
    expect(wall.web).toBeUndefined();
    run(s, Math.ceil(MYCELIUM.reach / MYCELIUM.grow));
    expect(house.web).toBe(MYCELIUM.reach);
    expect(webAt(s, 0, house.x + house.size / 2 + MYCELIUM.reach - 0.5, house.y)?.id).toBe(house.id);
    expect(webAt(s, 0, house.x + house.size / 2 + MYCELIUM.reach + 1, house.y)).toBeNull();
    enterAge(s, s.players[0], 'middle');
    run(s, 1);
    expect(house.web).toBeUndefined();
  });

  it('lets every hall on the web take in every stock', () => {
    const { s, house } = webbed();
    expect(nearestDrop(s, 0, 'gold', house.x + 3, house.y)?.id).toBe(house.id);
    expect(nearestDrop(s, 0, 'stone', house.x + 3, house.y)?.id).toBe(house.id);
    // A house without the web takes nothing.
    enterAge(s, s.players[0], 'middle');
    run(s, 1);
    expect(nearestDrop(s, 0, 'gold', house.x + 3, house.y)?.id).not.toBe(house.id);
  });

  it('banks a load the moment it is carried onto the web, and counts it toward the road on', () => {
    const { s, house } = webbed();
    const p = s.players[0];
    const tree = Math.floor(house.y) * s.w + Math.floor(house.x) + 4;
    setTile(s, tree, true);
    const u = spawnUnit(s, 0, 'citizen', (tree % s.w) - 0.5, Math.floor(tree / s.w) + 0.5);
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: tree });
    const before = p.res.wood;
    const at = { x: u.x, y: u.y };
    run(s, 40);
    expect(p.res.wood).toBeGreaterThan(before);
    expect(p.stats.webbed ?? 0).toBeGreaterThan(0);
    // It never left the tree for the house.
    expect(Math.hypot(u.x - at.x, u.y - at.y)).toBeLessThan(1.5);
  });

  it('hides its people on the web from rival eyes and aim, unless a rival stands close or they just struck', () => {
    const { s, house } = webbed();
    const mine = spawnUnit(s, 0, 'infantry', house.x + 3, house.y);
    const archer = spawnUnit(s, 1, 'ranged', house.x + 3 + MYCELIUM.reveal + 2, house.y);
    archer.stance = 'stand';
    run(s, 1);
    expect(mine.cloak).toBe(true);
    expect(canHit(s, archer, mine)).toBe(false);
    expect(nearestEnemyUnit(s, spatial(s), 1, archer.x, archer.y, 10)).toBeNull();
    // Off the web, it shows.
    const out = spawnUnit(s, 0, 'infantry', house.x + 10, house.y + 10);
    run(s, 1);
    expect(out.cloak).toBeUndefined();
    // A rival close by sees it: here an unarmed one, so no fight starts.
    mine.stance = 'stand';
    const scout = spawnUnit(s, 1, 'citizen', mine.x, mine.y + MYCELIUM.reveal - 0.5);
    run(s, 1);
    expect(mine.cloak).toBeUndefined();
    scout.hp = 0;
    // The archer that closed in on what it saw is sent back out of sight.
    archer.x = mine.x + MYCELIUM.reveal + 3;
    archer.y = mine.y;
    archer.order = { k: 'idle' };
    run(s, 1);
    expect(mine.cloak).toBe(true);
    // A blow struck shows it a while.
    mine.swing = s.tick;
    run(s, 1);
    expect(mine.cloak).toBeUndefined();
    run(s, MYCELIUM.shown + 1);
    expect(mine.cloak).toBe(true);
  });

  it('rots a rival building touching the web, timber faster than stone', () => {
    const { s, house, tx, ty } = webbed();
    const hut = placeBuilding(s, 1, 'house', tx + 3, ty, true);
    const tower = placeBuilding(s, 1, 'tower', tx, ty + 3, true);
    const far = placeBuilding(s, 1, 'house', tx + 12, ty + 12, true);
    const hp = { hut: hut.hp, tower: tower.hp, far: far.hp };
    run(s, 20);
    const lost = (b: Building, was: number) => (was - b.hp) / was;
    expect(lost(hut, hp.hut)).toBeGreaterThan(0);
    expect(lost(tower, hp.tower)).toBeGreaterThan(0);
    expect(lost(hut, hp.hut)).toBeGreaterThan(lost(tower, hp.tower) * 1.5);
    expect(far.hp).toBe(hp.far);
    expect(house.web).toBe(MYCELIUM.reach);
  });

  it('is burnt back by fire: a torch set to bare ground on the web, or a fire near it', () => {
    const { s, house } = webbed();
    const tile = Math.floor(house.y) * s.w + Math.floor(house.x + house.size / 2 + 3);
    expect(torchProblem(s, 1, { tile })).toBeNull();
    expect(torchProblem(s, 0, { tile })).not.toBeNull();
    const torch = spawnUnit(s, 1, 'infantry', (tile % s.w) + 1.5, Math.floor(tile / s.w) + 0.5);
    applyCommand(s, { t: 'torch', p: 1, ids: [torch.id], tile });
    run(s, 8);
    expect(house.web!).toBeLessThan(3);
    // It grows back.
    torch.hp = 0;
    run(s, 30);
    expect(house.web!).toBeGreaterThan(2);
  });

  it('makes soldiers cost a quarter more', () => {
    const { s } = meadow();
    const here = trainCostFor(s, 0, 'infantry', 'barracks');
    enterAge(s, s.players[0], 'middle');
    const there = trainCostFor(s, 0, 'infantry', 'barracks');
    expect((here.food ?? 0) + (here.gold ?? 0) + (here.wood ?? 0)).toBeGreaterThan(((there.food ?? 0) + (there.gold ?? 0) + (there.wood ?? 0)) * 1.2);
  });

  it('holds the road to the Bloom on the web’s harvest, and a Bloom people that came by it plants a Heart Tree, but wakes no Ents', () => {
    const { s } = meadow();
    const p = s.players[0];
    const road = ROADS.find((r) => r.from === 'mycelium' && r.to === 'bloom')!;
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadProblem(s, p, road)).toMatch(/web takes in/);
    p.stats.webbed = road.deed!.n;
    expect(roadProblem(s, p, road)).toBeNull();
    expect(buildBarred(p, 'heart')).not.toBeNull();
    enterAge(s, p, 'bloom');
    expect(buildBarred(p, 'heart')).toBeNull();
    expect(buildBarred(p, 'spire')).toBeNull();
    expect(barred(p, 'warden')).not.toBeNull();
  });

  it('plays the same twice', () => {
    const play = () => {
      const { s, house } = webbed(11);
      for (let k = 0; k < 4; k++) spawnUnit(s, 0, 'infantry', house.x + 2 + k * 0.5, house.y + 2);
      for (let k = 0; k < 4; k++) spawnUnit(s, 1, 'ranged', house.x + 7 + k * 0.5, house.y + 6);
      run(s, 30);
      return checksum(s);
    };
    expect(play()).toBe(play());
  });

  it('keeps the numbers it names', () => {
    expect(secs(MYCELIUM.shown)).toBeGreaterThan(0);
    expect(MYCELIUM.rot.wood).toBe(MYCELIUM.rot.stone * 2);
  });
});
