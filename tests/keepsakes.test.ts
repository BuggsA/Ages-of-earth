import { describe, expect, it } from 'vitest';
import { asleep, keepsakeOf, leaving, workRate } from '../src/sim/ages';
import { findSpot } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { AGES, BUILDINGS, CONVOY, KEG, LIGHTNING, TICK_HZ, TRUNK } from '../src/sim/data';
import { convoyShare } from '../src/sim/convoy';
import { trainCostFor } from '../src/sim/stats';
import { fairShare } from '../src/sim/fair';
import { createGame, enterAge, step } from '../src/sim/game';
import { millProblem } from '../src/sim/powder';
import { seraiNear } from '../src/sim/trade';
import { vigilGold } from '../src/sim/vigil';
import { maxHp, placeBuilding, spawnUnit } from '../src/sim/world';
import type { AgeId, Building, BuildingType, GameState } from '../src/sim/types';

/** Keepsake buildings (#555 s11): each side age names one building that keeps its work after the people leaves. */

const game = (age: AgeId, epoch: number): GameState => {
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
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
/** A finished building of player 0's about `d` tiles from its Town Center (or from a point). */
const raise = (s: GameState, type: BuildingType, d: number, at: { x: number; y: number } = tc(s)): Building => {
  const spot = findSpot(s, type, at.x, at.y, d, d + 8)!;
  return placeBuilding(s, 0, type, spot.tx, spot.ty, true);
};
const into = (s: GameState, age: AgeId, back = false) => enterAge(s, s.players[0], age, back);

describe('keepsakes in the data (#555 s11)', () => {
  it('only side ages name one, each a real building, with what it keeps doing', () => {
    const named = (Object.keys(AGES) as AgeId[]).filter((a) => AGES[a].keepsake);
    expect(named.length).toBeGreaterThanOrEqual(9);
    for (const a of named) {
      expect(TRUNK).not.toContain(a);
      expect(BUILDINGS[AGES[a].keepsake!.building]).toBeDefined();
      expect(AGES[a].keepsake!.does.length).toBeGreaterThan(10);
    }
    expect(AGES.alchemy.keepsake!.building).toBe('workshop');
  });
});

describe('leaving an age keeps one building at its work', () => {
  it('the oldest Caravanserai keeps its waystation off the Silk Road; the others sleep', () => {
    const s = game('silk', 3);
    const post = s.posts[0];
    const old = placeBuilding(s, 0, 'caravanserai', Math.round(post.x) + 3, Math.round(post.y) + 3, true);
    const young = raise(s, 'caravanserai', 6);
    const plan = leaving(s, s.players[0], 'middle', true);
    expect(plan.keepsake).toBe(old);
    expect(plan.sleep).toEqual([['caravanserai', 1]]);
    into(s, 'middle', true);
    expect(old.keep).toBe('silk');
    expect(asleep(s, old)).toBe(false);
    expect(asleep(s, young)).toBe(true);
    expect(seraiNear(s, 0, post)).toBe(old);
    expect(s.events.some((e) => e.k === 'keepsake' && e.id === old.id && e.age === 'silk')).toBe(true);
  });

  it('the one chosen is kept, and only from its own age, by its own people', () => {
    const s = game('silk', 3);
    const a = raise(s, 'caravanserai', 6);
    const b = raise(s, 'caravanserai', 12);
    applyCommand(s, { t: 'keepsake', p: 1, building: b.id });
    expect(b.keep).toBeUndefined();
    applyCommand(s, { t: 'keepsake', p: 0, building: tc(s).id });
    expect(tc(s).keep).toBeUndefined();
    applyCommand(s, { t: 'keepsake', p: 0, building: b.id });
    expect(b.keep).toBe('silk');
    expect(keepsakeOf(s, s.players[0], 'silk')).toBe(b);
    into(s, 'middle', true);
    expect(a.keep).toBeUndefined();
    expect(asleep(s, a)).toBe(true);
    expect(asleep(s, b)).toBe(false);
    // Out of the Silk Road, nothing more can be chosen.
    applyCommand(s, { t: 'keepsake', p: 0, building: a.id });
    expect(a.keep).toBeUndefined();
  });

  it('a kept Blood Tower keeps shooting off the Path of Blood', () => {
    const s = game('ironblood', 3);
    s.peaceUntil = 0;
    const tower = raise(s, 'bloodtower', 10);
    into(s, 'gunpowder');
    expect(tower.keep).toBe('ironblood');
    const foe = spawnUnit(s, 1, 'infantry', tower.x + 3, tower.y);
    foe.stance = 'stand';
    run(s, 1);
    expect(tower.cool).toBeGreaterThan(0);
  });
});

describe('the old mill (Alchemy\'s keepsake)', () => {
  const saltpetreWorld = (): GameState => {
    for (let seed = 1; seed < 60; seed++) {
      const s = createGame({ seed, size: 'small', mapType: 'plains', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
      if (s.rares?.includes('saltpetre')) {
        s.players[0].epoch = 2;
        s.players[0].age = 'alchemy';
        return s;
      }
    }
    throw new Error('no saltpetre world');
  };

  it('grinds one mill\'s worth in the Sappers, and stops when razed', () => {
    const s = saltpetreWorld();
    const p = s.players[0];
    const mill = raise(s, 'workshop', 8);
    const other = raise(s, 'workshop', 14);
    into(s, 'sapper');
    expect(mill.keep).toBe('alchemy');
    expect(other.keep).toBeUndefined();
    p.rare = { saltpetre: 100 };
    p.grind = 0;
    run(s, KEG.time + 1);
    // One mill, not two: a keg each `KEG.time`.
    expect(p.kegs).toBe(1);
    expect(millProblem(s, p)).toBeNull();
    mill.hp = 0;
    run(s, KEG.time * 2);
    expect(p.kegs).toBe(1);
    expect(millProblem(s, p)).toMatch(/only in the Age of Alchemy/);
  });
});

describe('keepsakes that keep an age\'s power', () => {
  it('a Temple kept from the Pilgrims keeps its vigils', () => {
    const s = game('pilgrim', 2);
    const kept = raise(s, 'temple', 8);
    const other = raise(s, 'temple', 16);
    into(s, 'middle');
    expect(kept.keep).toBe('pilgrim');
    for (const t of [kept, other]) spawnUnit(s, 0, 'priest', t.x + 2, t.y);
    expect(vigilGold(s, kept)).toBeGreaterThan(0);
    expect(vigilGold(s, other)).toBe(0);
  });

  it('a Temple kept from the Blood-rite is still an altar that mends', () => {
    const s = game('bloodrite', 4);
    const p = s.players[0];
    const altar = raise(s, 'temple', 10);
    into(s, 'gunpowder', true);
    expect(altar.keep).toBe('bloodrite');
    const man = spawnUnit(s, 0, 'infantry', altar.x + 3, altar.y);
    man.stance = 'stand';
    man.hp = maxHp(s, man) / 2;
    p.blood = 100;
    run(s, 2);
    expect(man.hp).toBeGreaterThan(maxHp(s, man) / 2);
  });

  it('a Market kept from the Fairs keeps its feast day', () => {
    const s = game('fair', 3);
    const market = raise(s, 'market', 6);
    const temple = raise(s, 'temple', 4, market);
    s.relics.push({ id: s.nextId++, x: temple.x, y: temple.y, carrier: 0, temple: temple.id });
    expect(fairShare(s, 0, market)).toBeGreaterThan(1);
    into(s, 'gunpowder');
    expect(market.keep).toBe('fair');
    expect(fairShare(s, 0, market)).toBeGreaterThan(1);
    expect(fairShare(s, 0, { x: market.x, y: market.y })).toBe(1);
  });

  it('a tower kept from Lightning lights a field: faster inside, nothing dark outside', () => {
    const s = game('lightning', 4);
    const coil = raise(s, 'tower', 4);
    into(s, 'industrial');
    expect(coil.keep).toBe('lightning');
    const near = raise(s, 'barracks', 2, coil);
    const far = raise(s, 'stable', LIGHTNING.reach + 4, coil);
    expect(workRate(s, near)).toBe(LIGHTNING.lit);
    expect(workRate(s, far)).toBe(100);
  });
});

describe('the Sea-Raiders keep their longship yard', () => {
  it('a Dock kept from the Sea-Raiders launches ships a fifth cheaper on any road; one not kept pays full', () => {
    const s = game('middle', 3);
    expect(AGES.searaider.keepsake!.building).toBe('dock');
    const full = trainCostFor(s, 0, 'transport', 'dock', { x: 0, y: 0 });
    const kept = trainCostFor(s, 0, 'transport', 'dock', { x: 0, y: 0, keep: 'searaider' });
    expect(kept.wood).toBe(Math.round(full.wood! * 0.8));
    expect(trainCostFor(s, 0, 'transport', 'dock', { x: 0, y: 0, keep: 'alchemy' })).toEqual(full);
  });
});

describe('the Sail keeps its convoy yard', () => {
  it('a Dock kept from the Sail still sends an escorted cog out for more, on any road', () => {
    const s = game('middle', 3);
    expect(AGES.sail.keepsake!.building).toBe('dock');
    const cog = spawnUnit(s, 0, 'cog', tc(s).x, tc(s).y);
    spawnUnit(s, 0, 'warship', tc(s).x + 1, tc(s).y);
    expect(convoyShare(s, cog, {})).toBe(1);
    expect(convoyShare(s, cog, { keep: 'alchemy' })).toBe(1);
    expect(convoyShare(s, cog, { keep: 'sail' })).toBe(CONVOY.pay);
  });
});
