import { describe, expect, it } from 'vitest';
import { CONSECRATE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { chantShare, consecrateProblem, faithOf } from '../src/sim/consecrate';
import { relicsKept } from '../src/sim/ages';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, BuildingType, GameState, Unit } from '../src/sim/types';

/** Two peoples in the Middle Ages, the first on the pilgrims' road, with a building of the second's beside the first's town. */
function setup(type: BuildingType = 'house', pilgrim = true): { s: GameState; b: Building } {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'romans' }] });
  for (const p of s.players) restat(s, p, () => { p.epoch = 2; });
  if (pilgrim) restat(s, s.players[0], () => { s.players[0].age = 'pilgrim'; });
  const home = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const b = placeBuilding(s, 1, type, Math.floor(home.x) + 7, Math.floor(home.y), true) as Building;
  return { s, b };
}

const priests = (s: GameState, b: Building, n: number): Unit[] => Array.from({ length: n }, (_, i) => spawnUnit(s, 0, 'priest', b.x + 3.5, b.y - 1.5 + i * 0.5));

/** Steps until the building is the first people's, or the limit; returns the ticks it took. */
function chantUntilTurned(s: GameState, b: Building, limit: number): number {
  for (let i = 0; i < limit; i++) {
    if (b.owner === 0) return i;
    step(s);
  }
  return limit;
}

describe('faith takes the walls (#209)', () => {
  it("lets a pilgrim people's priests chant a rival's building over", () => {
    const { s, b } = setup();
    const band = priests(s, b, 5);
    const before = s.players[0].stats.converted;
    step(s, [{ t: 'convert', p: 0, ids: band.map((u) => u.id), target: b.id }]);
    let turned = false;
    for (let i = 0; i < secs(30) && !turned; i++) {
      step(s);
      turned = s.events.some((e) => e.k === 'consecrated' && e.id === b.id && e.from === 1 && e.to === 0);
    }
    expect(turned).toBe(true);
    expect(b.owner).toBe(0);
    expect(b.hp).toBeGreaterThan(0);
    expect(faithOf(b)).toBe(0);
    expect(s.players[0].stats.converted).toBe(before + 1);
  });

  it('is the pilgrims\' alone: other priests are refused and do nothing', () => {
    const { s, b } = setup('house', false);
    const band = priests(s, b, 5);
    expect(consecrateProblem(s, 0, b)).toMatch(/pilgrim/);
    step(s, [{ t: 'convert', p: 0, ids: band.map((u) => u.id), target: b.id }]);
    expect(s.events.some((e) => e.k === 'refused' && e.owner === 0)).toBe(true);
    step(s, [{ t: 'attack', p: 0, ids: band.map((u) => u.id), target: b.id }]);
    for (let i = 0; i < secs(20); i++) step(s);
    expect(b.owner).toBe(1);
    expect(faithOf(b)).toBe(0);
  });

  it('never turns a Town Center or a Wonder, nor a friend\'s building', () => {
    const { s } = setup();
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    expect(consecrateProblem(s, 0, tc)).toMatch(/never/);
    for (const t of CONSECRATE.never) expect(CONSECRATE.never).toContain(t);
    const mine = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    expect(consecrateProblem(s, 0, mine)).toMatch(/rival/);
  });

  it('goes faster with more voices', () => {
    const few = setup();
    const fewBand = priests(few.s, few.b, 2);
    step(few.s, [{ t: 'convert', p: 0, ids: fewBand.map((u) => u.id), target: few.b.id }]);
    const slow = chantUntilTurned(few.s, few.b, secs(60));
    const many = setup();
    const manyBand = priests(many.s, many.b, 6);
    step(many.s, [{ t: 'convert', p: 0, ids: manyBand.map((u) => u.id), target: many.b.id }]);
    const fast = chantUntilTurned(many.s, many.b, secs(60));
    expect(few.b.owner).toBe(0);
    expect(many.b.owner).toBe(0);
    expect(fast * 2).toBeLessThan(slow);
  });

  it('fades when the chanting stops', () => {
    const { s, b } = setup();
    const band = priests(s, b, 3);
    step(s, [{ t: 'convert', p: 0, ids: band.map((u) => u.id), target: b.id }]);
    for (let i = 0; i < secs(4); i++) step(s);
    const reached = faithOf(b);
    expect(reached).toBeGreaterThan(0);
    expect(b.faithBy).toBe(0);
    step(s, [{ t: 'stop', p: 0, ids: band.map((u) => u.id) }]);
    for (let i = 0; i < secs(CONSECRATE.grace + 2); i++) step(s);
    expect(faithOf(b)).toBeLessThan(reached);
    for (let i = 0; i < secs(1 / CONSECRATE.fade); i++) step(s);
    expect(faithOf(b)).toBe(0);
    expect(b.owner).toBe(1);
  });

  it('is slowed by soldiers sheltering inside, who run out to fight for their side when it turns', () => {
    const { s, b } = setup('tower');
    const [pr] = priests(s, b, 1);
    const open = chantShare(s, pr, b);
    const guards = [spawnUnit(s, 1, 'infantry', b.x, b.y + 2), spawnUnit(s, 1, 'infantry', b.x, b.y + 2.4)];
    step(s, [{ t: 'garrison', p: 1, ids: guards.map((u) => u.id), target: b.id }]);
    for (let i = 0; i < secs(5) && b.garrison.length < 2; i++) step(s);
    expect(b.garrison.length).toBe(2);
    expect(chantShare(s, pr, b)).toBeCloseTo(open / (1 + CONSECRATE.guard * 2), 6);
    // Nearly there: the next voices finish it.
    b.faith = 0.999;
    b.faithBy = 0;
    b.chant = s.tick;
    step(s, [{ t: 'convert', p: 0, ids: [pr.id], target: b.id }]);
    chantUntilTurned(s, b, secs(10));
    expect(b.owner).toBe(0);
    expect(b.garrison.length).toBe(0);
    for (const g of guards) {
      expect(g.inside).toBe(0);
      expect(g.owner).toBe(1);
    }
  });

  it('refunds what the building was training to the people who lost it', () => {
    const { s, b } = setup('barracks');
    s.players[1].res.food = 500;
    s.players[1].res.gold = 500;
    s.players[1].res.wood = 500;
    step(s, [{ t: 'train', p: 1, building: b.id, unit: 'infantry' }]);
    expect(b.queue.length).toBe(1);
    const paid = { ...s.players[1].res };
    b.faith = 0.999;
    b.faithBy = 0;
    const band = priests(s, b, 2);
    step(s, [{ t: 'convert', p: 0, ids: band.map((u) => u.id), target: b.id }]);
    chantUntilTurned(s, b, secs(10));
    expect(b.owner).toBe(0);
    expect(b.queue.length).toBe(0);
    expect(s.players[1].res.food).toBeGreaterThan(paid.food);
  });

  it("brings a Temple's relics with it", () => {
    const { s, b } = setup('temple');
    s.relics.push({ id: s.nextId++, x: b.x, y: b.y, carrier: 0, temple: b.id });
    expect(relicsKept(s, 1)).toBe(1);
    b.faith = 0.999;
    b.faithBy = 0;
    const band = priests(s, b, 2);
    step(s, [{ t: 'convert', p: 0, ids: band.map((u) => u.id), target: b.id }]);
    chantUntilTurned(s, b, secs(10));
    expect(b.owner).toBe(0);
    expect(relicsKept(s, 0)).toBe(1);
    expect(relicsKept(s, 1)).toBe(0);
  });

  it('has a pilgrim computer send its priests in a band, with its army, at a rival tower', () => {
    const s = createGame({ seed: 7, size: 'small', peaceMinutes: 0, players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null, civ: 'romans' }] });
    for (const p of s.players) restat(s, p, () => { p.epoch = 2; });
    restat(s, s.players[0], () => { s.players[0].age = 'pilgrim'; });
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    const tower = placeBuilding(s, 1, 'tower', Math.floor(home.x) + 9, Math.floor(home.y), true) as Building;
    for (let i = 0; i < 6; i++) spawnUnit(s, 0, 'infantry', tower.x + 6, tower.y - 2 + i * 0.6);
    const band = priests(s, tower, 4).map((u) => {
      u.x += 3;
      u.px = u.x;
      return u;
    });
    let chanted = false;
    for (let i = 0; i < secs(30) && !chanted; i++) {
      step(s);
      chanted = tower.faithBy === 0 && faithOf(tower) > 0;
    }
    expect(chanted).toBe(true);
    expect(band.filter((u) => u.order.k === 'convert').length).toBeGreaterThanOrEqual(1);
  });

  it('opens a gate to its new side and shuts it on the old', () => {
    const { s, b } = setup('gate');
    const tile = b.ty * s.w + b.tx;
    expect(s.gateTeam[tile]).toBe(s.players[1].team);
    b.faith = 0.999;
    b.faithBy = 0;
    const band = priests(s, b, 2);
    step(s, [{ t: 'convert', p: 0, ids: band.map((u) => u.id), target: b.id }]);
    chantUntilTurned(s, b, secs(10));
    expect(b.owner).toBe(0);
    expect(s.gateTeam[tile]).toBe(s.players[0].team);
  });
});

describe('counter-chant', () => {
  it("slows a chant while the keeper's own priests stand by, but not when they shelter", () => {
    const { s, b } = setup();
    const [one] = priests(s, b, 1);
    const alone = chantShare(s, one, b);
    const defenders = Array.from({ length: 2 }, (_, i) => spawnUnit(s, 1, 'priest', b.x - 2, b.y + i * 0.5));
    expect(chantShare(s, one, b)).toBeCloseTo(alone / 2, 6);
    defenders[0].inside = b.id;
    expect(chantShare(s, one, b)).toBeGreaterThan(alone / 2);
  });
});
