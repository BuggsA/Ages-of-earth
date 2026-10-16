import { describe, expect, it } from 'vitest';
import { ageOf, backTo, buildBarred, mainRoad, pathCarry, pathDepth, pathOf, roadKnown, roadProblem, roadsFrom, shutRoads } from '../src/sim/ages';
import { landOwnerAt } from '../src/sim/borders';
import { AGES, FLOCK, PATHS, ROADS, TRIBUTE, secs } from '../src/sim/data';
import { addSheep } from '../src/sim/flocks';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf, statsFor } from '../src/sim/stats';
import { exacting } from '../src/sim/tribute';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, GameState, Unit } from '../src/sim/types';
import { buildingGeometry } from '../src/render/buildingModels';

/** The Age of the Horde (#318): the Steppe Road's second step, where riders exact tribute. */

const game = () => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const sheep = (s: GameState, owner = 0) => s.animals.filter((a) => a.kind === 'sheep' && a.owner === owner);
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const rich = (s: GameState) => { s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; };
const nomads = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'steppe'; s.players[0].epoch = 1; s.players[0].walked = ['steppe']; });
const horde = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'horde'; s.players[0].epoch = 2; s.players[0].walked = ['steppe', 'horde']; });
const climb = ROADS.find((r) => r.from === 'steppe' && r.to === 'horde')!;
const turn = ROADS.find((r) => r.from === 'middle' && r.to === 'horde')!;
const deeds = (s: GameState) => { s.players[0].stats.milked = 200; s.players[0].stats.hunted = 800; };

/** Clears player 1's people from the map (its buildings stay), so riders in its land stand undisturbed. */
function emptyRival(s: GameState): void {
  s.ents = s.ents.filter((e) => e.kind !== 'unit' || e.owner !== 1);
  for (const [id, e] of s.byId) if (e.kind === 'unit' && e.owner === 1) s.byId.delete(id);
}

/** A rider of player 0 in player 1's land, out of its Town Center's arrows. */
function riderInRivalLand(s: GameState, dx = 0): Unit {
  const home = tc(s, 1);
  const dir = Math.sign(s.w / 2 - home.x) || 1;
  const u = spawnUnit(s, 0, 'cavalry', home.x + dir * 11 + dx * 0.6, home.y + 0.5);
  expect(landOwnerAt(s, Math.floor(u.x), Math.floor(u.y))).toBe(1);
  return u;
}

describe('the Age of the Horde (#318)', () => {
  it('is the Steppe Road\'s second step: tier 2, on wheels, and the riders quicker for the steppe walked', () => {
    expect(AGES.horde.tier).toBe(2);
    expect(pathOf('horde')).toBe('steppe');
    expect(pathOf('steppe')).toBe('steppe');
    expect(AGES.horde.mobile).toBe(true);
    const s = game(); const p = s.players[0];
    nomads(s);
    const steppeSpeed = statsFor(s, 0, 'cavalry').speed;
    expect(pathDepth(p)).toBe(1);
    expect(pathCarry(p)).toBeNull();
    horde(s);
    expect(pathDepth(p)).toBe(2);
    expect(pathCarry(p)).toEqual({ path: 'steppe', times: 1 });
    expect(modsOf(s, 0).cavalrySpeed).toBeCloseTo(1 + PATHS.steppe.carry!.cavalrySpeed!, 6);
    expect(statsFor(s, 0, 'cavalry').speed).toBeGreaterThan(steppeSpeed);
    expect(modsOf(s, 0).tribute).toBeGreaterThan(0);
    expect(buildBarred(p, 'farm')).toContain('tills no fields');
    expect(buildBarred(p, 'wall')).toBeTruthy();
    expect(buildBarred(p, 'house')).toBeNull();
  });

  it('opens from the steppe with a Stable, once the flock is milked and the hunt is in', () => {
    const s = game(); const p = s.players[0]; rich(s);
    nomads(s);
    expect(roadKnown(s, p, climb)).toBe(false);
    placeBuilding(s, 0, 'stable', p.startX + 8, p.startY + 6, true);
    expect(roadKnown(s, p, climb)).toBe(true);
    expect(roadProblem(s, p, climb)).toContain('(0/200)');
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'horde' }]);
    expect(tc(s).advance).toBe(-1);
    deeds(s);
    expect(roadProblem(s, p, climb)).toBeNull();
    // The plain advance from the steppe still rejoins the trunk.
    expect(mainRoad(p)?.to).toBe('middle');
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'horde' }]);
    run(s, climb.time + 1);
    expect(ageOf(p)).toBe('horde');
    expect(p.epoch).toBe(2);
  });

  it('brings more of the herd on the first entry, and the flock keeps breeding there', () => {
    const s = game(); const p = s.players[0]; rich(s);
    nomads(s);
    placeBuilding(s, 0, 'stable', p.startX + 8, p.startY + 6, true);
    deeds(s);
    const before = sheep(s).length;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'horde' }]);
    run(s, climb.time + 1);
    expect(ageOf(p)).toBe('horde');
    expect(sheep(s).length).toBe(before + FLOCK.start);
    // An unmilked, well-fed sheep bears a lamb in the horde as on the steppe.
    s.animals = [];
    const ewe = addSheep(s, 0, tc(s).x + 4.5, tc(s).y + 0.5, false);
    ewe.milk = FLOCK.udder;
    ewe.fat = FLOCK.breed - FLOCK.fat;
    run(s, FLOCK.bite * 3);
    expect(sheep(s).filter((x) => x.lamb !== undefined).length).toBe(1);
  });

  it('is hidden from a people that never rode the steppe, and a turn off the Middle Ages for one that did', () => {
    const s = game(); const p = s.players[0]; rich(s);
    restat(s, p, () => { p.age = 'middle'; p.epoch = 2; });
    placeBuilding(s, 0, 'stable', p.startX + 8, p.startY + 6, true);
    deeds(s);
    expect(roadKnown(s, p, turn)).toBe(false);
    expect(shutRoads(s, p).some((r) => r.to === 'horde')).toBe(false);
    p.walked = ['steppe'];
    expect(roadKnown(s, p, turn)).toBe(true);
    expect(roadProblem(s, p, turn)).toBeNull();
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'horde' }]);
    run(s, turn.time + 1);
    expect(ageOf(p)).toBe('horde');
  });

  it('has roads back: forward to Gunpowder, down to the Middle Ages, and a step back lands in the Bronze Age', () => {
    const s = game(); const p = s.players[0];
    horde(s);
    expect(roadsFrom(p).map((r) => r.to).sort()).toEqual(['gunpowder', 'middle']);
    expect(mainRoad(p)?.to).toBe('gunpowder');
    expect(backTo(p)).toBe('bronze');
  });

  it('flies horsetail standards over its Town Centers, Houses and Stables', () => {
    for (const type of ['towncenter', 'house', 'stable'] as const) {
      const plain = buildingGeometry(type, 2, '#cc3333').getAttribute('position').count;
      expect(buildingGeometry(type, 2, '#cc3333', 0, 'horde').getAttribute('position').count, type).toBeGreaterThan(plain);
    }
  });

  it('counts milk drawn from the flock toward the deed', () => {
    const s = game(); const p = s.players[0];
    nomads(s);
    s.animals = [];
    const home = tc(s);
    const ewe = addSheep(s, 0, home.x + 3, home.y + 3, false);
    ewe.milk = FLOCK.udder;
    const milker = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
    step(s, [{ t: 'milk', p: 0, ids: [milker.id], target: ewe.id }]);
    run(s, 30);
    expect(p.stats.milked ?? 0).toBeGreaterThan(0);
  });
});

describe('tribute (#318)', () => {
  it('a rider standing in a rival\'s land takes gold from its treasury each second', () => {
    const s = game(); emptyRival(s); horde(s);
    const u = riderInRivalLand(s);
    const p = s.players[0], q = s.players[1];
    p.res.gold = 0;
    q.res.gold = 500;
    run(s, 10);
    const rate = modsOf(s, 0).tribute;
    expect(exacting(s, u, 1)).toBe(true);
    expect(p.res.gold).toBeGreaterThan(rate * 8);
    expect(p.res.gold).toBeLessThanOrEqual(rate * 11);
    expect(q.res.gold).toBeCloseTo(500 - p.res.gold, 6);
    expect(p.stats.tribute).toBeCloseTo(p.res.gold, 6);
  });

  it('counts at most eight riders a rival, and an empty treasury pays nothing', () => {
    const s = game(); emptyRival(s); horde(s);
    for (let i = 0; i < TRIBUTE.most + 4; i++) riderInRivalLand(s, i % 4);
    const p = s.players[0], q = s.players[1];
    p.res.gold = 0;
    q.res.gold = 1000;
    run(s, 5);
    const rate = modsOf(s, 0).tribute;
    expect(p.res.gold).toBeLessThanOrEqual(TRIBUTE.most * rate * 6 + 1e-6);
    expect(p.res.gold).toBeGreaterThanOrEqual(TRIBUTE.most * rate * 4 - 1e-6);
    q.res.gold = 0;
    const had = p.res.gold;
    run(s, 5);
    expect(p.res.gold).toBe(had);
    expect(q.res.gold).toBe(0);
  });

  it('takes nothing from riders on the move, at home, or outside the Horde', () => {
    const s = game(); emptyRival(s); horde(s);
    const p = s.players[0], q = s.players[1];
    // At home: own land pays no one.
    const home = tc(s, 0);
    spawnUnit(s, 0, 'cavalry', home.x + 6, home.y + 0.5);
    p.res.gold = 0;
    q.res.gold = 500;
    run(s, 4);
    expect(p.res.gold).toBe(0);
    // On the move: a rider riding through takes nothing while it rides.
    const u = riderInRivalLand(s);
    u.path = [0];
    expect(exacting(s, u, 1)).toBe(false);
    u.path = null;
    expect(exacting(s, u, 1)).toBe(true);
    // Back on the steppe, the same rider exacts nothing.
    nomads(s);
    run(s, 4);
    expect(p.res.gold).toBe(0);
    expect(q.res.gold).toBe(500);
  });

  it('keeps the peace', () => {
    const s = createGame({ seed: 11, size: 'small', peaceMinutes: 1, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    emptyRival(s); horde(s);
    riderInRivalLand(s);
    s.players[0].res.gold = 0;
    s.players[1].res.gold = 500;
    run(s, 5);
    expect(s.players[0].res.gold).toBe(0);
  });

  it('survives a save, and a match without a horde never touches it', () => {
    const s = game(); emptyRival(s); horde(s);
    riderInRivalLand(s);
    s.players[1].res.gold = 500;
    run(s, 3);
    const t = deserialize(serialize(s));
    expect(ageOf(t.players[0])).toBe('horde');
    expect(t.players[0].stats.tribute).toBeCloseTo(s.players[0].stats.tribute!, 6);
    run(s, 3);
    run(t, 3);
    expect(t.players[0].res.gold).toBeCloseTo(s.players[0].res.gold, 6);
    const plain = game();
    run(plain, 5);
    expect(plain.players[0].stats.tribute).toBeUndefined();
  });
});
