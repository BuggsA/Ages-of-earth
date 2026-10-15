import { describe, expect, it } from 'vitest';
import { SPREAD } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { findResource } from '../src/sim/units';
import { applyCommand } from '../src/sim/commands';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { R_TREE } from '../src/sim/types';
import type { GameState, Unit } from '../src/sim/types';

/** Bulk orders from the player spread (#266): gatherers over nodes, attackers over foes. */

const game = (): GameState =>
  createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const tileOf = (u: Unit) => (u.order.k === 'gather' ? u.order.tile : -1);

describe('bulk orders spread (#266)', () => {
  it('gatherers fan over trees, perNode to a tree', () => {
    const s = game();
    const p = s.players[0];
    const tree = findResource(s, R_TREE, p.startX, p.startY, 30);
    const cs = [0, 1, 2, 3, 4, 5].map((i) => spawnUnit(s, 0, 'citizen', p.startX + i * 0.3, p.startY + 3));
    applyCommand(s, { t: 'gather', p: 0, ids: cs.map((u) => u.id), tile: tree, spread: true });
    const per = new Map<number, number>();
    for (const u of cs) per.set(tileOf(u), (per.get(tileOf(u)) ?? 0) + 1);
    expect(per.size).toBeGreaterThan(1);
    expect(Math.max(...per.values())).toBeLessThanOrEqual(SPREAD.perNode);
    expect(per.get(tree)).toBe(SPREAD.perNode);
    for (const t of per.keys()) expect(s.res[t]).toBe(R_TREE);
  });

  it('without the flag every gatherer takes the clicked tree (the computer is unchanged)', () => {
    const s = game();
    const p = s.players[0];
    const tree = findResource(s, R_TREE, p.startX, p.startY, 30);
    const cs = [0, 1, 2, 3, 4, 5].map((i) => spawnUnit(s, 0, 'citizen', p.startX + i * 0.3, p.startY + 3));
    applyCommand(s, { t: 'gather', p: 0, ids: cs.map((u) => u.id), tile: tree });
    expect(cs.every((u) => tileOf(u) === tree)).toBe(true);
  });

  it('attackers spread over visible foes near the clicked one', () => {
    const s = game();
    const p = s.players[0];
    const mine = [0, 1, 2, 3, 4, 5].map((i) => spawnUnit(s, 0, 'infantry', p.startX + 6 + i * 0.3, p.startY + 6));
    const foes = [0, 1, 2].map((i) => spawnUnit(s, 1, 'infantry', p.startX + 8 + i, p.startY + 6));
    step(s);
    applyCommand(s, { t: 'attack', p: 0, ids: mine.map((u) => u.id), target: foes[0].id, spread: true });
    const per = new Map<number, number>();
    for (const u of mine) if (u.order.k === 'attack') per.set(u.order.target, (per.get(u.order.target) ?? 0) + 1);
    expect(per.get(foes[0].id)).toBe(SPREAD.perFoe);
    expect(per.size).toBeGreaterThan(1);
  });
});

describe('farm fields (#266 leftover)', () => {
  it('several citizens sent to one field take different fields', () => {
    const s = game();
    const p = s.players[0];
    const fields = [0, 1, 2].map((i) => {
      const b = placeBuilding(s, 0, 'farm', Math.floor(p.startX) + 4 + i * 3, Math.floor(p.startY) + 4, true);
      return b;
    });
    const cs = [0, 1, 2].map((i) => spawnUnit(s, 0, 'citizen', p.startX + i * 0.3, p.startY + 2));
    applyCommand(s, { t: 'work', p: 0, ids: cs.map((u) => u.id), target: fields[0].id });
    const targets = cs.map((u) => (u.order.k === 'farm' ? u.order.target : -1));
    expect(new Set(targets).size).toBe(3);
  });
});
