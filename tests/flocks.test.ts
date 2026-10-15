import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { FLOCK, ROADS, secs } from '../src/sim/data';
import { addSheep, flockCap, flockOf, grassy } from '../src/sim/flocks';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { spawnAnimal } from '../src/sim/animals';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import { walkable } from '../src/sim/grid';
import type { Animal, Building, GameState, Unit } from '../src/sim/types';
import { R_MEAT } from '../src/sim/types';

/** Flocks (#308): the steppe's food that walks. */

const game = () => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const citizens = (s: GameState, owner = 0) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'citizen');
const sheep = (s: GameState, owner = 0) => s.animals.filter((a) => a.kind === 'sheep' && a.owner === owner);
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const rich = (s: GameState) => { s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; };
/** Puts player 0 on the steppe directly. */
const nomads = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'steppe'; s.players[0].epoch = 1; });
const refusals = (s: GameState) => s.events.filter((e) => e.k === 'refused').map((e) => (e.k === 'refused' ? e.why : ''));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
/** Clears the wild from the map, so only the flock moves. */
const tame = (s: GameState) => { s.animals = []; };

describe('flocks (#308)', () => {
  it('come with the first steps onto the steppe: two sheep at each Town Center', () => {
    const s = game(); const p = s.players[0]; rich(s);
    p.stats.hunted = 400;
    const road = ROADS.find((r) => r.to === 'steppe')!;
    const camp = { x: tc(s).x, y: tc(s).y };
    // The road's clue: a finished Hunting Camp.
    placeBuilding(s, 0, 'huntcamp', p.startX + 8, p.startY + 6, true);
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'steppe' }]);
    run(s, road.time + 1);
    expect(ageOf(p)).toBe('steppe');
    expect(sheep(s).length).toBe(FLOCK.start);
    for (const a of sheep(s)) expect(dist(a, camp)).toBeLessThan(FLOCK.range + 3);
  });

  it('are raised at a Town Center for food, only on the steppe and only up to the cap', () => {
    const s = game(); const p = s.players[0]; rich(s); tame(s);
    step(s, [{ t: 'lamb', p: 0, building: tc(s).id }]);
    expect(refusals(s)[0]).toContain('steppe');
    nomads(s);
    const food = p.res.food;
    step(s, [{ t: 'lamb', p: 0, building: tc(s).id }]);
    expect(p.res.food).toBe(food - FLOCK.cost.food!);
    expect(sheep(s).length).toBe(1);
    expect(sheep(s)[0].lamb).toBeDefined();
    expect(flockCap(s, 0)).toBe(FLOCK.cap);
    for (let i = 0; i < FLOCK.cap + 2; i++) step(s, [{ t: 'lamb', p: 0, building: tc(s).id }]);
    expect(flockOf(s, 0)).toBe(FLOCK.cap);
    expect(refusals(s)[0]).toContain('full');
    // A lamb grows up.
    run(s, FLOCK.lamb + 1);
    expect(sheep(s).every((a) => a.lamb === undefined && a.hp === FLOCK.hp)).toBe(true);
  });

  it('crop the grass bare as they graze, and it grows back', () => {
    const s = game(); nomads(s); tame(s);
    const t = tc(s);
    const a = addSheep(s, 0, t.x + 4.5, t.y + 0.5, false);
    run(s, FLOCK.bite * 6);
    const bare: number[] = [];
    for (let i = 0; i < s.w * s.h; i++) if (s.grazed![i] > s.tick) bare.push(i);
    expect(bare.length).toBeGreaterThanOrEqual(4);
    expect(a.milk).toBeGreaterThan(0);
    // Every cropped tile lies near the camp.
    for (const i of bare) expect(dist({ x: (i % s.w) + 0.5, y: Math.floor(i / s.w) + 0.5 }, t)).toBeLessThan(FLOCK.range + 1.5);
    const first = bare[0];
    expect(grassy(s, first % s.w, Math.floor(first / s.w))).toBe(false);
    s.animals = [];
    run(s, FLOCK.regrow / 0.4 + 1);
    expect(grassy(s, first % s.w, Math.floor(first / s.w))).toBe(true);
  });

  it('go hungry once the ground about the camp is grazed out', () => {
    const s = game(); nomads(s); tame(s);
    const t = tc(s);
    const a = addSheep(s, 0, t.x + 4.5, t.y + 0.5, false);
    // Crop everything around the camp.
    s.grazed!.fill(s.tick + secs(9999));
    let told = false;
    for (let i = 0; i < secs(FLOCK.bite * 2 + 1); i++) {
      step(s);
      if (s.events.some((e) => e.k === 'flock' && e.what === 'hungry' && e.owner === 0)) told = true;
    }
    expect(a.hungry).toBe(true);
    expect(told).toBe(true);
  });

  it('fill their udders, then fatten and bear lambs while left unmilked', () => {
    const s = game(); nomads(s); tame(s);
    const t = tc(s);
    const a = addSheep(s, 0, t.x + 4.5, t.y + 0.5, false);
    a.milk = FLOCK.udder;
    a.fat = FLOCK.breed - FLOCK.fat;
    run(s, FLOCK.bite * 3);
    expect(flockOf(s, 0)).toBe(2);
    expect(sheep(s).filter((x) => x.lamb !== undefined).length).toBe(1);
  });

  it('are milked by citizens, slowly and again and again, into the food store', () => {
    const s = game(); const p = s.players[0]; nomads(s); tame(s);
    const t = tc(s);
    const a = addSheep(s, 0, t.x + 4.5, t.y + 0.5, false);
    a.milk = FLOCK.udder;
    const food = p.res.food;
    const u = citizens(s)[0];
    step(s, [{ t: 'milk', p: 0, ids: [u.id], target: a.id }]);
    run(s, 40);
    expect(p.res.food).toBeGreaterThan(food);
    expect(u.order.k).toBe('milk');
    // Lambs and other peoples' sheep can't be milked.
    const lamb = addSheep(s, 0, t.x + 5.5, t.y + 0.5, true);
    step(s, [{ t: 'milk', p: 0, ids: [u.id], target: lamb.id }]);
    expect(refusals(s)[0]).toContain('lamb');
    const theirs = addSheep(s, 1, t.x + 5.5, t.y + 1.5, false);
    step(s, [{ t: 'milk', p: 0, ids: [u.id], target: theirs.id }]);
    expect(refusals(s)[0]).toContain('own');
  });

  it('are slaughtered for a carcass worth more than a deer, and fat adds to it', () => {
    const s = game(); nomads(s); tame(s);
    const t = tc(s);
    const a = addSheep(s, 0, t.x + 4.5, t.y + 0.5, false);
    a.fat = 10;
    const u = citizens(s)[0];
    step(s, [{ t: 'hunt', p: 0, ids: [u.id], target: a.id }]);
    run(s, 15);
    expect(s.animals.includes(a)).toBe(false);
    let meat = 0;
    for (let i = 0; i < s.w * s.h; i++) if (s.res[i] === R_MEAT) meat += s.amount[i];
    expect(meat).toBeGreaterThan(FLOCK.meat);
  });

  it('follow their camp when it is struck and driven off', () => {
    const s = game(); nomads(s); tame(s);
    const t = tc(s);
    const a = addSheep(s, 0, t.x + 4.5, t.y + 0.5, false);
    step(s, [{ t: 'pack', p: 0, building: t.id }]);
    const w = s.ents.find((e): e is Unit => e.kind === 'unit' && e.type === 'wagon')!;
    expect(w).toBeTruthy();
    const to = { x: w.x + (w.x < s.w / 2 ? 14 : -14), y: w.y };
    step(s, [{ t: 'move', p: 0, ids: [w.id], x: to.x, y: to.y }]);
    run(s, 40);
    expect(dist(w, to)).toBeLessThan(2);
    expect(dist(a, w)).toBeLessThan(FLOCK.range + 2);
  });

  it('draw wolves from their dens, unless Hounds watch them near camp', () => {
    for (const hounds of [false, true]) {
      const s = game(); nomads(s); tame(s);
      // Nobody about for the pack to fight instead.
      for (const e of s.ents) if (e.kind === 'unit') e.inside = tc(s, e.owner).id;
      if (hounds) restat(s, s.players[0], () => s.players[0].techs.push('hounds'));
      const t = tc(s);
      // A den a few tiles past the flock, over open ground.
      const open = (x: number, y: number) => { for (let k = 0; k <= 8; k++) if (!walkable(s, Math.floor(x + k), Math.floor(y))) return false; return true; };
      let at = { x: 0, y: 0 };
      for (let dy = -5; dy <= 5 && !at.x; dy++) for (let dx = 3; dx <= 5; dx++) if (open(t.x + dx + 0.5, t.y + dy + 0.5)) { at = { x: t.x + dx + 0.5, y: t.y + dy + 0.5 }; break; }
      expect(at.x).toBeGreaterThan(0);
      const a = addSheep(s, 0, at.x, at.y, false);
      a.milk = FLOCK.udder;
      const wolf = spawnAnimal(s, at.x + 8, at.y, 'wolf');
      wolf.cool = 0;
      let lost = false;
      for (let i = 0; i < secs(40) && !lost; i++) {
        step(s);
        if (s.events.some((e) => e.k === 'flock' && e.what === 'wolf')) lost = true;
      }
      expect(lost, hounds ? 'with hounds' : 'without hounds').toBe(!hounds);
    }
  });

  it('are rustled by a rival who finds them unwatched, and follow the rustler', () => {
    const s = game(); nomads(s); tame(s);
    const t = tc(s);
    s.peaceUntil = 0;
    // A sheep strayed far from its camp and its people.
    const a = addSheep(s, 0, t.x + 30.5, t.y + 0.5, false);
    a.homeX = a.x;
    a.homeY = a.y;
    const rider = spawnUnit(s, 1, 'cavalry', a.x + 1, a.y);
    run(s, 2);
    expect(a.owner).toBe(1);
    expect(a.lead).toBe(rider.id);
    // But not from under its people's eyes.
    const b = addSheep(s, 0, t.x + 4.5, t.y + 0.5, false);
    spawnUnit(s, 1, 'cavalry', b.x + 1, b.y);
    run(s, 2);
    expect(b.owner).toBe(0);
  });

  it('walk out from under a camp pitched over them', () => {
    const s = game(); nomads(s); tame(s);
    const t = tc(s);
    const a = addSheep(s, 0, t.x + 0.3, t.y + 0.3, false);
    run(s, FLOCK.bite * 4);
    expect(walkable(s, Math.floor(a.x), Math.floor(a.y))).toBe(true);
  });

  it('save and load, and play the same after', () => {
    const s = game(); nomads(s); tame(s);
    const t = tc(s);
    addSheep(s, 0, t.x + 4.5, t.y + 0.5, false);
    addSheep(s, 0, t.x + 4.5, t.y + 2.5, true);
    run(s, 10);
    const copy = deserialize(serialize(s));
    run(s, 20);
    run(copy, 20);
    const sum = (g: GameState) => g.animals.map((x: Animal) => `${x.id}:${x.x.toFixed(4)},${x.y.toFixed(4)},${x.milk},${x.fat}`).join(' ');
    expect(sum(copy)).toBe(sum(s));
    expect(Array.from(copy.grazed!)).toEqual(Array.from(s.grazed!));
  });

  it('leave a match without sheep exactly as it was (no grazing state is made)', () => {
    const s = game();
    run(s, 30);
    expect(s.grazed).toBeUndefined();
  });
});
