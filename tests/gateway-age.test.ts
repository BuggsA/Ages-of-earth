import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { AGES, KEG, ROADS, buildingHp, secs } from '../src/sim/data';
import { ageOf, deedsDone, keyOf, lacking, opensOf, roadKnown, roadProblem } from '../src/sim/ages';
import { createGame, checksum, step } from '../src/sim/game';
import { kegProblem, millProblem } from '../src/sim/powder';
import type { Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The first gateway age (#577, the age road s5): saltpetre's only door to Alchemy, weak on its own, the only road to the Sappers. */

const setup = (seed: number) => ({ seed, size: 'small' as const, mapType: 'plains' as const, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
const tcOf = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, sec: number) => { for (let i = 0; i < secs(sec) && !s.over; i++) step(s); };
const toAlchemy = ROADS.find((r) => r.from === 'middle' && r.to === 'alchemy')!;
const toSappers = ROADS.find((r) => r.to === 'sapper')!;

/** A world whose seed holds saltpetre (or not). */
function world(saltpetre: boolean): GameState {
  for (let seed = 1; seed < 60; seed++) {
    const s = createGame(setup(seed));
    if (!!s.rares?.includes('saltpetre') === saltpetre) return s;
  }
  throw new Error('no such seed');
}

function workshop(s: GameState, o: number, dx = 8): Building {
  const home = tcOf(s, o);
  const spot = findSpot(s, 'workshop', home.x + dx, home.y + 4, 1, 12)!;
  return placeBuilding(s, o, 'workshop', spot.tx, spot.ty, true);
}

const enter = (s: GameState, o: number, age: 'alchemy' | 'sapper' | 'middle') => {
  const p = s.players[o];
  restat(s, p, () => { p.epoch = AGES[age].tier; p.age = age; });
};

describe('the gateway in the data', () => {
  it('Alchemy is a rare gateway off the Middle Ages, and the only road into the Sappers leaves from it', () => {
    expect(AGES.alchemy).toMatchObject({ tier: 2, gateway: true, routes: [] });
    expect(AGES.sapper).toMatchObject({ tier: 3, routes: [] });
    expect(ROADS.filter((r) => r.to === 'alchemy').map((r) => r.from)).toEqual(['middle']);
    expect(ROADS.filter((r) => r.to === 'sapper').map((r) => r.from)).toEqual(['alchemy']);
    expect(toAlchemy.vein).toMatchObject({ id: 'saltpetre' });
  });

  it('saltpetre is its only door: the lodge and the age panel read it so', () => {
    expect(keyOf(toAlchemy)).toEqual({ key: 'saltpetre', only: true });
    expect(opensOf('saltpetre').only).toEqual(['alchemy']);
    const s = world(false);
    const p = s.players[0];
    p.techs.push('survey');
    expect(lacking(s, p, 'alchemy')).toEqual([{ key: 'saltpetre', only: true }]);
  });
});

describe('the road into Alchemy', () => {
  it('is never seen where the world holds no saltpetre, whatever was mined', () => {
    const s = world(false);
    const p = s.players[0];
    enter(s, 0, 'middle');
    workshop(s, 0);
    p.techs.push('survey');
    p.stats.mined = { saltpetre: 99 };
    expect(roadKnown(s, p, toAlchemy)).toBe(false);
    expect(roadProblem(s, p, toAlchemy)).toMatch(/no saltpetre in this world/);
  });

  it('is learned by prospecting or by digging, needs a Siege Workshop, and opens on 40 saltpetre mined', () => {
    const s = world(true);
    const p = s.players[0];
    enter(s, 0, 'middle');
    expect(roadProblem(s, p, toAlchemy)).toMatch(/Prospector's Lodge, or dig saltpetre/);
    p.stats.mined = { saltpetre: 1 };
    expect(roadProblem(s, p, toAlchemy)).toMatch(/Siege Workshop/);
    workshop(s, 0);
    expect(roadKnown(s, p, toAlchemy)).toBe(true);
    expect(roadProblem(s, p, toAlchemy)).toBe(`${toAlchemy.vein!.text} (1/40)`);
    expect(deedsDone(p, toAlchemy, s)).toBe(false);
    p.stats.mined = { saltpetre: 40 };
    expect(roadProblem(s, p, toAlchemy)).toBeNull();
    for (const r of ['food', 'wood', 'gold'] as const) p.res[r] = 2000;
    applyCommand(s, { t: 'advance', p: 0, building: tcOf(s, 0).id, to: 'alchemy' });
    run(s, toAlchemy.time + 1);
    expect(ageOf(p)).toBe('alchemy');
    expect(p.epoch).toBe(2);
  });
});

describe('the mills of Alchemy', () => {
  it('each Siege Workshop grinds a keg from the store every so often, and none build engines', () => {
    const s = world(true);
    const p = s.players[0];
    enter(s, 0, 'alchemy');
    workshop(s, 0, 8);
    workshop(s, 0, -8);
    p.rare = { saltpetre: 100 };
    // Two mills grind a keg in half the time.
    run(s, KEG.time / 2 + 1);
    expect(p.kegs).toBe(1);
    expect(p.rare.saltpetre).toBe(100 - KEG.ore);
    expect(p.stats.ground).toBe(1);
    run(s, KEG.time * 2);
    // 100 saltpetre makes five kegs at most.
    expect(p.kegs).toBe(5);
    expect(p.rare.saltpetre).toBe(0);
    expect(millProblem(s, p)).toMatch(/saltpetre/);
    const w = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'workshop')!;
    applyCommand(s, { t: 'train', p: 0, building: w.id, unit: 'siege' });
    expect(w.queue.length).toBe(0);
  });

  it('grind nothing outside Alchemy, and stop when the store is full', () => {
    const s = world(true);
    const p = s.players[0];
    enter(s, 0, 'middle');
    workshop(s, 0);
    p.rare = { saltpetre: 100 };
    run(s, KEG.time + 2);
    expect(p.kegs ?? 0).toBe(0);
    enter(s, 0, 'alchemy');
    p.kegs = KEG.most;
    run(s, KEG.time + 2);
    expect(p.kegs).toBe(KEG.most);
    expect(p.rare.saltpetre).toBe(100);
    enter(s, 0, 'sapper');
    p.kegs = 0;
    run(s, KEG.time + 2);
    expect(p.kegs).toBe(0);
  });

  it('the Sappers open once enough kegs are ground', () => {
    const s = world(true);
    const p = s.players[0];
    enter(s, 0, 'alchemy');
    workshop(s, 0);
    expect(roadProblem(s, p, toSappers)).toMatch(/grind 4 kegs/);
    p.stats.ground = toSappers.deed!.n;
    expect(roadProblem(s, p, toSappers)).toBeNull();
  });
});

describe('the kegs of the Sappers', () => {
  /** Player 0 in the Sappers with kegs; a rival house a short walk from a sapper. */
  function siege(kegs = 3) {
    const s = world(true);
    enter(s, 0, 'sapper');
    s.players[0].kegs = kegs;
    const home = tcOf(s, 1);
    const spot = findSpot(s, 'house', home.x + 9, home.y, 1, 10)!;
    const house = placeBuilding(s, 1, 'house', spot.tx, spot.ty, true);
    const sapper = spawnUnit(s, 0, 'infantry', house.x + 5, house.y);
    return { s, house, sapper };
  }

  it('a sapper carries a keg to a rival building, lays it, and it blows when the fuse burns down', () => {
    const { s, house, sapper } = siege();
    const hp = house.hp;
    applyCommand(s, { t: 'keg', p: 0, ids: [sapper.id], target: house.id });
    for (let i = 0; i < secs(10) && !s.kegs; i++) step(s);
    expect(s.kegs).toHaveLength(1);
    expect(s.players[0].kegs).toBe(2);
    expect(sapper.order.k).toBe('idle');
    run(s, KEG.fuse + 0.5);
    expect(s.kegs).toBeUndefined();
    expect(hp - house.hp).toBeCloseTo(KEG.building, 0);
    expect(s.players[0].stats.blown).toBe(1);
  });

  it('a few kegs bring a house down that would take an army a while', () => {
    const { s, house, sapper } = siege(3);
    expect(buildingHp('house', 3)).toBeLessThan(KEG.building * 2);
    for (let n = 0; n < 2; n++) {
      applyCommand(s, { t: 'keg', p: 0, ids: [sapper.id], target: house.id });
      for (let i = 0; i < secs(10) && !s.kegs; i++) step(s);
      run(s, KEG.fuse + 0.5);
    }
    expect(house.hp).toBeLessThanOrEqual(0);
  });

  it('a rival who reaches a burning keg stamps it out', () => {
    const { s, house, sapper } = siege();
    const hp = house.hp;
    applyCommand(s, { t: 'keg', p: 0, ids: [sapper.id], target: house.id });
    for (let i = 0; i < secs(10) && !s.kegs; i++) step(s);
    const k = s.kegs![0];
    const guard: Unit = spawnUnit(s, 1, 'citizen', k.x + 0.3, k.y);
    guard.stance = 'stand';
    step(s);
    expect(s.kegs).toBeUndefined();
    run(s, KEG.fuse + 1);
    expect(house.hp).toBeGreaterThan(hp - KEG.building);
  });

  it('is refused outside the Sappers, with no kegs, and at one\'s own buildings', () => {
    const { s, house } = siege(0);
    expect(kegProblem(s, 0, house)).toMatch(/No kegs/);
    s.players[0].kegs = 1;
    expect(kegProblem(s, 0, house)).toBeNull();
    expect(kegProblem(s, 0, tcOf(s, 0))).toMatch(/rival building/);
    enter(s, 0, 'alchemy');
    expect(kegProblem(s, 0, house)).toMatch(/Age of Sappers/);
  });

  it('plays out the same twice', () => {
    const play = () => {
      const { s, house, sapper } = siege();
      applyCommand(s, { t: 'keg', p: 0, ids: [sapper.id], target: house.id });
      run(s, 20);
      return checksum(s);
    };
    expect(play()).toBe(play());
  });
});
