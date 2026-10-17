import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { spawnUnit } from '../src/sim/world';
import { walkable } from '../src/sim/grid';
import type { GameState, Unit } from '../src/sim/types';

/** The Run stance (#454): soldiers step away from armed foes and never fight on their own. */
const game = (): GameState => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const run = (s: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(s);
};

function face(s: GameState): { me: Unit; foe: Unit } {
  const p = s.players[0];
  let x0 = Math.floor(p.startX) + 6;
  const y0 = Math.floor(p.startY) + 6;
  while (!walkable(s, x0, y0, 0) || !walkable(s, x0 + 3, y0, 0)) x0++;
  return { me: spawnUnit(s, 0, 'cavalry', x0 + 0.5, y0 + 0.5), foe: spawnUnit(s, 1, 'cavalry', x0 + 3.5, y0 + 0.5) };
}

describe('run stance (#454)', () => {
  it('steps away from a foe in sight and does not strike', () => {
    const s = game();
    const { me, foe } = face(s);
    applyCommand(s, { t: 'stance', p: 0, ids: [me.id], stance: 'run' });
    foe.stance = 'stand';
    const x = me.x;
    const hp = me.hp;
    run(s, 120);
    expect(me.x).toBeLessThan(x - 2);
    expect(me.hp).toBe(hp);
    expect(me.order.k).not.toBe('attack');
  });

  it('an aggressive soldier in the same spot does fight', () => {
    const s = game();
    const { foe } = face(s);
    foe.stance = 'stand';
    const hp = foe.hp;
    run(s, 120);
    expect(foe.hp).toBeLessThan(hp);
  });

  it('a runner on patrol steps away, then takes the round up again', () => {
    const s = game();
    const { me, foe } = face(s);
    applyCommand(s, { t: 'stance', p: 0, ids: [me.id], stance: 'run' });
    applyCommand(s, { t: 'patrol', p: 0, ids: [me.id], x: me.x - 6, y: me.y });
    foe.stance = 'stand';
    run(s, 30);
    expect(me.queue.some((o) => o.k === 'patrol') || me.order.k === 'patrol' || me.order.k === 'move').toBe(true);
  });
});
