import { describe, expect, it } from 'vitest';
import { AGES, AMOUNT, FIRE, GROVE, ROADS, SEASON, TICK_HZ, WILDWOOD, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, enterAge, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { barred, buildBarred } from '../src/sim/ages';
import { ignite } from '../src/sim/fire';
import { heartBarred, rootEnt, rootProblem, treeToWake, woodPace } from '../src/sim/wildwood';
import { statsFor } from '../src/sim/stats';
import type { Building, Command, GameState, Unit } from '../src/sim/types';
import { B_RES, R_NONE, R_TREE, T_WATER } from '../src/sim/types';
import { countPop, placeBuilding, spawnUnit } from '../src/sim/world';

/** The Age of the Wildwood (`docs/wild-road.md` §4): the Heart Tree, Ents that root and wake, the Spreading, woodland ways, the door. */

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

/** Bare dry ground away from every town; player 0 walked the Wild route into the Wildwood, player 1 in the Bronze Age. */
function meadow(seed = 11): { s: GameState; tx: number; ty: number } {
  const s = game(seed);
  s.animals = [];
  for (const a of ['wild', 'grove', 'hive', 'wildwood'] as const) enterAge(s, s.players[0], a);
  s.players[1].epoch = 1;
  for (let y = 14; y < s.h - 14; y++) {
    for (let x = 14; x < s.w - 14; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 22)) continue;
      let open = true;
      for (let dy = -11; dy <= 11 && open; dy++) for (let dx = -11; dx <= 11 && open; dx++) open = s.terrain[(y + dy) * s.w + x + dx] !== T_WATER && (walkable(s, x + dx, y + dy) || s.res[(y + dy) * s.w + x + dx] !== R_NONE);
      if (!open) continue;
      for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) setTile(s, (y + dy) * s.w + x + dx, false);
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

/** A Heart Tree of player 0 on the meadow, with a short row of trees five tiles east of it. */
function grove() {
  const { s, tx, ty } = meadow();
  const heart = placeBuilding(s, 0, 'heart', tx - 1, ty - 1, true);
  for (let dy = -1; dy <= 1; dy++) setTile(s, (ty + dy) * s.w + tx + 5, true);
  return { s, tx, ty, heart };
}

const ents = (s: GameState, owner = 0) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'warden' && e.hp > 0);

/** An Ent of player 0's, awake on bare ground three tiles south of the Heart Tree. */
function awakeEnt() {
  const g = grove();
  const u = spawnUnit(g.s, 0, 'warden', g.tx + 0.5, g.ty + 4.5);
  return { ...g, u, tile: (g.ty + 4) * g.s.w + g.tx };
}

describe('the Age of the Wildwood', () => {
  it("is the Wild route's fourth age: off the Hive, shown by a Hive, opened by its honey; no machines", () => {
    const road = ROADS.find((r) => r.from === 'hive' && r.to === 'wildwood');
    expect(road?.clue).toBe('hive');
    expect(road?.deed?.stat).toBe('honey');
    expect(road?.walked).toBe('hive');
    expect(AGES.wildwood.tier).toBe(4);
    expect(AGES.wildwood.routes).toEqual(['wild']);
    expect(AGES.wildwood.verb && AGES.wildwood.door).toBeTruthy();
    expect(ROADS.some((r) => r.from === 'wildwood' && r.to === 'atomic')).toBe(true);
    expect(ROADS.some((r) => r.from === 'wildwood' && r.to === 'industrial')).toBe(true);
    expect(FIRE.burns).toContain('heart');
  });

  it('keeps the Heart Tree and its Ents for a people that has walked it, in every age after; machines wait', () => {
    const { s } = meadow();
    const [p, q] = s.players;
    expect(buildBarred(p, 'heart')).toBeNull();
    expect(buildBarred(q, 'heart')).toBeTruthy();
    expect(barred(p, 'warden')).toBeNull();
    expect(barred(q, 'warden')).toBeTruthy();
    for (const u of ['siege', 'ranged', 'fighter', 'bomber'] as const) expect(barred(p, u)).toBeTruthy();
    expect(buildBarred(p, 'airfield')).toBeTruthy();
    expect(barred(p, 'blowpipe')).toBeNull();
    enterAge(s, p, 'atomic');
    expect(buildBarred(p, 'heart')).toBeNull();
    expect(barred(p, 'warden')).toBeNull();
    expect(barred(p, 'siege')).toBeNull();
    expect(buildBarred(p, 'airfield')).toBeNull();
  });

  it('one Heart Tree to a people, a site counting', () => {
    const { s, tx, ty } = meadow();
    expect(heartBarred(s, 0, 'heart')).toBeNull();
    s.players[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    applyCommand(s, { t: 'build', p: 0, ids: [], type: 'heart', tx, ty });
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'heart' && e.owner === 0)).toBe(true);
    expect(heartBarred(s, 0, 'heart')).toBeTruthy();
    expect(heartBarred(s, 1, 'heart')).toBeNull();
    const before = s.ents.length;
    applyCommand(s, { t: 'build', p: 0, ids: [], type: 'heart', tx: tx + 5, ty: ty + 5 });
    expect(s.ents.length).toBe(before);
  });

  it('wakes an Ent from the nearest tree by the Heart Tree, and waits while none stands', () => {
    const { s, tx, ty, heart } = grove();
    const p = s.players[0];
    p.res = { food: 5000, wood: 5000, stone: 0, gold: 5000 };
    const tree = treeToWake(s, heart);
    expect(tree).toBe(ty * s.w + tx + 5);
    run(s, statsFor(s, 0, 'warden').time + 2, [{ t: 'train', p: 0, building: heart.id, unit: 'warden' }]);
    const [u] = ents(s);
    expect(u).toBeTruthy();
    expect(s.res[tree]).toBe(R_NONE);
    expect(Math.floor(u.x)).toBe(tx + 5);
    // Fell the rest and the next one waits in the queue.
    for (let dy = -1; dy <= 1; dy++) setTile(s, (ty + dy) * s.w + tx + 5, false);
    run(s, statsFor(s, 0, 'warden').time + 2, [{ t: 'train', p: 0, building: heart.id, unit: 'warden' }]);
    expect(ents(s).length).toBe(1);
    expect(heart.queue.length).toBe(1);
    setTile(s, (ty + 6) * s.w + tx, true);
    run(s, 2);
    expect(ents(s).length).toBe(2);
  });

  it('an Ent roots as a real tree that mends and still takes room, and wakes when a rival comes near', () => {
    const { s, u, tile, tx, ty } = awakeEnt();
    u.hp = 100;
    countPop(s);
    const pop = s.players[0].pop;
    applyCommand(s, { t: 'root', p: 0, ids: [u.id] });
    expect(s.byId.has(u.id)).toBe(false);
    expect(s.res[tile]).toBe(R_TREE);
    expect(s.wardens).toEqual([{ tile, owner: 0, hp: 100 }]);
    countPop(s);
    expect(s.players[0].pop).toBe(pop);
    run(s, 10);
    expect(s.wardens![0].hp).toBeGreaterThan(100 + statsFor(s, 0, 'warden').hp * WILDWOOD.mend * 8);
    // A rival walks by out of reach: nothing; then close: it wakes, with the health it mended.
    const foe = spawnUnit(s, 1, 'infantry', tx + 0.5, ty + 9.5);
    foe.stance = 'stand';
    run(s, 2);
    expect(s.wardens?.length).toBe(1);
    foe.y = ty + 6;
    run(s, 2);
    expect(s.wardens).toBeUndefined();
    expect(s.res[tile]).toBe(R_NONE);
    const [woke] = ents(s);
    expect(woke.hp).toBeGreaterThan(150);
  });

  it('roots only on bare open ground, alone', () => {
    const { s, u, tx, ty } = awakeEnt();
    expect(rootProblem(s, u)).toBeNull();
    const c = spawnUnit(s, 0, 'citizen', u.x + 0.2, u.y);
    expect(rootProblem(s, u)).toBeTruthy();
    c.x = tx + 8;
    u.x = tx + 0.5;
    u.y = ty + 0.5;
    expect(rootProblem(s, u)).toBeTruthy();
  });

  it('wakes under the axe, and is lost if its tree burns', () => {
    const { s, u, tile } = awakeEnt();
    rootEnt(s, u);
    s.amount[tile] -= 5;
    run(s, 2);
    expect(ents(s).length).toBe(1);
    const again = ents(s)[0];
    rootEnt(s, again);
    s.wardens![0].hp = 1;
    ignite(s, tile, 0, 1, true);
    run(s, FIRE.tree + 3);
    expect(s.res[tile]).toBe(R_NONE);
    expect(s.wardens).toBeUndefined();
    expect(ents(s).length).toBe(0);
  });

  it('if the Heart Tree falls, every Ent roots where it stands and none wakes', () => {
    const { s, u, tile, heart, tx, ty } = awakeEnt();
    heart.hp = 0;
    run(s, 2);
    expect(ents(s).length).toBe(0);
    expect(s.wardens?.[0].tile).toBe(tile);
    expect(s.byId.has(u.id)).toBe(false);
    const foe = spawnUnit(s, 1, 'infantry', tx + 0.5, ty + 5.5);
    foe.stance = 'stand';
    run(s, 3);
    expect(s.wardens?.length).toBe(1);
  });

  it('each spring the woods round the Heart Tree seed the bare ground beside them in its land, and Thornwalls thicken', () => {
    const { s, tx, ty } = grove();
    for (let dx = -4; dx <= 4; dx++) setTile(s, (ty - 5) * s.w + tx + dx, true);
    const store = placeBuilding(s, 0, 'storehouse', tx + 4, ty + 6, true);
    const thorn = placeBuilding(s, 0, 'thornwall', tx - 6, ty + 4, true);
    toSeason(s, 0);
    run(s, WILDWOOD.spreadAt + 1);
    const seeded = (s.stools ?? []).filter((t) => t.at > s.tick);
    expect(seeded.length).toBeGreaterThan(3);
    expect(seeded.length).toBeLessThanOrEqual(WILDWOOD.seeds);
    for (const t of seeded) {
      const x = t.tile % s.w;
      const y = Math.floor(t.tile / s.w);
      expect(Math.abs(x - store.tx - 0.5) > 1.5 || Math.abs(y - store.ty - 0.5) > 1.5).toBe(true);
      expect([t.tile - 1, t.tile + 1, t.tile - s.w, t.tile + s.w].some((i) => s.res[i] === R_TREE)).toBe(true);
    }
    expect(thorn.grown).toBeGreaterThanOrEqual(GROVE.stage);
    run(s, WILDWOOD.grow + 2);
    expect(s.res[seeded[0].tile]).toBe(R_TREE);
  });

  it('woodland ways: its people run through the woods round its Heart Tree, a rival is slowed there, only in the age', () => {
    const { s, tx, ty } = grove();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) setTile(s, (ty + 8 + dy) * s.w + tx + dx, true);
    const mine = spawnUnit(s, 0, 'citizen', tx + 0.5, ty + 8.5);
    const foe = spawnUnit(s, 1, 'infantry', tx + 0.5, ty + 8.5);
    const open = spawnUnit(s, 0, 'citizen', tx - 6.5, ty + 0.5);
    step(s);
    expect(woodPace(s, mine)).toBe(WILDWOOD.ways.own);
    expect(woodPace(s, foe)).toBe(WILDWOOD.ways.rival);
    expect(woodPace(s, open)).toBe(1);
    enterAge(s, s.players[0], 'industrial');
    step(s);
    expect(woodPace(s, mine)).toBe(1);
  });

  it('fire hits a Wildwood people\'s living things twice as hard, and only while it stands in the age', () => {
    const { s, tx, ty } = meadow();
    const g = placeBuilding(s, 0, 'garden', tx, ty, true) as Building;
    g.hp = 1e6;
    ignite(s, g.ty * s.w + g.tx, 0, 1, true);
    run(s, 2);
    let hp = g.hp;
    run(s, 1);
    const wild = hp - g.hp;
    enterAge(s, s.players[0], 'industrial');
    hp = g.hp;
    run(s, 1);
    expect(wild).toBeCloseTo((hp - g.hp) * FIRE.wild, 3);
  });
});
