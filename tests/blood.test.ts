import { describe, expect, it } from 'vitest';
import { buildBarred } from '../src/sim/ages';
import { bloodOf, levyProblem } from '../src/sim/blood';
import { BLOOD, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { hurt } from '../src/sim/combat';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import type { Building, GameState, Unit, UnitType } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Blood (#355 s1): the store, the Drain Rig that fills it from the enemy dead, and the levy. */

const game = (): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.players[0].epoch = 3;
  s.players[0].age = 'ironblood';
  return s;
};
const rigAt = (s: GameState, x: number, y: number): Building => {
  for (let r = 0; r < 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!placeProblem(s, 'drainrig', Math.round(x) + dx, Math.round(y) + dy, true, 0)) return placeBuilding(s, 0, 'drainrig', Math.round(x) + dx, Math.round(y) + dy, true);
      }
  throw new Error('no room');
};
const slay = (s: GameState, rig: Building, type: UnitType, away: number, owner = 1): Unit => {
  const t = spawnUnit(s, owner, type, rig.x + away, rig.y);
  hurt(s, t, 9999, 0, null);
  return t;
};

describe('the Drain Rig', () => {
  it('is raised in the Path of Blood and no other age', () => {
    const s = game();
    expect(buildBarred(s.players[0], 'drainrig')).toBeNull();
    s.players[0].age = 'middle';
    expect(buildBarred(s.players[0], 'drainrig')).toBeTruthy();
  });

  it('draws a share of a fallen enemy\'s price as blood when it fell within reach', () => {
    const s = game();
    const rig = rigAt(s, s.players[0].startX, s.players[0].startY + 5);
    expect(s.players[0].blood).toBeUndefined();
    slay(s, rig, 'infantry', BLOOD.reach - 1);
    const first = bloodOf(s.players[0]);
    expect(first).toBeGreaterThan(0);
    expect(s.events.some((e) => e.k === 'blood' && e.how === 'slain' && e.n === first)).toBe(true);
    slay(s, rig, 'infantry', BLOOD.reach + 3);
    expect(bloodOf(s.players[0])).toBe(first);
  });

  it('draws nothing from machines, from the people\'s own dead, or without a finished rig', () => {
    const s = game();
    const rig = rigAt(s, s.players[0].startX, s.players[0].startY + 5);
    slay(s, rig, 'siege', 3);
    slay(s, rig, 'infantry', 3, 0);
    expect(bloodOf(s.players[0])).toBe(0);
    rig.built = false;
    slay(s, rig, 'infantry', 3);
    expect(bloodOf(s.players[0])).toBe(0);
  });

  it('is deterministic through a save', () => {
    const s = game();
    const rig = rigAt(s, s.players[0].startX, s.players[0].startY + 5);
    slay(s, rig, 'infantry', 3);
    const back = deserialize(serialize(s));
    expect(bloodOf(back.players[0])).toBe(bloodOf(s.players[0]));
  });
});

describe('the levy', () => {
  const crowd = (s: GameState, rig: Building, n: number) => {
    const out: Unit[] = [];
    for (let i = 0; i < n; i++) out.push(spawnUnit(s, 0, 'citizen', rig.x + 1 + i * 0.3, rig.y + 1));
    return out;
  };

  it('turns the citizens near the rig into blood, then rests', () => {
    const s = game();
    const rig = rigAt(s, s.players[0].startX, s.players[0].startY + 5);
    const folk = crowd(s, rig, 5);
    expect(levyProblem(s, s.players[0], rig)).toBeNull();
    applyCommand(s, { t: 'callUp', p: 0, building: rig.id, n: 9 });
    expect(bloodOf(s.players[0])).toBe(BLOOD.levy * BLOOD.levyMost);
    expect(folk.filter((u) => s.byId.has(u.id)).length).toBe(5 - BLOOD.levyMost);
    expect(s.players[0].stats.levied).toBe(BLOOD.levyMost);
    expect(levyProblem(s, s.players[0], rig)).toMatch(/still drawing/);
    for (let i = 0; i < secs(BLOOD.rest * BLOOD.levyMost) + 2; i++) step(s);
    expect(levyProblem(s, s.players[0], rig)).toBeNull();
  });

  it('does nothing with no citizen near, or for a rival\'s command', () => {
    const s = game();
    const rig = rigAt(s, s.players[0].startX, s.players[0].startY + 5);
    expect(levyProblem(s, s.players[0], rig)).toMatch(/No citizen/);
    const folk = crowd(s, rig, 2);
    applyCommand(s, { t: 'callUp', p: 1, building: rig.id, n: 3 });
    expect(bloodOf(s.players[0])).toBe(0);
    expect(folk.every((u) => s.byId.has(u.id))).toBe(true);
  });
});
