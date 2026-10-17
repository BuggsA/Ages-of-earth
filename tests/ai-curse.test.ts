import { describe, expect, it } from 'vitest';
import { AI_CURSE, AI_LEVELS, RITE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The computer answers a curse on its own army (#434): cursed soldiers that are losing step back, riders go for the priest. */

const setup = (curseAnswer?: boolean) => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.rares = [];
  s.peaceUntil = 0;
  const a = s.players[0];
  a.epoch = 4;
  const b = s.players[1];
  b.epoch = 4;
  b.age = 'bloodrite';
  b.walked = ['warband', 'ironblood', 'totalwar', 'bloodrite'];
  b.statsVersion++;
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === 1) ((e.x = 1.5), (e.y = 1.5));
  const home = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const foot: Unit[] = [];
  for (let i = 0; i < 4; i++) foot.push(spawnUnit(s, 0, 'infantry', home.x + 8, home.y + i * 0.5));
  const foes: Unit[] = [];
  for (let i = 0; i < 8; i++) {
    const f = spawnUnit(s, 1, 'infantry', home.x + 11, home.y + i * 0.4);
    f.stance = 'stand';
    foes.push(f);
  }
  const rider = spawnUnit(s, 0, 'cavalry', home.x + 6, home.y + 6);
  const priest = spawnUnit(s, 1, 'priest', home.x + 14, home.y + 8);
  step(s);
  const issued = { ...AI_LEVELS.hard };
  if (curseAnswer === false) AI_LEVELS.hard.curseAnswer = false;
  return { s, home, foot, foes, rider, priest, restore: () => Object.assign(AI_LEVELS.hard, issued) };
};

const curse = (s: GameState, us: Unit[], left: number) => {
  for (const u of us) u.cursed = s.tick + secs(left);
};

describe('the computer answers a curse', () => {
  it('pulls cursed soldiers that are losing back for the curse\'s last seconds, and a rider goes for the priest', () => {
    const { s, foot, home, rider, priest } = setup();
    curse(s, foot, AI_CURSE.late - 2);
    for (const u of foot) u.hp = u.hp * 0.5;
    for (let i = 0; i < secs(2); i++) step(s);
    const cx = foot.reduce((n, u) => n + u.x, 0) / foot.length;
    expect(cx).toBeLessThan(home.x + 8);
    expect(foot.some((u) => u.order.k === 'move' && !u.order.amove)).toBe(true);
    expect(rider.order.k === 'attack' && rider.order.target === priest.id).toBe(true);
    expect(RITE.last).toBeGreaterThan(AI_CURSE.late);
  });

  it('does nothing when the switch is off', () => {
    const { s, foot, rider, priest, restore } = setup(false);
    curse(s, foot, AI_CURSE.late - 2);
    for (const u of foot) u.hp = u.hp * 0.5;
    for (let i = 0; i < secs(2); i++) step(s);
    restore();
    expect(foot.some((u) => u.order.k === 'move' && !u.order.amove)).toBe(false);
    expect(rider.order.k === 'attack' && rider.order.target === priest.id).toBe(false);
  });

  it('keeps fighting when the curse is fresh', () => {
    const { s, foot } = setup();
    curse(s, foot, RITE.last);
    for (let i = 0; i < secs(2); i++) step(s);
    expect(foot.some((u) => u.order.k === 'move' && !u.order.amove)).toBe(false);
  });
});
