import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { applyCommand } from '../src/sim/commands';
import { citizenJob } from '../src/sim/labor';
import { spawnUnit } from '../src/sim/world';
import { BUILDINGS } from '../src/sim/data';
import type { Building, GameState, Unit } from '../src/sim/types';
import { R_BERRY, R_MEAT, R_NONE } from '../src/sim/types';

/** Hands sent for food where nothing is left to forage lay fields (#344). */
const game = () => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const farms = (s: GameState) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'farm');

function bare(s: GameState): Unit[] {
  for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_BERRY || s.res[i] === R_MEAT) s.res[i] = R_NONE;
  s.animals.length = 0;
  const cs = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
  for (const u of cs) u.order = { k: 'idle' };
  while (cs.length < 3) cs.push(spawnUnit(s, 0, 'citizen', cs[0].x, cs[0].y));
  return cs.slice(0, 3);
}

describe('+Food with nothing to forage', () => {
  it('lays a field for each idle hand and sends them to raise it', () => {
    const s = game();
    const hands = bare(s);
    const before = farms(s).length;
    s.players[0].res.wood = 500;
    applyCommand(s, { t: 'reassign', p: 0, from: 'idle', to: 'food', n: 3 });
    expect(farms(s)).toHaveLength(before + 3);
    expect(hands.every((u) => u.order.k === 'build')).toBe(true);
    expect(s.players[0].res.wood).toBe(500 - 3 * (BUILDINGS.farm.cost.wood ?? 0));
    expect(hands.map(citizenJob)).toEqual(['build', 'build', 'build']);
    expect(s.events.filter((e) => e.k === 'refused')).toHaveLength(0);
  });

  it('says what is missing when the wood is short', () => {
    const s = game();
    bare(s);
    s.players[0].res.wood = 0;
    applyCommand(s, { t: 'reassign', p: 0, from: 'idle', to: 'food', n: 3 });
    expect(farms(s)).toHaveLength(0);
    expect(s.events.some((e) => e.k === 'refused')).toBe(true);
  });
});
