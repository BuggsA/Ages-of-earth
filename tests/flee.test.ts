import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { hurt } from '../src/sim/combat';
import { spawnUnit } from '../src/sim/world';
import type { Building, GameState, Unit } from '../src/sim/types';

/** Citizens run from danger: into shelter from soldiers, out of range of towers; switchable, and theirs alone. */
const game = (): GameState => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const citizenOf = (s: GameState, p: number) => s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === p && e.type === 'citizen')!;

describe('citizens run from danger', () => {
  it('makes for shelter when a soldier strikes, and comes out when the foe is gone', () => {
    const s = game();
    const c = citizenOf(s, 0);
    const foe = spawnUnit(s, 1, 'infantry', c.x + 1, c.y);
    hurt(s, c, 1, 1, foe);
    expect(c.order.k).toBe('garrison');
    foe.hp = 0;
    for (let i = 0; i < 20 * 60; i++) step(s);
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    expect(c.inside).toBe(0);
    expect(tc.garrison).not.toContain(c.id);
  });

  it('steps away from a tower that shoots it', () => {
    const s = game();
    const c = citizenOf(s, 0);
    const t = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    c.x = t.x + 3;
    c.y = t.y;
    hurt(s, c, 1, 1, null);
    expect(c.order.k).toBe('move');
  });

  it('stays put when turned off, globally or for one citizen, and never touches the computer\'s', () => {
    const s = game();
    const c = citizenOf(s, 0);
    const foe = spawnUnit(s, 1, 'infantry', c.x + 1, c.y);
    applyCommand(s, { t: 'flee', p: 0, on: false });
    hurt(s, c, 1, 1, foe);
    expect(c.order.k).not.toBe('garrison');
    applyCommand(s, { t: 'flee', p: 0, on: true, ids: [c.id] });
    hurt(s, c, 1, 1, foe);
    expect(c.order.k).toBe('garrison');
    const bot = createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: 'normal', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    const b = citizenOf(bot, 0);
    hurt(bot, b, 1, 1, spawnUnit(bot, 1, 'infantry', b.x + 1, b.y));
    expect(b.order.k).not.toBe('garrison');
  });
});
