import { describe, expect, it } from 'vitest';
import { AGES, AMOUNT, FIRE, LEVIATHANS, ROADS, SEASON, TICK_HZ, WILDWOOD, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, enterAge, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { barred, buildBarred, roadProblem } from '../src/sim/ages';
import { landOwnerAt } from '../src/sim/borders';
import { behemothBusy, bombTiles, kneelProblem, riseProblem, seedBombProblem } from '../src/sim/leviathans';
import { heartSleeps } from '../src/sim/wildwood';
import type { Building, Command, GameState, Unit } from '../src/sim/types';
import { B_RES, R_NONE, R_TREE, T_WATER } from '../src/sim/types';
import { canHit, maxHp, placeBuilding, spawnUnit } from '../src/sim/world';

/** The Age of Leviathans (`docs/wild-road.md` §5a): the Great Den, the Skywhale and its seed-bombs, the Behemoth, the sleeping Heart Tree. */

const game = (seed = 11, ai: 'normal' | null = null): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

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

/** Bare dry ground away from every town; player 0 walked the Wild route into Leviathans, player 1 in the Bronze Age; the peace is over. */
function meadow(seed = 11): { s: GameState; tx: number; ty: number } {
  const s = game(seed);
  s.animals = [];
  s.peaceUntil = 0;
  for (const a of ['wild', 'grove', 'hive', 'wildwood', 'leviathans'] as const) enterAge(s, s.players[0], a);
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

const unit = (s: GameState, id: number): Unit | undefined => {
  const e = s.byId.get(id);
  return e && e.kind === 'unit' ? e : undefined;
};

describe('the Age of Leviathans', () => {
  it("is the Wild route's beasts' end: off the Wildwood, shown by a Den, opened by the beasts bred, and the Bloom's rival for good", () => {
    const road = ROADS.find((r) => r.from === 'wildwood' && r.to === 'leviathans');
    expect(road?.clue).toBe('den');
    expect(road?.walked).toBe('wildwood');
    expect(road?.deed?.stat).toBe('bred');
    expect(road?.shuns).toBe('bloom');
    expect(ROADS.find((r) => r.from === 'wildwood' && r.to === 'bloom')?.shuns).toBe('leviathans');
    expect(AGES.leviathans.tier).toBe(5);
    expect(AGES.leviathans.routes).toEqual(['wild']);
    expect(AGES.leviathans.verb && AGES.leviathans.door).toBeTruthy();
    expect(ROADS.some((r) => r.from === 'leviathans' && r.to === 'atomic')).toBe(true);
    expect(ROADS.some((r) => r.from === 'leviathans' && r.to === 'wildwood')).toBe(true);
    expect(FIRE.burns).toContain('greatden');
    // A people that took the Bloom finds this road closed, and the other way round.
    const s = game();
    const p = s.players[0];
    for (const a of ['wild', 'grove', 'hive', 'wildwood', 'bloom', 'wildwood'] as const) enterAge(s, p, a);
    placeBuilding(s, 0, 'den', Math.floor(p.startX) + 6, Math.floor(p.startY) + 6, true);
    p.stats.bred = 30;
    expect(roadProblem(s, p, road!)).toMatch(/closed/);
  });

  it('keeps its Great Den and giants for a people that has walked it; no Ents, machines, Airfield or Silo while it stays', () => {
    const { s } = meadow();
    const [p, q] = s.players;
    expect(buildBarred(p, 'greatden')).toBeNull();
    expect(buildBarred(q, 'greatden')).toBeTruthy();
    expect(barred(p, 'skywhale')).toBeNull();
    expect(barred(q, 'behemoth')).toBeTruthy();
    for (const u of ['warden', 'ranged', 'siege', 'fighter', 'bomber'] as const) expect(barred(p, u)).toBeTruthy();
    expect(buildBarred(p, 'airfield')).toBeTruthy();
    expect(buildBarred(p, 'silo')).toBeTruthy();
    expect(heartSleeps(p)).toBe(true);
    enterAge(s, p, 'atomic');
    expect(buildBarred(p, 'greatden')).toBeNull();
    expect(barred(p, 'behemoth')).toBeNull();
    expect(barred(p, 'warden')).toBeNull();
    expect(buildBarred(p, 'silo')).toBeNull();
    expect(heartSleeps(p)).toBe(false);
  });

  it('puts the Heart Tree to sleep: walking Ents root, rooted ones wake for no rival, and the woods spread no more', () => {
    const { s, tx, ty } = meadow();
    const p = s.players[0];
    const heart = placeBuilding(s, 0, 'heart', Math.floor(p.startX) + 6, Math.floor(p.startY) + 6, true);
    const ent = spawnUnit(s, 0, 'warden', tx + 0.5, ty + 0.5);
    run(s, 2);
    expect(s.byId.has(ent.id)).toBe(false);
    expect(s.wardens?.length).toBe(1);
    spawnUnit(s, 1, 'infantry', tx + 1.5, ty + 0.5);
    run(s, 3);
    expect(s.wardens?.length).toBe(1);
    // A spring's Spreading, round a Heart Tree with bare ground beside its woods, puts out nothing.
    for (let x = heart.tx - 6; x < heart.tx - 3; x++) for (let y = heart.ty; y < heart.ty + 3; y++) setTile(s, y * s.w + x, true);
    s.tick = secs(SEASON.len) * 4 + secs(WILDWOOD.spreadAt) - 2;
    run(s, 2);
    expect(p.stats.spread ?? 0).toBe(0);
  });

  it('breeds one Behemoth to a people at the Great Den, a Town Center on its back that counts for the heart rule', () => {
    const { s, tx, ty } = meadow();
    const p = s.players[0];
    const den = placeBuilding(s, 0, 'greatden', tx - 8, ty - 8, true);
    applyCommand(s, { t: 'train', p: 0, building: den.id, unit: 'behemoth' });
    expect(den.queue.length).toBe(1);
    expect(behemothBusy(s, 0)).toBe(true);
    applyCommand(s, { t: 'train', p: 0, building: den.id, unit: 'behemoth' });
    expect(den.queue.length).toBe(1);
    run(s, 125);
    const titan = s.ents.find((e): e is Unit => e.kind === 'unit' && e.type === 'behemoth' && e.owner === 0);
    expect(titan?.packed).toBe('towncenter');
    expect(p.stats.bred ?? 0).toBe(0);
    // Every other Town Center gone: the walking one still holds the people together.
    for (const e of s.ents) if (e.kind === 'building' && e.owner === 0 && e.type === 'towncenter') e.hp = 0;
    run(s, 2);
    expect(p.heartless).toBeUndefined();
  });

  it('kneels its Town Center at once, finished and at its share of health; rises again with the queue empty; never in a rival land', () => {
    const { s, tx, ty } = meadow();
    const titan = spawnUnit(s, 0, 'behemoth', tx + 0.5, ty + 0.5);
    titan.packed = 'towncenter';
    titan.packedHp = 1;
    titan.hp = maxHp(s, titan) / 2;
    expect(kneelProblem(s, titan)).toBeNull();
    run(s, 1, [{ t: 'pitch', p: 0, ids: [titan.id] }]);
    expect(s.byId.has(titan.id)).toBe(false);
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.behemoth === true)!;
    expect(tc.type).toBe('towncenter');
    expect(tc.built).toBe(true);
    expect(tc.hp / maxHp(s, tc)).toBeCloseTo(0.5, 1);
    // It works at once: it trains a citizen.
    run(s, 1, [{ t: 'train', p: 0, building: tc.id, unit: 'citizen' }]);
    expect(tc.queue.length).toBe(1);
    expect(riseProblem(tc)).toMatch(/training/);
    run(s, 1, [{ t: 'pack', p: 0, building: tc.id }]);
    expect(s.byId.has(tc.id)).toBe(true);
    run(s, 1, [{ t: 'cancel', p: 0, building: tc.id, index: 0 }]);
    run(s, 1, [{ t: 'pack', p: 0, building: tc.id }]);
    expect(s.byId.has(tc.id)).toBe(false);
    const again = s.ents.find((e): e is Unit => e.kind === 'unit' && e.type === 'behemoth')!;
    expect(again.hp / maxHp(s, again)).toBeCloseTo(0.5, 1);
    // A rival's land: no kneeling there.
    const rival = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    again.x = rival.x + 6;
    again.y = rival.y + 0.5;
    expect(landOwnerAt(s, Math.floor(again.x), Math.floor(again.y))).toBe(1);
    expect(kneelProblem(s, again)).toMatch(/rival/);
  });

  it('carries soldiers in a Skywhale over a wall and sets them down beyond it', () => {
    const { s, tx, ty } = meadow();
    // A wall across the meadow, from edge to edge of the cleared ground, and the soldiers on its near side.
    for (let y = ty - 13; y <= ty + 13; y++) placeBuilding(s, 1, 'wall', tx, y, true);
    const whale = spawnUnit(s, 0, 'skywhale', tx - 4.5, ty + 0.5);
    const men = [0, 1, 2].map((i) => spawnUnit(s, 0, 'infantry', tx - 6.5, ty - 1 + i));
    run(s, 12, [{ t: 'board', p: 0, ids: men.map((u) => u.id), target: whale.id }]);
    expect(whale.cargo.length).toBe(3);
    run(s, 20, [{ t: 'unload', p: 0, ids: [whale.id], x: tx + 6.5, y: ty + 0.5 }]);
    expect(whale.cargo.length).toBe(0);
    for (const u of men) {
      expect(unit(s, u.id)?.inside).toBe(0);
      expect(u.x).toBeGreaterThan(tx + 1);
    }
  });

  it('drops seed-bombs of Thornwall into a rival town, for wood, once every so often', () => {
    const { s, tx, ty } = meadow();
    const p = s.players[0];
    placeBuilding(s, 1, 'towncenter', tx - 2, ty - 2, true);
    const whale = spawnUnit(s, 0, 'skywhale', tx + 4.5, ty + 0.5);
    expect(landOwnerAt(s, Math.floor(whale.x), Math.floor(whale.y))).toBe(1);
    expect(bombTiles(s, whale.x, whale.y).length).toBe(LEVIATHANS.seeds);
    const wood = p.res.wood;
    run(s, 1, [{ t: 'seedbomb', p: 0, ids: [whale.id] }]);
    const thorns = s.ents.filter((e) => e.kind === 'building' && e.type === 'thornwall' && e.owner === 0);
    expect(thorns.length).toBe(LEVIATHANS.seeds);
    for (const b of thorns) expect(Math.hypot(b.x - whale.x, b.y - whale.y)).toBeLessThan(LEVIATHANS.reach + 1.5);
    expect(p.res.wood).toBe(wood - (LEVIATHANS.bomb.wood ?? 0));
    expect(seedBombProblem(s, whale)).toMatch(/ready in/);
    run(s, 1, [{ t: 'seedbomb', p: 0, ids: [whale.id] }]);
    expect(s.ents.filter((e) => e.kind === 'building' && e.type === 'thornwall' && e.owner === 0).length).toBe(LEVIATHANS.seeds);
    run(s, LEVIATHANS.every);
    expect(seedBombProblem(s, whale)).toBeNull();
    // Over water it has nowhere to sow.
    let wet = -1;
    for (let i = 0; i < s.w * s.h && wet < 0; i++) {
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      if (x < 4 || y < 4 || x > s.w - 5 || y > s.h - 5) continue;
      let all = true;
      for (let dy = -3; dy <= 3 && all; dy++) for (let dx = -3; dx <= 3 && all; dx++) all = s.terrain[(y + dy) * s.w + x + dx] === T_WATER;
      if (all) wet = i;
    }
    if (wet >= 0) expect(bombTiles(s, (wet % s.w) + 0.5, Math.floor(wet / s.w) + 0.5)).toEqual([]);
  });

  it('is brought down by fighters and guns, not by swords, and no priest turns a giant', () => {
    const { s, tx, ty } = meadow();
    const whale = spawnUnit(s, 0, 'skywhale', tx + 0.5, ty + 0.5);
    const fighter = spawnUnit(s, 1, 'fighter', tx + 2.5, ty + 0.5);
    const rifle = spawnUnit(s, 1, 'ranged', tx + 3.5, ty + 0.5);
    const sword = spawnUnit(s, 1, 'infantry', tx + 1.5, ty + 0.5);
    s.players[1].epoch = 4;
    expect(canHit(s, fighter, whale)).toBe(true);
    expect(canHit(s, rifle, whale)).toBe(true);
    expect(canHit(s, sword, whale)).toBe(false);
    const priest = spawnUnit(s, 1, 'priest', tx + 1.5, ty + 1.5);
    run(s, 20, [{ t: 'convert', p: 1, ids: [priest.id], target: whale.id }]);
    expect(whale.owner).toBe(0);
  });

  it('is played by the computer: it raises a Great Den, breeds and kneels its Behemoth, and flies its whales', () => {
    const s = game(4, 'normal');
    s.peaceUntil = 0;
    for (const a of ['wild', 'grove', 'hive', 'wildwood', 'leviathans'] as const) enterAge(s, s.players[0], a);
    for (const q of s.players) q.res = { food: 4000, wood: 4000, stone: 1500, gold: 3000 };
    let knelt = false;
    let whale = false;
    for (let i = 0; i < 8 * 60 * TICK_HZ && !(knelt && whale) && !s.over; i++) {
      step(s);
      knelt ||= s.events.some((e) => e.k === 'leviathan' && e.what === 'kneel' && e.owner === 0);
      whale ||= s.events.some((e) => e.k === 'trained' && e.type === 'skywhale' && e.owner === 0);
    }
    expect(s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'greatden' && e.built)).toBe(true);
    expect(knelt).toBe(true);
    expect(whale).toBe(true);
  });
});
