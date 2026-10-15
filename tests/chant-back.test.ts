import { describe, expect, it } from 'vitest';
import { CONSECRATE, DT } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { answerChant, faithStep } from '../src/sim/consecrate';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, GameState } from '../src/sim/types';

/** A pilgrim keeper (player 1) with a tower of its own half chanted over by player 0. */
function setup(keeperPilgrim: boolean): { s: GameState; b: Building } {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'romans' }] });
  for (const p of s.players) restat(s, p, () => { p.epoch = 2; });
  if (keeperPilgrim) restat(s, s.players[1], () => { s.players[1].age = 'pilgrim'; });
  const home = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const b = placeBuilding(s, 1, 'tower', Math.floor(home.x) + 7, Math.floor(home.y), true) as Building;
  b.faith = 0.5;
  b.faithBy = 0;
  b.chant = s.tick;
  return { s, b };
}

describe('chanting back', () => {
  it('lets a pilgrim keeper\'s nearby priests wear a rival\'s tally down', () => {
    const { s, b } = setup(true);
    spawnUnit(s, 1, 'priest', b.x + 3, b.y);
    spawnUnit(s, 1, 'priest', b.x + 3, b.y + 1);
    expect(answerChant(s, b)).toBeCloseTo(2 * CONSECRATE.counter.answer * DT * 1.25, 5);
    b.chant = s.tick - 1000; // nobody chanting: only the fade and the answer
    const before = b.faith!;
    faithStep(s);
    expect(b.faith!).toBeLessThan(before - CONSECRATE.fade * DT * 0.99);
  });

  it('is the pilgrims\' alone, and wants the priests near', () => {
    const quiet = setup(false);
    spawnUnit(quiet.s, 1, 'priest', quiet.b.x + 3, quiet.b.y);
    expect(answerChant(quiet.s, quiet.b)).toBe(0);
    const far = setup(true);
    spawnUnit(far.s, 1, 'priest', far.b.x + 20, far.b.y);
    expect(answerChant(far.s, far.b)).toBe(0);
  });
});
