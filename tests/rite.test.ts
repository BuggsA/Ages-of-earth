import { describe, expect, it } from 'vitest';
import { bloodOf, cursed } from '../src/sim/blood';
import { hurt } from '../src/sim/combat';
import { applyCommand } from '../src/sim/commands';
import { RITE, secs } from '../src/sim/data';
import { offeringOf, riteProblem } from '../src/sim/fork';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import type { AgeId, Building, GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The Blood-rite's priests (#355 s4): sacrifice and the curse. */

const game = (): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 0;
  s.players[0].epoch = 4;
  return s;
};
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};
const standIn = (s: GameState, age: AgeId) => {
  const p = s.players[0];
  p.walked = ['warband', 'ironblood', 'totalwar', ...(age === 'industrial' || age === 'totalwar' ? [] : [age])];
  p.age = age;
  p.statsVersion++;
};
const clear = (s: GameState) => {
  for (const e of s.ents) if (e.kind === 'unit') ((e.x = 1.5), (e.y = 1.5));
};
/** A Blood-rite people with a priest, and an enemy foot soldier standing 4 tiles from it that does not move. */
const setup = (age: AgeId = 'bloodrite') => {
  const s = game();
  standIn(s, age);
  clear(s);
  s.players[0].blood = 100;
  const base = tc(s);
  const priest = spawnUnit(s, 0, 'priest', base.x + 8, base.y);
  const foe = spawnUnit(s, 1, 'infantry', base.x + 12, base.y);
  foe.stance = 'stand';
  return { s, priest, foe, base };
};
const rite = (s: GameState, priest: Unit, target: Unit, how: 'sacrifice' | 'curse') =>
  applyCommand(s, { t: 'convert', p: 0, ids: [priest.id], target: target.id, rite: how });

describe('the Blood-rite: sacrifice', () => {
  it('kills the victim and pays the offering into the store', () => {
    const { s, priest, foe } = setup();
    const pay = offeringOf(s, foe);
    expect(pay).toBeGreaterThan(0);
    const before = bloodOf(s.players[0]);
    rite(s, priest, foe, 'sacrifice');
    expect(priest.order.k).toBe('convert');
    run(s, 12);
    expect(foe.hp).toBeLessThanOrEqual(0);
    expect(bloodOf(s.players[0])).toBe(before + pay);
    expect(s.players[0].stats.sacrificed).toBe(1);
    expect(priest.order.k).toBe('idle');
  });

  it('pays more for a dearer victim, and a Hero pays double', () => {
    const { s } = setup();
    const foot = spawnUnit(s, 1, 'infantry', 5, 5);
    const rider = spawnUnit(s, 1, 'cavalry', 6, 5);
    const king = spawnUnit(s, 1, 'hero', 7, 5);
    expect(offeringOf(s, rider)).toBeGreaterThan(offeringOf(s, foot));
    expect(offeringOf(s, king)).toBeGreaterThanOrEqual(RITE.hero);
  });

  it('is refused for a machine, a King, a friend, and anyone outside the rite', () => {
    const { s, foe } = setup();
    const engine = spawnUnit(s, 1, 'siege', 5, 5);
    const ally = spawnUnit(s, 0, 'infantry', 6, 5);
    s.kings.push(foe.id);
    expect(riteProblem(s, 0, 'sacrifice', engine)).toMatch(/bleeds nothing/);
    expect(riteProblem(s, 0, 'sacrifice', foe)).toMatch(/King/);
    expect(riteProblem(s, 0, 'sacrifice', ally)).toMatch(/enemy/);
    expect(riteProblem(s, 0, 'curse', foe)).toBeNull();
    const industrial = setup('industrial');
    expect(riteProblem(industrial.s, 0, 'sacrifice', industrial.foe)).toMatch(/Blood-rite/);
  });

  it('works on a grafted soldier, which a plain conversion cannot', () => {
    const { s, foe } = setup();
    foe.hemo = s.tick + secs(60);
    expect(riteProblem(s, 0, 'sacrifice', foe)).toBeNull();
  });

  it('gives the priest no order outside the rite or in a peace', () => {
    const a = setup('industrial');
    rite(a.s, a.priest, a.foe, 'sacrifice');
    expect(a.priest.order.k).toBe('idle');
    const b = setup();
    b.s.peaceUntil = b.s.tick + secs(60);
    rite(b.s, b.priest, b.foe, 'curse');
    expect(b.priest.order.k).toBe('idle');
  });
});

describe('the Blood-rite: the curse', () => {
  it('spends blood and makes every blow land harder for a while', () => {
    const { s, priest, foe } = setup();
    const start = bloodOf(s.players[0]);
    rite(s, priest, foe, 'curse');
    run(s, 6);
    expect(cursed(s, foe)).toBe(true);
    expect(bloodOf(s.players[0])).toBe(start - RITE.curse);
    expect(s.players[0].stats.cursed).toBe(1);
    const hp = foe.hp;
    hurt(s, foe, 10, 0, null);
    expect(foe.hp).toBeCloseTo(hp - 10 * RITE.taken, 5);
    run(s, RITE.last + 1);
    expect(cursed(s, foe)).toBe(false);
    const after = foe.hp;
    hurt(s, foe, 10, 0, null);
    expect(foe.hp).toBeCloseTo(after - 10, 5);
  });

  it('falls on the living within the spread of the target, and not on machines or those farther off', () => {
    const { s, priest, foe } = setup();
    const near = spawnUnit(s, 1, 'infantry', foe.x + 1.2, foe.y);
    const far = spawnUnit(s, 1, 'infantry', foe.x, foe.y + RITE.spread + 1);
    const engine = spawnUnit(s, 1, 'siege', foe.x + 1, foe.y);
    for (const u of [near, far, engine]) u.stance = 'stand';
    rite(s, priest, foe, 'curse');
    run(s, 6);
    expect(cursed(s, near)).toBe(true);
    expect(cursed(s, far)).toBe(false);
    expect(cursed(s, engine)).toBe(false);
    const hp = engine.hp;
    hurt(s, engine, 10, 0, null);
    expect(engine.hp).toBe(hp - 10);
  });

  it('is refused with the store too low, and the blood is not spent', () => {
    const { s, priest, foe } = setup();
    s.players[0].blood = RITE.curse - 1;
    rite(s, priest, foe, 'curse');
    expect(priest.order.k).toBe('idle');
    expect(s.events.some((e) => e.k === 'refused')).toBe(true);
    expect(bloodOf(s.players[0])).toBe(RITE.curse - 1);
  });

  it('is cancelled if the store runs dry during the chant', () => {
    const { s, priest, foe } = setup();
    rite(s, priest, foe, 'curse');
    s.players[0].blood = 0;
    run(s, 6);
    expect(cursed(s, foe)).toBe(false);
    expect(priest.order.k).toBe('idle');
  });

  it('rests the priest before the next curse, and is kept by a save', () => {
    const { s, priest, foe } = setup();
    rite(s, priest, foe, 'curse');
    run(s, 6);
    expect(priest.cool).toBeGreaterThan(secs(RITE.rest - 6));
    const back = deserialize(serialize(s))!;
    const again = back.ents.find((e) => e.id === foe.id) as Unit;
    expect(cursed(back, again)).toBe(true);
  });
});

describe('a plain conversion is unchanged by the rite', () => {
  it('still turns an enemy to your side', () => {
    const { s, priest, foe } = setup();
    applyCommand(s, { t: 'convert', p: 0, ids: [priest.id], target: foe.id });
    run(s, 12);
    expect(foe.owner).toBe(0);
  });
});
