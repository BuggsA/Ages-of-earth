import { describe, expect, it } from 'vitest';
import { ageDef, ageOf, barred, roadKnown, trainsAt } from '../src/sim/ages';
import { applyCommand } from '../src/sim/commands';
import { AGES, BUILDINGS, HUNT, ROADS, ROUTES, UNITS, domainOf, secs, type RouteId } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { AgeId, GameState, Unit } from '../src/sim/types';
import { canHit, countPop, placeBuilding, spawnUnit } from '../src/sim/world';

/** The Age of the Wild Hunt (#801): the Wild and the Steppe's crossing. A pack at every rider's heel, wolves that follow the wagons, hawks. */

const ROAD = ROADS.find((r) => r.to === 'hunt')!;

/** Two peoples at war on open land, player 0 in `age` at the Bronze Age's epoch, nobody's computer. */
const game = (age: AgeId = 'hunt', walked: AgeId[] = ['wild', 'steppe']): GameState => {
  const s = createGame({ seed: 4, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 0;
  for (const p of s.players) p.epoch = 1;
  s.players[0].age = age;
  s.players[0].walked = walked;
  s.players[0].res = { food: 3000, wood: 3000, stone: 500, gold: 500 };
  return s;
};
const run = (s: GameState, seconds: number, until: () => boolean = () => false) => {
  for (let i = 0; i < secs(seconds) && !until(); i++) step(s);
};
const units = (s: GameState, owner: number, type: Unit['type']): Unit[] => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === type && e.hp > 0);
const stable = (s: GameState) => placeBuilding(s, 0, 'stable', Math.floor(s.players[0].startX) + 6, Math.floor(s.players[0].startY) + 6, true);

describe('the crossing in the data (#801)', () => {
  it('turns off the Stone Age for a people that walked the Wild and the Steppe, a Hunting Camp its clue, a hard gate', () => {
    expect(ROAD.from).toBe('stone');
    expect(ROAD.crossing).toEqual(['wild', 'steppe']);
    expect(ROAD.clue).toBe('huntcamp');
    expect(ROAD.gate).toBe('hard');
    // Both siblings leave from the Stone Age, as a crossing's must.
    for (const a of ROAD.crossing!) expect(ROADS.some((r) => r.from === 'stone' && r.to === a)).toBe(true);
    expect(ROADS.filter((r) => r.from === 'hunt').map((r) => r.to).sort()).toEqual(['bronze', 'middle']);
  });

  it('stands on no basic route, packs a camp onto wagons, and names what it does and shuts', () => {
    const a = AGES.hunt;
    for (const r of Object.keys(ROUTES) as RouteId[]) expect(a.routes).not.toContain(r);
    expect(a.tier).toBe(1);
    expect(a.mobile).toBe(true);
    expect(a.heel).toBe(true);
    expect(a.verb && a.door && a.good).toBeTruthy();
    expect(a.noBuild!.buildings).toEqual(['farm', 'wall', 'gate']);
    expect(a.price!.cavalry).toBeGreaterThan(1);
  });

  it('is seen once either sibling is walked', () => {
    const s = game('stone', []);
    placeBuilding(s, 0, 'huntcamp', 1, 1, true);
    const p = s.players[0];
    expect(roadKnown(s, p, ROAD)).toBe(false);
    p.walked = ['steppe'];
    expect(roadKnown(s, p, ROAD)).toBe(true);
  });
});

describe('the hawk (#801)', () => {
  it('is an air unit with no weapon, quick and far-sighted, cheap and not a soldier', () => {
    const st = UNITS.hawk[1]!;
    expect(domainOf('hawk')).toBe('air');
    expect(st.attack).toBe(0);
    expect(st.sight).toBeGreaterThan(UNITS.cavalry[1]!.sight * 1.5);
    expect(st.speed).toBeGreaterThan(UNITS.warwolf[1]!.speed);
    expect(st.cost.gold ?? 0).toBe(0);
  });

  it('is trained at a Hunting Camp, in the age only', () => {
    const s = game();
    const p = s.players[0];
    expect(trainsAt(p, 'huntcamp')).toEqual(['hawk']);
    expect(barred(p, 'hawk', 'huntcamp')).toBeNull();
    p.age = 'bronze';
    expect(trainsAt(p, 'huntcamp')).toEqual([]);
    expect(barred(p, 'hawk', 'huntcamp')).toMatch(/Wild Hunt/);
    expect(BUILDINGS.huntcamp.trains).toEqual([]);
  });

  it('can be shot by an archer or a tower and not by a spearman, and cannot hurt anyone', () => {
    const s = game();
    const hawk = spawnUnit(s, 1, 'hawk', 20, 20);
    const bow = spawnUnit(s, 0, 'ranged', 21, 20);
    const spear = spawnUnit(s, 0, 'infantry', 21, 21);
    expect(canHit(s, bow, hawk)).toBe(true);
    expect(canHit(s, spear, hawk)).toBe(false);
    expect(canHit(s, hawk, bow)).toBe(false);
  });

  it('trained at the camp, flies out and counts in the pop', () => {
    const s = game();
    const camp = placeBuilding(s, 0, 'huntcamp', Math.floor(s.players[0].startX) + 5, Math.floor(s.players[0].startY) + 5, true);
    const before = s.players[0].pop;
    applyCommand(s, { t: 'train', p: 0, building: camp.id, unit: 'hawk' });
    run(s, UNITS.hawk[1]!.time + 5, () => units(s, 0, 'hawk').length > 0);
    expect(units(s, 0, 'hawk')).toHaveLength(1);
    expect(s.players[0].pop).toBe(before + 1);
  });
});

describe('the pack at heel (#801)', () => {
  const trainRider = (s: GameState) => {
    const b = stable(s);
    applyCommand(s, { t: 'train', p: 0, building: b.id, unit: 'cavalry' });
    run(s, 60, () => units(s, 0, 'cavalry').length > 0);
    return b;
  };

  it('brings a War Wolf out beside every rider trained at a Stable, with no taming', () => {
    const s = game();
    expect(s.players[0].tamed ?? []).toEqual([]);
    trainRider(s);
    expect(units(s, 0, 'cavalry')).toHaveLength(1);
    expect(units(s, 0, 'warwolf')).toHaveLength(1);
  });

  it('is no free cost: the wolf takes a place in the houses, and comes only where there is room', () => {
    const s = game();
    const p = s.players[0];
    const base = p.pop;
    trainRider(s);
    expect(p.pop).toBe(base + 2);
    const t = game();
    const b = stable(t);
    // Houses for one more soul than the town holds: the rider takes it, and the wolf finds none.
    countPop(t);
    for (let i = t.players[0].cap - t.players[0].pop - 1; i > 0; i--) spawnUnit(t, 0, 'citizen', t.players[0].startX + 3, t.players[0].startY + 3);
    applyCommand(t, { t: 'train', p: 0, building: b.id, unit: 'cavalry' });
    run(t, 60, () => units(t, 0, 'cavalry').length > 0);
    expect(units(t, 0, 'cavalry')).toHaveLength(1);
    expect(units(t, 0, 'warwolf')).toHaveLength(0);
  });

  it('comes only in the age, and only with riders', () => {
    const s = game('bronze');
    trainRider(s);
    expect(units(s, 0, 'cavalry')).toHaveLength(1);
    expect(units(s, 0, 'warwolf')).toHaveLength(0);
    const t = game();
    const b = placeBuilding(t, 0, 'range', Math.floor(t.players[0].startX) + 6, Math.floor(t.players[0].startY) + 6, true);
    applyCommand(t, { t: 'train', p: 0, building: b.id, unit: 'ranged' });
    run(t, 60, () => units(t, 0, 'ranged').length > 0);
    expect(units(t, 0, 'ranged')).toHaveLength(1);
    expect(units(t, 0, 'warwolf')).toHaveLength(0);
  });

  it('makes riders a fifth dearer in the age', () => {
    const a = game();
    const b = game('bronze');
    const cost = (s: GameState) => ageDef(s.players[0]).price?.cavalry ?? 1;
    expect(cost(a) / cost(b)).toBeCloseTo(1.2, 5);
    expect(ageOf(a.players[0])).toBe('hunt');
  });
});

describe('the followers (#801)', () => {
  /** A camp's Town Center packed onto a wagon, and a wolf idle at `d` tiles from it. */
  const camp = (s: GameState, d: number, owner = 0) => {
    const p = s.players[0];
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    applyCommand(s, { t: 'pack', p: 0, building: tc.id });
    const wagon = units(s, 0, 'wagon')[0];
    expect(wagon, 'the Town Center packs').toBeTruthy();
    const wolf = spawnUnit(s, owner, 'warwolf', wagon.x + d, wagon.y);
    return { wagon, wolf, p };
  };

  it('runs an idle wolf to a wagon that is rolling, from within reach', () => {
    const s = game();
    const { wagon, wolf } = camp(s, 10);
    applyCommand(s, { t: 'move', p: 0, ids: [wagon.id], x: wagon.x - 12, y: wagon.y });
    const d0 = Math.hypot(wolf.x - wagon.x, wolf.y - wagon.y);
    run(s, HUNT.every * 1.5);
    expect(wolf.order.k).toBe('move');
    run(s, 2);
    expect(Math.hypot(wolf.x - wagon.x, wolf.y - wagon.y)).toBeLessThan(d0);
  });

  it('leaves a wolf out of reach, one already at heel, and a standing wagon alone', () => {
    const s = game();
    const far = camp(s, HUNT.follow + 6);
    applyCommand(s, { t: 'move', p: 0, ids: [far.wagon.id], x: far.wagon.x - 12, y: far.wagon.y });
    run(s, HUNT.every + 1);
    expect(far.wolf.order.k).toBe('idle');
    const t = game();
    const still = camp(t, 10);
    run(t, HUNT.every + 1);
    expect(still.wolf.order.k).toBe('idle');
  });

  it('is for a people with the pack at heel: a Bronze Age camp\'s wolf stays put', () => {
    const s = game('bronze');
    s.players[0].age = 'steppe';
    const { wagon, wolf } = camp(s, 10);
    s.players[0].age = 'bronze';
    applyCommand(s, { t: 'move', p: 0, ids: [wagon.id], x: wagon.x - 12, y: wagon.y });
    run(s, HUNT.every + 2);
    expect(wolf.order.k).toBe('idle');
  });

  it('never calls a rival\'s wolf to your wagon', () => {
    const s = game();
    const { wagon, wolf } = camp(s, 10, 1);
    s.players[1].age = 'hunt';
    s.players[1].walked = ['wild', 'steppe'];
    applyCommand(s, { t: 'move', p: 0, ids: [wagon.id], x: wagon.x - 12, y: wagon.y });
    run(s, HUNT.every + 2);
    expect(wolf.order.k).toBe('idle');
  });
});
