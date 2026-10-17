import { describe, expect, it } from 'vitest';
import { ageOf, barred, buildBarred, mainRoad, pathCarry, pathDepth, roadKnown, roadProblem, roadsFrom } from '../src/sim/ages';
import { landOwnerAt } from '../src/sim/borders';
import { AGES, BUILDINGS, PATHS, ROADS, TICK_HZ, WARCAMP, secs } from '../src/sim/data';
import { hurt } from '../src/sim/combat';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf, statsFor, techCostFor, trainTimeFor } from '../src/sim/stats';
import type { Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The Path of Blood's second step (#303): the Age of Iron and Blood, and its War Camps. */

const road = ROADS.find((r) => r.to === 'ironblood')!;
const game = (): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.rares = []; // the deeds are the road here (#356)
  s.players[0].epoch = 3;
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  return s;
};
const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const camps = (s: GameState) => s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'warcamp');
/** A free spot for a building of player 0's, `lo`..`hi` tiles from (x, y). */
const spot = (s: GameState, type: 'barracks' | 'warcamp', x: number, y: number, lo: number, hi: number) => {
  for (let r = lo; r <= hi; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(x) + dx;
        const ty = Math.round(y) + dy;
        if (!placeProblem(s, type, tx, ty, true, 0)) return { tx, ty };
      }
  throw new Error('no room');
};
const barracks = (s: GameState) => {
  const p = s.players[0];
  const at = spot(s, 'barracks', p.startX, p.startY, 4, 20);
  return placeBuilding(s, 0, 'barracks', at.tx, at.ty, true);
};
/** Player 0 walked the Warband, took its plunder, climbed to Gunpowder and turns into Iron and Blood. */
const enter = (s: GameState) => {
  const p = s.players[0];
  barracks(s);
  p.walked = ['warband'];
  p.stats.plunder = road.deed!.n;
  step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'ironblood' }]);
  for (let i = 0; i < secs(road.time) + 2; i++) step(s);
};
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};
/** A finished camp of player 0's deep in player 1's land, out of reach of its Town Center's arrows, with soldiers by it. */
const forward = (s: GameState, soldiers = 3) => {
  const foe = tc(s, 1);
  const at = spot(s, 'warcamp', foe.x, foe.y, 10, 13);
  const camp = placeBuilding(s, 0, 'warcamp', at.tx, at.ty, true);
  const men: Unit[] = [];
  for (let i = 0; i < soldiers; i++) men.push(spawnUnit(s, 0, 'infantry', camp.x + 1.5 + i * 0.3, camp.y + 1.5));
  return { camp, men };
};

describe('the Age of Iron and Blood', () => {
  it('is the path of blood at tier 3, a turn off the Gunpowder Age with its own roads on', () => {
    expect(AGES.ironblood.path).toBe('blood');
    expect(AGES.ironblood.tier).toBe(3);
    expect(road.from).toBe('gunpowder');
    expect(road.walked).toBe('warband');
    expect(road.deed!.stat).toBe('plunder');
    expect(ROADS.filter((r) => r.from === 'ironblood').map((r) => r.to).sort()).toEqual(['gunpowder', 'industrial']);
    // Total War (s4) is still to be built.
    expect(PATHS.blood.planned!.length).toBeGreaterThan(0);
  });

  it('stays hidden from a people that never walked the Warband, plunder or not', () => {
    const s = game();
    const p = s.players[0];
    barracks(s);
    p.stats.plunder = 5000;
    expect(roadKnown(s, p, road)).toBe(false);
    expect(roadProblem(s, p, road)).toContain('Warband');
    p.walked = ['warband'];
    p.stats.plunder = 0;
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadProblem(s, p, road)).toContain(`0/${road.deed!.n}`);
    p.stats.plunder = road.deed!.n;
    expect(roadProblem(s, p, road)).toBeNull();
  });

  it('carries the Warband with it: deeper plunder, no traders, thinner fields, dearer learning', () => {
    const s = game();
    const p = s.players[0];
    const tech = techCostFor(s, 0, 'rifling');
    enter(s);
    expect(ageOf(p)).toBe('ironblood');
    expect(p.epoch).toBe(3);
    expect(pathDepth(p)).toBe(2);
    expect(pathCarry(p)).toEqual({ path: 'blood', times: 1 });
    const share = AGES.ironblood.add!.plunder! + PATHS.blood.carry!.plunder!;
    expect(modsOf(s, 0).plunder).toBeCloseTo(share);
    expect(barred(p, 'trader')).toContain('Path of Blood');
    expect(modsOf(s, 0).farm).toBeLessThan(AGES.warband.mul!.farm!);
    expect(techCostFor(s, 0, 'rifling').gold ?? 0).toBeGreaterThan(tech.gold ?? 0);
    expect(mainRoad(p)!.to).toBe('industrial');
    expect(roadsFrom(p).map((r) => r.to)).toContain('gunpowder');

    const gold = p.res.gold;
    const foe = spawnUnit(s, 1, 'infantry', s.players[1].startX, s.players[1].startY);
    const c = statsFor(s, 1, foe.type).cost;
    hurt(s, foe, foe.hp + 100, 0, null);
    const want = Math.floor(((c.food ?? 0) + (c.wood ?? 0) + (c.gold ?? 0) + (c.stone ?? 0)) * modsOf(s, 0).plunder);
    expect(p.res.gold).toBe(gold + want);
  });
});

describe('War Camps', () => {
  it('are only for the people on this step of the path', () => {
    const s = game();
    const p = s.players[0];
    expect(buildBarred(p, 'warcamp')).toContain('Iron and Blood');
    const man = spawnUnit(s, 0, 'infantry', p.startX + 3, p.startY + 3);
    const at = spot(s, 'warcamp', p.startX, p.startY, 5, 12);
    step(s, [{ t: 'build', p: 0, ids: [man.id], type: 'warcamp', tx: at.tx, ty: at.ty }]);
    expect(camps(s)).toHaveLength(0);
    expect(s.events.some((e) => e.k === 'refused' && e.owner === 0)).toBe(true);
  });

  it('are pitched by foot soldiers in enemy land, where nothing else may be built', () => {
    const s = game();
    enter(s);
    const foe = tc(s, 1);
    const at = spot(s, 'warcamp', foe.x, foe.y, 10, 13);
    expect(landOwnerAt(s, at.tx + 1, at.ty + 1)).toBe(1);
    expect(placeProblem(s, 'barracks', at.tx, at.ty, true, 0)).toBe('foreign');
    const men = [0, 1, 2].map((i) => spawnUnit(s, 0, 'infantry', at.tx + 3 + i * 0.4, at.ty + 3));
    step(s, [{ t: 'build', p: 0, ids: men.map((m) => m.id), type: 'warcamp', tx: at.tx, ty: at.ty }]);
    const camp = camps(s)[0];
    expect(camp).toBeDefined();
    expect(men.every((m) => m.order.k === 'build')).toBe(true);
    run(s, BUILDINGS.warcamp.time / 3 + 6);
    expect(camp.built).toBe(true);
    // The camp holds the land round it, inside the rival's border.
    expect(landOwnerAt(s, Math.floor(camp.x), Math.floor(camp.y))).toBe(0);
    // Soldiers never pick up other foundations after it.
    expect(men.every((m) => m.order.k !== 'build')).toBe(true);
  });

  it('trains foot soldiers at the front, slower than a Barracks', () => {
    const s = game();
    enter(s);
    const { camp } = forward(s);
    expect(trainTimeFor(s, 0, 'infantry', 'warcamp')).toBeCloseTo(trainTimeFor(s, 0, 'infantry', 'barracks') * WARCAMP.train);
    const before = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'infantry').length;
    step(s, [{ t: 'train', p: 0, building: camp.id, unit: 'infantry' }]);
    expect(camp.queue).toHaveLength(1);
    run(s, trainTimeFor(s, 0, 'infantry', 'warcamp') + 1);
    expect(s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'infantry').length).toBe(before + 1);
  });

  it('keep the army round them fed in enemy land', () => {
    // The same soldiers on the same spot, with the camp and without it.
    const a = game();
    enter(a);
    const kept = forward(a).men[0];
    const b = game();
    enter(b);
    const { camp, men } = forward(b);
    camp.hp = 0;
    run(b, 1);
    expect(camps(b)).toHaveLength(0);
    run(a, 1);
    const hpA = kept.hp;
    const hpB = men[0].hp;
    run(a, 12);
    run(b, 12);
    expect(kept.hp).toBe(hpA);
    expect(men[0].hp).toBeLessThan(hpB);
  });

  it('burn when their soldiers leave, and are saved when they come back', () => {
    const s = game();
    enter(s);
    const { camp, men } = forward(s);
    run(s, 3);
    expect(camp.alone).toBeUndefined();
    const full = camp.hp;
    for (const m of men) {
      m.x = camp.x + WARCAMP.watch + 6;
      m.order = { k: 'idle' };
      m.path = null;
    }
    let warned = false;
    for (let i = 0; i < secs(WARCAMP.grace); i++) {
      step(s);
      warned ||= s.events.some((e) => e.k === 'campAlone' && e.id === camp.id && !e.struck);
    }
    expect(warned).toBe(true);
    expect(camp.hp).toBe(full);
    run(s, 4);
    expect(camp.hp).toBeLessThan(full);
    const burnt = camp.hp;
    men[0].x = camp.x + 1.5;
    run(s, 2);
    expect(camp.alone).toBeUndefined();
    expect(camp.hp).toBe(burnt);
  });

  it('burn to the ground left alone', () => {
    const s = game();
    enter(s);
    const { camp, men } = forward(s, 1);
    men[0].hp = 0;
    run(s, WARCAMP.grace + 1 / WARCAMP.burn + 3);
    expect(camps(s)).toHaveLength(0);
    expect(camp.hp).toBeLessThanOrEqual(0);
  });

  it('are struck when the people leaves the path: they burn at once and train no more', () => {
    const s = game();
    enter(s);
    const { camp } = forward(s);
    const back = ROADS.find((r) => r.from === 'ironblood' && r.to === 'gunpowder')!;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'gunpowder' }]);
    for (let i = 0; i < secs(back.time) + 2; i++) step(s);
    expect(ageOf(s.players[0])).toBe('gunpowder');
    expect(modsOf(s, 0).plunder).toBe(0);
    const hp = camp.hp;
    run(s, 2);
    expect(camp.hp).toBeLessThan(hp);
    step(s, [{ t: 'train', p: 0, building: camp.id, unit: 'infantry' }]);
    expect(camp.queue).toHaveLength(0);
  });

  it('survive a save, countdown and all', () => {
    const s = game();
    enter(s);
    const { camp, men } = forward(s);
    for (const m of men) m.hp = 0;
    run(s, 3);
    expect(camp.alone).toBeGreaterThan(0);
    const t = deserialize(serialize(s));
    const back = t.ents.find((e): e is Building => e.kind === 'building' && e.type === 'warcamp')!;
    expect(back.alone).toBe(camp.alone);
    expect(ageOf(t.players[0])).toBe('ironblood');
    for (let i = 0; i < 5 * TICK_HZ; i++) {
      step(s);
      step(t);
    }
    expect(back.hp).toBe(camp.hp);
  });
});
