import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { BONUS, TICK_HZ, TRADE } from '../src/sim/data';
import { checksum, createGame, step, type GameSetup } from '../src/sim/game';
import { placeProblem, walkable } from '../src/sim/grid';
import { generateMap } from '../src/sim/mapgen';
import { deserialize, serialize } from '../src/sim/save';
import { tripGold } from '../src/sim/trade';
import type { Building, Command, GameState, MapSize, MapType, TradePost, Unit } from '../src/sim/types';
import { R_NONE, T_GRASS, T_SAND } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

const game = (o: Partial<GameSetup> = {}): GameState =>
  createGame({
    seed: o.seed ?? 7,
    size: o.size ?? 'small',
    mapType: o.mapType,
    startEpoch: o.startEpoch ?? 2,
    peaceMinutes: o.peaceMinutes,
    players: o.players ?? [
      { name: 'A', ai: null, civ: 'romans' },
      { name: 'B', ai: null, civ: 'romans' },
    ],
  });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
/** The post nearest a player's town. */
const postNear = (s: GameState, p = 0): TradePost => [...s.posts].sort((a, b) => dist(a, { x: s.players[p].startX, y: s.players[p].startY }) - dist(b, { x: s.players[p].startX, y: s.players[p].startY }))[0];
/** A finished Market of a player's, about `d` tiles from a point (toward their town). */
function marketNear(s: GameState, p: number, at: { x: number; y: number }, d: number): Building {
  const pl = s.players[p];
  const l = dist(at, { x: pl.startX, y: pl.startY });
  const x = at.x + ((pl.startX - at.x) / l) * d;
  const y = at.y + ((pl.startY - at.y) / l) * d;
  const spot = findSpot(s, 'market', x, y, 0, 10)!;
  return placeBuilding(s, p, 'market', spot.tx, spot.ty, true);
}
const traderBy = (s: GameState, p: number, m: Building): Unit => spawnUnit(s, p, 'trader', m.x, m.y + m.size / 2 + 1);

describe('trading posts on the map', () => {
  it('every map has at least two, out near the edge, far from every town, fair to the two nearest, on open level ground', () => {
    const types: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'];
    const sizes: MapSize[] = ['small', 'medium', 'large'];
    for (const type of types) {
      for (const size of sizes) {
        for (const n of [2, 3, 4]) {
          const m = generateMap(11, size, n, type);
          const label = `${type} ${size} ${n}`;
          expect(m.posts.length, label).toBeGreaterThanOrEqual(2);
          expect(m.posts.length, label).toBeLessThanOrEqual(TRADE.posts[size]);
          for (const p of m.posts) {
            const ds = m.starts.map((st) => dist(p, st)).sort((a, b) => a - b);
            expect(ds[0], label).toBeGreaterThanOrEqual(TRADE.far * Math.min(m.w, m.h));
            expect(ds[1] - ds[0], label).toBeLessThanOrEqual(TRADE.fair * 4);
            for (let dy = -TRADE.plaza; dy <= TRADE.plaza; dy++) {
              for (let dx = -TRADE.plaza; dx <= TRADE.plaza; dx++) {
                const i = (Math.floor(p.y) + dy) * m.w + Math.floor(p.x) + dx;
                expect(m.res[i], label).toBe(R_NONE);
                expect(m.terrain[i] === T_GRASS || m.terrain[i] === T_SAND, label).toBe(true);
                expect(m.block[i], label).toBe(0);
              }
            }
            for (const o of m.posts) if (o !== p) expect(dist(o, p), label).toBeGreaterThanOrEqual(TRADE.spacing * Math.min(m.w, m.h));
          }
        }
      }
    }
  });

  it('nothing can be built on a post, but anyone can walk across it', () => {
    const s = game();
    const p = s.posts[0];
    expect(placeProblem(s, 'house', Math.floor(p.x), Math.floor(p.y))).toBe('blocked');
    expect(placeProblem(s, 'house', Math.floor(p.x) + 1, Math.floor(p.y) + 1)).toBe('blocked');
    expect(walkable(s, Math.floor(p.x), Math.floor(p.y))).toBe(true);
  });
});

describe('traders', () => {
  it('run the road between their Market and a post, paying gold by the distance each trip home', () => {
    const s = game();
    const post = postNear(s);
    const m = marketNear(s, 0, post, 20);
    const t = traderBy(s, 0, m);
    const pay = tripGold(s, 0, m, post);
    const gold = s.players[0].res.gold;
    run(s, 1, [{ t: 'route', p: 0, ids: [t.id], post: post.id }]);
    expect(t.order).toMatchObject({ k: 'trade', post: post.id, market: m.id, phase: 'go' });
    let loaded = 0;
    for (let i = 0; i < 90 * TICK_HZ && !loaded; i++) {
      step(s);
      for (const ev of s.events) if (ev.k === 'caravan' && ev.what === 'loaded') loaded = ev.amount;
    }
    expect(loaded).toBe(pay);
    expect(t.carry).toBe(pay);
    // Nothing is paid until it is home.
    expect(s.players[0].res.gold).toBe(gold);
    let paid = 0;
    for (let i = 0; i < 90 * TICK_HZ && !paid; i++) {
      step(s);
      for (const ev of s.events) if (ev.k === 'caravan' && ev.what === 'paid') paid = ev.amount;
    }
    expect(paid).toBe(pay);
    expect(s.players[0].res.gold).toBe(gold + pay);
    expect(s.players[0].stats.traded).toBe(pay);
    // And out again, on its own.
    expect(t.order).toMatchObject({ k: 'trade', phase: 'go' });
    run(s, 120);
    expect(s.players[0].stats.traded).toBeGreaterThanOrEqual(2 * pay);
  });

  it('share a quarter of each trip with allies who have a Market, and with no one else', () => {
    const s = game({
      players: [
        { name: 'A', ai: null, civ: 'romans', team: 0 },
        { name: 'B', ai: null, civ: 'romans', team: 0 },
        { name: 'C', ai: null, civ: 'romans', team: 1 },
      ],
    });
    const post = postNear(s);
    const m = marketNear(s, 0, post, 20);
    marketNear(s, 2, post, 20);
    const t = traderBy(s, 0, m);
    const pay = tripGold(s, 0, m, post);
    const [a, b, c] = s.players.map((p) => p.res.gold);
    run(s, 1, [{ t: 'route', p: 0, ids: [t.id], post: post.id }]);
    for (let i = 0; i < 90 * TICK_HZ && !s.players[0].stats.traded; i++) step(s);
    expect(s.players[0].res.gold - a).toBeGreaterThanOrEqual(pay);
    // The ally has no Market yet; the rival never shares.
    expect(s.players[1].res.gold).toBe(b);
    expect(s.players[2].res.gold).toBe(c);
    marketNear(s, 1, post, 20);
    const before = s.players[1].res.gold;
    const mark = s.players[0].stats.traded;
    for (let i = 0; i < 120 * TICK_HZ && s.players[0].stats.traded === mark; i++) step(s);
    expect(s.players[1].res.gold - before).toBeGreaterThanOrEqual(Math.floor((s.players[0].stats.traded - mark) * TRADE.ally));
    expect(s.players[1].stats.traded).toBeGreaterThan(0);
    expect(s.players[2].res.gold).toBe(c);
  });

  it('pay grows with the square of the road, and Banking adds a fifth', () => {
    const s = game({ startEpoch: 3 });
    const post = s.posts[0];
    const near = tripGold(s, 0, { x: post.x + 15, y: post.y }, post);
    const far = tripGold(s, 0, { x: post.x + 30, y: post.y }, post);
    expect(far).toBeGreaterThanOrEqual(near * 4 - 4);
    expect(far).toBeLessThanOrEqual(near * 4 + 4);
    expect(tripGold(s, 0, { x: post.x + 500, y: post.y }, post)).toBe(TRADE.max);
    s.players[0].techs.push('caravan', 'banking');
    s.players[0].statsVersion++;
    expect(tripGold(s, 0, { x: post.x + 30, y: post.y }, post)).toBe(Math.floor(30 * 30 * TRADE.gold * (1 + 2 * TRADE.epoch) * 1.2));
  });

  it('a trader that falls on the way home brings nothing', () => {
    const s = game();
    const post = postNear(s);
    const m = marketNear(s, 0, post, 20);
    const t = traderBy(s, 0, m);
    const gold = s.players[0].res.gold;
    step(s, [{ t: 'route', p: 0, ids: [t.id], post: post.id }]);
    for (let i = 0; i < 90 * TICK_HZ && t.carry === 0; i++) step(s);
    expect(t.carry).toBeGreaterThan(0);
    t.hp = 0;
    run(s, 60);
    expect(s.players[0].res.gold).toBe(gold);
    expect(s.players[0].stats.traded).toBe(0);
  });

  it('goes home to another Market if its own falls, and waits with its gold when none is left', () => {
    const s = game();
    const post = postNear(s);
    const m = marketNear(s, 0, post, 20);
    const t = traderBy(s, 0, m);
    step(s, [{ t: 'route', p: 0, ids: [t.id], post: post.id }]);
    for (let i = 0; i < 90 * TICK_HZ && t.carry === 0; i++) step(s);
    const carry = t.carry;
    m.hp = 0;
    run(s, 5);
    expect(t.order.k).toBe('idle');
    expect(t.carry).toBe(carry);
    const gold = s.players[0].res.gold;
    const again = marketNear(s, 0, post, 26);
    run(s, 90, [{ t: 'work', p: 0, ids: [t.id], target: again.id }]);
    expect(s.players[0].res.gold).toBeGreaterThanOrEqual(gold + carry);
    expect(t.carry === 0 || t.order.k === 'trade').toBe(true);
  });

  it('are trained at the Market from the Bronze Age, and a rally point on a post puts them on the road', () => {
    const s = game({ startEpoch: 0 });
    const post = postNear(s);
    const m = marketNear(s, 0, post, 20);
    s.players[0].res.gold = 500;
    s.players[0].res.wood = 500;
    run(s, 1, [{ t: 'train', p: 0, building: m.id, unit: 'trader' }]);
    expect(m.queue.length).toBe(0);
    s.players[0].epoch = 1;
    s.players[0].statsVersion++;
    run(s, 1, [
      { t: 'rally', p: 0, building: m.id, x: post.x, y: post.y },
      { t: 'train', p: 0, building: m.id, unit: 'trader' },
    ]);
    expect(m.queue.length).toBe(1);
    run(s, 25);
    const t = s.ents.find((e): e is Unit => e.kind === 'unit' && e.type === 'trader' && e.owner === 0)!;
    expect(t).toBeDefined();
    expect(t.order).toMatchObject({ k: 'trade', post: post.id, market: m.id });
  });

  it('are easy prey for cavalry and never fight back', () => {
    expect(BONUS.cavalry.trader).toBeGreaterThan(2);
    const s = game();
    const p = s.players[0];
    const t = spawnUnit(s, 0, 'trader', p.startX + 10, p.startY + 10);
    const rider = spawnUnit(s, 1, 'cavalry', p.startX + 11, p.startY + 10);
    const foe = spawnUnit(s, 1, 'infantry', p.startX + 10, p.startY + 12);
    foe.stance = 'stand';
    const foeHp = foe.hp;
    const riderHp = rider.hp;
    run(s, 1, [{ t: 'attack', p: 0, ids: [t.id], target: foe.id }]);
    expect(t.order.k).not.toBe('attack');
    run(s, 30, [{ t: 'attack', p: 1, ids: [rider.id], target: t.id }]);
    expect(s.byId.has(t.id)).toBe(false);
    // The trader never struck back.
    expect(foe.hp).toBe(foeHp);
    expect(rider.hp).toBe(riderHp);
  });

  it('a match with traders on the road saves and plays on exactly the same', () => {
    const s = game();
    const post = postNear(s);
    const m = marketNear(s, 0, post, 25);
    const ts = [traderBy(s, 0, m), traderBy(s, 0, m)];
    run(s, 30, [{ t: 'route', p: 0, ids: ts.map((u) => u.id), post: post.id }]);
    const copy = deserialize(serialize(s));
    run(s, 60);
    run(copy, 60);
    expect(checksum(copy)).toBe(checksum(s));
    expect(copy.players[0].stats.traded).toBe(s.players[0].stats.traded);
  });
});

describe('the computer and trade', () => {
  it('builds a Market and keeps traders on the road for gold', () => {
    const s = createGame({ seed: 3, size: 'small', startEpoch: 2, peaceMinutes: 30, players: [{ name: 'A', ai: 'normal' }, { name: 'B', ai: 'normal' }] });
    run(s, 14 * 60);
    for (const p of s.players) {
      const traders = s.ents.filter((e) => e.kind === 'unit' && e.owner === p.id && e.type === 'trader');
      expect(traders.length, p.name).toBeGreaterThan(0);
      expect(p.stats.traded, p.name).toBeGreaterThan(0);
    }
  }, 60000);
});
