import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AMOUNT, COPPICE, SNARE, secs } from '../src/sim/data';
import { buildBarred } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { growthAt } from '../src/sim/coppice';
import { fillSnares, snareCap, snareRate } from '../src/sim/snares';
import { B_RES, R_NONE, R_TREE } from '../src/sim/types';
import type { Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

// The managed wood (#501, the Britons): no fields; woods felled near the stores grow back, saplings are planted, and the snares feed the town.
const game = () => createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'greeks' }] });
const tcOf = (s: GameState, owner: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const citizenOf = (s: GameState, owner: number) => s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'citizen')!;
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};

/** An open grass tile `dx`, `dy` tiles off a player's Town Center corner, made free of everything. */
function openTile(s: GameState, owner: number, dx: number, dy: number): number {
  const tc = tcOf(s, owner);
  const t = (tc.ty + dy) * s.w + tc.tx + dx;
  expect(s.bldAt[t]).toBe(0);
  s.res[t] = R_NONE;
  s.amount[t] = 0;
  s.block[t] = 0;
  return t;
}

/** A tree of a single log set on a tile, so one stroke of the axe fells it. */
function lastLog(s: GameState, t: number): void {
  s.res[t] = R_TREE;
  s.amount[t] = 1;
  s.block[t] |= B_RES;
}

/** Sends a player's citizen to fell the tree on `t` and steps until it is down. */
function fell(s: GameState, owner: number, t: number): void {
  const u = citizenOf(s, owner);
  u.x = (t % s.w) + 1.5;
  u.y = Math.floor(t / s.w) + 0.5;
  // Stands its ground: the tile may lie under a rival's Town Center, whose arrows would send a fleeing citizen off.
  applyCommand(s, { t: 'flee', p: owner, on: false, ids: [u.id] });
  applyCommand(s, { t: 'gather', p: owner, ids: [u.id], tile: t });
  for (let i = 0; i < secs(20) && s.res[t] === R_TREE; i++) step(s);
  expect(s.res[t]).toBe(R_NONE);
  // Off the tile, so the tree has room to grow.
  u.x = tcOf(s, owner).x;
  u.y = tcOf(s, owner).y + 4;
  applyCommand(s, { t: 'move', p: owner, ids: [u.id], x: u.x, y: u.y });
}

describe('the managed wood', () => {
  it('bars the Britons from Farms, and everyone else from Saplings', () => {
    const s = game();
    expect(buildBarred(s.players[0], 'farm')).toMatch(/tills no fields/);
    expect(buildBarred(s.players[0], 'sapling')).toBeNull();
    expect(buildBarred(s.players[1], 'farm')).toBeNull();
    expect(buildBarred(s.players[1], 'sapling')).toMatch(/Only the Britons/);
  });

  it('coppices a tree a Briton fells near its stores: the stool grows a full tree again', () => {
    const s = game();
    const t = openTile(s, 0, -3, 1);
    lastLog(s, t);
    fell(s, 0, t);
    expect(s.stools?.map((x) => x.tile)).toEqual([t]);
    expect(growthAt(s, t)).toBeGreaterThanOrEqual(0);
    expect(growthAt(s, t)).toBeLessThan(1);
    run(s, COPPICE.regrow + COPPICE.retry * 2);
    expect(s.res[t]).toBe(R_TREE);
    expect(s.amount[t]).toBe(AMOUNT.tree);
    expect(s.block[t] & B_RES).toBeTruthy();
    expect(s.stools).toEqual([]);
  });

  it('clears for good a tree a rival fells, and one a Briton fells far from any store', () => {
    const s = game();
    const near = openTile(s, 1, -3, 1);
    lastLog(s, near);
    fell(s, 1, near);
    expect(s.stools ?? []).toEqual([]);
    // Far from every British store.
    const far = openTile(s, 1, -2, 3);
    lastLog(s, far);
    fell(s, 0, far);
    expect(s.stools ?? []).toEqual([]);
    run(s, COPPICE.regrow + 5);
    expect(s.res[near]).toBe(R_NONE);
    expect(s.res[far]).toBe(R_NONE);
  });

  it('roots a planted Sapling as a stool, which grows into a tree', () => {
    const s = game();
    const t = openTile(s, 0, -3, 2);
    const b = placeBuilding(s, 0, 'sapling', t % s.w, Math.floor(t / s.w), true);
    expect(b.built).toBe(true);
    run(s, 1);
    expect(s.byId.has(b.id)).toBe(false);
    expect(s.bldAt[t]).toBe(0);
    expect(s.stools?.map((x) => x.tile)).toEqual([t]);
    run(s, COPPICE.grow + COPPICE.retry * 2);
    expect(s.res[t]).toBe(R_TREE);
  });

  it('grubs out a stool a building is raised over, and waits while someone stands on one', () => {
    const s = game();
    const t = openTile(s, 0, -3, 1);
    lastLog(s, t);
    fell(s, 0, t);
    // A unit planted on the stool holds the tree back.
    const u = citizenOf(s, 0);
    run(s, COPPICE.regrow - 2);
    u.x = (t % s.w) + 0.5;
    u.y = Math.floor(t / s.w) + 0.5;
    u.order = { k: 'idle' };
    for (let i = 0; i < secs(4); i++) {
      u.x = (t % s.w) + 0.5;
      u.y = Math.floor(t / s.w) + 0.5;
      step(s);
    }
    expect(s.res[t]).toBe(R_NONE);
    expect(s.stools?.length).toBe(1);
    // A Snare raised on it grubs it out.
    u.x += 3;
    placeBuilding(s, 0, 'snare', t % s.w, Math.floor(t / s.w), true);
    run(s, COPPICE.retry + 2);
    expect(s.stools).toEqual([]);
    expect(s.res[t]).toBe(R_NONE);
  });

  it('fills a British snare faster and fuller than a rival snare in the same wood', () => {
    const s = game();
    const tc = tcOf(s, 0);
    // A thick wood round two spots, one snare of each people's.
    for (let y = tc.ty + 8; y < tc.ty + 16; y++) for (let x = tc.tx - 8; x < tc.tx + 8; x++) lastLog(s, y * s.w + x);
    const spot = (dx: number) => {
      const t = (tc.ty + 11) * s.w + tc.tx + dx;
      s.res[t] = R_NONE;
      s.block[t] = 0;
      return t;
    };
    const a = spot(-5);
    const b = spot(3);
    const mine = placeBuilding(s, 0, 'snare', a % s.w, Math.floor(a / s.w), true);
    const theirs = placeBuilding(s, 1, 'snare', b % s.w, Math.floor(b / s.w), true);
    expect(snareRate(s, mine)).toBeCloseTo(snareRate(s, theirs) * COPPICE.snare, 5);
    expect(snareCap(s, mine)).toBe(SNARE.cap * COPPICE.cap);
    expect(snareCap(s, theirs)).toBe(SNARE.cap);
    for (let t = 1; t <= 600; t++) {
      s.tick = secs(t);
      fillSnares(s);
    }
    expect(mine.snared).toBe(SNARE.cap * COPPICE.cap);
    expect(theirs.snared).toBe(SNARE.cap);
  });

  it('is played by the computer: a snare line walked by tenders, and no fields', () => {
    const s = createGame({ seed: 2, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'greeks' }] });
    run(s, 9 * 60);
    const mine = s.ents.filter((e) => e.owner === 0 && e.hp > 0);
    expect(mine.filter((e) => e.kind === 'building' && e.type === 'farm')).toEqual([]);
    expect(mine.filter((e) => e.kind === 'building' && e.type === 'snare' && e.built).length).toBeGreaterThanOrEqual(2);
    expect(mine.some((e) => e.kind === 'unit' && e.order.k === 'snare')).toBe(true);
    expect(s.players[0].stats.snared ?? 0).toBeGreaterThan(50);
  });
});
