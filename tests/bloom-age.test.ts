import { describe, expect, it } from 'vitest';
import { AGES, AMOUNT, BLOOM, FIRE, ROADS, SEASON, TICK_HZ, WILDWOOD, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, enterAge, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { barred, buildBarred } from '../src/sim/ages';
import { borderMap } from '../src/sim/borders';
import { greenOf, hackersAt, pollenMul, ripeIn, ringOf, slingProblem, spireBarred } from '../src/sim/bloom';
import type { Building, Command, GameState } from '../src/sim/types';
import { B_RES, R_NONE, R_TREE, T_GRASS, T_SAND, T_WATER } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The Age of the Bloom (`docs/wild-road.md` §5b): the Seed Spire, the Bloom Seed and its heart-root, the Greening, pollen, the door. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

function setTile(s: GameState, i: number, tree: boolean): void {
  s.res[i] = tree ? R_TREE : R_NONE;
  s.amount[i] = tree ? AMOUNT.tree : 0;
  if (tree) s.block[i] |= B_RES;
  else s.block[i] &= ~B_RES;
  s.blockVersion++;
}

/** Bare dry ground away from every town; player 0 walked the Wild route into the Bloom, player 1 in the Bronze Age; the peace is over. */
function meadow(seed = 11): { s: GameState; tx: number; ty: number } {
  const s = game(seed);
  s.animals = [];
  s.peaceUntil = 0;
  for (const a of ['wild', 'grove', 'hive', 'wildwood', 'bloom'] as const) enterAge(s, s.players[0], a);
  s.players[1].epoch = 1;
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

/** Player 0's Heart Tree and a finished Seed Spire by player 0's home, its Seed ripe; and a rival hamlet of player 1's on the meadow. */
function town() {
  const { s, tx, ty } = meadow();
  const p = s.players[0];
  p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
  const heart = placeBuilding(s, 0, 'heart', Math.floor(p.startX) + 6, Math.floor(p.startY) + 6, true);
  const spire = placeBuilding(s, 0, 'spire', Math.floor(p.startX) - 7, Math.floor(p.startY) - 7, true);
  spire.ripe = s.tick;
  const near = placeBuilding(s, 1, 'house', tx + 2, ty, true);
  const edge = placeBuilding(s, 1, 'house', tx - 7, ty, true);
  const far = placeBuilding(s, 1, 'house', tx, ty + 10, true);
  return { s, tx, ty, p, heart, spire, near, edge, far };
}

const alive = (s: GameState, b: Building) => s.byId.has(b.id) && b.hp > 0;

describe('the Age of the Bloom', () => {
  it("is the Wild route's plants' end: off the Wildwood, shown by the Heart Tree, opened by the Spreading", () => {
    const road = ROADS.find((r) => r.from === 'wildwood' && r.to === 'bloom');
    expect(road?.clue).toBe('heart');
    expect(road?.walked).toBe('wildwood');
    expect(road?.deed?.stat).toBe('spread');
    expect(AGES.bloom.tier).toBe(5);
    expect(AGES.bloom.routes).toEqual(['wild']);
    expect(AGES.bloom.verb && AGES.bloom.door).toBeTruthy();
    expect(ROADS.some((r) => r.from === 'bloom' && r.to === 'atomic')).toBe(true);
    expect(ROADS.some((r) => r.from === 'bloom' && r.to === 'wildwood')).toBe(true);
    expect(FIRE.burns).toContain('spire');
  });

  it('keeps the Spire for a people that has walked it; the Dens go quiet and no Silo is raised while it stays', () => {
    const { s } = meadow();
    const [p, q] = s.players;
    expect(buildBarred(p, 'spire')).toBeNull();
    expect(buildBarred(q, 'spire')).toBeTruthy();
    for (const u of ['warwolf', 'tusker', 'warmammoth', 'cavebear'] as const) expect(barred(p, u)).toBeTruthy();
    expect(buildBarred(p, 'silo')).toBeTruthy();
    expect(barred(p, 'warden')).toBeNull();
    enterAge(s, p, 'atomic');
    expect(buildBarred(p, 'spire')).toBeNull();
    expect(buildBarred(p, 'silo')).toBeNull();
    expect(barred(p, 'cavebear')).toBeNull();
  });

  it('one Seed Spire to a people, a site counting', () => {
    const { s, tx, ty } = meadow();
    s.players[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    expect(spireBarred(s, 0, 'spire')).toBeNull();
    applyCommand(s, { t: 'build', p: 0, ids: [], type: 'spire', tx, ty });
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'spire' && e.owner === 0)).toBe(true);
    expect(spireBarred(s, 0, 'spire')).toBeTruthy();
    const before = s.ents.length;
    applyCommand(s, { t: 'build', p: 0, ids: [], type: 'spire', tx: tx + 5, ty: ty + 5 });
    expect(s.ents.length).toBe(before);
  });

  it('ripens a Seed only while the Heart Tree stands, and slings it only when ripe', () => {
    const { s, tx, ty, heart, spire } = town();
    spire.ripe = undefined;
    run(s, 1);
    expect(ripeIn(s, spire)).toBeGreaterThanOrEqual(BLOOM.ripen - 1);
    expect(slingProblem(s, 0, spire, tx, ty)).toMatch(/ripens/);
    heart.hp = 0;
    run(s, 10);
    // The clock waited the ten seconds the Heart Tree was down.
    expect(ripeIn(s, spire)).toBeGreaterThanOrEqual(BLOOM.ripen - 1);
    expect(slingProblem(s, 0, spire, tx, ty)).toMatch(/Heart Tree/);
  });

  it('slings for its fuel; the Seed falls where everyone sees, roots, and cracks every rival building in its ring into forest', () => {
    const { s, tx, ty, p, spire, near, edge, far } = town();
    const food = p.res.food;
    run(s, 1, [{ t: 'sling', p: 0, spire: spire.id, x: tx + 0.5, y: ty + 0.5 }]);
    expect(p.res.food).toBe(food - (BLOOM.fuel.food ?? 0));
    expect(s.blooms?.length).toBe(1);
    expect(ripeIn(s, spire)).toBeGreaterThan(BLOOM.ripen - 2);
    // A second sling waits for the next Seed.
    expect(slingProblem(s, 0, spire, tx, ty)).toBeTruthy();
    run(s, BLOOM.flight + 1);
    const seed = s.blooms![0];
    expect(Math.hypot(seed.x - (tx + 0.5), seed.y - (ty + 0.5))).toBeLessThan(BLOOM.land + 1);
    expect(ringOf(s, seed).map((b) => b.id)).toEqual([near.id, edge.id]);
    run(s, BLOOM.grow);
    expect(s.blooms).toBeUndefined();
    expect(alive(s, near)).toBe(false);
    expect(alive(s, edge)).toBe(false);
    expect(alive(s, far)).toBe(true);
    expect(alive(s, spire)).toBe(true);
    run(s, BLOOM.sprout + 2);
    expect(s.res[near.ty * s.w + near.tx]).toBe(R_TREE);
  });

  it("is cut out by rival citizens who reach the heart-root in time, and the ring stands", () => {
    const { s, tx, ty, spire, near } = town();
    run(s, 1, [{ t: 'sling', p: 0, spire: spire.id, x: tx + 0.5, y: ty + 0.5 }]);
    run(s, BLOOM.flight + 1);
    const seed = s.blooms![0];
    const n = 5;
    for (let i = 0; i < n; i++) spawnUnit(s, 1, 'citizen', seed.x + (i - 2) * 0.3, seed.y + 0.6);
    expect(hackersAt(s, seed)).toBe(n);
    // Not the Bloom people's own citizens.
    spawnUnit(s, 0, 'citizen', seed.x, seed.y - 0.5);
    expect(hackersAt(s, seed)).toBe(n);
    run(s, Math.ceil(BLOOM.root / n) + 2);
    expect(s.blooms).toBeUndefined();
    run(s, BLOOM.grow);
    expect(alive(s, near)).toBe(true);
  });

  it('wins by the Greening: the Heart Tree held while the land stays green long enough, every screen counting', () => {
    const { s, p, heart } = town();
    const own = borderMap(s);
    for (let i = 0; i < own.length; i++) if (own[i] === 0 && s.bldAt[i] === 0 && s.res[i] === R_NONE && (s.terrain[i] === T_GRASS || s.terrain[i] === T_SAND)) setTile(s, i, true);
    const g = greenOf(s)!;
    expect(g.green[0] / Math.max(g.land[0], BLOOM.least)).toBeGreaterThan(BLOOM.green);
    run(s, 2);
    expect(p.greenSince).toBeDefined();
    expect(p.green).toBeGreaterThanOrEqual(BLOOM.green * 1000);
    // Felled back below the mark, the hold fades.
    const save = new Uint8Array(s.res);
    for (let i = 0; i < own.length; i++) if (own[i] === 0 && s.res[i] === R_TREE) setTile(s, i, false);
    run(s, 2);
    expect(p.greenSince).toBeUndefined();
    for (let i = 0; i < own.length; i++) if (save[i] === R_TREE) setTile(s, i, true);
    run(s, BLOOM.hold + 3);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(p.team);
    expect(s.players[1].defeated).toBe(true);
    void heart;
  });

  it('holds no Greening without the Heart Tree', () => {
    const { s, p, heart } = town();
    const own = borderMap(s);
    for (let i = 0; i < own.length; i++) if (own[i] === 0 && s.bldAt[i] === 0 && s.res[i] === R_NONE && (s.terrain[i] === T_GRASS || s.terrain[i] === T_SAND)) setTile(s, i, true);
    heart.hp = 0;
    run(s, 3);
    expect(p.green).toBeGreaterThanOrEqual(BLOOM.green * 1000);
    expect(p.greenSince).toBeUndefined();
  });

  it("blinds a rival's soldiers near the Heart Tree in the pollen storm at each season's start", () => {
    const { s, heart } = town();
    const rival = spawnUnit(s, 1, 'infantry', heart.x + 4, heart.y);
    const own = spawnUnit(s, 0, 'infantry', heart.x + 4, heart.y + 1);
    const away = spawnUnit(s, 1, 'infantry', heart.x + BLOOM.pollen + 4, heart.y);
    s.tick = secs(SEASON.len) * 6 + secs(BLOOM.storm / 2);
    expect(pollenMul(s, rival)).toBe(BLOOM.blind);
    expect(pollenMul(s, own)).toBe(1);
    expect(pollenMul(s, away)).toBe(1);
    s.tick = secs(SEASON.len) * 6 + secs(BLOOM.storm + 5);
    expect(pollenMul(s, rival)).toBe(1);
  });

  it('is raced by the computer: a rival computer sends its citizens to hack out a Seed rooted in its town', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'normal', civ: 'romans' }] });
    s.peaceUntil = 0;
    for (const a of ['wild', 'grove', 'hive', 'wildwood', 'bloom'] as const) enterAge(s, s.players[0], a);
    const p = s.players[0];
    p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    placeBuilding(s, 0, 'heart', Math.floor(p.startX) + 6, Math.floor(p.startY) + 6, true);
    const spire = placeBuilding(s, 0, 'spire', Math.floor(p.startX) - 7, Math.floor(p.startY) - 7, true);
    spire.ripe = s.tick;
    run(s, 60);
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    run(s, 1, [{ t: 'sling', p: 0, spire: spire.id, x: tc.x + 4, y: tc.y + 4 }]);
    let hacked = false;
    for (let i = 0; i < (BLOOM.flight + BLOOM.grow) * TICK_HZ && !hacked; i++) {
      step(s);
      hacked = s.events.some((e) => e.k === 'bloom' && e.what === 'hacked');
    }
    expect(hacked).toBe(true);
    expect(alive(s, tc)).toBe(true);
  });

  it('is played by the computer: it raises its Spire and slings its Seed at a rival', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: 'normal', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    s.peaceUntil = 0;
    for (const a of ['wild', 'grove', 'hive', 'wildwood', 'bloom'] as const) enterAge(s, s.players[0], a);
    for (const q of s.players) q.res = { food: 4000, wood: 4000, stone: 1500, gold: 3000 };
    let slung = false;
    for (let i = 0; i < 8 * 60 * TICK_HZ && !slung && !s.over; i++) {
      step(s);
      slung = s.events.some((e) => e.k === 'bloom' && e.what === 'slung' && e.owner === 0);
    }
    expect(s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'spire' && e.built)).toBe(true);
    expect(slung).toBe(true);
  });

  it('spreads its woods at the start of every season, not only in spring', () => {
    const { s, heart, p } = town();
    for (let x = heart.tx - 6; x < heart.tx - 3; x++) for (let y = heart.ty; y < heart.ty + 3; y++) setTile(s, y * s.w + x, true);
    // Summer, just before the Spreading.
    s.tick = secs(SEASON.len) * 5 + secs(WILDWOOD.spreadAt) - 2;
    run(s, 1);
    expect(p.stats.spread ?? 0).toBeGreaterThan(0);
  });
});
