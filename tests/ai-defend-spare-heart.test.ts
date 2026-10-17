import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** A raid on the computer's spare Town Center (#452) draws its army there, not just a raid on the first. */

const run = (s: GameState, secs: number) => { for (let i = 0; i < secs * TICK_HZ; i++) step(s); };

describe('the computer defends its spare Town Center', () => {
  it('sends its soldiers to a raid on the second Town Center', () => {
    const s = createGame({ seed: 7, size: 'small', peaceMinutes: 0, startEpoch: 1, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'normal', civ: 'greeks' }] });
    s.animals = [];
    s.players[1].res = { food: 2000, wood: 2000, stone: 2000, gold: 2000 };
    run(s, 240);
    const tcs = s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter' && e.hp > 0 && e.built);
    expect(tcs.length).toBe(2);
    const [first, spare] = tcs;
    const guards: Unit[] = [];
    for (let i = 0; i < 4; i++) guards.push(spawnUnit(s, 1, 'infantry', first.x + 3 + i, first.y + 3));
    const dist = (u: Unit) => Math.hypot(u.x - spare.x, u.y - spare.y);
    const before = guards.map(dist);
    for (let i = 0; i < 3; i++) spawnUnit(s, 0, 'infantry', spare.x + 4 + i, spare.y + 4);
    run(s, 12);
    const closer = guards.filter((u, i) => u.hp > 0 && dist(u) < before[i] - 3).length;
    expect(closer).toBeGreaterThanOrEqual(2);
  });
});
