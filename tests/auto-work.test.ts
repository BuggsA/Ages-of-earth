import { describe, expect, it } from 'vitest';
import { createGame, step } from '../src/sim/game';
import { applyCommand } from '../src/sim/commands';

/** Idle hands find work (#344): new citizens and finished builders take the nearest node, for people only. */
const game = (ai: boolean) =>
  createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: ai ? 'normal' : null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

describe('idle hands find work (#344)', () => {
  it('a citizen trained with no rally point goes to gather', () => {
    const s = game(false);
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    applyCommand(s, { t: 'train', p: 0, building: tc.id, unit: 'citizen' });
    for (let i = 0; i < 230; i++) step(s);
    const fresh = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen' && e.order.k === 'gather');
    expect(fresh.length).toBeGreaterThan(0);
  });

  it('the computer is unchanged', () => {
    const s = game(true);
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    applyCommand(s, { t: 'train', p: 0, building: tc.id, unit: 'citizen' });
    s.players[0].res.food = 0;
    for (let i = 0; i < 230; i++) step(s);
    expect(s.players[0].ai).toBeTruthy();
  });
});
