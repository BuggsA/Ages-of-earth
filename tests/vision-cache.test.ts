import { describe, expect, it } from 'vitest';
import { TERRAIN } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { heightSight } from '../src/sim/terrain';
import { sees, updateVision } from '../src/sim/vision';
import { spawnUnit, statsOf } from '../src/sim/world';

/**
 * Sight from high ground (#925) is not a whole number of half tiles, so the fog's discs are drawn from the radius taken to the
 * nearest half tile, never from whichever radius asked first: else a match plays out differently after another in the same
 * process (or on another machine online). Its own file, so the disc cache starts empty.
 */
describe('the fog after high ground', () => {
  it('draws a sight of 8.22 tiles as 8, even when it is the first to ask', () => {
    const s = createGame({ seed: 3, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    // A spot 25 tiles from anything, on level ground, its corner raised so the bowman on it sees 1.22 tiles further.
    let at: { x: number; y: number } | null = null;
    for (let y = 12; y < s.h - 12 && !at; y++) for (let x = 12; x < s.w - 12 && !at; x++) if (s.ents.every((e) => Math.abs(e.x - x) > 25 || Math.abs(e.y - y) > 25)) at = { x, y };
    expect(at).not.toBeNull();
    const { x, y } = at!;
    const W = s.w + 1;
    for (let cy = y - 10; cy <= y + 10; cy++) for (let cx = x - 10; cx <= x + 10; cx++) s.height[cy * W + cx] = 0.2;
    const u = spawnUnit(s, 0, 'ranged', x, y);
    const base = statsOf(s, u).sight;
    const bonus = 8.22 - base;
    s.height[y * W + x] = 0.2 + TERRAIN.sightFrom + bonus / TERRAIN.sightPer;
    expect(heightSight(s, x, y)).toBeCloseTo(bonus, 5);
    for (const p of s.players) p.vis.fill(0);
    updateVision(s);
    expect(sees(s, 0, x + 7.5, y + 0.5)).toBe(true);
    // 8 tiles over and 1 down lies within 8.22 but outside 8.
    expect(sees(s, 0, x + 8.5, y + 1.5)).toBe(false);
  });
});
