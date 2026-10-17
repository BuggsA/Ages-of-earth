import { describe, expect, it } from 'vitest';
import { WAY } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { wayFor } from '../src/sim/ways';
import { R_BERRY, R_NONE } from '../src/sim/types';
import type { GameState, WayId } from '../src/sim/types';

function game(): GameState {
  const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'egyptians' }, { name: 'B', ai: 'hard', civ: 'egyptians' }] });
  // No deer and no berries near A's town and no rival close, so only the rival's Way can tip the choice.
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  s.animals = s.animals.filter((a) => (a.x - tc.x) ** 2 + (a.y - tc.y) ** 2 > WAY.near * WAY.near);
  for (let i = 0; i < s.res.length; i++) {
    const x = (i % s.w) + 0.5;
    const y = Math.floor(i / s.w) + 0.5;
    if (s.res[i] === R_BERRY && (x - tc.x) ** 2 + (y - tc.y) ** 2 <= WAY.near * WAY.near) s.res[i] = R_NONE;
  }
  return s;
}

describe('the computer reads a rival\'s Way (#336)', () => {
  it('a rival who has not chosen changes nothing', () => {
    const s = game();
    const base = wayFor(s, s.players[0]);
    s.players[1].way = undefined;
    expect(wayFor(s, s.players[0])).toBe(base);
  });

  it('a Warband rival, or a Hearth one worth raiding, calls for soldiers at home', () => {
    for (const way of ['warband', 'hearth'] as WayId[]) {
      const s = game();
      s.players[1].way = way;
      const score = wayFor(s, s.players[0]);
      expect(score, way).toBe('warband');
    }
  });

  it('a Hunters\' rival leaves berries and farms safe, so the Hearth wins', () => {
    const s = game();
    s.players[1].way = 'hunt';
    expect(wayFor(s, s.players[0])).toBe('hearth');
  });

  it('a defeated rival is ignored', () => {
    const s = game();
    const base = wayFor(s, s.players[0]);
    s.players[1].way = base === 'warband' ? 'hunt' : 'warband';
    s.players[1].defeated = true;
    expect(wayFor(s, s.players[0])).toBe(base);
  });
});
