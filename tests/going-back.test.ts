import { describe, expect, it } from 'vitest';
import { asleep, leaving } from '../src/sim/ages';
import { levyProblem } from '../src/sim/blood';
import { applyCommand } from '../src/sim/commands';
import { AGES, STEP_BACK, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { stationsOf } from '../src/sim/hemo';
import { placeProblem } from '../src/sim/grid';
import { seraiNear } from '../src/sim/trade';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { AgeId, Building, BuildingType, GameState } from '../src/sim/types';

/** Going back as a plan (#555 s10): buildings of other ages sleep while their people stands outside them, and wake on return. */

const game = (age: AgeId = 'totalwar', epoch = 4): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  s.players[0].epoch = epoch;
  s.players[0].age = age;
  return s;
};
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};
const raise = (s: GameState, type: BuildingType, dy = 6): Building => {
  const p = s.players[0];
  for (let r = 0; r < 14; r++)
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== r) continue;
        const tx = Math.round(p.startX) + x, ty = Math.round(p.startY) + dy + y;
        if (!placeProblem(s, type, tx, ty, true, 0)) return placeBuilding(s, 0, type, tx, ty, true);
      }
  throw new Error('no room');
};
/** Stands player 0 in an age outright: no journey, so nothing is marked kept on the way out (keepsakes, #555 s11, are their own tests). */
const into = (s: GameState, age: AgeId) => restat(s, s.players[0], () => { s.players[0].age = age; s.players[0].epoch = AGES[age].tier; });

describe('buildings of other ages sleep (#555 s10)', () => {
  it('a Drain Rig sleeps off the ages of blood and wakes on return', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    expect(asleep(s, rig)).toBe(false);
    into(s, 'gunpowder');
    expect(asleep(s, rig)).toBe(true);
    expect(levyProblem(s, s.players[0], rig)).toMatch(/sleeps until your people returns/);
    into(s, 'ironblood');
    expect(asleep(s, rig)).toBe(false);
  });

  it('a sleeping Blood Tower holds its fire, and shoots again once its people is back', () => {
    const s = game();
    s.peaceUntil = 0;
    const tower = raise(s, 'bloodtower');
    into(s, 'industrial');
    const foe = spawnUnit(s, 1, 'infantry', tower.x + 3, tower.y);
    foe.stance = 'stand';
    // The tower's reload marks each bolt it looses (the Town Center's arrows would muddy the foe's health).
    run(s, 4);
    expect(tower.cool).toBe(0);
    into(s, 'totalwar');
    run(s, 1);
    expect(tower.cool).toBeGreaterThan(0);
  });

  it('a sleeping Transfusion Station feeds no graft', () => {
    const s = game();
    const st = raise(s, 'transfusion');
    expect(stationsOf(s, 0)).toContain(st);
    into(s, 'gunpowder');
    expect(stationsOf(s, 0)).toEqual([]);
  });

  it('a Caravanserai off the Silk Road pays nothing for the post beside it', () => {
    const s = game('silk', 3);
    const post = s.posts[0];
    const serai = placeBuilding(s, 0, 'caravanserai', Math.round(post.x) + 3, Math.round(post.y) + 3, true);
    expect(seraiNear(s, 0, post)).toBe(serai);
    into(s, 'middle');
    expect(seraiNear(s, 0, post)).toBe(null);
    into(s, 'silk');
    expect(seraiNear(s, 0, post)).toBe(serai);
  });

  it('ordinary buildings never sleep', () => {
    const s = game();
    const forge = raise(s, 'forge');
    into(s, 'stone');
    expect(asleep(s, forge)).toBe(false);
  });
});

describe('the step-back plan (#555 s10)', () => {
  it('names what is kept, what sleeps and what is lost', () => {
    const s = game();
    const p = s.players[0];
    p.techs.push('rifling');
    raise(s, 'drainrig');
    raise(s, 'drainrig', -6);
    raise(s, 'warcamp', 10);
    const plan = leaving(s, p, 'gunpowder', true);
    expect(plan.walked).toBe('totalwar');
    expect(plan.suspend).toEqual(['rifling']);
    expect(plan.sleep).toEqual([['drainrig', 2]]);
    expect(plan.lost).toEqual([['warcamp', 1]]);
    expect(plan.wake).toEqual([]);
  });

  it('names what wakes on the road back, and suspends nothing on a road forward', () => {
    const s = game('gunpowder', 3);
    raise(s, 'drainrig');
    raise(s, 'warcamp', 10);
    const plan = leaving(s, s.players[0], 'ironblood', false);
    expect(plan.walked).toBeUndefined();
    expect(plan.suspend).toEqual([]);
    expect(plan.wake).toEqual([['drainrig', 1]]);
    expect(plan.lost).toEqual([]);
  });

  it('matches what the step back does, through the command', () => {
    const s = game();
    const p = s.players[0];
    p.res.food = p.res.gold = 5000;
    const rig = raise(s, 'drainrig');
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    const plan = leaving(s, p, 'gunpowder', true);
    applyCommand(s, { t: 'stepBack', p: 0, building: tc.id });
    run(s, STEP_BACK.time + 1);
    expect(p.age).toBe('gunpowder');
    expect(plan.sleep).toEqual([['drainrig', 1]]);
    expect(asleep(s, rig)).toBe(true);
  });
});
