import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { TICK_HZ, TRADE } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { NAVAL, walkable } from '../src/sim/grid';
import { portSpot, tripGold } from '../src/sim/trade';
import type { Building, Command, GameState, TradePost, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

const game = (seed: number): GameState =>
  createGame({
    seed,
    size: 'small',
    mapType: 'lakes',
    startEpoch: 2,
    players: [
      { name: 'A', ai: null, civ: 'romans' },
      { name: 'B', ai: null, civ: 'romans' },
    ],
  });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** A world with a port post, a finished Dock of player 0's on the water far from it, and a merchant ship at that Dock. */
function harbor(): { s: GameState; post: TradePost; dock: Building; cog: Unit } {
  for (let seed = 1; seed < 40; seed++) {
    const s = game(seed);
    const post = s.posts.find((p) => portSpot(s, p));
    if (!post) continue;
    // Water joined to the port, then a Dock on a shore of it at least 8 tiles from the post.
    const at = portSpot(s, post)!;
    const seen = new Set<number>([Math.floor(at.y) * s.w + Math.floor(at.x)]);
    const queue = [...seen];
    for (let q = 0; q < queue.length; q++) {
      const x = queue[q] % s.w;
      const y = (queue[q] - x) / s.w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const ni = ny * s.w + nx;
        if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h || seen.has(ni) || !walkable(s, nx, ny, NAVAL)) continue;
        seen.add(ni);
        queue.push(ni);
      }
    }
    let best: { tx: number; ty: number } | null = null;
    let bestD = 0;
    for (const i of queue) {
      const x = i % s.w;
      const y = (i - x) / s.w;
      const d = (x - post.x) ** 2 + (y - post.y) ** 2;
      if (d < 64 || d <= bestD) continue;
      const spot = findSpot(s, 'dock', x, y, 0, 4, 0);
      if (spot) {
        best = spot;
        bestD = d;
      }
    }
    if (!best) continue;
    const dock = placeBuilding(s, 0, 'dock', best.tx, best.ty, true);
    const cog = spawnUnit(s, 0, 'cog', dock.x, dock.y);
    return { s, post, dock, cog };
  }
  throw new Error('no world with a port post and a far Dock');
}

describe('trade by sea', () => {
  it('a port is a post with water near it, and a sea trip pays a fifth over the land road', () => {
    const { s, post, dock } = harbor();
    expect(portSpot(s, post)).not.toBeNull();
    const land = tripGold(s, 0, dock, post);
    const sea = tripGold(s, 0, dock, post, true);
    expect(sea).toBeGreaterThanOrEqual(land);
    expect(sea).toBeLessThanOrEqual(Math.max(land + 1, Math.ceil(land * TRADE.sea.mul) + 1));
  });

  it('a merchant ship sails to the port and brings gold home to its Dock', () => {
    const { s, post, dock, cog } = harbor();
    const before = s.players[0].res.gold;
    run(s, 1, [{ t: 'route', p: 0, ids: [cog.id], post: post.id }]);
    expect(cog.order.k).toBe('trade');
    let loaded = false;
    for (let i = 0; i < 240 * TICK_HZ && s.players[0].res.gold === before; i++) {
      step(s);
      if (cog.carry > 0) loaded = true;
    }
    expect(loaded).toBe(true);
    expect(s.players[0].res.gold).toBeGreaterThan(before);
    expect(s.players[0].stats.traded).toBeGreaterThan(0);
    expect(dock.hp).toBeGreaterThan(0);
  });

  it('refuses an inland post', () => {
    const { s, cog } = harbor();
    const inland = s.posts.find((p) => !portSpot(s, p));
    if (inland) {
      run(s, 1, [{ t: 'route', p: 0, ids: [cog.id], post: inland.id }]);
      expect(cog.order.k).not.toBe('trade');
    }
  });
});

describe('ports on the Inland Sea', () => {
  it('stands every trading post on a shore a ship can reach', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const size of ['small', 'medium'] as const) {
        const s = createGame({
          seed,
          size,
          mapType: 'sea',
          startEpoch: 2,
          players: [
            { name: 'A', ai: null, civ: 'romans' },
            { name: 'B', ai: null, civ: 'romans' },
          ],
        });
        expect(s.posts.length).toBeGreaterThan(0);
        for (const p of s.posts) expect(portSpot(s, p)).not.toBeNull();
      }
    }
  });
});
