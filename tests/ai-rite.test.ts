import { describe, expect, it } from 'vitest';
import { bloodOf, cursed } from '../src/sim/blood';
import { riteWork } from '../src/sim/ai';
import { AI_FORK, AI_LEVELS, AI_RITE, RITE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { AgeId, Building, GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The computer's priests in the Blood-rite (#355 s4): a curse on a packed force, a sacrifice when the store is low. */

const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};
/** Steps on and returns the most of `foes` that lay under a curse at once (a curse lifts after `RITE.last` seconds). */
const peakCursed = (s: GameState, foes: Unit[], seconds: number) => {
  let peak = 0;
  for (let i = 0; i < secs(seconds); i++) {
    step(s);
    peak = Math.max(peak, foes.filter((f) => cursed(s, f)).length);
  }
  return peak;
};

/** A computer in the Blood-rite with one priest, `n` enemy foot soldiers (or `type`) standing together 5 tiles off, and `blood` in store. */
const setup = (blood: number, n = 4, level: 'hard' | 'easy' = 'hard', type: Unit['type'] = 'infantry', age: AgeId = 'bloodrite') => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: level, civ: 'romans' }, { name: 'B', ai: null }] });
  s.rares = [];
  s.peaceUntil = 0;
  const p = s.players[0];
  p.epoch = 4;
  p.age = age;
  p.walked = ['warband', 'ironblood', 'totalwar', age];
  p.statsVersion++;
  p.blood = blood;
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === 1) ((e.x = 1.5), (e.y = 1.5));
  const home = tc(s);
  const priest = spawnUnit(s, 0, 'priest', home.x + 6, home.y);
  const foes: Unit[] = [];
  for (let i = 0; i < n; i++) {
    const f = spawnUnit(s, 1, type, home.x + 11, home.y - 1 + i * 0.5);
    f.stance = 'stand';
    foes.push(f);
  }
  step(s);
  return { s, priest, foes };
};

describe('the computer in the Blood-rite', () => {
  it('is a clever level that uses the rites', () => {
    expect(AI_LEVELS.hard.clever).toBe(true);
    expect(AI_LEVELS.easy.clever).toBe(false);
  });

  it('curses a packed force when the store can spare the blood', () => {
    const { s, foes } = setup(RITE.curse + AI_RITE.keep + 20);
    expect(foes.length).toBeGreaterThanOrEqual(AI_RITE.pack);
    expect(peakCursed(s, foes, 25)).toBeGreaterThanOrEqual(AI_RITE.pack);
    expect(s.players[0].stats.cursed).toBeGreaterThanOrEqual(1);
  });

  it('does not curse a lone soldier, and keeps a blood reserve', () => {
    const lone = setup(RITE.curse + AI_RITE.keep + 20, 1);
    expect(peakCursed(lone.s, lone.foes, 25)).toBe(0);
    // The decision itself: just under the reserve it will not curse, just over it will.
    const poor = setup(RITE.curse + AI_RITE.keep - 1);
    expect(riteWork(poor.s, poor.s.players[0], poor.priest)?.how).not.toBe('curse');
    poor.s.players[0].blood = RITE.curse + AI_RITE.keep;
    expect(riteWork(poor.s, poor.s.players[0], poor.priest)?.how).toBe('curse');
    poor.s.players[0].blood = AI_FORK.store - 1;
    expect(riteWork(poor.s, poor.s.players[0], poor.priest)?.how).not.toBe('curse');
  });

  it('offers up a dear victim to fill a low store', () => {
    const { s, foes } = setup(5, 1, 'hard', 'cavalry');
    run(s, 25);
    expect(s.players[0].stats.sacrificed).toBeGreaterThanOrEqual(1);
    expect(foes[0].hp).toBeLessThanOrEqual(0);
    expect(bloodOf(s.players[0])).toBeGreaterThan(5);
  });

  it('leaves machines to be converted, not offered or cursed', () => {
    const { s, foes } = setup(200, 4, 'hard', 'siege');
    expect(peakCursed(s, foes, 25)).toBe(0);
    expect(s.players[0].stats.sacrificed ?? 0).toBe(0);
  });

  it('does nothing of the kind in another age, or as an easy computer', () => {
    const away = setup(200, 4, 'hard', 'infantry', 'hemocraft');
    expect(peakCursed(away.s, away.foes, 25)).toBe(0);
    const easy = setup(200, 4, 'easy');
    expect(peakCursed(easy.s, easy.foes, 25)).toBe(0);
    expect(easy.s.players[0].stats.sacrificed ?? 0).toBe(0);
  });
});
