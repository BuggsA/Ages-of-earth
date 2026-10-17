import { describe, expect, it } from 'vitest';
import { sworn } from '../src/sim/blood';
import { AI_LEVELS, AI_ORDERS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The computer reads a rival's Military Orders (#459): its riders go for the priest who swears the army. */

const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;

/** A hard computer with three riders, and 9 tiles off a rival foot soldier with (or without) Military Orders and its priest behind it. */
const setup = (orders: boolean, riders = 3) => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null }] });
  s.rares = [];
  s.peaceUntil = 0;
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === 1) ((e.x = 1.5), (e.y = 1.5));
  s.players[0].epoch = 2;
  s.players[0].statsVersion++;
  const b = s.players[1];
  b.epoch = 2;
  if (orders) b.techs.push('militaryOrders');
  b.statsVersion++;
  const home = tc(s);
  const own: Unit[] = [];
  for (let i = 0; i < riders; i++) own.push(spawnUnit(s, 0, 'cavalry', home.x + 5, home.y - 1 + i));
  const soldier = spawnUnit(s, 1, 'infantry', home.x + 14, home.y);
  soldier.stance = 'stand';
  const priest = spawnUnit(s, 1, 'priest', home.x + 17, home.y);
  priest.stance = 'stand';
  step(s);
  return { s, own, soldier, priest };
};
/** Steps up to `seconds` and returns how many riders were seen at once on an attack order at the priest. */
const onPriest = (s: GameState, own: Unit[], priest: Unit, seconds: number): number => {
  let most = 0;
  for (let i = 0; i < secs(seconds); i++) {
    step(s);
    most = Math.max(most, own.filter((u) => u.order.k === 'attack' && u.order.target === priest.id).length);
    if (priest.hp <= 0) break;
  }
  return most;
};

describe('the computer against Military Orders (#459)', () => {
  it('sends riders at the priest who swears the army, no more than it should', () => {
    const { s, own, soldier, priest } = setup(true);
    expect(sworn(s, soldier)).toBe(true);
    const most = onPriest(s, own, priest, 6);
    expect(most).toBeGreaterThanOrEqual(1);
    expect(most).toBeLessThanOrEqual(AI_ORDERS.riders);
  });

  it('leaves the priest to the ordinary fight when the army is not sworn', () => {
    const { s, own, priest } = setup(false);
    expect(onPriest(s, own, priest, 6)).toBe(0);
  });

  it('is switched off by `breakOath: false`', () => {
    const was = AI_LEVELS.hard.breakOath;
    AI_LEVELS.hard.breakOath = false;
    try {
      const { s, own, priest } = setup(true);
      expect(onPriest(s, own, priest, 6)).toBe(0);
    } finally {
      AI_LEVELS.hard.breakOath = was;
    }
  });
});
