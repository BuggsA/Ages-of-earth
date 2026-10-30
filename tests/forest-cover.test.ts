import { describe, expect, it } from 'vitest';
import { AI_COVER, BUILDINGS, TERRAIN, secs } from '../src/sim/data';
import { damageOf, nearestEnemyUnit } from '../src/sim/combat';
import { createGame, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { Spatial } from '../src/sim/spatial';
import { coverStep, inWoods, treesRound, woodsNear, woodsPace } from '../src/sim/terrain';
import { B_RES, R_TREE, T_GRASS, type GameState, type Unit } from '../src/sim/types';
import { canHit, placeBuilding, spawnUnit, statsOf } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';

/** The lay of the land t2 (#934): a soldier in a wood is hidden from rivals beyond a few tiles; woods slow an army, riders most. */

const game = (ai: 'normal' | null = null): GameState =>
  createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai, civ: 'romans' }, { name: 'B', ai: null, civ: 'greeks' }] });

/** A 24 × 7 strip, nobody on it, at least 20 tiles from every Town Center (outside every border), cleared to open grass. Returns its top-left tile. */
function plain(s: GameState): { x: number; y: number } {
  const tcs = s.ents.filter((e) => e.kind === 'building' && e.type === 'towncenter');
  for (let ty = 3; ty < s.h - 12; ty++) {
    for (let tx = 3; tx < s.w - 29; tx++) {
      if (tcs.some((t) => (t.x - tx - 12) * (t.x - tx - 12) + (t.y - ty - 3) * (t.y - ty - 3) < 26 * 26)) continue;
      if (s.ents.some((e) => e.x > tx - 3 && e.x < tx + 27 && e.y > ty - 3 && e.y < ty + 10)) continue;
      for (let y = ty - 2; y < ty + 9; y++) {
        for (let x = tx - 2; x < tx + 26; x++) {
          s.terrain[y * s.w + x] = T_GRASS;
          s.block[y * s.w + x] = 0;
          s.res[y * s.w + x] = 0;
        }
      }
      s.blockVersion++;
      return { x: tx, y: ty };
    }
  }
  throw new Error('no open strip');
}

/** Plants trees over columns x0..x1 of the strip, rows 0..6, leaving row 3 open: a ride through a wood. */
function wood(s: GameState, at: { x: number; y: number }, x0: number, x1: number): void {
  for (let y = at.y; y < at.y + 7; y++) {
    if (y === at.y + 3) continue;
    for (let x = at.x + x0; x <= at.x + x1; x++) {
      s.res[y * s.w + x] = R_TREE;
      s.amount[y * s.w + x] = 100;
      s.block[y * s.w + x] = B_RES;
    }
  }
  s.blockVersion++;
}

/** Reads the cover now, as a step does. */
function readCover(s: GameState): void {
  const sp = new Spatial();
  sp.rebuild(s);
  s.tick = Math.ceil(s.tick / TERRAIN.coverEvery) * TERRAIN.coverEvery;
  coverStep(s, sp);
}

describe('forest cover: who is hidden', () => {
  it('a soldier in a wood is unseen and untargeted from afar, and seen once a rival closes in', () => {
    const s = game();
    const at = plain(s);
    wood(s, at, 6, 14);
    const u = spawnUnit(s, 0, 'infantry', at.x + 10.5, at.y + 3.5);
    expect(inWoods(s, u.x, u.y)).toBe(true);
    // A rival bowman out in the open, 7 tiles off: within his reach, but he can't see into the wood.
    const b = spawnUnit(s, 1, 'ranged', at.x + 3.5, at.y + 3.5);
    readCover(s);
    expect(u.cover).toBe(true);
    expect(canHit(s, b, u)).toBe(false);
    const sp = new Spatial();
    sp.rebuild(s);
    expect(nearestEnemyUnit(s, sp, 1, b.x, b.y, 10)).toBeNull();
    // He walks up to the wood's edge, within `seen` tiles: the soldier shows.
    b.x = u.x - TERRAIN.seen + 0.5;
    readCover(s);
    expect(u.cover).toBeUndefined();
    expect(canHit(s, b, u)).toBe(true);
  });

  it('the same soldier in the open is not hidden; nor is a citizen in the wood', () => {
    const s = game();
    const at = plain(s);
    wood(s, at, 12, 20);
    const open = spawnUnit(s, 0, 'infantry', at.x + 4.5, at.y + 3.5);
    const cit = spawnUnit(s, 0, 'citizen', at.x + 16.5, at.y + 3.5);
    spawnUnit(s, 1, 'ranged', at.x + 0.5, at.y + 0.5);
    readCover(s);
    expect(treesRound(s, open.x, open.y)).toBe(0);
    expect(open.cover).toBeUndefined();
    expect(inWoods(s, cit.x, cit.y)).toBe(true);
    expect(cit.cover).toBeUndefined();
  });

  it('a rival tower sees into the wood within its sight', () => {
    const s = game();
    const at = plain(s);
    wood(s, at, 6, 14);
    const u = spawnUnit(s, 0, 'infantry', at.x + 10.5, at.y + 3.5);
    readCover(s);
    expect(u.cover).toBe(true);
    // A finished Watch Tower of the rival's, its middle 7.5 tiles off: within its sight (9 and half its footprint).
    const t = placeBuilding(s, 1, 'tower', at.x + 17, at.y + 3, true);
    expect(Math.abs(t.x - u.x)).toBeLessThan(BUILDINGS.tower.sight + t.size / 2);
    readCover(s);
    expect(u.cover).toBeUndefined();
  });

  it('a soldier shows for a while after it strikes', () => {
    const s = game();
    const at = plain(s);
    wood(s, at, 6, 14);
    const u = spawnUnit(s, 0, 'ranged', at.x + 10.5, at.y + 3.5);
    readCover(s);
    expect(u.cover).toBe(true);
    u.swing = s.tick;
    readCover(s);
    expect(u.cover).toBeUndefined();
    s.tick += secs(TERRAIN.shown);
    readCover(s);
    expect(u.cover).toBe(true);
  });

  it('nothing hides inside a rival\'s border: a people knows its own woods', () => {
    const s = game();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    // An open tile 8 to 10 tiles from the rival's Town Center, ringed with trees.
    let spot: { x: number; y: number } | null = null;
    for (let r = 8; r <= 10 && !spot; r++) {
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const x = Math.floor(home.x) + dx;
        const y = Math.floor(home.y) + dy;
        if (walkable(s, x, y) && !s.ents.some((e) => Math.abs(e.x - x - 0.5) < 3 && Math.abs(e.y - y - 0.5) < 3)) {
          spot = { x, y };
          break;
        }
      }
    }
    expect(spot).not.toBeNull();
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) s.res[(spot!.y + dy) * s.w + spot!.x + dx] = R_TREE;
    const u = spawnUnit(s, 0, 'infantry', spot!.x + 0.5, spot!.y + 0.5);
    expect(inWoods(s, u.x, u.y)).toBe(true);
    s.ents = s.ents.filter((e) => e.kind !== 'unit' || e.owner !== 1 || e === u);
    readCover(s);
    expect(u.cover).toBeUndefined();
  });
});

describe('forest cover: the going', () => {
  it('slows soldiers among the trees, riders most, and leaves workers and the open alone', () => {
    const s = game();
    const at = plain(s);
    wood(s, at, 12, 20);
    const foot = spawnUnit(s, 0, 'infantry', at.x + 16.5, at.y + 3.5);
    const ride = spawnUnit(s, 0, 'cavalry', at.x + 16.5, at.y + 3.5);
    const cit = spawnUnit(s, 0, 'citizen', at.x + 16.5, at.y + 3.5);
    const open = spawnUnit(s, 0, 'infantry', at.x + 4.5, at.y + 3.5);
    expect(woodsPace(s, foot)).toBe(TERRAIN.woodsFoot);
    expect(woodsPace(s, ride)).toBe(TERRAIN.woodsRide);
    expect(TERRAIN.woodsRide).toBeLessThan(TERRAIN.woodsFoot);
    expect(woodsPace(s, cit)).toBe(1);
    expect(woodsPace(s, open)).toBe(1);
  });

  it('a soldier walking a ride through a wood goes less far than one on open ground', () => {
    const s = game();
    const at = plain(s);
    wood(s, at, 2, 22);
    const inWood = spawnUnit(s, 0, 'infantry', at.x + 3.5, at.y + 3.5);
    const s2 = game();
    const at2 = plain(s2);
    const inOpen = spawnUnit(s2, 0, 'infantry', at2.x + 3.5, at2.y + 3.5);
    applyCommand(s, { t: 'move', p: 0, ids: [inWood.id], x: at.x + 21.5, y: at.y + 3.5 });
    applyCommand(s2, { t: 'move', p: 0, ids: [inOpen.id], x: at2.x + 21.5, y: at2.y + 3.5 });
    for (let i = 0; i < secs(4); i++) {
      step(s);
      step(s2);
    }
    const far = inWood.x - (at.x + 3.5);
    const far2 = inOpen.x - (at2.x + 3.5);
    expect(far2).toBeGreaterThan(1);
    expect(far).toBeLessThan(far2 * (TERRAIN.woodsFoot + 0.05));
  });

  it('a rider fighting from a wood strikes softer; a foot soldier does not', () => {
    const s = game();
    const at = plain(s);
    wood(s, at, 12, 20);
    const t = spawnUnit(s, 1, 'infantry', at.x + 4.5, at.y + 3.5);
    const rIn = spawnUnit(s, 0, 'cavalry', at.x + 16.5, at.y + 3.5);
    const rOut = spawnUnit(s, 0, 'cavalry', at.x + 5.5, at.y + 3.5);
    const fIn = spawnUnit(s, 0, 'infantry', at.x + 16.5, at.y + 3.5);
    const fOut = spawnUnit(s, 0, 'infantry', at.x + 5.5, at.y + 3.5);
    const hit = (u: Unit) => damageOf(s, u, statsOf(s, u), t, false);
    expect(hit(rIn)).toBeLessThan(hit(rOut));
    expect(hit(fIn)).toBe(hit(fOut));
  });
});

describe('forest cover: the computer', () => {
  it('finds the nearest wood to lie in, and none on open ground', () => {
    const s = game();
    const at = plain(s);
    expect(woodsNear(s, at.x + 4.5, at.y + 3.5, AI_COVER.reach)).toBeNull();
    wood(s, at, 7, 12);
    const w = woodsNear(s, at.x + 4.5, at.y + 3.5, AI_COVER.reach)!;
    expect(w).not.toBeNull();
    expect(inWoods(s, w.x, w.y)).toBe(true);
    expect(walkable(s, Math.floor(w.x), Math.floor(w.y))).toBe(true);
  });

  it('musters its army in a wood near home, where its soldiers lie hidden', () => {
    const s = game('normal');
    for (let i = 0; i < secs(60) && !s.ai[0]?.muster; i++) step(s);
    const m0 = s.ai[0].muster!;
    expect(m0).toBeTruthy();
    // A grove beside the muster, open ground among its trees, away from the town.
    const cx = Math.floor(m0.x) + 2;
    const cy = Math.floor(m0.y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const i = (cy + dy) * s.w + cx + dx;
      if (s.block[i] === 0 && !s.bldAt[i]) {
        s.res[i] = R_TREE;
        s.amount[i] = 100;
        s.block[i] = B_RES;
      }
    }
    s.blockVersion++;
    s.ai[0].muster = null;
    for (let i = 0; i < secs(60) && !s.ai[0]?.muster; i++) step(s);
    const m = s.ai[0].muster!;
    expect(m).toBeTruthy();
    expect(inWoods(s, m.x, m.y)).toBe(true);
  });
});
