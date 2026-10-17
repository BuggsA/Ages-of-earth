import { describe, expect, it } from 'vitest';
import { SEASON, SNARE, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { clearResource, placeProblem } from '../src/sim/grid';
import { catchIn, snareRate, snareSpot, treesNear } from '../src/sim/snares';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { raidBlow } from '../src/sim/ways';
import { R_TREE } from '../src/sim/types';
import type { Building, GameState, Unit } from '../src/sim/types';

/** Snares in the wood (#485): set among standing trees, they fill by themselves and a tender walks the line. */

const game = (seed = 1): GameState =>
  createGame({ seed, size: 'small', homeland: 'wood', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

/** Free tiles a snare may go on, nearest player 0's start first, each at least `SNARE.apart` from the ones before. */
function spots(s: GameState, n: number): { tx: number; ty: number }[] {
  const p = s.players[0];
  const all: { tx: number; ty: number; d: number }[] = [];
  for (let ty = 2; ty < s.h - 2; ty++) {
    for (let tx = 2; tx < s.w - 2; tx++) {
      if (placeProblem(s, 'snare', tx, ty, true, 0)) continue;
      all.push({ tx, ty, d: (tx - p.startX) * (tx - p.startX) + (ty - p.startY) * (ty - p.startY) });
    }
  }
  all.sort((a, b) => a.d - b.d || a.ty - b.ty || a.tx - b.tx);
  const out: { tx: number; ty: number }[] = [];
  for (const c of all) {
    if (out.length >= n) break;
    if (out.some((o) => Math.abs(o.tx - c.tx) < SNARE.apart + 2 && Math.abs(o.ty - c.ty) < SNARE.apart + 2)) continue;
    out.push(c);
  }
  return out;
}

const lay = (s: GameState, at: { tx: number; ty: number }, owner = 0): Building => {
  const b = placeBuilding(s, owner, 'snare', at.tx, at.ty, true);
  b.snared = 0;
  return b;
};

const citizens = (s: GameState, owner = 0) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'citizen');

describe('snares in the wood (#485)', () => {
  it('goes only among standing trees, and apart from other snares', () => {
    const s = game();
    const [at] = spots(s, 1);
    expect(at).toBeDefined();
    expect(treesNear(s, at.tx, at.ty)).toBeGreaterThanOrEqual(SNARE.need);
    // Bare ground by the Town Center has too few trees.
    const p = s.players[0];
    let bare: { tx: number; ty: number } | null = null;
    for (let r = 3; r < 12 && !bare; r++) {
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const tx = Math.floor(p.startX) + dx;
        const ty = Math.floor(p.startY) + dy;
        if (treesNear(s, tx, ty) < SNARE.need && !placeProblem(s, 'house', tx, ty, true, 0)) {
          bare = { tx, ty };
          break;
        }
      }
    }
    expect(bare).not.toBeNull();
    expect(placeProblem(s, 'snare', bare!.tx, bare!.ty, true, 0)).toBe('woods');
    lay(s, at);
    expect(snareSpot(s, at.tx + 1, at.ty)).toBe('snares');
    // The command refuses a bare spot, and says why.
    const [u] = citizens(s);
    s.players[0].res.wood = 500;
    s.events = [];
    applyCommand(s, { t: 'build', p: 0, ids: [u.id], type: 'snare', tx: bare!.tx, ty: bare!.ty });
    expect(s.ents.filter((e) => e.kind === 'building' && e.type === 'snare').length).toBe(1);
    const why = s.events.find((e) => e.k === 'refused');
    expect(why && 'why' in why ? why.why : '').toMatch(/trees/);
  });

  it('fills by itself with its woods, up to its cap, and starves when the trees round it are felled', () => {
    const s = game();
    const [at] = spots(s, 1);
    const b = lay(s, at);
    const rate = snareRate(s, b);
    const woods = Math.min(1, treesNear(s, at.tx, at.ty) / SNARE.full);
    expect(rate).toBeCloseTo(SNARE.rate * woods * (s.tick >= 3 * secs(SEASON.len) ? SNARE.winter : 1));
    for (let i = 0; i < secs(20); i++) step(s);
    expect(b.snared ?? 0).toBeGreaterThan(rate * 18);
    expect(b.snared ?? 0).toBeLessThanOrEqual(rate * 21);
    // Full: it catches no more.
    b.snared = SNARE.cap - 0.01;
    for (let i = 0; i < secs(5); i++) step(s);
    expect(b.snared).toBe(SNARE.cap);
    // Fell every tree round it: it starves.
    for (let y = at.ty - SNARE.r; y <= at.ty + SNARE.r; y++) for (let x = at.tx - SNARE.r; x <= at.tx + SNARE.r; x++) if (s.res[y * s.w + x] === R_TREE) clearResource(s, y * s.w + x);
    expect(snareRate(s, b)).toBe(0);
    b.snared = 3;
    for (let i = 0; i < secs(10); i++) step(s);
    expect(b.snared).toBe(3);
  });

  it('fills half again as fast in winter', () => {
    const s = game();
    const b = lay(s, spots(s, 1)[0]);
    const spring = snareRate(s, b);
    s.tick = 3 * secs(SEASON.len) + 1;
    expect(snareRate(s, b)).toBeCloseTo(spring * SNARE.winter);
  });

  it('a tender walks the line: empties each snare, goes on to the next, and carries the catch home', () => {
    const s = game();
    const [a, c] = spots(s, 2);
    expect(c).toBeDefined();
    const one = lay(s, a);
    const two = lay(s, c);
    one.snared = 8;
    two.snared = 8;
    const [u] = citizens(s);
    const food = s.players[0].res.food;
    applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: one.id });
    expect(u.order.k).toBe('snare');
    let visitedTwo = false;
    for (let i = 0; i < secs(120); i++) {
      step(s);
      if (u.order.k === 'snare' && u.order.target === two.id) visitedTwo = true;
    }
    expect(visitedTwo).toBe(true);
    expect(s.players[0].stats.snared ?? 0).toBeGreaterThanOrEqual(16);
    expect(s.players[0].res.food).toBeGreaterThanOrEqual(food + 16);
    // Still on the line, waiting for the next catch.
    expect(u.order.k).toBe('snare');
    expect(catchIn(one) + catchIn(two)).toBeLessThan(16);
  });

  it("a rival's citizen can't empty your snares", () => {
    const s = game();
    const b = lay(s, spots(s, 1)[0]);
    b.snared = 10;
    const [r] = citizens(s, 1);
    applyCommand(s, { t: 'work', p: 1, ids: [r.id], target: b.id });
    expect(r.order.k).not.toBe('snare');
  });

  it("a Warband's soldier striking a rival's snare carries off its catch, not the rival's stores (#463 s1)", () => {
    const s = game();
    const b = lay(s, spots(s, 1)[0]);
    b.snared = 17.5;
    s.players[1].way = 'warband';
    const raider = spawnUnit(s, 1, 'infantry', b.x + 1, b.y);
    const stores = s.players[0].res.food;
    const food = s.players[1].res.food;
    raidBlow(s, b, 5, 1, raider);
    expect(s.players[1].res.food).toBe(food + 17);
    expect(s.players[0].res.food).toBe(stores);
    expect(b.snared).toBeCloseTo(0.5);
    // A people not of the Warband takes nothing.
    b.snared = 10;
    s.players[1].way = 'hunt';
    raidBlow(s, b, 5, 1, raider);
    expect(b.snared).toBe(10);
  });
});
