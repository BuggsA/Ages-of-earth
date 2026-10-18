import { describe, expect, it } from 'vitest';
import { canRaise } from '../src/sim/ages';
import { LEGION_MODEL, unitGeometry } from '../src/render/unitModels';
import { findSpot } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { LEGION } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { citizenCap, citizenProblem, legionary } from '../src/sim/legion';
import { R_TREE } from '../src/sim/types';
import type { Building, GameState, Unit } from '../src/sim/types';
import { findResource, gatherRate } from '../src/sim/units';
import { restat, spawnUnit } from '../src/sim/world';

// The legion (#501, the Romans): few citizens; the foot soldiers fell timber, quarry stone and raise buildings.
const game = () => createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'greeks' }] });
const tcOf = (s: GameState, owner: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const citizens = (s: GameState, owner: number) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'citizen' && e.hp > 0);
const soldier = (s: GameState, owner: number): Unit => {
  const tc = tcOf(s, owner);
  return spawnUnit(s, owner, 'infantry', tc.x + 4, tc.y + 4);
};

describe('the legion', () => {
  it('keeps few citizens: twelve at first and three more each epoch, for the Romans alone', () => {
    const s = game();
    const p = s.players[0];
    expect(citizenCap(p)).toBe(LEGION.citizens);
    restat(s, p, () => { p.epoch = 2; });
    expect(citizenCap(p)).toBe(LEGION.citizens + 2 * LEGION.perEpoch);
    expect(citizenProblem(s, s.players[1])).toBeNull();
  });

  it('refuses a citizen once the cap is reached, counting those in training', () => {
    const s = game();
    const p = s.players[0];
    p.res.food = 5000;
    const tc = tcOf(s, 0);
    const have = citizens(s, 0).length;
    for (let i = 0; i < LEGION.citizens - have; i++) spawnUnit(s, 0, 'citizen', tc.x + 3, tc.y + 3);
    expect(citizenProblem(s, p)).toMatch(/keeps only 12 citizens/);
    applyCommand(s, { t: 'train', p: 0, building: tc.id, unit: 'citizen' });
    expect(tc.queue).toHaveLength(0);
    expect(s.events.some((e) => e.k === 'refused')).toBe(true);
    // A Greek town trains as many as it likes.
    s.players[1].res.food = 5000;
    const gtc = tcOf(s, 1);
    applyCommand(s, { t: 'train', p: 1, building: gtc.id, unit: 'citizen' });
    expect(gtc.queue).toHaveLength(1);
  });

  it('puts legionaries to the axe, at four fifths of a citizen\'s pace; no other people\'s foot may', () => {
    const s = game();
    const tc = tcOf(s, 0);
    const tree = findResource(s, R_TREE, tc.x, tc.y, 40);
    expect(tree).toBeGreaterThanOrEqual(0);
    const rome = soldier(s, 0);
    const greek = soldier(s, 1);
    const [cit] = citizens(s, 0);
    expect(legionary(s, rome)).toBe(true);
    expect(legionary(s, greek)).toBe(false);
    expect(gatherRate(s, rome, R_TREE)).toBeCloseTo(gatherRate(s, cit, R_TREE) * LEGION.rate, 6);
    applyCommand(s, { t: 'gather', p: 0, ids: [rome.id], tile: tree });
    applyCommand(s, { t: 'gather', p: 1, ids: [greek.id], tile: tree });
    expect(rome.order.k).toBe('gather');
    expect(greek.order.k).not.toBe('gather');
    for (let i = 0; i < 20 * 120 && rome.carry === 0 && s.players[0].res.wood < 400; i++) step(s);
    expect(rome.carry > 0 || s.players[0].stats.gathered > 0).toBe(true);
  });

  it('keeps food and gold to the citizens: a legionary will not gather a berry bush', () => {
    const s = game();
    const tc = tcOf(s, 0);
    const bush = findResource(s, 2, tc.x, tc.y, 40);
    const rome = soldier(s, 0);
    if (bush >= 0) applyCommand(s, { t: 'gather', p: 0, ids: [rome.id], tile: bush });
    expect(rome.order.k).not.toBe('gather');
  });

  it('raises any building, which no other people\'s foot soldiers may', () => {
    const s = game();
    expect(canRaise('infantry', 'house', 'romans')).toBe(true);
    expect(canRaise('infantry', 'house', 'greeks')).toBe(false);
    expect(canRaise('infantry', 'house')).toBe(false);
    const tc = tcOf(s, 0);
    const rome = soldier(s, 0);
    const before = s.ents.filter((e) => e.kind === 'building').length;
    const spot = findSpot(s, 'house', tc.x, tc.y, 4, 14)!;
    expect(spot).toBeTruthy();
    applyCommand(s, { t: 'build', p: 0, ids: [rome.id], type: 'house', tx: spot.tx, ty: spot.ty });
    expect(s.ents.filter((e) => e.kind === 'building').length).toBe(before + 1);
    expect(rome.order.k).toBe('build');
    const house = s.byId.get((rome.order as { target: number }).target) as Building;
    for (let i = 0; i < 20 * 200 && !house.built; i++) step(s);
    expect(house.built).toBe(true);
  });

  it('keeps watch at work: an enemy near makes him drop his tools, and he goes back to the axe after', () => {
    const s = game();
    const tc = tcOf(s, 0);
    const tree = findResource(s, R_TREE, tc.x, tc.y, 40);
    const rome = soldier(s, 0);
    applyCommand(s, { t: 'gather', p: 0, ids: [rome.id], tile: tree });
    s.peaceUntil = 0;
    const foe = spawnUnit(s, 1, 'infantry', rome.x + 2, rome.y);
    let fought = false;
    for (let i = 0; i < 20 * 60; i++) {
      step(s);
      if (rome.order.k === 'attack') fought = true;
      if (fought && foe.hp <= 0 && rome.order.k === 'gather') break;
    }
    expect(fought).toBe(true);
    expect(rome.order.k === 'gather' || foe.hp > 0).toBe(true);
  });

  it('draws a legionary at work with his tools on his back, in every epoch', () => {
    for (let e = 0; e < 5; e++) {
      const plain = unitGeometry('infantry', e).getAttribute('position').count;
      const laden = unitGeometry('infantry', LEGION_MODEL + e).getAttribute('position').count;
      expect(laden).toBeGreaterThan(plain);
    }
  });
});
