import { describe, expect, it } from 'vitest';
import { ageOf, barred, buildBarred, mainRoad, pathCarry, pathDepth, roadKnown, roadProblem, roadsFrom } from '../src/sim/ages';
import { AGES, CALL_UP, PATHS, ROADS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf, trainTimeFor } from '../src/sim/stats';
import { callUpProblem, callUpReach } from '../src/sim/warcamp';
import type { Building, GameState, Unit } from '../src/sim/types';
import { maxHp, placeBuilding, spawnUnit } from '../src/sim/world';

/** The Path of Blood's last step (#313): the Age of Total War, and the call to arms at its War Camps. */

const road = ROADS.find((r) => r.to === 'totalwar')!;
const game = (): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.players[0].epoch = 4;
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  return s;
};
const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const units = (s: GameState, type: string, owner = 0) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === type);
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
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};
/** Player 0 walked the Warband and Iron and Blood, trained the camp's soldiers, and turns into Total War from the Industrial Age. */
const enter = (s: GameState) => {
  const p = s.players[0];
  barracks(s);
  p.walked = ['warband', 'ironblood'];
  p.stats.campTrained = road.deed!.n;
  step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'totalwar' }]);
  run(s, road.time + 0.2);
};
/** A finished camp of player 0's at home (far from its own citizens), kept by a soldier, with citizens set down by it. */
const muster = (s: GameState, near: number[] = [1, 2]) => {
  const p = s.players[0];
  // The Town Center's own citizens go far off, so only the ones placed here stand in reach.
  for (const c of units(s, 'citizen')) {
    c.x = p.startX < s.w / 2 ? 1.5 : s.w - 1.5;
    c.y = p.startY < s.h / 2 ? 1.5 : s.h - 1.5;
  }
  const at = spot(s, 'warcamp', p.startX, p.startY, 6, 14);
  const camp = placeBuilding(s, 0, 'warcamp', at.tx, at.ty, true);
  spawnUnit(s, 0, 'cavalry', camp.x - 1.5, camp.y - 1.5);
  const folk = near.map((d) => spawnUnit(s, 0, 'citizen', camp.x + d, camp.y + 1.2));
  return { camp, folk };
};

describe('the Age of Total War', () => {
  it('is the path of blood at tier 4, a turn off the Industrial Age that only Iron and Blood finds', () => {
    expect(AGES.totalwar.path).toBe('blood');
    expect(AGES.totalwar.tier).toBe(4);
    expect(AGES.totalwar.callUp).toBe(true);
    expect(road.from).toBe('industrial');
    expect(road.walked).toBe('ironblood');
    expect(road.deed!.stat).toBe('campTrained');
    expect(ROADS.filter((r) => r.from === 'totalwar').map((r) => r.to)).toEqual(['industrial']);
    // The last age of the path is built: what is still planned is not an age.
    expect(PATHS.blood.planned!.some((x) => /Total War/.test(x))).toBe(false);
  });

  it('stays hidden from a people that never walked Iron and Blood, then waits on soldiers trained at camps', () => {
    const s = game();
    const p = s.players[0];
    barracks(s);
    p.walked = ['warband'];
    p.stats.campTrained = 99;
    expect(roadKnown(s, p, road)).toBe(false);
    expect(roadProblem(s, p, road)).toContain('Iron and Blood');
    p.walked = ['warband', 'ironblood'];
    p.stats.campTrained = 0;
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadProblem(s, p, road)).toContain(`0/${road.deed!.n}`);
    p.stats.campTrained = road.deed!.n;
    expect(roadProblem(s, p, road)).toBeNull();
  });

  it('counts foot soldiers trained at War Camps, the deed, and not those from a Barracks', () => {
    const s = game();
    const p = s.players[0];
    p.epoch = 3;
    p.age = 'ironblood';
    p.walked = ['warband'];
    const b = barracks(s);
    const at = spot(s, 'warcamp', p.startX, p.startY, 6, 14);
    const camp = placeBuilding(s, 0, 'warcamp', at.tx, at.ty, true);
    spawnUnit(s, 0, 'infantry', camp.x + 1.5, camp.y + 1.5);
    step(s, [
      { t: 'train', p: 0, building: camp.id, unit: 'infantry' },
      { t: 'train', p: 0, building: b.id, unit: 'infantry' },
    ]);
    run(s, trainTimeFor(s, 0, 'infantry', 'warcamp') + 1);
    expect(p.stats.trained).toBeGreaterThanOrEqual(2);
    expect(p.stats.campTrained).toBe(1);
  });

  it('carries the whole path: the deepest plunder, no traders, thinner fields, War Camps again', () => {
    const s = game();
    const p = s.players[0];
    enter(s);
    expect(ageOf(p)).toBe('totalwar');
    expect(p.epoch).toBe(4);
    expect(pathDepth(p)).toBe(3);
    expect(pathCarry(p)).toEqual({ path: 'blood', times: 2 });
    expect(modsOf(s, 0).plunder).toBeCloseTo(AGES.totalwar.add!.plunder! + 2 * PATHS.blood.carry!.plunder!);
    expect(modsOf(s, 0).farm).toBeLessThan(AGES.ironblood.mul!.farm!);
    expect(barred(p, 'trader')).toContain('Path of Blood');
    expect(buildBarred(p, 'warcamp')).toBeNull();
    expect(mainRoad(p)).toBeUndefined();
    expect(roadsFrom(p).map((r) => r.to)).toEqual(['industrial']);
  });
});

describe('the call to arms', () => {
  it('turns the nearest citizen into a foot soldier where it stood, for its arms, with the health it had', () => {
    const s = game();
    const p = s.players[0];
    enter(s);
    const { camp, folk } = muster(s);
    step(s);
    const [first, second] = folk;
    first.hp = maxHp(s, first) / 2;
    const at = { x: first.x, y: first.y };
    const res = { ...p.res };
    const pop = p.pop;
    const soldiers = units(s, 'infantry').length;
    expect(callUpReach(s, camp).map((u) => u.id)).toEqual([first.id, second.id]);
    expect(callUpProblem(s, p, camp)).toBeNull();
    step(s, [{ t: 'callUp', p: 0, building: camp.id }]);
    expect(s.byId.has(first.id)).toBe(false);
    expect(s.byId.has(second.id)).toBe(true);
    const ids = s.events.flatMap((e) => (e.k === 'callUp' ? e.ids : []));
    expect(ids).toHaveLength(1);
    const man = s.byId.get(ids[0]) as Unit;
    expect(man.type).toBe('infantry');
    expect(man.owner).toBe(0);
    expect(man.hp).toBeCloseTo(maxHp(s, man) / 2);
    expect(Math.abs(man.x - at.x) + Math.abs(man.y - at.y)).toBeLessThan(0.5);
    expect(units(s, 'infantry')).toHaveLength(soldiers + 1);
    expect(p.res.wood).toBe(res.wood - CALL_UP.cost.wood!);
    expect(p.res.gold).toBe(res.gold - CALL_UP.cost.gold!);
    expect(p.pop).toBe(pop);
    expect(p.stats.calledUp).toBe(1);
  });

  it('rests the camp after each call, and calls at most five at once', () => {
    const s = game();
    const p = s.players[0];
    enter(s);
    const { camp } = muster(s, [1, 1.5, 2, 2.5, 3, 3.5, 4]);
    step(s, [{ t: 'callUp', p: 0, building: camp.id, n: 1 }]);
    step(s, [{ t: 'callUp', p: 0, building: camp.id, n: 1 }]);
    expect(s.events.some((e) => e.k === 'refused' && e.owner === 0 && /mustering/.test(e.why))).toBe(true);
    expect(p.stats.calledUp).toBe(1);
    run(s, CALL_UP.rest);
    expect(callUpProblem(s, p, camp)).toBeNull();
    step(s, [{ t: 'callUp', p: 0, building: camp.id, n: 99 }]);
    expect(p.stats.calledUp).toBe(1 + CALL_UP.most);
    expect(callUpReach(s, camp)).toHaveLength(7 - 1 - CALL_UP.most);
    expect(callUpProblem(s, p, camp)).toMatch(/mustering/);
  });

  it('calls no one beyond its reach, in another age, or with no arms to give', () => {
    const s = game();
    const p = s.players[0];
    enter(s);
    const { camp, folk } = muster(s, [CALL_UP.reach + 2]);
    expect(callUpProblem(s, p, camp)).toContain(`within ${CALL_UP.reach} tiles`);
    folk[0].x = camp.x + 1;
    expect(callUpProblem(s, p, camp)).toBeNull();
    const gold = p.res.gold;
    p.res.gold = CALL_UP.cost.gold! - 1;
    expect(callUpProblem(s, p, camp)).toContain('gold');
    step(s, [{ t: 'callUp', p: 0, building: camp.id }]);
    expect(s.byId.has(folk[0].id)).toBe(true);
    p.res.gold = gold;
    // Iron and Blood pitches camps but calls no one to arms.
    p.epoch = 3;
    p.age = 'ironblood';
    expect(callUpProblem(s, p, camp)).toContain('total war');
  });

  it('never calls another people’s citizens, nor answers another people’s order', () => {
    const s = game();
    enter(s);
    const { camp } = muster(s, []);
    const theirs = spawnUnit(s, 1, 'citizen', camp.x + 1, camp.y + 1);
    expect(callUpReach(s, camp)).toHaveLength(0);
    s.players[1].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    step(s, [{ t: 'callUp', p: 1, building: camp.id, n: 5 }]);
    expect(s.byId.has(theirs.id)).toBe(true);
    expect(s.events.some((e) => e.k === 'callUp')).toBe(false);
  });

  it('leaves its soldiers standing when the people makes peace, and strikes the camps', () => {
    const s = game();
    const p = s.players[0];
    enter(s);
    const { camp } = muster(s);
    step(s, [{ t: 'callUp', p: 0, building: camp.id, n: 2 }]);
    const called = units(s, 'infantry').length;
    const back = ROADS.find((r) => r.from === 'totalwar' && r.to === 'industrial')!;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'industrial' }]);
    run(s, back.time + 0.2);
    expect(ageOf(p)).toBe('industrial');
    expect(modsOf(s, 0).plunder).toBe(0);
    expect(units(s, 'infantry')).toHaveLength(called);
    const hp = camp.hp;
    run(s, 2);
    expect(camp.hp).toBeLessThan(hp);
    expect(callUpProblem(s, p, camp)).not.toBeNull();
  });

  it('survives a save while the camp rests, and plays on the same', () => {
    const s = game();
    enter(s);
    const { camp } = muster(s, [1, 2, 3]);
    step(s, [{ t: 'callUp', p: 0, building: camp.id, n: 2 }]);
    const t = deserialize(serialize(s));
    const back = t.byId.get(camp.id) as Building;
    expect(back.muster).toBe(camp.muster);
    expect(t.players[0].stats.calledUp).toBe(2);
    for (let i = 0; i < secs(CALL_UP.rest * 2); i++) {
      step(s, i === secs(CALL_UP.rest * 2) - 1 ? [{ t: 'callUp', p: 0, building: camp.id }] : []);
      step(t, i === secs(CALL_UP.rest * 2) - 1 ? [{ t: 'callUp', p: 0, building: camp.id }] : []);
    }
    expect(t.players[0].stats.calledUp).toBe(3);
    expect(serialize(t)).toBe(serialize(s));
  });
});
