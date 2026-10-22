import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { ORE_POST, ORE_TRADE, ROADS, secs } from '../src/sim/data';
import { deedsDone } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { loadPrice } from '../src/sim/oretrade';
import type { GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Posts that sell what the map lacks (#573): a trader buys key ore at the post and carries it home. */

// Seed 9 (medium) holds blood-iron but no salt and no saltpetre; seed 4 holds all three.
const make = (seed = 9): GameState => {
  const s = createGame({ seed, size: 'medium', startEpoch: 1, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  // No wolves on the road: these trips are about the trade.
  for (const a of s.animals) if (a.kind === 'wolf' || a.kind === 'boar' || a.kind === 'raider') a.hp = 0;
  return s;
};
const run = (s: GameState, sec: number, until?: () => boolean) => { for (let i = 0; i < secs(sec) && !until?.(); i++) step(s); };

/** A Market at player 0's home and a trader beside the post that sells salt. */
function buyer(s: GameState) {
  const p = s.players[0];
  const post = s.posts.find((t) => t.sells?.includes('salt'))!;
  const spot = findSpot(s, 'market', post.x, post.y, 6, 20)!;
  const market = placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
  const u = spawnUnit(s, 0, 'trader', post.x + 1.5, post.y + 1.5);
  p.res.gold = 500;
  return { p, post, market, u };
}

describe('posts that sell what the map lacks (#573)', () => {
  it('a world without a road\'s ore sells it at a post; a world with every ore sells none', () => {
    expect(make(9).posts.some((t) => t.sells?.includes('salt'))).toBe(true);
    // Saltpetre opens no road, and its technology stays where the world holds it: no post sells it.
    expect(make(9).posts.some((t) => t.sells?.includes('saltpetre'))).toBe(false);
    expect(make(9).posts.some((t) => t.sells?.includes('bloodiron'))).toBe(false);
    expect(make(4).posts.every((t) => !t.sells)).toBe(true);
  });

  it('a load costs more than the Market pays for it, and dearer with every load bought', () => {
    const s = make();
    const first = loadPrice(s, 'salt');
    expect(first / ORE_POST.lot).toBeGreaterThan(ORE_TRADE.gold.salt / ORE_TRADE.lot);
    s.oreSold = { salt: 3 };
    expect(loadPrice(s, 'salt')).toBeGreaterThan(first);
  });

  it('a trader told to buy pays at the post, carries it home and banks it toward the ore doors', () => {
    const s = make();
    const { p, post, u } = buyer(s);
    const price = loadPrice(s, 'salt');
    applyCommand(s, { t: 'route', p: 0, ids: [u.id], post: post.id, buy: 'salt' });
    run(s, 10, () => !!u.ore);
    expect(u.ore).toEqual({ id: 'salt', n: ORE_POST.lot, from: 0 });
    expect(p.res.gold).toBe(500 - price);
    expect(s.oreSold?.salt).toBe(1);
    run(s, 120, () => (p.stats.mined?.salt ?? 0) > 0);
    expect(p.stats.mined?.salt).toBe(ORE_POST.lot);
    expect(p.rare?.salt).toBe(ORE_POST.lot);
    expect(p.stats.bought).toBeGreaterThanOrEqual(ORE_POST.lot);
  });

  it('a felled trader drops the ore it bought, for anyone to carry off', () => {
    const s = make();
    const { post, u } = buyer(s);
    applyCommand(s, { t: 'route', p: 0, ids: [u.id], post: post.id, buy: 'salt' });
    run(s, 10, () => !!u.ore);
    u.hp = 0;
    step(s);
    expect(s.caches).toEqual([expect.objectContaining({ ore: 'salt', n: ORE_POST.lot, from: 0 })]);
  });

  it('refuses a post that does not sell it, and a buyer short of gold', () => {
    const s = make();
    const { p, post, u } = buyer(s);
    const other = s.posts.find((t) => !t.sells?.includes('salt'));
    if (other) {
      applyCommand(s, { t: 'route', p: 0, ids: [u.id], post: other.id, buy: 'salt' });
      expect(s.events.some((e) => e.k === 'refused' && /sells no salt/.test(e.why))).toBe(true);
    }
    p.res.gold = 0;
    applyCommand(s, { t: 'route', p: 0, ids: [u.id], post: post.id, buy: 'salt' });
    let refused = false;
    for (let i = 0; i < secs(10) && !refused; i++) {
      step(s);
      refused = s.events.some((e) => e.k === 'refused' && /Not enough gold/.test(e.why));
    }
    expect(refused).toBe(true);
    expect(u.ore).toBeUndefined();
    expect((u as Unit).order.k).toBe('idle');
  });

  it('bought ore opens the road\'s ore door in a world that lacks the ore', () => {
    const s = make();
    const p = s.players[0];
    const r = ROADS.find((x) => x.to === 'merchant' && x.ore)!;
    expect(deedsDone(p, r, s)).toBe(false);
    const { post, u } = buyer(s);
    p.res.gold = 9000;
    applyCommand(s, { t: 'route', p: 0, ids: [u.id], post: post.id, buy: 'salt' });
    run(s, 900, () => (p.stats.mined?.salt ?? 0) >= r.ore!.n);
    expect(deedsDone(p, r, s)).toBe(true);
  });
});

describe('the computer buys what its road needs (#573)', () => {
  it('bound for the merchants on a world without salt, it keeps a trader buying salt at the post', () => {
    // Seed 9 (medium) holds no salt.
    const s = createGame({ seed: 9, size: 'medium', startEpoch: 1, players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'britons' }] });
    s.peaceUntil = 1e9;
    expect(s.rares).not.toContain('salt');
    const p = s.players[0];
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { merchant: true } };
    const spot = findSpot(s, 'market', p.startX, p.startY, 6, 24)!;
    placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
    for (let i = 0; i < 20; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    for (let i = 0; i < 2; i++) spawnUnit(s, 0, 'trader', p.startX + 4 + i, p.startY - 4);
    p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    const buying = () => s.ents.some((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'trader' && e.order.k === 'trade' && e.order.buy === 'salt');
    run(s, 30, buying);
    expect(buying()).toBe(true);
    run(s, 300, () => (p.stats.bought ?? 0) > 0);
    expect(p.stats.bought).toBeGreaterThan(0);
  });
});
