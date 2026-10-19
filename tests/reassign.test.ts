import { describe, expect, it } from 'vitest';
import { createGame, step } from '../src/sim/game';
import { applyCommand, shortages } from '../src/sim/commands';
import { citizenJob, handsFor, workforce } from '../src/sim/labor';
import { GATHER, LABOR } from '../src/sim/data';
import { placeProblem } from '../src/sim/grid';
import { spawnUnit } from '../src/sim/world';
import type { GameState, Unit } from '../src/sim/types';
import { R_TREE } from '../src/sim/types';
import { findResource } from '../src/sim/units';

/** Moving citizens between jobs in bulk, without picking them (Workers panel). */
const game = () => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const mine = (s: GameState) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');

/** Ten citizens all cutting wood. */
function woodcutters(s: GameState): Unit[] {
  const cs = mine(s);
  while (cs.length < 10) cs.push(spawnUnit(s, 0, 'citizen', cs[0].x, cs[0].y));
  const cut = cs.slice(0, 10);
  const tree = findResource(s, R_TREE, cut[0].x, cut[0].y, 40);
  expect(tree).toBeGreaterThanOrEqual(0);
  for (const u of cut) u.order = { k: 'gather', tile: tree, res: 'wood', phase: 'go' };
  return cut;
}

describe('reassign', () => {
  it('moves five woodcutters to food and leaves the other five', () => {
    const s = game();
    const cut = woodcutters(s);
    const others = mine(s).filter((u) => !cut.includes(u));
    const before = others.map((u) => JSON.stringify(u.order));
    applyCommand(s, { t: 'reassign', p: 0, from: 'wood', to: 'food', n: 5 });
    const jobs = cut.map(citizenJob);
    expect(jobs.filter((j) => j === 'food')).toHaveLength(5);
    expect(jobs.filter((j) => j === 'wood')).toHaveLength(5);
    expect(others.map((u) => JSON.stringify(u.order))).toEqual(before);
    expect(s.events.filter((e) => e.k === 'refused')).toHaveLength(0);
  });

  it('takes the idle and empty-handed before a worker carrying a load', () => {
    const s = game();
    const cut = woodcutters(s);
    cut[0].carry = 10;
    cut[0].carryRes = 'wood';
    applyCommand(s, { t: 'reassign', p: 0, from: 'wood', to: 'stone', n: 9 });
    expect(citizenJob(cut[0])).toBe('wood');
    expect(cut.slice(1).every((u) => citizenJob(u) === 'stone')).toBe(true);
  });

  it('sends idle hands first, and the workers walk to work', () => {
    const s = game();
    const idle = mine(s)[0];
    idle.order = { k: 'idle' };
    applyCommand(s, { t: 'reassign', p: 0, from: 'idle', to: 'wood', n: 1 });
    expect(citizenJob(idle)).toBe('wood');
    for (let i = 0; i < 400; i++) step(s);
    expect(workforce(s, 0).get('wood')).toContain(idle.id);
  });

  it('says why when no one can be moved, and never touches a rival', () => {
    const s = game();
    const rival = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 1 && e.type === 'citizen');
    for (const u of rival) u.order = { k: 'gather', tile: 0, res: 'wood', phase: 'go' };
    applyCommand(s, { t: 'reassign', p: 0, from: 'stone', to: 'food', n: 3 });
    applyCommand(s, { t: 'reassign', p: 0, from: 'wood', to: 'wood', n: 3 });
    expect(s.events.filter((e) => e.k === 'refused')).toHaveLength(2);
    expect(rival.every((u) => citizenJob(u) === 'wood')).toBe(true);
  });
});

/** A free spot for a house near a point, as tile coordinates. */
const spotFor = (s: GameState, x: number, y: number): { tx: number; ty: number } => {
  for (let r = 0; r < 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!placeProblem(s, 'house', Math.round(x) + dx, Math.round(y) + dy, true, 0)) return { tx: Math.round(x) + dx, ty: Math.round(y) + dy };
      }
  throw new Error('no room');
};

describe('reassign to building', () => {
  const site = (s: GameState) => {
    const cs = mine(s);
    const at = spotFor(s, s.players[0].startX, s.players[0].startY + 6);
    applyCommand(s, { t: 'build', p: 0, ids: [cs[0].id], type: 'house', tx: at.tx, ty: at.ty });
    const b = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && !e.built)!;
    expect(b).toBeTruthy();
    return b;
  };

  it('sends woodcutters to the unfinished building and sets them back to wood after', () => {
    const s = game();
    const cut = woodcutters(s);
    const b = site(s);
    for (const u of cut) u.order = { k: 'gather', tile: findResource(s, R_TREE, u.x, u.y, 40), res: 'wood', phase: 'go' };
    applyCommand(s, { t: 'reassign', p: 0, from: 'wood', to: 'build', n: 4 });
    const builders = cut.filter((u) => u.order.k === 'build' && u.order.target === b.id);
    expect(builders).toHaveLength(4);
    expect(builders.every((u) => u.resume?.k === 'gather')).toBe(true);
    expect(cut.filter((u) => citizenJob(u) === 'wood')).toHaveLength(6);
  });

  it('says so when nothing is being built', () => {
    const s = game();
    woodcutters(s);
    applyCommand(s, { t: 'reassign', p: 0, from: 'wood', to: 'build', n: 4 });
    expect(s.events.some((e) => e.k === 'refused' && e.why === 'Nothing is being built')).toBe(true);
  });
});

describe('what a shortage asks for', () => {
  it('lists every missing resource, and a hand count that covers it in the window', () => {
    const s = game();
    const p = s.players[0];
    p.res.wood = 10;
    p.res.stone = 0;
    expect(shortages(p, { wood: 50, stone: 20, gold: 0 })).toEqual([{ res: 'wood', need: 40 }, { res: 'stone', need: 20 }]);
    expect(shortages(p, { wood: 5 })).toEqual([]);
    expect(handsFor('wood', 40)).toBe(Math.ceil(40 / (GATHER.tree * LABOR.window)));
    expect(handsFor('gold', 1)).toBe(1);
    expect(handsFor('food', 10000)).toBe(LABOR.most);
  });
});
