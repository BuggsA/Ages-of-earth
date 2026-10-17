import { describe, expect, it } from 'vitest';
import { hitAnimal, spawnAnimal } from '../src/sim/animals';
import { beastBlood, bloodOf, captivesOf } from '../src/sim/blood';
import { addSheep } from '../src/sim/flocks';
import { AMOUNT, BLOOD, TICK_HZ } from '../src/sim/data';
import { hurt } from '../src/sim/combat';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import type { Building, BuildingType, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Blood's other sources (#355, s1's leftovers): beasts slain near a rig, the flock that grazes by it, and captives taken to it. */

const game = (age: 'ironblood' | 'bloodrite' = 'ironblood'): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.players[0].epoch = age === 'ironblood' ? 3 : 4;
  s.players[0].age = age;
  // Only the units a test places stand near its buildings.
  for (const e of s.ents) if (e.kind === 'unit') e.hp = 0;
  s.ents = s.ents.filter((e) => e.hp > 0);
  s.byId = new Map(s.ents.map((e) => [e.id, e]));
  s.animals = [];
  return s;
};
const raise = (s: GameState, type: BuildingType, x = s.players[0].startX, y = s.players[0].startY + 6): Building => {
  for (let r = 0; r < 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!placeProblem(s, type, Math.round(x) + dx, Math.round(y) + dy, true, 0)) return placeBuilding(s, 0, type, Math.round(x) + dx, Math.round(y) + dy, true);
      }
  throw new Error('no room');
};
/** A citizen of B struck down `away` tiles from the building by a soldier of A (or by nothing). */
const strikeDown = (s: GameState, b: Building, away: number, by: 'infantry' | 'ranged' | 'priest' | null = 'infantry'): Unit => {
  const t = spawnUnit(s, 1, 'citizen', b.x + away, b.y);
  const u = by ? spawnUnit(s, 0, by, t.x + 0.6, t.y) : null;
  hurt(s, t, 9999, 0, u);
  return t;
};
const seconds = (s: GameState, n: number) => {
  for (let i = 0; i < n * TICK_HZ; i++) step(s);
};

describe('captives', () => {
  it('an enemy citizen a soldier strikes down near a rig is taken to it alive, and gives no blood as it falls', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    const t = strikeDown(s, rig, 4);
    expect(captivesOf(rig)).toBe(1);
    expect(rig.captives).toEqual([{ p: 1, left: BLOOD.captive }]);
    expect(bloodOf(s.players[0])).toBe(0);
    expect(s.players[0].stats.captives).toBe(1);
    expect(s.events.some((e) => e.k === 'captive' && e.what === 'taken' && e.from === 1)).toBe(true);
    step(s);
    expect(s.byId.has(t.id)).toBe(false);
  });

  it('is not taken when struck down by no one, by a priest, or out of reach: those fall and give their blood as before', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    strikeDown(s, rig, 3, null);
    expect(bloodOf(s.players[0])).toBeGreaterThan(0);
    strikeDown(s, rig, 3, 'priest');
    strikeDown(s, rig, BLOOD.reach + 3);
    expect(captivesOf(rig)).toBe(0);
  });

  it('a soldier that shoots takes captives too, up to the rig\'s hold, and past it they fall as the slain', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    for (let i = 0; i < BLOOD.hold; i++) strikeDown(s, rig, 2 + i * 0.3, 'ranged');
    expect(captivesOf(rig)).toBe(BLOOD.hold);
    expect(bloodOf(s.players[0])).toBe(0);
    strikeDown(s, rig, 3);
    expect(captivesOf(rig)).toBe(BLOOD.hold);
    expect(bloodOf(s.players[0])).toBeGreaterThan(0);
  });

  it('is bled a blood a second into the store until spent', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    strikeDown(s, rig, 3);
    strikeDown(s, rig, 4);
    seconds(s, 10);
    expect(bloodOf(s.players[0])).toBeCloseTo(2 * 10 * BLOOD.bleed, 5);
    seconds(s, BLOOD.captive / BLOOD.bleed);
    expect(captivesOf(rig)).toBe(0);
    expect(rig.captives).toBeUndefined();
    expect(bloodOf(s.players[0])).toBeCloseTo(2 * BLOOD.captive, 5);
  });

  it('goes free as a citizen of its own people when the rig falls', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    strikeDown(s, rig, 3);
    strikeDown(s, rig, 4);
    const folk = () => s.ents.filter((e) => e.kind === 'unit' && e.owner === 1 && e.type === 'citizen' && e.hp > 0).length;
    step(s);
    const before = folk();
    rig.hp = 0;
    step(s);
    expect(s.byId.has(rig.id)).toBe(false);
    expect(folk()).toBe(before + 2);
    expect(s.events.filter((e) => e.k === 'captive' && e.what === 'freed').length).toBe(2);
  });

  it('is taken to a Blood-rite altar as to a rig', () => {
    const s = game('bloodrite');
    const altar = raise(s, 'temple');
    strikeDown(s, altar, 4);
    expect(captivesOf(altar)).toBe(1);
  });

  it('is kept through a save', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    strikeDown(s, rig, 3);
    seconds(s, 3);
    const back = deserialize(serialize(s));
    const rig2 = back.byId.get(rig.id) as Building;
    expect(rig2.captives).toEqual(rig.captives);
    seconds(s, 5);
    seconds(back, 5);
    expect(bloodOf(back.players[0])).toBe(bloodOf(s.players[0]));
  });
});

describe('beasts and the flock', () => {
  it('a beast slain near a rig by its people gives a share of its meat as blood', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    const deer = spawnAnimal(s, rig.x + 4, rig.y, 'deer');
    const hunter = spawnUnit(s, 0, 'infantry', deer.x + 0.8, deer.y);
    hitAnimal(s, deer, 9999, hunter.x, hunter.y);
    expect(bloodOf(s.players[0])).toBe(beastBlood('deer', AMOUNT.meat));
    expect(s.events.some((e) => e.k === 'blood' && e.how === 'beast')).toBe(true);
  });

  it('a beast slain far from any rig, or by a people off the Path of Blood, gives none', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    const far = spawnAnimal(s, rig.x + BLOOD.reach + 4, rig.y, 'deer');
    hitAnimal(s, far, 9999, far.x + 0.8, far.y);
    spawnUnit(s, 0, 'infantry', far.x + 0.8, far.y);
    expect(bloodOf(s.players[0])).toBe(0);
    s.players[0].age = 'middle';
    const near = spawnAnimal(s, rig.x + 3, rig.y, 'deer');
    spawnUnit(s, 0, 'infantry', near.x + 0.8, near.y);
    hitAnimal(s, near, 9999, near.x + 0.8, near.y);
    expect(bloodOf(s.players[0])).toBe(0);
  });

  it('a rig bleeds the milk of its people\'s sheep grazing by it, and leaves sheep farther off and lambs alone', () => {
    const s = game();
    const rig = raise(s, 'drainrig');
    const near = addSheep(s, 0, rig.x + 3, rig.y, false);
    const far = addSheep(s, 0, rig.x + BLOOD.flockReach + 5, rig.y, false);
    const lamb = addSheep(s, 0, rig.x + 2, rig.y + 1, true);
    const theirs = addSheep(s, 1, rig.x + 2, rig.y - 1, false);
    for (const a of [near, far, lamb, theirs]) a.milk = 10;
    s.tick = Math.ceil(s.tick / TICK_HZ) * TICK_HZ;
    step(s);
    expect(near.milk).toBeLessThanOrEqual(10 - BLOOD.flockMilk + 1);
    expect(bloodOf(s.players[0])).toBeCloseTo(BLOOD.flockMilk * BLOOD.flockYield, 5);
    expect(far.milk).toBeGreaterThanOrEqual(10);
    expect(lamb.milk).toBeGreaterThanOrEqual(10);
    expect(theirs.milk).toBeGreaterThanOrEqual(10);
  });
});
