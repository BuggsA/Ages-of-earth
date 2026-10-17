import { describe, expect, it } from 'vitest';
import { AUTO_WORK } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { spawnAnimal } from '../src/sim/animals';
import { findResource, rallyNode } from '../src/sim/units';
import { placeBuilding, spawnUnit, townCenters } from '../src/sim/world';
import { R_BERRY, R_MEAT, R_NONE, R_TREE } from '../src/sim/types';
import type { GameState, Order, Unit } from '../src/sim/types';

/** Hands find their own work (#344): a rally flag that outlives its tree, hunters that follow the herd, pickers that take a free field. */
const game = (ai: boolean): GameState =>
  createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: ai ? 'normal' : null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

/** What a unit is doing now, read fresh (the compiler would otherwise keep the order it was given). */
const kind = (u: Unit): string => (u.order as Order).k;
const target = (u: Unit): number | undefined => (u.order as unknown as { target?: number }).target;

const citizens = (s: GameState): Unit[] => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');

function trainOne(s: GameState): Unit {
  const tc = townCenters(s, 0)[0];
  const before = new Set(citizens(s).map((u) => u.id));
  applyCommand(s, { t: 'train', p: 0, building: tc.id, unit: 'citizen' });
  for (let i = 0; i < 600; i++) {
    step(s);
    const fresh = citizens(s).find((u) => !before.has(u.id));
    if (fresh) return fresh;
  }
  throw new Error('no citizen trained');
}

/** Clear every bush and carcass within `r` tiles of (x, y). */
function clearFood(s: GameState, x: number, y: number, r: number): void {
  for (let ty = Math.floor(y) - r; ty <= Math.floor(y) + r; ty++) {
    for (let tx = Math.floor(x) - r; tx <= Math.floor(x) + r; tx++) {
      const i = ty * s.w + tx;
      if (tx >= 0 && ty >= 0 && tx < s.w && ty < s.h && (s.res[i] === R_BERRY || s.res[i] === R_MEAT)) s.res[i] = R_NONE;
    }
  }
}

describe('a rally flag on a felled tree (#344)', () => {
  it('sends a new citizen to the nearest tree by the flag, not to bare ground', () => {
    const s = game(false);
    const tc = townCenters(s, 0)[0];
    const tree = findResource(s, R_TREE, tc.x, tc.y, 30);
    const fx = (tree % s.w) + 0.5;
    const fy = Math.floor(tree / s.w) + 0.5;
    applyCommand(s, { t: 'rally', p: 0, building: tc.id, x: fx, y: fy });
    expect(tc.rally!.kind).toBe(R_TREE);
    s.res[tree] = R_NONE; // felled
    const u = trainOne(s);
    expect(u.order.k).toBe('gather');
    const o = u.order as { tile: number; res: string };
    expect(o.res).toBe('wood');
    expect(s.res[o.tile]).toBe(R_TREE);
    expect(o.tile).toBe(findResource(s, R_TREE, fx, fy, AUTO_WORK.rally));
  });

  it('a flag on bare ground still just walks there', () => {
    const s = game(false);
    const tc = townCenters(s, 0)[0];
    let x = Math.floor(tc.x) + 5;
    const y = Math.floor(tc.y);
    while (s.res[y * s.w + x] !== R_NONE) x++;
    applyCommand(s, { t: 'rally', p: 0, building: tc.id, x: x + 0.5, y: y + 0.5 });
    expect(tc.rally!.kind).toBeUndefined();
    expect(trainOne(s).order.k).toBe('move');
  });

  it("leaves the computer's rally as it was (it re-tasks its own people)", () => {
    const s = game(true);
    const tc = townCenters(s, 0)[0];
    const tree = findResource(s, R_TREE, tc.x, tc.y, 30);
    applyCommand(s, { t: 'rally', p: 0, building: tc.id, x: (tree % s.w) + 0.5, y: Math.floor(tree / s.w) + 0.5 });
    s.res[tree] = R_NONE;
    const u = spawnUnit(s, 0, 'citizen', tc.x, tc.y + 3);
    expect(rallyNode(s, u, tc.rally!)).toBe(-1);
    s.players[0].ai = null;
    expect(rallyNode(s, u, tc.rally!)).toBeGreaterThanOrEqual(0);
  });
});

describe('a hunter follows the herd (#344)', () => {
  it('spears the next deer near the finished carcass instead of walking to bushes', () => {
    const s = game(false);
    const p = s.players[0];
    const x = p.startX + 8;
    const y = p.startY + 8;
    clearFood(s, x, y, 10);
    let tile = Math.floor(y) * s.w + Math.floor(x);
    while (s.res[tile] !== R_NONE) tile++;
    s.res[tile] = R_MEAT;
    s.amount[tile] = 1;
    const deer = spawnAnimal(s, (tile % s.w) + 3.5, Math.floor(tile / s.w) + 0.5);
    const u = spawnUnit(s, 0, 'citizen', (tile % s.w) + 0.5, Math.floor(tile / s.w) + 1.4);
    u.order = { k: 'gather', tile, res: 'food', phase: 'go' };
    let hunted = false;
    for (let i = 0; i < 400 && !hunted; i++) {
      step(s);
      hunted = kind(u) === 'hunt';
    }
    expect(hunted).toBe(true);
    expect(target(u)).toBe(deer.id);
  });
});

describe('a picker whose bushes are gone takes a free field (#344)', () => {
  it('two pickers take two fields, not one between them', () => {
    const s = game(false);
    const p = s.players[0];
    const x = p.startX + 7;
    const y = p.startY + 7;
    clearFood(s, x, y, AUTO_WORK.farm + 20);
    let tile = Math.floor(y) * s.w + Math.floor(x);
    while (s.res[tile] !== R_NONE) tile++;
    s.res[tile] = R_BERRY;
    s.amount[tile] = 1;
    const bx = tile % s.w;
    const by = Math.floor(tile / s.w);
    const f1 = placeBuilding(s, 0, 'farm', bx - 5, by + 2, true);
    const f2 = placeBuilding(s, 0, 'farm', bx - 5, by - 4, true);
    const a = spawnUnit(s, 0, 'citizen', (tile % s.w) + 1.4, Math.floor(tile / s.w) + 0.5);
    const b = spawnUnit(s, 0, 'citizen', (tile % s.w) - 0.4, Math.floor(tile / s.w) + 0.5);
    a.order = { k: 'gather', tile, res: 'food', phase: 'go' };
    b.order = { k: 'gather', tile, res: 'food', phase: 'go' };
    for (let i = 0; i < 400 && (kind(a) !== 'farm' || kind(b) !== 'farm'); i++) step(s);
    expect(kind(a)).toBe('farm');
    expect(kind(b)).toBe('farm');
    const fields = [target(a), target(b)].sort();
    expect(fields).toEqual([f1.id, f2.id].sort());
  });
});
