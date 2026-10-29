import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, BUILDINGS, DELVE, ROADS, secs } from '../src/sim/data';
import { buildBarred, roadKnown, roadProblem } from '../src/sim/ages';
import { delveProblem, delveTime, isBelow, isMouth } from '../src/sim/delve';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { findSpot } from '../src/sim/ai';
import type { Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Deep Road's second age (#876 s2, #881): the Age of Delvings, Barrows joined underground to each other and to the Town Centers. */

const make = (seed = 2) => {
  const s = createGame({ seed, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  return s;
};
const enter = (s: GameState, o: number, age: 'delvings' | 'middle' | 'megaliths') => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};
const tcOf = (s: GameState, o = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const raise = (s: GameState, type: 'barrow', x: number, y: number, o = 0) => {
  const spot = findSpot(s, type, x, y, 2, 20, 1, (tx, ty) => !placeProblem(s, type, tx, ty, true, o))!;
  return placeBuilding(s, o, type, spot.tx, spot.ty, true);
};
const shelter = (_s: GameState, b: Building, units: Unit[]) => {
  for (const u of units) {
    u.inside = b.id;
    b.garrison.push(u.id);
  }
};

describe('the road (#881)', () => {
  it('is the Deep Road\'s tier 2, instead of the Middle Ages, a climb from Megaliths and a turn from the Middle Ages for one that walked them', () => {
    expect(AGES.delvings.tier).toBe(AGES.middle.tier);
    expect(AGES.delvings.routes).toEqual(['deep']);
    expect(AGES.delvings.verb && AGES.delvings.door && AGES.delvings.good).toBeTruthy();
    expect(AGES.delvings.keepsake?.building).toBe('barrow');
    const climb = ROADS.find((r) => r.from === 'megaliths' && r.to === 'delvings')!;
    const turn = ROADS.find((r) => r.from === 'middle' && r.to === 'delvings')!;
    expect(climb.walked).toBe('megaliths');
    expect(turn.walked).toBe('megaliths');
    expect(ROADS.some((r) => r.from === 'delvings' && r.to === 'middle')).toBe(true);
    expect(ROADS.some((r) => r.from === 'delvings' && r.to === 'gunpowder')).toBe(true);
    const s = make();
    enter(s, 0, 'megaliths');
    s.players[0].walked = ['megaliths'];
    expect(roadKnown(s, s.players[0], climb)).toBe(true);
    expect(roadProblem(s, s.players[0], climb)).toBeNull();
  });

  it('shuts the Stable and every rider', () => {
    const s = make();
    enter(s, 0, 'delvings');
    expect(buildBarred(s.players[0], 'stable')).toBeTruthy();
    expect(AGES.delvings.no?.units).toContain('cavalry');
  });
});

describe('the tunnel (#881)', () => {
  it('makes every Barrow and Town Center a mouth in the age, and none out of it', () => {
    const s = make();
    enter(s, 0, 'delvings');
    const tc = tcOf(s);
    const b = raise(s, 'barrow', tc.x + 8, tc.y);
    expect(isMouth(s, tc)).toBe(true);
    expect(isMouth(s, b)).toBe(true);
    enter(s, 0, 'middle');
    expect(isMouth(s, tc)).toBe(false);
    expect(isMouth(s, b)).toBe(false);
  });

  it('sends those sheltering in one mouth below to another: unseen on the way, and up when they arrive', () => {
    const s = make();
    enter(s, 0, 'delvings');
    const tc = tcOf(s);
    const near = raise(s, 'barrow', tc.x + 6, tc.y);
    const far = raise(s, 'barrow', tc.x + 30, tc.y + 10);
    const soldiers = [0, 1, 2, 3].map((i) => spawnUnit(s, 0, 'infantry', near.x + i * 0.3, near.y + 2));
    shelter(s, near, soldiers);
    applyCommand(s, { t: 'delve', p: 0, from: near.id, to: far.id });
    expect(near.garrison.length).toBe(0);
    expect(far.garrison.length).toBe(4);
    for (const u of soldiers) expect(isBelow(s, u)).toBe(true);
    // Letting the far mouth out before they arrive leaves them below.
    applyCommand(s, { t: 'ungarrison', p: 0, building: far.id });
    expect(far.garrison.length).toBe(4);
    const time = delveTime(near, far);
    expect(time).toBeGreaterThan(DELVE.least);
    for (let i = 0; i < secs(time) + 2; i++) step(s);
    expect(far.garrison.length).toBe(0);
    for (const u of soldiers) {
      expect(u.inside).toBe(0);
      expect(Math.abs(u.x - far.x) + Math.abs(u.y - far.y)).toBeLessThan(6);
    }
    expect(s.players[0].stats.delved).toBe(4);
  });

  it('is far quicker than marching: five tiles a second', () => {
    expect(DELVE.pace).toBeGreaterThan(2);
  });

  it('takes no rider into a Barrow, and sends none below from a Town Center', () => {
    const s = make();
    enter(s, 0, 'delvings');
    const tc = tcOf(s);
    const b = raise(s, 'barrow', tc.x + 8, tc.y);
    const rider = spawnUnit(s, 0, 'cavalry', b.x, b.y + 2);
    applyCommand(s, { t: 'garrison', p: 0, ids: [rider.id], target: b.id });
    for (let i = 0; i < secs(4); i++) step(s);
    expect(rider.inside).toBe(0);
    shelter(s, tc, [rider]);
    expect(delveProblem(s, 0, tc, b)).toMatch(/riders/);
  });

  it('spills those bound for a mouth that falls out where it stood', () => {
    const s = make();
    enter(s, 0, 'delvings');
    const tc = tcOf(s);
    const near = raise(s, 'barrow', tc.x + 6, tc.y);
    const far = raise(s, 'barrow', tc.x + 32, tc.y + 8);
    const soldiers = [0, 1].map((i) => spawnUnit(s, 0, 'infantry', near.x + i * 0.3, near.y + 2));
    shelter(s, near, soldiers);
    applyCommand(s, { t: 'delve', p: 0, from: near.id, to: far.id });
    far.hp = 0;
    step(s);
    for (const u of soldiers) {
      expect(u.inside).toBe(0);
      expect(u.hp).toBeGreaterThan(0);
      expect(Math.abs(u.x - far.x) + Math.abs(u.y - far.y)).toBeLessThan(6);
    }
  });

  it('keeps a kept Barrow\'s tunnel to the Town Centers on any road, but no Town Center to Town Center', () => {
    const s = make();
    enter(s, 0, 'delvings');
    const tc = tcOf(s);
    const b = raise(s, 'barrow', tc.x + 10, tc.y);
    const tc2 = placeBuilding(s, 0, 'towncenter', tc.tx + 20, tc.ty + 20, true);
    b.keep = 'delvings';
    enter(s, 0, 'middle');
    expect(isMouth(s, b)).toBe(true);
    expect(isMouth(s, tc)).toBe(true);
    const u = spawnUnit(s, 0, 'infantry', tc.x, tc.y + 3);
    shelter(s, tc, [u]);
    expect(delveProblem(s, 0, tc, b)).toBeNull();
    expect(delveProblem(s, 0, tc, tc2)).toMatch(/kept Barrow/);
  });

  it('never sends a rival\'s people below', () => {
    const s = make();
    enter(s, 0, 'delvings');
    const tc = tcOf(s);
    const b = raise(s, 'barrow', tc.x + 8, tc.y);
    const u = spawnUnit(s, 0, 'infantry', b.x, b.y + 2);
    shelter(s, b, [u]);
    applyCommand(s, { t: 'delve', p: 1, from: b.id, to: tc.id });
    expect(b.garrison).toEqual([u.id]);
  });

  it('is raised only in the Age of Delvings, and shelters twelve', () => {
    expect(BUILDINGS.barrow.ages).toEqual(['delvings']);
    expect(BUILDINGS.barrow.garrison).toBe(12);
  });
});
