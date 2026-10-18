import { describe, expect, it } from 'vitest';
import { buildBarred } from '../src/sim/ages';
import { landOwnerAt } from '../src/sim/borders';
import { applyCommand } from '../src/sim/commands';
import { CIVS, FLOCK, NOMAD, TECHS, TRIBUTE, secs } from '../src/sim/data';
import { addSheep, flockCap, flockOf } from '../src/sim/flocks';
import { createGame, step } from '../src/sim/game';
import { mineable } from '../src/sim/household';
import { isNomad, quarries } from '../src/sim/nomad';
import { packProblem } from '../src/sim/steppe';
import { tributeStep } from '../src/sim/tribute';
import { R_GOLD, R_STONE, R_TREE } from '../src/sim/types';
import type { Building, GameState, Unit } from '../src/sim/types';
import { countPop, placeBuilding, restat, spawnUnit } from '../src/sim/world';
import { findResource, milkRate } from '../src/sim/units';

// Born on the move (#501, the Mongols): the camp is on wagons and the flock walks with it from the first minute; no fields, no quarry.
const game = (rival: 'greeks' | 'mongols' = 'greeks') => createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'mongols' }, { name: 'B', ai: null, civ: rival }] });
const tcOf = (s: GameState, owner: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const citizen = (s: GameState, owner: number) => s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'citizen')!;
const run = (s: GameState, seconds: number, each?: () => void) => {
  for (let i = 0; i < secs(seconds); i++) {
    step(s);
    each?.();
  }
};

/** A rider of player 0 standing in player 1's land, out of its Town Center's arrows, with player 1's people cleared away. */
function riderInRivalLand(s: GameState): Unit {
  s.ents = s.ents.filter((e) => e.kind !== 'unit' || e.owner !== 1);
  for (const [id, e] of s.byId) if (e.kind === 'unit' && e.owner === 1) s.byId.delete(id);
  const home = tcOf(s, 1);
  const dir = Math.sign(s.w / 2 - home.x) || 1;
  const u = spawnUnit(s, 0, 'cavalry', home.x + dir * 11, home.y + 0.5);
  expect(landOwnerAt(s, Math.floor(u.x), Math.floor(u.y))).toBe(1);
  return u;
}

describe('born on the move (#501, the Mongols)', () => {
  it('gives the Mongols a verb and a door, and only them', () => {
    expect(CIVS.mongols.nomad).toBe(true);
    expect(CIVS.mongols.verb).toBeTruthy();
    expect(CIVS.mongols.door).toBeTruthy();
    const s = game();
    expect(isNomad(s.players[0])).toBe(true);
    expect(isNomad(s.players[1])).toBe(false);
  });

  it('starts the Mongol camp with its flock, and packs its Town Center in the Stone Age', () => {
    const s = game();
    expect(s.players[0].epoch).toBe(0);
    expect(flockOf(s, 0)).toBe(NOMAD.start);
    expect(flockOf(s, 1)).toBe(0);
    expect(packProblem(s, s.players[0], tcOf(s, 0))).toBeNull();
    expect(packProblem(s, s.players[1], tcOf(s, 1))).toBeTruthy();
    applyCommand(s, { t: 'pack', p: 0, building: tcOf(s, 0).id });
    expect(s.ents.some((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'wagon' && e.packed === 'towncenter')).toBe(true);
  });

  it('raises a lamb at a Mongol Town Center in the Stone Age', () => {
    const s = game();
    applyCommand(s, { t: 'lamb', p: 0, building: tcOf(s, 0).id });
    expect(flockOf(s, 0)).toBe(NOMAD.start + 1);
    applyCommand(s, { t: 'lamb', p: 1, building: tcOf(s, 1).id });
    expect(flockOf(s, 1)).toBe(0);
  });

  it('tills no field in any epoch, and quarries no stone, while the rival does both', () => {
    const s = game();
    const p = s.players[0];
    for (const epoch of [0, 1, 2, 3, 4]) {
      restat(s, p, () => { p.epoch = epoch; delete p.age; });
      expect(buildBarred(p, 'farm')).toContain('tills no fields');
      expect(buildBarred(p, 'house')).toBeNull();
    }
    expect(buildBarred(s.players[1], 'farm')).toBeNull();
    expect(quarries(p, R_STONE)).toBe(false);
    expect(mineable(p, R_STONE)).toBe(false);
    expect(mineable(p, R_GOLD)).toBe(true);
    expect(mineable(p, R_TREE)).toBe(true);
    expect(mineable(s.players[1], R_STONE)).toBe(true);
  });

  it('refuses a gather order on a stone quarry from a Mongol citizen, and takes it from a Greek one', () => {
    const s = game();
    const stone = findResource(s, R_STONE, tcOf(s, 0).x, tcOf(s, 0).y, 60);
    expect(stone).toBeGreaterThanOrEqual(0);
    const mo = citizen(s, 0);
    const gr = citizen(s, 1);
    applyCommand(s, { t: 'gather', p: 0, ids: [mo.id], tile: stone });
    applyCommand(s, { t: 'gather', p: 1, ids: [gr.id], tile: stone });
    expect(mo.order.k).not.toBe('gather');
    expect(gr.order.k).toBe('gather');
  });

  it('keeps more sheep for every finished House, standing or on its wagon', () => {
    const s = game();
    const tc = tcOf(s, 0);
    const before = flockCap(s, 0);
    expect(before).toBe(FLOCK.cap);
    const h = placeBuilding(s, 0, 'house', Math.floor(tc.x) + 6, Math.floor(tc.y) + 6, true);
    countPop(s);
    expect(flockCap(s, 0)).toBe(before + NOMAD.house);
    applyCommand(s, { t: 'pack', p: 0, building: h.id });
    expect(flockCap(s, 0)).toBe(before + NOMAD.house);
    // A House under construction keeps none.
    placeBuilding(s, 0, 'house', Math.floor(tc.x) - 8, Math.floor(tc.y) + 6, false);
    expect(flockCap(s, 0)).toBe(before + NOMAD.house);
    // A Greek House keeps no sheep.
    const t1 = tcOf(s, 1);
    placeBuilding(s, 1, 'house', Math.floor(t1.x) + 6, Math.floor(t1.y) + 6, true);
    expect(flockCap(s, 1)).toBe(FLOCK.cap);
  });

  it('milks more from a Mongol sheep than from a steppe sheep of a settled people, bite for bite', () => {
    const s = game('greeks');
    const g = s.players[1];
    restat(s, g, () => { g.age = 'steppe'; g.epoch = 1; });
    const m = addSheep(s, 0, tcOf(s, 0).x + 3.5, tcOf(s, 0).y + 4.5, false);
    const o = addSheep(s, 1, tcOf(s, 1).x + 3.5, tcOf(s, 1).y + 4.5, false);
    s.animals = s.animals.filter((a) => a === m || a === o || a.kind !== 'sheep');
    run(s, FLOCK.bite * 4 + 1);
    expect(m.milk!).toBeGreaterThan(o.milk!);
  });

  it('puts the Plow into a Mongol dairy, and not into a settled people\'s', () => {
    const s = game('greeks');
    const m = citizen(s, 0);
    const g = citizen(s, 1);
    const before = { m: milkRate(s, m), g: milkRate(s, g) };
    for (const p of s.players) restat(s, p, () => p.techs.push('plow'));
    expect(milkRate(s, m)).toBeCloseTo(before.m * TECHS.plow.mul!.farm!, 6);
    expect(milkRate(s, g)).toBeCloseTo(before.g, 6);
  });

  it('takes stone with the gold as tribute, where a settled horde takes gold alone', () => {
    const s = game();
    const p = s.players[0];
    restat(s, p, () => { p.epoch = 1; });
    s.peaceUntil = 0;
    riderInRivalLand(s);
    s.players[1].res = { food: 0, wood: 0, gold: 500, stone: 500 };
    const was = { ...p.res };
    s.tick = secs(TRIBUTE.every) * 40;
    tributeStep(s);
    const gold = p.res.gold - was.gold;
    const stone = p.res.stone - was.stone;
    expect(gold).toBeCloseTo(CIVS.mongols.add!.tribute! * TRIBUTE.every, 6);
    expect(stone).toBeCloseTo(gold * NOMAD.stone, 6);
    expect(s.players[1].res.stone).toBeCloseTo(500 - stone, 6);
    expect(p.stats.tributeStone).toBeCloseTo(stone, 6);
    // A rival with an empty purse still pays in stone.
    s.players[1].res.gold = 0;
    const st = p.res.stone;
    s.tick += secs(TRIBUTE.every);
    tributeStep(s);
    expect(p.res.stone).toBeGreaterThan(st);
  });

  it('gives a settled people in the Horde gold and no stone', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'greeks' }] });
    const p = s.players[0];
    restat(s, p, () => { p.age = 'horde'; p.epoch = 2; p.walked = ['steppe', 'horde']; });
    s.peaceUntil = 0;
    riderInRivalLand(s);
    s.players[1].res = { food: 0, wood: 0, gold: 500, stone: 500 };
    const stone = p.res.stone;
    s.tick = secs(TRIBUTE.every) * 40;
    tributeStep(s);
    expect(p.res.gold).toBeGreaterThan(0);
    expect(p.res.stone).toBe(stone);
    expect(s.players[1].res.stone).toBe(500);
  });

  it('a Mongol computer buys stone at its Market when it runs short', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: 'easy', civ: 'mongols' }, { name: 'B', ai: null, civ: 'greeks' }] });
    const p = s.players[0];
    restat(s, p, () => { p.epoch = 1; });
    const tc = tcOf(s, 0);
    placeBuilding(s, 0, 'market', Math.floor(tc.x) + 7, Math.floor(tc.y) - 2, true);
    p.res = { food: 200, wood: 200, gold: 900, stone: 0 };
    let bought = 0;
    run(s, 20, () => { for (const e of s.events) if (e.k === 'trade' && e.owner === 0 && e.buy && e.res === 'stone') bought++; });
    expect(bought).toBeGreaterThan(0);
    expect(p.res.stone).toBeGreaterThan(0);
  });

  it('a Mongol computer milks its flock, lays no field and quarries no stone in its first minutes', () => {
    const s = createGame({ seed: 3, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'mongols' }, { name: 'B', ai: null, civ: 'greeks' }] });
    let milkers = 0;
    let quarried = false;
    run(s, 240, () => {
      const mine = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
      milkers = Math.max(milkers, mine.filter((u) => u.order.k === 'milk').length);
      quarried ||= mine.some((u) => u.order.k === 'gather' && s.res[u.order.tile] === R_STONE);
    });
    expect(milkers).toBeGreaterThan(0);
    expect(quarried).toBe(false);
    expect(s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'farm')).toBe(false);
    expect(s.players[0].stats.milked ?? 0).toBeGreaterThan(0);
  });
});
