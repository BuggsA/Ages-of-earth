import { describe, expect, it } from 'vitest';
import { buildBarred } from '../src/sim/ages';
import { findSpot } from '../src/sim/ai';
import { landOwnerAt } from '../src/sim/borders';
import { AGES, BORDERS, BUILDINGS, SERAI, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { nearestWalkable, placeProblem } from '../src/sim/grid';
import { owesToll, restsAt, tollOf } from '../src/sim/passage';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf } from '../src/sim/stats';
import { seraiNear, tripGold } from '../src/sim/trade';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, GameState, TradePost, Unit } from '../src/sim/types';
import { buildingGeometry } from '../src/render/buildingModels';

/** Caravanserais and safe passage on the Silk Road (#334). */

const game = (): GameState => {
  const s = createGame({ seed: 7, size: 'small', startEpoch: 2, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  // Wolves by the road would eat the traders these tests follow.
  s.animals = [];
  return s;
};
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};
const silk = (s: GameState, who: number) => restat(s, s.players[who], () => { s.players[who].age = 'silk'; s.players[who].epoch = 3; s.players[who].walked = ['steppe', 'horde', 'silk']; });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const postNear = (s: GameState, who: number): TradePost => [...s.posts].sort((a, b) => dist(a, { x: s.players[who].startX, y: s.players[who].startY }) - dist(b, { x: s.players[who].startX, y: s.players[who].startY }))[0];
/** A finished Caravanserai of `who`'s about `d` tiles from a point. */
function seraiAt(s: GameState, who: number, at: { x: number; y: number }, d: number): Building {
  const spot = findSpot(s, 'caravanserai', at.x, at.y, d, d + 6)!;
  return placeBuilding(s, who, 'caravanserai', spot.tx, spot.ty, true);
}
/** A walkable spot in player 1's land, out of its Town Center's bow range. */
function inLandOf1(s: GameState): { x: number; y: number } {
  const p = s.players[1];
  for (const [dx, dy] of [[11, 0], [-11, 0], [0, 11], [0, -11], [8, 8], [-8, 8], [8, -8], [-8, -8]]) {
    const t = nearestWalkable(s, p.startX + dx, p.startY + dy, 2);
    if (t < 0) continue;
    const x = (t % s.w) + 0.5, y = Math.floor(t / s.w) + 0.5;
    if (landOwnerAt(s, Math.floor(x), Math.floor(y)) === 1) return { x, y };
  }
  throw new Error('no ground in player 1\'s land');
}
/** A trader of player 0's on its way home with `carry` gold, standing at a spot. */
function laden(s: GameState, at: { x: number; y: number }, carry = 100): Unit {
  const post = postNear(s, 0);
  const m = placeBuilding(s, 0, 'market', s.players[0].startX + 6, s.players[0].startY + 6, true);
  const t = spawnUnit(s, 0, 'trader', at.x, at.y);
  t.order = { k: 'trade', post: post.id, market: m.id, phase: 'back' };
  t.carry = carry;
  t.carryRes = 'gold';
  return t;
}
const tolls = (s: GameState) => s.events.filter((e) => e.k === 'toll');

describe('the Caravanserai (#334)', () => {
  it('is the Silk Road\'s own building: raised only there, holding the land round it', () => {
    const s = game(); const p = s.players[0];
    expect(BUILDINGS.caravanserai.ages).toEqual(['silk']);
    expect(BORDERS.caravanserai).toBeGreaterThan(0);
    expect(buildBarred(p, 'caravanserai')).toBeTruthy();
    silk(s, 0);
    expect(buildBarred(p, 'caravanserai')).toBeNull();
    const b = seraiAt(s, 0, postNear(s, 0), 4);
    expect(landOwnerAt(s, Math.floor(b.x), Math.floor(b.y))).toBe(0);
  });

  it('may be raised in no one\'s land, but not in a rival\'s', () => {
    const s = game(); silk(s, 0);
    const post = postNear(s, 0);
    const spot = findSpot(s, 'caravanserai', post.x, post.y, 3, 9, 1, (tx, ty) => landOwnerAt(s, tx + 1, ty + 1) === -1);
    expect(spot).toBeTruthy();
    expect(placeProblem(s, 'caravanserai', spot!.tx, spot!.ty, true, 0)).toBeNull();
    const there = inLandOf1(s);
    const foreign = findSpot(s, 'caravanserai', there.x, there.y, 0, 3, 1, (tx, ty) => landOwnerAt(s, tx + 1, ty + 1) === 1);
    expect(foreign).toBeTruthy();
    expect(placeProblem(s, 'caravanserai', foreign!.tx, foreign!.ty, true, 0)).toBe('foreign');
  });

  it('makes a near post pay its owner a quarter more by land, once, and not by sea or for anyone else', () => {
    const s = game(); silk(s, 0); silk(s, 1);
    const post = postNear(s, 0);
    const m = { x: post.x + 30, y: post.y };
    const plain = tripGold(s, 0, m, post);
    const bySea = tripGold(s, 0, m, post, true);
    const b = seraiAt(s, 0, post, 3);
    expect(dist(b, post)).toBeLessThanOrEqual(SERAI.near);
    expect(seraiNear(s, 0, post)).toBe(b);
    expect(tripGold(s, 0, m, post)).toBeGreaterThan(plain);
    expect(tripGold(s, 0, m, post)).toBeLessThanOrEqual(Math.ceil((plain + 1) * SERAI.pay));
    // Two do no more than one.
    const once = tripGold(s, 0, m, post);
    seraiAt(s, 0, post, 3);
    expect(tripGold(s, 0, m, post)).toBe(once);
    // Not by sea, and not for a rival's traders.
    expect(tripGold(s, 0, m, post, true)).toBe(bySea);
    expect(seraiNear(s, 1, post)).toBeNull();
    expect(tripGold(s, 1, m, post)).toBe(plain);
    // An unfinished or far one counts for nothing.
    const s2 = game(); silk(s2, 0);
    const post2 = postNear(s2, 0);
    const far = findSpot(s2, 'caravanserai', post2.x, post2.y, SERAI.near + 2, SERAI.near + 8)!;
    placeBuilding(s2, 0, 'caravanserai', far.tx, far.ty, true);
    const near = findSpot(s2, 'caravanserai', post2.x, post2.y, 3, 6)!;
    placeBuilding(s2, 0, 'caravanserai', near.tx, near.ty, false);
    expect(seraiNear(s2, 0, post2)).toBeNull();
  });

  it('pays the bonus when a trader loads at a post beside one', () => {
    const s = game(); silk(s, 0);
    const post = postNear(s, 0);
    const b = seraiAt(s, 0, post, 3);
    const spot = findSpot(s, 'market', s.players[0].startX, s.players[0].startY, 6, 14)!;
    const m = placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
    const t = spawnUnit(s, 0, 'trader', m.x, m.y + m.size / 2 + 1);
    step(s, [{ t: 'route', p: 0, ids: [t.id], post: post.id }]);
    for (let i = 0; i < 150 * TICK_HZ && t.order.k === 'trade' && t.order.phase === 'go'; i++) step(s);
    expect(t.order).toMatchObject({ phase: 'back' });
    expect(t.carry).toBe(tripGold(s, 0, m, post));
    b.hp = 0;
    expect(t.carry).toBeGreaterThan(tripGold(s, 0, m, post));
  });

  it('rests hurt traders and wagons of its owner and allies within reach, and no one else', () => {
    const s = game(); silk(s, 0);
    const b = seraiAt(s, 0, { x: s.players[0].startX, y: s.players[0].startY }, 8);
    const near = spawnUnit(s, 0, 'trader', b.x + 2, b.y);
    const far = spawnUnit(s, 0, 'trader', b.x + SERAI.rest + 4, b.y);
    const rival = spawnUnit(s, 1, 'trader', b.x - 2, b.y);
    for (const u of [near, far, rival]) u.hp = 20;
    expect(restsAt(s, near, b)).toBe(true);
    expect(restsAt(s, far, b)).toBe(false);
    expect(restsAt(s, rival, b)).toBe(false);
    // (The rival's trader stands by player 0's town, under its Town Center's bows, so it isn't stepped.)
    rival.hp = 0;
    for (const u of [near, far]) u.order = { k: 'idle' };
    run(s, 3);
    expect(near.hp).toBeGreaterThanOrEqual(20 + SERAI.heal * 2);
    expect(far.hp).toBe(20);
  });

  it('is drawn as a courtyard of its own', () => {
    const g = buildingGeometry('caravanserai', 3, '#c03030');
    expect(g.getAttribute('position').count).toBeGreaterThan(100);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeLessThanOrEqual(2.1);
    // The Silk Road's awnings and drying lines are left off it.
    expect(buildingGeometry('caravanserai', 3, '#c03030', 0, 'silk').getAttribute('position').count).toBe(g.getAttribute('position').count);
  });
});

describe('safe passage (#334)', () => {
  it('is what tribute becomes on the Silk Road: a toll, where the Horde had tribute', () => {
    const s = game(); silk(s, 1);
    expect(modsOf(s, 1).toll).toBe(AGES.silk.add!.toll);
    expect(modsOf(s, 1).toll).toBeGreaterThan(0);
    expect(modsOf(s, 1).tribute).toBe(0);
    expect(modsOf(s, 0).toll).toBe(0);
    expect(AGES.horde.add?.toll ?? 0).toBe(0);
  });

  it('takes a share of a rival trader\'s load once a trip as it crosses a caravan people\'s land', () => {
    const s = game(); silk(s, 1);
    const t = laden(s, inLandOf1(s));
    const gold = s.players[1].res.gold;
    const share = tollOf(s, 1, 100);
    expect(share).toBe(Math.floor(100 * AGES.silk.add!.toll!));
    expect(owesToll(s, t, 1)).toBe(true);
    let seen = 0;
    for (let i = 0; i < 4 * TICK_HZ; i++) {
      step(s);
      seen += tolls(s).length;
    }
    expect(seen).toBe(1);
    expect(t.carry).toBe(100 - share);
    expect(s.players[1].res.gold).toBe(gold + share);
    expect(s.players[1].stats.toll).toBe(share);
    expect(t.tolled).toBe(1 << 1);
    expect(owesToll(s, t, 1)).toBe(false);
  });

  it('asks nothing of allies, of empty traders, during the peace, or in a people\'s land that takes no toll', () => {
    const lands = (setup: (s: GameState, t: Unit) => void) => {
      const s = game(); silk(s, 1);
      const t = laden(s, inLandOf1(s));
      setup(s, t);
      const carry = t.carry;
      run(s, 3);
      return { paid: carry - t.carry, events: s.players[1].stats.toll ?? 0 };
    };
    expect(lands(() => {}).paid).toBeGreaterThan(0);
    expect(lands((s) => { s.players[1].team = s.players[0].team; })).toEqual({ paid: 0, events: 0 });
    expect(lands((_s, t) => { t.order = { k: 'trade', post: (t.order as { post: number }).post, market: (t.order as { market: number }).market, phase: 'go' }; }).events).toBe(0);
    expect(lands((s) => { s.peaceUntil = s.tick + 10 * TICK_HZ; })).toEqual({ paid: 0, events: 0 });
    expect(lands((s) => restat(s, s.players[1], () => { s.players[1].age = 'gunpowder'; s.players[1].walked = []; }))).toEqual({ paid: 0, events: 0 });
  });

  it('owes the toll afresh for each new load', () => {
    const s = game(); silk(s, 1);
    const t = laden(s, inLandOf1(s));
    run(s, 2);
    expect(t.tolled).toBe(1 << 1);
    // Home and out again: the new load at the post owes it again.
    const post = s.posts.find((p) => p.id === (t.order as { post: number }).post)!;
    t.carry = 0;
    t.order = { k: 'trade', post: post.id, market: (t.order as { market: number }).market, phase: 'go' };
    t.x = post.x; t.y = post.y; t.path = null;
    step(s);
    expect(t.order).toMatchObject({ phase: 'back' });
    expect(t.tolled).toBeUndefined();
  });

  it('keeps what a load has paid across a save, and plays the same from it', () => {
    const s = game(); silk(s, 1);
    const t = laden(s, inLandOf1(s));
    run(s, 2);
    const back = deserialize(serialize(s));
    expect((back.byId.get(t.id) as Unit).tolled).toBe(t.tolled);
    run(s, 5);
    run(back, 5);
    expect(serialize(back)).toBe(serialize(s));
  });
});
