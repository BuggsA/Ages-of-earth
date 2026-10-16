import { describe, expect, it } from 'vitest';
import { SPREAD } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { findResource } from '../src/sim/units';
import { applyCommand } from '../src/sim/commands';
import { spawnUnit } from '../src/sim/world';
import { R_TREE } from '../src/sim/types';

/** When a crowd outnumbers the room on the nearby nodes, the extras share the least crowded node, not the clicked one (#266). */
describe('spread overflow', () => {
  it('a crowd bigger than the nodes can hold stays evenly shared', () => {
    const s = createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    const p = s.players[0];
    const tree = findResource(s, R_TREE, p.startX, p.startY, 30);
    const cs = Array.from({ length: 60 }, (_, i) => spawnUnit(s, 0, 'citizen', p.startX + (i % 10) * 0.3, p.startY + 3 + Math.floor(i / 10) * 0.3));
    applyCommand(s, { t: 'gather', p: 0, ids: cs.map((u) => u.id), tile: tree, spread: true });
    const per = new Map<number, number>();
    for (const u of cs) if (u.order.k === 'gather') per.set(u.order.tile, (per.get(u.order.tile) ?? 0) + 1);
    const counts = [...per.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(Math.max(...counts)).toBeGreaterThan(SPREAD.perNode - 1);
  });
});
