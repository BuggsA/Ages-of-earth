import { describe, expect, it } from 'vitest';
import { AGES, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { damTurns, isCanal } from '../src/sim/water';
import type { Building, BuildingType, GameState } from '../src/sim/types';
import { restat } from '../src/sim/world';

/** The computer in the Age of Locks (#701 s5): it digs its canal, raises a dam that drives its town, and bridges the canal. */

function locksTown(): { s: GameState; o: number } {
  const s = createGame({ seed: 4, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
  const p = s.players[0];
  s.peaceUntil = 1e9;
  restat(s, p, () => {
    p.epoch = AGES.locks.tier;
    p.age = 'locks';
    p.walked = [...(p.walked ?? []), 'waterline', 'locks'];
  });
  p.res = { food: 4000, wood: 4000, stone: 2500, gold: 2500 };
  return { s, o: 0 };
}

const mine = (s: GameState, o: number, type: BuildingType) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === o && e.type === type);

describe('the computer in the Age of Locks (#701 s5)', () => {
  it('raises a dam that turns, digs a canal, and lays a bridge over it', () => {
    const { s, o } = locksTown();
    const canal = () => (s.channel ? Array.from(s.channel).filter((v) => v === 2).length : 0);
    for (let i = 0; i < secs(240) && !(mine(s, o, 'dam').some((b) => b.built) && mine(s, o, 'bridge').some((b) => b.built)); i++) step(s);
    const dam = mine(s, o, 'dam').find((b) => b.built);
    expect(dam).toBeDefined();
    expect(damTurns(s, dam!)).toBe(true);
    expect(canal()).toBeGreaterThan(2);
    const bridge = mine(s, o, 'bridge').find((b) => b.built);
    expect(bridge).toBeDefined();
    expect(isCanal(s, bridge!.ty * s.w + bridge!.tx)).toBe(true);
  });
});
