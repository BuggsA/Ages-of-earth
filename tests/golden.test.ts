import { describe, expect, it } from 'vitest';
import { ageDef, ageOf, asleep, barred, buildBarred, goldenEnds, goldenSpan, hasWalked, roadKnown, roadProblem, threadsOf, weave, workRate } from '../src/sim/ages';
import { AGES, GOLDEN, LIGHTNING, ROADS, secs } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { modsOf } from '../src/sim/stats';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

/** The Golden Age (#703): every side age walked, woven at once with none of its doors, for a span; then it ends for good. */

const ROAD = ROADS.find((r) => r.to === 'golden')!;

const game = (walked: AgeId[]): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null, civ: 'egyptians' }, { name: 'B', ai: null, civ: 'britons' }] });
  const p = s.players[0];
  p.epoch = 3;
  p.age = 'gunpowder';
  p.walked = walked;
  p.res = { food: 5000, wood: 5000, stone: 2000, gold: 5000 };
  return s;
};

const golden = (walked: AgeId[]): GameState => {
  const s = game(walked);
  enterAge(s, s.players[0], 'golden');
  return s;
};

describe('the door', () => {
  it('turns off the Gunpowder Age, unheard of with one life walked, heard of with two, open with three', () => {
    expect(ROAD.from).toBe('gunpowder');
    expect(AGES.golden.tier).toBe(3);
    const one = game(['merchant']);
    expect(roadKnown(one, one.players[0], ROAD)).toBe(false);
    expect(roadProblem(one, one.players[0], ROAD)).toMatch(/many lives/);
    const two = game(['merchant', 'pilgrim']);
    expect(roadKnown(two, two.players[0], ROAD)).toBe(true);
    expect(roadProblem(two, two.players[0], ROAD)).toMatch(/2\/3/);
    const three = game(['steppe', 'merchant', 'pilgrim']);
    expect(roadProblem(three, three.players[0], ROAD)).toBeNull();
  });

  it('never opens twice', () => {
    const s = golden(['steppe', 'merchant', 'pilgrim']);
    enterAge(s, s.players[0], 'gunpowder');
    expect(hasWalked(s.players[0], 'golden')).toBe(true);
    expect(roadProblem(s, s.players[0], ROAD)).toMatch(/closed to it for good/);
  });
});

describe('the weave', () => {
  it('wakes every life walked at once, with none of their doors', () => {
    const s = golden(['steppe', 'merchant', 'pilgrim', 'warband']);
    const p = s.players[0];
    expect(ageOf(p)).toBe('golden');
    expect(threadsOf(p)).toEqual(['steppe', 'merchant', 'pilgrim', 'warband']);
    const def = ageDef(p);
    // The verbs: a town on wagons, swords hired at the Market, plunder hauled home, priests that chant buildings over.
    expect(def.mobile).toBe(true);
    expect(def.hire?.at).toBe('market');
    expect(def.haul).toBe(true);
    expect(def.vigils).toBe(true);
    expect(modsOf(s, 0).consecrate).toBeGreaterThan(0);
    expect(modsOf(s, 0).plunder).toBeGreaterThan(0);
    // None of the doors: farms and walls (the Steppe), Stables (the merchants), siege (the pilgrims), traders (the Warband).
    expect(buildBarred(p, 'farm')).toBeNull();
    expect(buildBarred(p, 'wall')).toBeNull();
    expect(buildBarred(p, 'stable')).toBeNull();
    expect(barred(p, 'siege')).toBeNull();
    expect(barred(p, 'trader')).toBeNull();
    // The best of each gift, and none of the prices: cheap riders, fast soldiers, fields that yield in full.
    expect(def.price?.cavalry).toBe(0.8);
    expect(def.levy).toBeUndefined();
    expect(def.mul?.militaryTrain).toBe(0.85);
    expect(def.mul?.farm).toBeUndefined();
  });

  it('takes the better of two gifts on the same mod, never their sum', () => {
    const w = weave(['warband', 'ironblood']);
    expect(w.add?.plunder).toBe(0.25);
    expect(w.mul?.techCost).toBeUndefined();
    expect(weave(['reclaimer']).mul?.techCost).toBe(0.8);
    expect(weave(['reclaimer']).mul?.militaryTrain).toBeUndefined();
  });

  it('wakes the buildings of every life walked, and lets them be raised', () => {
    const s = game(['warband', 'ironblood', 'pilgrim']);
    const p = s.players[0];
    const rig = placeBuilding(s, 0, 'drainrig', p.startX + 6, p.startY + 6, true) as Building;
    expect(asleep(s, rig)).toBe(true);
    expect(buildBarred(p, 'warcamp')).not.toBeNull();
    enterAge(s, p, 'golden');
    expect(asleep(s, rig)).toBe(false);
    expect(buildBarred(p, 'warcamp')).toBeNull();
    expect(buildBarred(p, 'mission')).not.toBeNull();
  });

  it('keeps the coils\' field and drops their dark', () => {
    const s = golden(['lightning', 'merchant', 'pilgrim']);
    const p = s.players[0];
    expect(ageDef(p).coils).toBe(true);
    const far = placeBuilding(s, 0, 'barracks', p.startX + 8, p.startY + 8, true) as Building;
    expect(workRate(s, far)).toBe(100);
    placeBuilding(s, 0, 'tower', p.startX + 8, p.startY + 11, true);
    expect(workRate(s, far)).toBe(LIGHTNING.lit);
  });
});

describe('the clock', () => {
  it('burns its span, longer for every life past the third, and is told to every people', () => {
    expect(goldenSpan(game(['steppe', 'merchant', 'pilgrim']).players[0])).toBe(secs(GOLDEN.span));
    expect(goldenSpan(game(['steppe', 'merchant', 'pilgrim', 'warband', 'sail']).players[0])).toBe(secs(GOLDEN.span + 2 * GOLDEN.more));
    const s = game(['steppe', 'merchant', 'pilgrim']);
    enterAge(s, s.players[0], 'golden');
    const told = s.events.find((e) => e.k === 'golden');
    expect(told).toMatchObject({ owner: 0, threads: ['steppe', 'merchant', 'pilgrim'] });
    expect(goldenEnds(s.players[0])).toBe(s.tick + secs(GOLDEN.span));
  });

  it('ends on its own, and the people wakes in the Gunpowder Age with its doors back', () => {
    const s = golden(['steppe', 'merchant', 'pilgrim']);
    const p = s.players[0];
    const end = goldenEnds(p)!;
    while (s.tick < end - 1) step(s);
    expect(ageOf(p)).toBe('golden');
    let over = false;
    for (let i = 0; i < secs(2) && !over; i++) {
      step(s);
      over = s.events.some((e) => e.k === 'golden' && e.over);
    }
    expect(over).toBe(true);
    expect(ageOf(p)).toBe('gunpowder');
    expect(p.goldenAt).toBeUndefined();
    expect(ageDef(p).mobile).toBeUndefined();
    expect(buildBarred(p, 'mission')).not.toBeNull();
  }, 30000);
});
