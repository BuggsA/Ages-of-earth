import { describe, expect, it } from 'vitest';
import { AI_RIDGE, TERRAIN, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { climbPace, heightReach, heightSight, ridgeNear, standAt } from '../src/sim/terrain';
import { T_GRASS, type GameState, type Unit } from '../src/sim/types';
import { sees, updateVision } from '../src/sim/vision';
import { spawnUnit, statsOf } from '../src/sim/world';

/** The lay of the land t1 (#925): shooting down reaches further, shooting up falls short, a rise sees further, climbing is slow. */

const LOW = 0.2;
const game = (ai: 'normal' | null = null): GameState =>
  createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai, civ: 'romans' }, { name: 'B', ai: null, civ: 'greeks' }] });

/** A 20 × 7 strip, nobody on it, its middle at least 18 tiles from every Town Center, cleared to open grass and flattened to `LOW`. Returns its top-left tile. */
function plain(s: GameState): { x: number; y: number } {
  const tcs = s.ents.filter((e) => e.kind === 'building' && e.type === 'towncenter');
  for (let ty = 3; ty < s.h - 12; ty++) {
    for (let tx = 3; tx < s.w - 25; tx++) {
      if (tcs.some((t) => (t.x - tx - 10) * (t.x - tx - 10) + (t.y - ty - 3) * (t.y - ty - 3) < 18 * 18)) continue;
      if (s.ents.some((e) => e.x > tx - 3 && e.x < tx + 23 && e.y > ty - 3 && e.y < ty + 10)) continue;
      for (let y = ty - 2; y < ty + 9; y++) {
        for (let x = tx - 2; x < tx + 22; x++) {
          s.terrain[y * s.w + x] = T_GRASS;
          s.block[y * s.w + x] = 0;
        }
      }
      s.blockVersion++;
      shape(s, tx - 8, ty - 8, tx + 28, ty + 15, () => LOW);
      return { x: tx, y: ty };
    }
  }
  throw new Error('no open strip');
}

/** Sets the corner heights in a box by a function of the corner. */
function shape(s: GameState, x0: number, y0: number, x1: number, y1: number, f: (x: number, y: number) => number): void {
  const W = s.w + 1;
  for (let y = Math.max(0, y0); y <= Math.min(s.h, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(s.w, x1); x++) s.height[y * W + x] = f(x, y);
}

/** A flat-topped mound `h` high, its top `r` tiles round (cx, cy). */
function mound(s: GameState, cx: number, cy: number, r: number, h: number): void {
  shape(s, Math.floor(cx - r - 1), Math.floor(cy - r - 1), Math.ceil(cx + r + 1), Math.ceil(cy + r + 1), (x, y) =>
    (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r ? h : LOW);
}

/** An archer of A's and a spearman of B's, their edges `gap` apart along the strip. */
function duel(s: GameState, at: { x: number; y: number }, gap: number): { a: Unit; t: Unit } {
  const a = spawnUnit(s, 0, 'ranged', at.x + 2.5, at.y + 3.5);
  const t = spawnUnit(s, 1, 'infantry', 0, 0);
  t.x = a.x + gap + statsOf(s, a).radius + statsOf(s, t).radius;
  t.y = a.y;
  t.stance = 'stand';
  return { a, t };
}

const shotBy = (s: GameState, u: Unit): boolean => s.shots.some((x) => x.src === u.id);

describe('high ground: reach', () => {
  it('reaches further shooting down and falls short shooting up, nothing on the level', () => {
    const s = game();
    const at = plain(s);
    const x = at.x + 2.5;
    const y = at.y + 3.5;
    expect(heightReach(s, x, y, x + 6, y)).toBe(0);
    mound(s, x, y, 1.5, LOW + 1);
    expect(heightReach(s, x, y, x + 6, y)).toBeCloseTo((1 - TERRAIN.rise) * TERRAIN.reachPer);
    expect(heightReach(s, x + 6, y, x, y)).toBe(-TERRAIN.reachDown);
    mound(s, x, y, 1.5, LOW + 3);
    expect(heightReach(s, x, y, x + 6, y)).toBe(TERRAIN.reachUp);
    // A ship's guns stand at the sea's face, not on its bed.
    expect(standAt(s, x, y)).toBeGreaterThanOrEqual(TERRAIN.sea);
  });

  it('lets an archer on a mound shoot a soldier below past its reach on the level', () => {
    for (const hill of [false, true]) {
      const s = game();
      const at = plain(s);
      const { a, t } = duel(s, at, 0);
      t.x += statsOf(s, a).range + 1;
      if (hill) mound(s, a.x, a.y, 1.5, LOW + 1.3);
      const x0 = a.x;
      a.order = { k: 'attack', target: t.id, auto: false, then: null };
      step(s);
      expect(shotBy(s, a)).toBe(hill);
      if (hill) expect(a.x).toBe(x0);
    }
  });

  it('keeps an archer below from reaching a soldier on a mound at its reach on the level', () => {
    for (const hill of [false, true]) {
      const s = game();
      const at = plain(s);
      const { a, t } = duel(s, at, 0);
      t.x += statsOf(s, a).range - 0.4;
      if (hill) mound(s, t.x, t.y, 1.5, LOW + 1.3);
      a.order = { k: 'attack', target: t.id, auto: false, then: null };
      step(s);
      expect(shotBy(s, a)).toBe(!hill);
    }
  });

  it('has an archer standing its ground on a rise take a target only the height brings into reach', () => {
    for (const hill of [false, true]) {
      const s = game();
      const at = plain(s);
      const { a, t } = duel(s, at, 0);
      t.x += statsOf(s, a).range + 1;
      a.stance = 'stand';
      if (hill) mound(s, a.x, a.y, 1.5, LOW + 1.3);
      const x0 = a.x;
      for (let i = 0; i < 20; i++) step(s);
      expect(a.order.k === 'attack').toBe(hill);
      expect(a.x).toBeCloseTo(x0, 5);
    }
  });
});

describe('high ground: sight', () => {
  it('sees further from the top of a rise, and no further on the level', () => {
    for (const hill of [false, true]) {
      const s = game();
      const at = plain(s);
      const u = spawnUnit(s, 0, 'cavalry', at.x + 10.5, at.y + 3.5);
      const r = statsOf(s, u).sight;
      if (hill) mound(s, u.x, u.y, 1, LOW + 1);
      expect(heightSight(s, u.x, u.y) > 0).toBe(hill);
      updateVision(s);
      expect(sees(s, 0, u.x + r + 1.5, u.y)).toBe(hill);
      expect(sees(s, 0, u.x + r - 0.5, u.y)).toBe(true);
    }
  });

  it('never sees more than `sightMax` further, however tall the crag', () => {
    const s = game();
    const at = plain(s);
    mound(s, at.x + 10.5, at.y + 3.5, 1, LOW + 9);
    expect(heightSight(s, at.x + 10.5, at.y + 3.5)).toBe(TERRAIN.sightMax);
  });
});

describe('high ground: climbing', () => {
  it('is slower uphill, as fast on the level and downhill', () => {
    const s = game();
    const at = plain(s);
    const u = spawnUnit(s, 0, 'infantry', at.x + 2.5, at.y + 3.5);
    expect(climbPace(s, u, u.x + 5, u.y)).toBe(1);
    shape(s, at.x - 8, at.y - 8, at.x + 28, at.y + 15, (x) => LOW + Math.max(0, x - at.x) * 0.3);
    const up = climbPace(s, u, u.x + 5, u.y);
    expect(up).toBeLessThan(0.8);
    expect(up).toBeGreaterThanOrEqual(TERRAIN.climbMin);
    expect(climbPace(s, u, u.x - 5, u.y)).toBe(1);
  });

  it('holds a soldier back walking up a slope, but not a citizen at her work', () => {
    const went: Record<string, number[]> = { flat: [], slope: [] };
    for (const ground of ['flat', 'slope'] as const) {
      const s = game();
      const at = plain(s);
      if (ground === 'slope') shape(s, at.x - 8, at.y - 8, at.x + 28, at.y + 15, (x) => LOW + Math.max(0, x - at.x) * 0.3);
      for (const type of ['infantry', 'citizen'] as const) {
        const u = spawnUnit(s, 0, type, at.x + 1.5, at.y + (type === 'citizen' ? 1.5 : 5.5));
        u.order = { k: 'move', x: at.x + 18.5, y: u.y, amove: false, started: false };
      }
      for (let i = 0; i < secs(3); i++) step(s);
      for (const type of ['infantry', 'citizen']) {
        const u = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === type && e.x > at.x && e.x < at.x + 20 && e.y > at.y && e.y < at.y + 7)!;
        went[ground].push(u.x - (at.x + 1.5));
      }
    }
    expect(went.slope[0]).toBeLessThan(went.flat[0] * 0.85);
    expect(went.slope[1]).toBeCloseTo(went.flat[1], 1);
  });
});

describe('high ground: the computer', () => {
  it('finds the highest open ground near a point, and nothing on the level', () => {
    const s = game();
    const at = plain(s);
    const x = at.x + 10.5;
    const y = at.y + 3.5;
    expect(ridgeNear(s, x, y, AI_RIDGE.reach, AI_RIDGE.gain)).toBeNull();
    mound(s, x + 3, y, 1, LOW + 1);
    const r = ridgeNear(s, x, y, AI_RIDGE.reach, AI_RIDGE.gain)!;
    expect(r).not.toBeNull();
    expect(standAt(s, r.x, r.y)).toBeGreaterThan(LOW + 0.9);
  });

  it('musters its army on a rise near home', () => {
    const s = game('normal');
    const p = s.players[0];
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    // Wait for the first muster, to know where it would stand on the level.
    for (let i = 0; i < secs(60) && !s.ai[0]?.muster; i++) step(s);
    const m0 = s.ai[0].muster!;
    expect(m0).toBeTruthy();
    // A mound beside it, on open ground away from the town: the next muster moves onto it.
    let top: { x: number; y: number } | null = null;
    for (let k = 1; k <= AI_RIDGE.reach - 1 && !top; k++) {
      for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) {
        const tx = Math.floor(m0.x) + dx;
        const ty = Math.floor(m0.y) + dy;
        if (walkable(s, tx, ty) && (tx + 0.5 - home.x) ** 2 + (ty + 0.5 - home.y) ** 2 > 16) {
          top = { x: tx + 0.5, y: ty + 0.5 };
          break;
        }
      }
    }
    expect(top).not.toBeNull();
    const base = standAt(s, top!.x, top!.y);
    const W = s.w + 1;
    const tx = Math.floor(top!.x);
    const ty = Math.floor(top!.y);
    for (const [cx, cy] of [[tx, ty], [tx + 1, ty], [tx, ty + 1], [tx + 1, ty + 1]]) s.height[cy * W + cx] = Math.max(base, standAt(s, m0.x, m0.y)) + 2;
    s.ai[0].muster = null;
    for (let i = 0; i < secs(60) && !s.ai[0]?.muster; i++) step(s);
    const m = s.ai[0].muster!;
    expect(m).toBeTruthy();
    expect(standAt(s, m.x, m.y)).toBeGreaterThan(standAt(s, m0.x, m0.y) + AI_RIDGE.gain);
    expect(p.defeated).toBeFalsy();
  });
});
