import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import type { GameState } from '../src/sim/types';
import { sees, seesRect, updateVision } from '../src/sim/vision';
import { placeBuilding, spawnUnit, statsOf } from '../src/sim/world';

/** A map with nobody on it, so each test places exactly the eyes it means to. */
function empty(teams: number[] = [0, 1]): GameState {
  const s = createGame({
    seed: 3,
    size: 'small',
    players: teams.map((team, i) => ({ name: `P${i}`, ai: null, civ: 'romans', team })),
  });
  s.ents = [];
  for (const p of s.players) {
    p.vis.fill(0);
    p.seen.fill(0);
  }
  return s;
}

describe('fog of war', () => {
  it('shows a unit what lies within its sight, and nothing past it', () => {
    const s = empty();
    const u = spawnUnit(s, 0, 'citizen', 30.5, 30.5);
    const r = statsOf(s, u).sight;
    updateVision(s);
    expect(sees(s, 0, 30.5, 30.5)).toBe(true);
    expect(sees(s, 0, 30.5 + r - 0.5, 30.5)).toBe(true);
    expect(sees(s, 0, 30.5 + r + 1.5, 30.5)).toBe(false);
    expect(sees(s, 0, 30.5 + r, 30.5 + r)).toBe(false); // the corner of its square lies outside the disc
    expect(sees(s, 1, 30.5, 30.5)).toBe(false);
  });

  it('forgets what it no longer sees but remembers having seen it', () => {
    const s = empty();
    const u = spawnUnit(s, 0, 'citizen', 20.5, 20.5);
    updateVision(s);
    u.x = 50.5;
    u.y = 50.5;
    updateVision(s);
    const i = 20 * s.w + 20;
    expect(s.players[0].vis[i]).toBe(0);
    expect(s.players[0].seen[i]).toBe(1);
    expect(sees(s, 0, 50.5, 50.5)).toBe(true);
  });

  it('gives the dead no eyes', () => {
    const s = empty();
    const u = spawnUnit(s, 0, 'citizen', 20.5, 20.5);
    u.hp = 0;
    updateVision(s);
    expect(s.players[0].vis.some((v) => v === 1)).toBe(false);
  });

  it('lets allies share what they see, and keeps it from rivals', () => {
    const s = empty([0, 0, 1]);
    spawnUnit(s, 0, 'citizen', 15.5, 15.5);
    spawnUnit(s, 1, 'citizen', 45.5, 45.5);
    updateVision(s);
    for (const p of [0, 1]) {
      expect(sees(s, p, 15.5, 15.5)).toBe(true);
      expect(sees(s, p, 45.5, 45.5)).toBe(true);
    }
    expect(sees(s, 2, 15.5, 15.5)).toBe(false);
    expect(sees(s, 2, 45.5, 45.5)).toBe(false);
    expect(s.players[2].seen.some((v) => v === 1)).toBe(false);
  });

  it('lets a finished building see further than a building site', () => {
    const s = empty();
    const site = placeBuilding(s, 0, 'house', 20, 20, false);
    updateVision(s);
    const siteTiles = s.players[0].vis.reduce((n, v) => n + v, 0);
    site.built = true;
    updateVision(s);
    const builtTiles = s.players[0].vis.reduce((n, v) => n + v, 0);
    expect(siteTiles).toBeGreaterThan(0);
    expect(builtTiles).toBeGreaterThan(siteTiles);
  });

  it('answers off-map questions with no, and sees a footprint if any of its tiles is seen', () => {
    const s = empty();
    spawnUnit(s, 0, 'citizen', 0.5, 0.5);
    updateVision(s);
    expect(sees(s, 0, -1, 0)).toBe(false);
    expect(sees(s, 0, 0, s.h + 3)).toBe(false);
    expect(seesRect(s, 0, -2, -2, 3)).toBe(true);
    expect(seesRect(s, 0, 40, 40, 4)).toBe(false);
    expect(seesRect(s, 1, -2, -2, 3)).toBe(false);
  });
});
