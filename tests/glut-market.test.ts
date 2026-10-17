import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { TICK_HZ, TRADE } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { glutNow, floodPost, tripGold } from '../src/sim/trade';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** A post's market floods with every load and heals with time (#493). */
const make = () => {
  const s = createGame({ seed: 3, size: 'medium', startEpoch: 1, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  return s;
};

describe('a glutted post', () => {
  it('starts fresh, floods per load up to the cap, and heals with time', () => {
    const s = make();
    const post = s.posts[0];
    expect(glutNow(s, post)).toBe(0);
    floodPost(s, post);
    expect(glutNow(s, post)).toBeCloseTo(TRADE.glut.each, 6);
    for (let i = 0; i < 20; i++) floodPost(s, post);
    expect(glutNow(s, post)).toBe(TRADE.glut.max);
    s.tick += TICK_HZ * 100;
    expect(glutNow(s, post)).toBeCloseTo(TRADE.glut.max - TRADE.glut.heal * 100, 6);
    s.tick += TICK_HZ * 1000;
    expect(glutNow(s, post)).toBe(0);
  });

  it('cuts what a trip pays, only at the flooded post', () => {
    const s = make();
    const p = s.players[0];
    const spot = findSpot(s, 'market', p.startX, p.startY, 6, 24)!;
    const m = placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
    const [a, b] = s.posts;
    const fresh = tripGold(s, 0, m, a);
    floodPost(s, a);
    expect(tripGold(s, 0, m, a)).toBeLessThan(fresh);
    const other = tripGold(s, 0, m, b);
    floodPost(s, a);
    expect(tripGold(s, 0, m, b)).toBe(other);
  });

  it('a trader loading at the post floods it, and the next load pays less', () => {
    const s = make();
    const p = s.players[0];
    const spot = findSpot(s, 'market', p.startX, p.startY, 6, 24)!;
    const m = placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
    const post = s.posts[0];
    const load = () => {
      const u = spawnUnit(s, 0, 'trader', post.x, post.y);
      u.order = { k: 'trade', post: post.id, market: m.id, phase: 'go' };
      step(s);
      const paid = u.carry;
      step(s);
      return paid;
    };
    const first = load();
    expect(first).toBeGreaterThan(0);
    expect(glutNow(s, post)).toBeGreaterThan(0);
    expect(load()).toBeLessThan(first);
  });
});
