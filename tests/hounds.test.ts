import { describe, expect, it } from 'vitest';
import { TECHS, WOLF, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { spawnAnimal } from '../src/sim/animals';
import { modsOf } from '../src/sim/stats';
import type { GameState } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** Hounds: a Hunting Camp research that halves beast damage and speeds the butchering. */

const game = (): GameState =>
  createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

/** One citizen alone with a wolf; the damage taken in the first bite. */
function firstBite(hounds: boolean): number {
  const s = game();
  s.animals = [];
  const p = s.players[0];
  if (hounds) {
    p.techs.push('hounds');
    p.statsVersion++;
  }
  const x = p.startX + 2, y = p.startY + 2;
  const u = spawnUnit(s, 0, 'citizen', x, y);
  spawnAnimal(s, x + 1, y, 'wolf');
  const hp = u.hp;
  for (let i = 0; i < secs(6) && u.hp === hp; i++) step(s);
  return hp - u.hp;
}

describe('hounds', () => {
  it('are a Stone Age research at the Hunting Camp', () => {
    expect(TECHS.hounds.at).toBe('huntcamp');
    expect(TECHS.hounds.epoch).toBe(0);
  });

  it('speed the hunt and ward the beasts', () => {
    const s = game();
    s.players[0].techs.push('hounds');
    s.players[0].statsVersion++;
    expect(modsOf(s, 0).hunt).toBeGreaterThan(modsOf(s, 1).hunt);
    expect(modsOf(s, 0).beastWard).toBe(0.5);
    expect(modsOf(s, 1).beastWard).toBe(1);
  });

  it('halve the bite of a wolf', () => {
    const plain = firstBite(false);
    const dogs = firstBite(true);
    expect(plain).toBe(WOLF.bite);
    expect(dogs).toBe(WOLF.bite * 0.5);
  });
});
