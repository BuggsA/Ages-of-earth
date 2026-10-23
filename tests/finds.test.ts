import { describe, expect, it } from 'vitest';
import { holds, roadKnown } from '../src/sim/ages';
import { FINDS, ROADS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { generateMap } from '../src/sim/mapgen';
import type { GameState } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** Finds (#588): one mark near each town, the same distance out, naming a key resource this world holds. */

const make = (seed: number, ai: boolean = false): GameState =>
  createGame({ seed, size: 'medium', startEpoch: 0, players: [{ name: 'A', ai: ai ? 'easy' : null, civ: 'romans' }, { name: 'B', ai: ai ? 'easy' : null, civ: 'britons' }] });

describe('finds (#588)', () => {
  it('stand the same distance from every town, nearer their own, and the same on every build of the seed', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const m = generateMap(seed, 'medium', 2, 'continental', true, true);
      expect(m.finds.length).toBe(2);
      const ds = m.finds.map((f) => Math.hypot(f.x - m.starts[f.near].x, f.y - m.starts[f.near].y));
      expect(Math.max(...ds) - Math.min(...ds)).toBeLessThanOrEqual(2 * FINDS.fair);
      expect(Math.abs(ds[0] - FINDS.ring.medium)).toBeLessThanOrEqual(3);
      for (const f of m.finds) {
        const own = Math.hypot(f.x - m.starts[f.near].x, f.y - m.starts[f.near].y);
        const other = Math.hypot(f.x - m.starts[1 - f.near].x, f.y - m.starts[1 - f.near].y);
        expect(own).toBeLessThan(other);
      }
      expect(generateMap(seed, 'medium', 2, 'continental', true, true).finds).toEqual(m.finds);
    }
  });

  it('only speak of what the world holds, and a world that holds nothing has stashes that say so', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const s = make(seed);
      for (const f of s.finds ?? []) expect(f.key === null ? !['bogIron', 'salt', 'saltpetre', 'bloodiron', 'ruin'].some((k) => holds(s, k as 'ruin')) : holds(s, f.key)).toBe(true);
    }
    // Seed 18 (small, continental) holds no ore and no ruins.
    const bare = generateMap(18, 'small', 2, 'continental', true, true);
    expect(bare.finds.length).toBe(2);
    expect(bare.finds.every((f) => f.kind === 'stash' && f.key === null)).toBe(true);
  });

  it('are left out of campaign maps', () => {
    expect(generateMap(3, 'medium', 2, 'continental', false, false).finds).toEqual([]);
  });

  it('go to the first people to stand on one: a reward, a lead with a mark at the nearest of the resource, once', () => {
    const s = make(3);
    const f = s.finds![0];
    expect(f.key).not.toBeNull();
    const p = s.players[f.near];
    const before = { ...p.res };
    const rival = s.players[1 - f.near];
    spawnUnit(s, p.id, 'citizen', f.x + 0.5, f.y);
    for (let i = 0; i < 10; i++) step(s);
    expect(f.by).toBe(p.id);
    for (const [r, n] of Object.entries(FINDS.kinds[f.kind].reward)) expect(p.res[r as 'gold'] - before[r as 'gold']).toBeGreaterThanOrEqual(n);
    const lead = p.leads!.find((l) => l.key === f.key)!;
    expect(lead).toBeTruthy();
    expect(lead.at).not.toBeNull();
    expect(rival.leads).toBeUndefined();
    // A rival there later takes nothing more.
    const gold = rival.res.gold;
    spawnUnit(s, rival.id, 'citizen', f.x - 0.5, f.y);
    for (let i = 0; i < 10; i++) step(s);
    expect(f.by).toBe(p.id);
    expect(rival.leads).toBeUndefined();
    expect(rival.res.gold).toBeGreaterThanOrEqual(gold);
  });

  it('a lead to bog iron reveals the iron road without a lodge, and only where the world holds it', () => {
    const s = make(3);
    const road = ROADS.find((r) => r.found)!;
    const p = s.players[0];
    expect(roadKnown(s, p, road)).toBe(false);
    p.leads = [{ key: 'bogIron', at: null }];
    s.bogIron = true;
    expect(roadKnown(s, p, road)).toBe(true);
    s.bogIron = false;
    expect(roadKnown(s, p, road)).toBe(false);
  });

  it('are walked to by the computer early', () => {
    const s = make(3, true);
    for (let i = 0; i < secs(240); i++) step(s);
    for (const f of s.finds!) expect(f.by).toBeGreaterThanOrEqual(0);
  }, 60000);
});
