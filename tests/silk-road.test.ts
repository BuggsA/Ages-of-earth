import { describe, expect, it } from 'vitest';
import { ageOf, buildBarred, mainRoad, pathCarry, pathDepth, pathOf, roadKnown, roadProblem, roadsFrom } from '../src/sim/ages';
import { findSpot } from '../src/sim/ai';
import { AGES, PATHS, ROADS, SILK, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf } from '../src/sim/stats';
import { packProblem } from '../src/sim/steppe';
import { caravanBonus, tripGold } from '../src/sim/trade';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, Command, GameState, TradePost, Unit } from '../src/sim/types';
import { buildingGeometry } from '../src/render/buildingModels';
import { unitGeometry } from '../src/render/unitModels';

/** The Age of the Silk Road (#326): the Steppe Road's third step, where caravans travel with the camp. */

const game = (): GameState => {
  const s = createGame({ seed: 7, size: 'small', startEpoch: 2, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  // Wolves by the road would eat the traders these tests follow.
  s.animals = [];
  return s;
};
const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};
const rich = (s: GameState) => { s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; };
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const silk = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'silk'; s.players[0].epoch = 3; s.players[0].walked = ['steppe', 'horde', 'silk']; });
const horde = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'horde'; s.players[0].epoch = 2; s.players[0].walked = ['steppe', 'horde']; });
const merchants = (s: GameState, walked: boolean) => restat(s, s.players[0], () => { s.players[0].age = 'merchant'; s.players[0].epoch = 2; s.players[0].walked = walked ? ['steppe', 'merchant'] : ['merchant']; });
const fromMerchants = ROADS.find((r) => r.from === 'merchant' && r.to === 'silk')!;
const fromHorde = ROADS.find((r) => r.from === 'gunpowder' && r.to === 'silk')!;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const postNear = (s: GameState): TradePost => [...s.posts].sort((a, b) => dist(a, { x: s.players[0].startX, y: s.players[0].startY }) - dist(b, { x: s.players[0].startX, y: s.players[0].startY }))[0];
/** A finished Market of player 0's, about `d` tiles from the post toward its town. */
function marketNear(s: GameState, post: TradePost, d: number): Building {
  const pl = s.players[0];
  const l = dist(post, { x: pl.startX, y: pl.startY });
  const spot = findSpot(s, 'market', post.x + ((pl.startX - post.x) / l) * d, post.y + ((pl.startY - post.y) / l) * d, 0, 10)!;
  return placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
}
/** Steps until a trader event of this kind for player 0, returning it. */
function until(s: GameState, what: 'loaded' | 'paid', seconds = 120) {
  for (let i = 0; i < seconds * TICK_HZ; i++) {
    step(s);
    for (const ev of s.events) if (ev.k === 'caravan' && ev.what === what && ev.owner === 0 && !ev.share) return ev;
  }
  return null;
}
const wagons = (s: GameState) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'wagon');

describe('the Age of the Silk Road (#326)', () => {
  it('is the Steppe Road\'s third step: tier 3, on wheels, the Market packs too, and trade pays more', () => {
    expect(AGES.silk.tier).toBe(3);
    expect(pathOf('silk')).toBe('steppe');
    expect(AGES.silk.mobile).toBe(true);
    expect(AGES.silk.caravans).toBe(true);
    expect(PATHS.steppe.planned ?? []).not.toContainEqual(expect.stringMatching(/Silk/));
    const s = game(); const p = s.players[0];
    silk(s);
    expect(pathDepth(p)).toBe(3);
    expect(pathCarry(p)).toEqual({ path: 'steppe', times: 2 });
    expect(modsOf(s, 0).tradeGold).toBeGreaterThan(1);
    expect(modsOf(s, 0).traderSpeed).toBeGreaterThan(1);
    // No tribute: a caravan people keeps the roads open.
    expect(modsOf(s, 0).tribute).toBe(0);
    expect(buildBarred(p, 'farm')).toBeTruthy();
    expect(buildBarred(p, 'wall')).toBeTruthy();
    expect(buildBarred(p, 'market')).toBeNull();
    // Out of it: the plain advance rejoins the trunk at the Industrial Age, and the Gunpowder Age settles.
    expect(mainRoad(p)?.to).toBe('industrial');
    expect(roadsFrom(p).map((r) => r.to)).toContain('gunpowder');
  });

  it('opens from the merchants only for a people that once rode the steppe, with a Market and the trade and hunt done', () => {
    const s = game(); const p = s.players[0]; rich(s);
    merchants(s, false);
    placeBuilding(s, 0, 'market', p.startX + 8, p.startY + 6, true);
    expect(roadKnown(s, p, fromMerchants)).toBe(false);
    merchants(s, true);
    expect(roadKnown(s, p, fromMerchants)).toBe(true);
    expect(roadProblem(s, p, fromMerchants)).toContain('(0/800)');
    p.stats.traded = 800;
    p.stats.hunted = 800;
    expect(roadProblem(s, p, fromMerchants)).toBeNull();
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'silk' }]);
    run(s, fromMerchants.time + 1);
    expect(ageOf(p)).toBe('silk');
    expect(p.epoch).toBe(3);
  });

  it('turns off the Gunpowder Age for a people that rode as a horde, with a Market, once tribute and trade are in', () => {
    const s = game(); const p = s.players[0]; rich(s);
    restat(s, p, () => { p.age = 'gunpowder'; p.epoch = 3; p.walked = []; });
    placeBuilding(s, 0, 'market', p.startX + 8, p.startY + 6, true);
    expect(roadKnown(s, p, fromHorde)).toBe(false);
    restat(s, p, () => { p.walked = ['steppe', 'horde']; });
    expect(roadKnown(s, p, fromHorde)).toBe(true);
    expect(roadProblem(s, p, fromHorde)).toContain('tribute');
    p.stats.tribute = 300;
    p.stats.traded = 400;
    expect(roadProblem(s, p, fromHorde)).toBeNull();
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'silk' }]);
    run(s, fromHorde.time + 1);
    expect(ageOf(p)).toBe('silk');
  });

  it('is never seen from the Horde itself, nor by a people that never rode as one', () => {
    const s = game(); const p = s.players[0];
    horde(s);
    expect(roadsFrom(p).some((r) => r.to === 'silk')).toBe(false);
    placeBuilding(s, 0, 'market', p.startX + 8, p.startY + 6, true);
    restat(s, p, () => { p.age = 'gunpowder'; p.epoch = 3; p.walked = ['merchant']; });
    placeBuilding(s, 0, 'market', p.startX + 8, p.startY + 6, true);
    expect(roadKnown(s, p, fromHorde)).toBe(false);
  });

  it('packs the Market onto a wagon only on the Silk Road, and pitches it again', () => {
    const s = game(); const p = s.players[0];
    const m = placeBuilding(s, 0, 'market', p.startX + 8, p.startY + 6, true);
    horde(s);
    expect(packProblem(s, p, m)).toContain('Only Town Centers and Houses');
    silk(s);
    expect(packProblem(s, p, m)).toBeNull();
    step(s, [{ t: 'pack', p: 0, building: m.id }]);
    expect(s.byId.has(m.id)).toBe(false);
    const w = wagons(s).find((u) => u.packed === 'market')!;
    expect(w).toBeTruthy();
    run(s, 1, [{ t: 'pitch', p: 0, ids: [w.id] }]);
    const again = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'market')!;
    expect(again).toBeTruthy();
    run(s, 11);
    expect(again.built).toBe(true);
  });

  it('a trader comes home to its Market on the road, and is paid more for the ground the camp covered', () => {
    const s = game(); silk(s);
    const post = postNear(s);
    const m = marketNear(s, post, 20);
    const t = spawnUnit(s, 0, 'trader', m.x, m.y + m.size / 2 + 1);
    run(s, 1, [{ t: 'route', p: 0, ids: [t.id], post: post.id }]);
    const loaded = until(s, 'loaded');
    expect(loaded).toBeTruthy();
    expect((t.order as { from?: unknown }).from).toEqual({ x: m.x, y: m.y });
    expect(t.carry).toBe(tripGold(s, 0, m, post));
    // A longer road's load, so the bonus is whole gold on this small map.
    t.carry = 100;
    const carry = t.carry;
    // Strike the Market and drive it on, away from the post, while the trader walks back.
    const set = { x: m.x, y: m.y };
    step(s, [{ t: 'pack', p: 0, building: m.id }]);
    const w = wagons(s).find((u) => u.packed === 'market')!;
    const l = dist(post, set);
    const to = { x: set.x + ((set.x - post.x) / l) * 14, y: set.y + ((set.y - post.y) / l) * 14 };
    step(s, [{ t: 'move', p: 0, ids: [w.id], x: to.x, y: to.y }]);
    const gold = s.players[0].res.gold;
    const paid = until(s, 'paid', 150);
    expect(paid).toBeTruthy();
    if (!paid || paid.k !== 'caravan') return;
    expect(paid.moved).toBeGreaterThanOrEqual(8);
    expect(paid.bonus).toBe(Math.floor(carry * SILK.each * Math.min(SILK.most, paid.moved!)));
    expect(paid.amount).toBe(carry + paid.bonus!);
    expect(s.players[0].res.gold).toBe(gold + paid.amount);
    expect(s.players[0].stats.caravan).toBe(paid.bonus);
    // It paid in at the wagon, and goes out again from where the Market now is.
    expect(dist(paid, w)).toBeLessThan(1e-9);
    expect(t.order).toMatchObject({ k: 'trade', phase: 'go', market: w.id });
    expect((t.order as { from?: { x: number; y: number } }).from).toEqual({ x: w.x, y: w.y });
  });

  it('pays nothing extra outside the Silk Road, and caps the ground counted', () => {
    const s = game(); const p = s.players[0];
    p.age = 'merchant';
    expect(caravanBonus(s, 0, 100, { x: 0, y: 0 }, { x: 30, y: 0 })).toEqual({ moved: 0, bonus: 0 });
    silk(s);
    expect(caravanBonus(s, 0, 100, { x: 0, y: 0 }, { x: 30, y: 0 })).toEqual({ moved: 30, bonus: Math.floor(100 * SILK.each * 30) });
    expect(caravanBonus(s, 0, 100, { x: 0, y: 0 }, { x: 0, y: SILK.most + 50 }).bonus).toBe(Math.floor(100 * SILK.each * SILK.most));
    expect(caravanBonus(s, 0, 100, undefined, { x: 30, y: 0 }).bonus).toBe(0);
  });

  it('a Market on its wagon, and a trader\'s starting point, survive a save', () => {
    const s = game(); silk(s);
    const post = postNear(s);
    const m = marketNear(s, post, 20);
    const t = spawnUnit(s, 0, 'trader', m.x, m.y + m.size / 2 + 1);
    run(s, 1, [{ t: 'route', p: 0, ids: [t.id], post: post.id }]);
    until(s, 'loaded');
    step(s, [{ t: 'pack', p: 0, building: m.id }]);
    const back = deserialize(serialize(s));
    expect(back.ents.some((e) => e.kind === 'unit' && e.type === 'wagon' && e.packed === 'market')).toBe(true);
    const t2 = back.byId.get(t.id) as Unit;
    expect(t2.order).toEqual(t.order);
  });

  it('draws the Market on the road as a camel caravan cart, and dresses the caravan town in awnings and dyed silk', () => {
    const cart = unitGeometry('wagon', 23);
    const ger = unitGeometry('wagon', 3);
    expect(cart.getAttribute('position').count).not.toBe(ger.getAttribute('position').count);
    cart.computeBoundingBox();
    const b = cart.boundingBox!;
    expect(Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z)).toBeLessThan(3);
    for (const type of ['towncenter', 'house', 'market'] as const) {
      const plain = buildingGeometry(type, 3, '#cc3333').getAttribute('position').count;
      expect(buildingGeometry(type, 3, '#cc3333', 0, 'silk').getAttribute('position').count, type).toBeGreaterThan(plain);
    }
  });
});
