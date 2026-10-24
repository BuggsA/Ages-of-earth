import { describe, expect, it } from 'vitest';
import { AGES, GROVE, ROADS, SEASON, TICK_HZ, secs } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { buildBarred } from '../src/sim/ages';
import { buildingMaxHp } from '../src/sim/stats';
import { gardenMul } from '../src/sim/grove';
import type { Building, Command, GameState } from '../src/sim/types';
import { B_GATE, B_RES, R_NONE, T_WATER } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { findSpot } from '../src/sim/ai';

/** The Age of the Grove (`docs/wild-road.md` §2): Thornwalls that grow, Kitchen Gardens fed by dung or water, Orchards that bear. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** An open, dry meadow away from every town, with the wild cleared, and player 0 walked from the Wild into the Grove. */
function meadow(seed = 11): { s: GameState; tx: number; ty: number } {
  const s = game(seed);
  s.animals = [];
  enterAge(s, s.players[0], 'wild');
  enterAge(s, s.players[0], 'grove');
  for (let y = 12; y < s.h - 12; y++) {
    for (let x = 12; x < s.w - 12; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 20)) continue;
      let open = true;
      for (let dy = -9; dy <= 9 && open; dy++) for (let dx = -9; dx <= 9 && open; dx++) open = s.terrain[(y + dy) * s.w + x + dx] !== T_WATER && (walkable(s, x + dx, y + dy) || s.res[(y + dy) * s.w + x + dx] !== R_NONE);
      if (!open) continue;
      // Clear the trees and stones off it, so every test has the same bare ground.
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

/** Skips the clock to the start of a season (0 spring … 3 winter), as `step` would count it. */
const toSeason = (s: GameState, i: number) => {
  s.tick = secs(SEASON.len) * (4 + i);
};

describe('the Age of the Grove', () => {
  it('is the Wild route\'s second age: off the Wild, shown by a Den, opened by beasts reared, with roads back', () => {
    const road = ROADS.find((r) => r.from === 'wild' && r.to === 'grove');
    expect(road?.clue).toBe('den');
    expect(road?.deed?.stat).toBe('bred');
    expect(AGES.grove.tier).toBe(2);
    expect(AGES.grove.routes).toEqual(['wild']);
    expect(AGES.grove.verb).toBeTruthy();
    expect(AGES.grove.noBuild?.buildings).toEqual(expect.arrayContaining(['wall', 'gate', 'tower']));
    expect(ROADS.some((r) => r.from === 'grove' && r.to === 'gunpowder')).toBe(true);
    expect(ROADS.some((r) => r.from === 'grove' && r.to === 'middle')).toBe(true);
  });

  it('plants only for a people that has walked it, and keeps planting after it climbs on', () => {
    const { s } = meadow();
    for (const t of ['thornwall', 'garden', 'orchard'] as const) {
      expect(buildBarred(s.players[0], t)).toBeNull();
      expect(buildBarred(s.players[1], t)).toBeTruthy();
    }
    expect(buildBarred(s.players[0], 'wall')).toBeTruthy();
    enterAge(s, s.players[0], 'gunpowder');
    expect(buildBarred(s.players[0], 'garden')).toBeNull();
    expect(buildBarred(s.players[0], 'wall')).toBeNull();
  });

  it('counts beasts reared at a Den toward the deed', () => {
    const { s, tx, ty } = meadow();
    s.players[0].tamed = ['boar'];
    s.players[0].res = { food: 2000, wood: 2000, stone: 0, gold: 0 };
    const den = placeBuilding(s, 0, 'den', tx, ty, true);
    run(s, 45, [{ t: 'train', p: 0, building: den.id, unit: 'tusker' }]);
    expect(s.players[0].stats.bred).toBe(1);
  });

  it('a Thornwall line grows from seedling to living oak, stronger at each stage, and the oak mends', () => {
    const { s, tx, ty } = meadow();
    toSeason(s, 1);
    s.players[0].res.wood = 500;
    const u = spawnUnit(s, 0, 'citizen', tx + 0.5, ty + 2.5);
    run(s, 25, [{ t: 'wall', p: 0, ids: [u.id], x0: tx, y0: ty, x1: tx + 3, y1: ty, thorn: true }]);
    const line = s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'thornwall');
    expect(line.length).toBe(4);
    expect(line.every((b) => b.built)).toBe(true);
    const b = line[0];
    const seedling = buildingMaxHp(s, 0, 'thornwall', b.level);
    run(s, GROVE.stage * 3 + 2);
    expect(b.level).toBe(3);
    const oak = buildingMaxHp(s, 0, 'thornwall', b.level);
    expect(oak).toBeGreaterThan(seedling * 5);
    expect(oak).toBeGreaterThan(buildingMaxHp(s, 0, 'wall'));
    expect(b.hp).toBe(oak);
    b.hp = oak - 60;
    run(s, GROVE.calm + 12);
    expect(b.hp).toBeGreaterThan(oak - 60 + GROVE.mend * 5);
  });

  it('grows twice as fast in spring', () => {
    const { s, tx, ty } = meadow();
    toSeason(s, 0);
    const b = placeBuilding(s, 0, 'thornwall', tx, ty, true);
    run(s, GROVE.stage / GROVE.spring + 2);
    expect(b.level).toBe(1);
  });

  it('parts for its own people and shuts on everyone else', () => {
    const { s, tx, ty } = meadow();
    const b = placeBuilding(s, 0, 'thornwall', tx, ty, true);
    const i = b.ty * s.w + b.tx;
    expect(s.block[i] & B_GATE).toBeTruthy();
    expect(s.gateTeam[i]).toBe(s.players[0].team);
    expect(s.gateTeam[i]).not.toBe(s.players[1].team);
  });

  it('a piece cut down sprouts again from its root; one its people grubbed out does not', () => {
    const { s, tx, ty } = meadow();
    const cut = placeBuilding(s, 0, 'thornwall', tx, ty, true);
    const grub = placeBuilding(s, 0, 'thornwall', tx + 4, ty, true);
    cut.hp = 0;
    run(s, 2, [{ t: 'delete', p: 0, ids: [grub.id] }]);
    expect(s.byId.has(cut.id)).toBe(false);
    expect(s.roots?.length).toBe(1);
    run(s, GROVE.regrow + 2);
    const at = (x: number) => s.byId.get(s.bldAt[ty * s.w + x]) as Building | undefined;
    expect(at(tx)?.type).toBe('thornwall');
    expect(at(tx)?.level ?? 0).toBe(0);
    expect(at(tx + 4)).toBeUndefined();
  });

  it('a root built over is gone for good', () => {
    const { s, tx, ty } = meadow();
    const cut = placeBuilding(s, 0, 'thornwall', tx, ty, true);
    cut.hp = 0;
    run(s, 2);
    placeBuilding(s, 1, 'house', tx, ty, true);
    run(s, GROVE.regrow + 2);
    expect(s.roots?.length ?? 0).toBe(0);
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'thornwall')).toBe(false);
  });

  it('a Den feeds its oldest gardens in reach, and no more', () => {
    const { s, tx, ty } = meadow();
    placeBuilding(s, 0, 'den', tx, ty, true);
    const gardens: Building[] = [];
    for (let i = 0; i < GROVE.dungFeeds + 2; i++) gardens.push(placeBuilding(s, 0, 'garden', tx - 2 + (i % 4), ty + 4 + Math.floor(i / 4), true));
    const far = placeBuilding(s, 0, 'garden', tx + GROVE.dung + 6, ty, true);
    run(s, 2);
    expect(gardens.slice(0, GROVE.dungFeeds).every((g) => g.fed === 1)).toBe(true);
    expect(gardens.slice(GROVE.dungFeeds).every((g) => !g.fed)).toBe(true);
    expect(far.fed).toBeUndefined();
    expect(gardenMul(gardens[0])).toBeCloseTo(1 + GROVE.dungMul);
    expect(gardenMul(far)).toBe(1);
  });

  it('a gardener at a fed garden brings in about twice a farmer\'s food', () => {
    const food = (field: 'farm' | 'garden') => {
      const { s, tx, ty } = meadow();
      toSeason(s, 1);
      placeBuilding(s, 0, 'storehouse', tx, ty, true);
      if (field === 'garden') placeBuilding(s, 0, 'den', tx - 4, ty + 4, true);
      const f = placeBuilding(s, 0, field, tx + 3, ty, true);
      const u = spawnUnit(s, 0, 'citizen', tx + 3.5, ty + 3.5);
      u.order = { k: 'farm', target: f.id, phase: 'go' };
      const before = s.players[0].res.food;
      run(s, 90);
      return s.players[0].res.food - before;
    };
    const farm = food('farm');
    const garden = food('garden');
    expect(farm).toBeGreaterThan(20);
    expect(garden).toBeGreaterThan(farm * 1.7);
  });

  it('an Orchard bears once grown, in summer and autumn, while a store stands near', () => {
    const { s, tx, ty } = meadow();
    placeBuilding(s, 0, 'storehouse', tx, ty, true);
    const o = placeBuilding(s, 0, 'orchard', tx + 3, ty, true);
    toSeason(s, 1);
    let food = s.players[0].res.food;
    run(s, 30);
    expect(s.players[0].res.food).toBe(food);
    o.grown = GROVE.orchardGrow;
    run(s, 2);
    expect(o.level).toBe(1);
    food = s.players[0].res.food;
    run(s, 40);
    expect(s.players[0].res.food - food).toBeGreaterThanOrEqual(GROVE.orchardFood * 3);
    toSeason(s, 3);
    food = s.players[0].res.food;
    run(s, 40);
    expect(s.players[0].res.food).toBe(food);
  });

  it('the computer in the Grove gardens round its Den, sets Orchards and plants a Thornwall line toward its rival', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    const p = s.players[0];
    enterAge(s, p, 'wild');
    enterAge(s, p, 'grove');
    p.tamed = ['boar'];
    p.res = { food: 1500, wood: 1500, stone: 200, gold: 200 };
    const spot = findSpot(s, 'den', p.startX, p.startY, 5, 14)!;
    placeBuilding(s, 0, 'den', spot.tx, spot.ty, true);
    run(s, 240);
    const of = (t: string) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === t && e.hp > 0);
    expect(of('garden').length).toBeGreaterThan(0);
    expect(of('garden').every((g) => g.fed)).toBe(true);
    expect(of('orchard').length).toBeGreaterThan(0);
    expect(of('thornwall').length).toBeGreaterThanOrEqual(GROVE.aiThorn / 2);
  });

  it('the rules stay deterministic: two runs of a growing grove match', () => {
    const play = () => {
      const { s, tx, ty } = meadow();
      placeBuilding(s, 0, 'den', tx, ty, true);
      placeBuilding(s, 0, 'garden', tx + 4, ty, true);
      const b = placeBuilding(s, 0, 'thornwall', tx, ty + 5, true);
      run(s, 60);
      b.hp = 0;
      run(s, 60);
      return JSON.stringify(s.ents.filter((e) => e.kind === 'building').map((e) => [e.type, e.hp, (e as Building).level, (e as Building).fed]));
    };
    expect(play()).toBe(play());
  });
});

