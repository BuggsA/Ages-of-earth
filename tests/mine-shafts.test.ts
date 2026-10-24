import { describe, expect, it } from 'vitest';
import { BUILDINGS, SHAFT } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { clearResource, placeProblem } from '../src/sim/grid';
import { groundAt, seamOf, seamsAt } from '../src/sim/shafts';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { R_GOLD, R_NONE, R_SALT, R_STONE, T_ROCK } from '../src/sim/types';
import type { Building, CivId, GameState, Unit } from '../src/sim/types';

/** Mine Shafts (#681): stone and gold dug for good, best over old workings, fair by rock, poor on open ground. */

const game = (seed = 3, civ: CivId = 'greeks'): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ }, { name: 'B', ai: null }] });

/** A free 2×2 site, nearest player 0's start first, that passes `ok`. */
function site(s: GameState, ok: (tx: number, ty: number) => boolean = () => true): { tx: number; ty: number } {
  const p = s.players[0];
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ty = 2; ty < s.h - 3; ty++) {
    for (let tx = 2; tx < s.w - 3; tx++) {
      const d = (tx - p.startX) * (tx - p.startX) + (ty - p.startY) * (ty - p.startY);
      if (d >= bestD || d < 36 || placeProblem(s, 'shaft', tx, ty, true, 0) || !ok(tx, ty)) continue;
      bestD = d;
      best = { tx, ty };
    }
  }
  if (!best) throw new Error('no site');
  return best;
}

/** Whether any tile within `SHAFT.near` of a 2×2 site at (tx, ty) passes `f`. */
function near(s: GameState, tx: number, ty: number, f: (i: number) => boolean): boolean {
  for (let y = ty - SHAFT.near; y < ty + 2 + SHAFT.near; y++) for (let x = tx - SHAFT.near; x < tx + 2 + SHAFT.near; x++) if (x >= 0 && y >= 0 && x < s.w && y < s.h && f(y * s.w + x)) return true;
  return false;
}

const plain = (s: GameState) => (tx: number, ty: number) => !near(s, tx, ty, (i) => s.terrain[i] === T_ROCK || s.res[i] === R_STONE || s.res[i] === R_GOLD);

/** A finished shaft and a citizen beside it, working it; a Storehouse at its side so the haul is short. */
function dig(s: GameState, at: { tx: number; ty: number }): { b: Building; u: Unit } {
  const b = placeBuilding(s, 0, 'shaft', at.tx, at.ty, true);
  const u = spawnUnit(s, 0, 'citizen', at.tx + 2.6, at.ty + 1);
  const drop = [[at.tx + 3, at.ty], [at.tx - 3, at.ty], [at.tx, at.ty + 3], [at.tx, at.ty - 3]].find(([x, y]) => !placeProblem(s, 'storehouse', x, y, true, 0));
  if (drop) placeBuilding(s, 0, 'storehouse', drop[0], drop[1], true);
  applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
  return { b, u };
}

const run = (s: GameState, secs: number) => {
  for (let i = 0; i < secs * 20; i++) step(s);
};

describe('Mine Shafts (#681)', () => {
  it('is a Bronze Age economy building with a key of its own', () => {
    const b = BUILDINGS.shaft;
    expect(b.epoch).toBe(1);
    expect(b.menu).toBe('eco');
    const keys = Object.entries(BUILDINGS).filter(([t, d]) => d.menu === 'eco' && t !== 'shaft').map(([, d]) => d.key);
    expect(keys).not.toContain(b.key);
  });

  it('reads its ground: open earth, rock beside it, or old workings', () => {
    const s = game();
    const open = site(s, plain(s));
    expect(groundAt(s, { ...open, size: 2 })).toMatchObject({ stone: 'open', gold: 'open', salt: null });
    const hill = site(s, (tx, ty) => near(s, tx, ty, (i) => s.terrain[i] === T_ROCK));
    expect(groundAt(s, { ...hill, size: 2 })).toMatchObject({ stone: 'hill', gold: 'hill' });
    // Work a gold tile out beside an open site: its ground is now old workings, for gold only.
    const i = (open.ty - 1) * s.w + open.tx;
    s.res[i] = R_GOLD;
    s.amount[i] = 1;
    clearResource(s, i);
    expect(s.res[i]).toBe(R_NONE);
    expect(groundAt(s, { ...open, size: 2 })).toMatchObject({ stone: 'open', gold: 'old' });
    // A rare ore is dug only over its own old workings.
    expect(seamsAt(s, { ...open, size: 2, owner: 0 })).toEqual(['stone', 'gold']);
    s.res[i + 1] = R_SALT;
    s.amount[i + 1] = 1;
    clearResource(s, i + 1);
    expect(seamsAt(s, { ...open, size: 2, owner: 0 })).toEqual(['stone', 'gold', 'salt']);
  });

  it('a miner digs gold for good, slower than an open deposit, and old workings dig faster than open ground', () => {
    const s = game();
    const a = site(s, plain(s));
    const { b, u } = dig(s, a);
    expect(seamOf(s, b)).toBe('gold');
    const gold0 = s.players[0].res.gold;
    run(s, 240);
    expect(u.order.k).toBe('shaft');
    const open = s.players[0].res.gold - gold0;
    expect(open).toBeGreaterThan(10);
    // Same again, on a fresh map, with old gold workings by the site.
    const s2 = game();
    const i = (a.ty - 1) * s2.w + a.tx;
    s2.res[i] = R_GOLD;
    s2.amount[i] = 1;
    clearResource(s2, i);
    dig(s2, a);
    const g0 = s2.players[0].res.gold;
    run(s2, 240);
    const old = s2.players[0].res.gold - g0;
    expect(old).toBeGreaterThan(open * 1.6);
  });

  it('switches seam on command, and refuses a seam its ground does not hold', () => {
    const s = game();
    const { b } = dig(s, site(s, plain(s)));
    applyCommand(s, { t: 'seam', p: 0, building: b.id, seam: 'stone' });
    expect(seamOf(s, b)).toBe('stone');
    const stone0 = s.players[0].res.stone;
    run(s, 240);
    expect(s.players[0].res.stone - stone0).toBeGreaterThan(10);
    applyCommand(s, { t: 'seam', p: 0, building: b.id, seam: 'salt' });
    expect(seamOf(s, b)).toBe('stone');
    // Another player can't set it.
    applyCommand(s, { t: 'seam', p: 1, building: b.id, seam: 'gold' });
    expect(seamOf(s, b)).toBe('stone');
  });

  it('digs a rare ore over its old workings, counted as mined', () => {
    const s = game();
    const a = site(s, plain(s));
    const i = (a.ty - 1) * s.w + a.tx;
    s.res[i] = R_SALT;
    s.amount[i] = 1;
    clearResource(s, i);
    const { b } = dig(s, a);
    applyCommand(s, { t: 'seam', p: 0, building: b.id, seam: 'salt' });
    const stone0 = s.players[0].res.stone;
    run(s, 240);
    expect(s.players[0].stats.mined?.salt ?? 0).toBeGreaterThan(10);
    expect(s.players[0].res.stone).toBe(stone0);
  });

  it('a household people sinks shafts for stone, never gold', () => {
    const s = game(3, 'chinese');
    const { b } = dig(s, site(s, plain(s)));
    expect(seamOf(s, b)).toBe('stone');
    applyCommand(s, { t: 'seam', p: 0, building: b.id, seam: 'gold' });
    expect(seamOf(s, b)).toBe('stone');
  });
});
