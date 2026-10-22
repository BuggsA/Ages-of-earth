import { describe, expect, it } from 'vitest';
import { findSpot, oreTarget } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { AI_CACHE, CACHE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Take it back (#570): a rival's key ore spills when the store holding it falls, and anyone's citizens carry it home. */

const game = (): GameState => createGame({ seed: 4, size: 'small', mapType: 'plains', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
const tcOf = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, sec: number) => { for (let i = 0; i < secs(sec) && !s.over; i++) step(s); };

/** Player 1 holds 40 saltpetre in a Storehouse beside its Town Center; returns the store. */
function holding(s: GameState): Building {
  const home = tcOf(s, 1);
  const spot = findSpot(s, 'storehouse', home.x + 10, home.y, 1, 10)!;
  const store = placeBuilding(s, 1, 'storehouse', spot.tx, spot.ty, true);
  s.players[1].rare = { saltpetre: 40 };
  s.players[1].stats.mined = { saltpetre: 40 };
  return store;
}

describe('take it back (#570)', () => {
  it('a fallen ore store spills its share of the ore as a cache, and the loser\'s ore door goes back', () => {
    const s = game();
    const store = holding(s);
    store.hp = 0;
    step(s);
    // Two stores stood (the Town Center and this one): a half split two ways.
    const n = Math.floor((40 * CACHE.share) / 2);
    expect(s.caches?.length).toBe(1);
    expect(s.caches![0]).toMatchObject({ ore: 'saltpetre', n, from: 1 });
    expect(s.players[1].rare!.saltpetre).toBe(40 - n);
    expect(s.players[1].stats.mined!.saltpetre).toBe(40 - n);
  });

  it('a rival citizen lifts it and banks it at home, where it counts toward its own ore door', () => {
    const s = game();
    const store = holding(s);
    store.hp = 0;
    step(s);
    const c = s.caches![0];
    const home = tcOf(s, 0);
    const spot = findSpot(s, 'storehouse', c.x - 4, c.y, 0, 8)!;
    placeBuilding(s, 0, 'storehouse', spot.tx, spot.ty, true);
    const taker = spawnUnit(s, 0, 'citizen', c.x + 1, c.y);
    applyCommand(s, { t: 'cache', p: 0, ids: [taker.id], target: c.id });
    run(s, 40);
    expect(s.caches).toBeUndefined();
    expect(taker.ore).toBeUndefined();
    expect(s.players[0].rare?.saltpetre).toBe(10);
    expect(s.players[0].stats.mined?.saltpetre).toBe(10);
    expect(s.players[0].stats.seized).toBe(10);
    expect(home.hp).toBeGreaterThan(0);
  });

  it('a cache bigger than one load takes trips, and a fallen carrier drops what it holds', () => {
    const s = game();
    const store = holding(s);
    s.players[1].rare = { saltpetre: 200 };
    store.hp = 0;
    step(s);
    const c = s.caches![0];
    expect(c.n).toBe(50);
    const taker = spawnUnit(s, 0, 'citizen', c.x + 1, c.y);
    applyCommand(s, { t: 'cache', p: 0, ids: [taker.id], target: c.id });
    for (let i = 0; i < 40 && !taker.ore; i++) step(s);
    expect(taker.ore).toEqual({ id: 'saltpetre', n: CACHE.load, from: 1 });
    expect(c.n).toBe(50 - CACHE.load);
    taker.hp = 0;
    step(s);
    const total = (s.caches ?? []).reduce((a, k) => a + k.n, 0);
    expect(total).toBe(50);
  });

  it('a fallen digger drops the ore in its basket', () => {
    const s = game();
    const u = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 1 && e.type === 'citizen')!;
    u.carry = 7.6;
    u.carryRes = 'stone';
    u.carryRare = 'salt';
    u.hp = 0;
    step(s);
    expect(s.caches).toEqual([expect.objectContaining({ ore: 'salt', n: 7, from: 1 })]);
  });

  it('a store of a people holding no ore spills nothing', () => {
    const s = game();
    const store = holding(s);
    s.players[1].rare = {};
    store.hp = 0;
    step(s);
    expect(s.caches).toBeUndefined();
  });

  it('a citizen sent onto a cache with nowhere to keep it is refused and keeps it', () => {
    const s = game();
    const store = holding(s);
    store.hp = 0;
    step(s);
    const c = s.caches![0];
    tcOf(s, 0).hp = 0;
    step(s);
    const taker = spawnUnit(s, 0, 'citizen', c.x + 1, c.y);
    applyCommand(s, { t: 'cache', p: 0, ids: [taker.id], target: c.id });
    let refused = false;
    for (let i = 0; i < 60; i++) {
      step(s);
      if (s.events.some((e) => e.k === 'refused' && e.owner === 0)) refused = true;
    }
    expect(refused).toBe(true);
    expect(taker.ore?.n).toBe(10);
    expect(taker.order.k).toBe('idle');
  });
});

describe('the computer and caches (#570)', () => {
  const aiGame = () => {
    const s = createGame({ seed: 4, size: 'small', mapType: 'plains', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    return s;
  };

  it('carries home a cache it sees lying near its town', () => {
    const s = aiGame();
    const tc = tcOf(s, 0);
    step(s);
    s.caches = [{ id: s.nextId++, x: tc.x + 6.5, y: tc.y + 0.5, ore: 'salt', n: 30, from: 1 }];
    run(s, 60);
    expect(s.caches).toBeUndefined();
    expect(s.players[0].stats.seized).toBe(30);
  });

  it('leaves a cache a rival soldier stands over', () => {
    const s = aiGame();
    const tc = tcOf(s, 0);
    step(s);
    s.caches = [{ id: s.nextId++, x: tc.x + 6.5, y: tc.y + 0.5, ore: 'salt', n: 30, from: 1 }];
    const guard = spawnUnit(s, 1, 'infantry', tc.x + 7.5, tc.y + 0.5);
    guard.stance = 'stand';
    for (let i = 0; i < secs(3); i++) step(s);
    expect(s.ents.some((e) => e.kind === 'unit' && e.owner === 0 && e.order.k === 'cache')).toBe(false);
  });

  it('assayed, it aims at the ore store of a rival holding enough key ore', () => {
    const s = aiGame();
    const store = holding(s);
    const p = s.players[0];
    const home = { x: p.startX, y: p.startY };
    s.players[1].rare = { saltpetre: AI_CACHE.worth - 1 };
    expect(oreTarget(s, p, home)).toBeNull();
    s.players[1].rare = { saltpetre: AI_CACHE.worth };
    const tc = tcOf(s, 1);
    const near = (b: Building) => (b.x - home.x) ** 2 + (b.y - home.y) ** 2;
    const want = near(store) < near(tc) ? store : tc;
    expect(oreTarget(s, p, home)).toEqual({ x: want.x, y: want.y });
  });
});
