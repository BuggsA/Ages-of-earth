import { describe, expect, it } from 'vitest';
import { ageOf, barred, buildBarred, pathCarry, pathDepth, pathLine, roadKnown, roadProblem } from '../src/sim/ages';
import { bloodOf } from '../src/sim/blood';
import { AGES, BLOOD, HEMO, HEMOCRAFT, PATHS, RITE, ROADS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { feedReach, graftCost } from '../src/sim/hemo';
import { placeProblem } from '../src/sim/grid';
import { hurt } from '../src/sim/combat';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf } from '../src/sim/stats';
import type { AgeId, Building, BuildingType, GameState, Unit } from '../src/sim/types';
import { maxHp, placeBuilding, spawnUnit } from '../src/sim/world';

/** The fork at the end of the Path of Blood (#355 s2): Hemocraft and the Blood-rite. */

const craftRoad = ROADS.find((r) => r.to === 'hemocraft')!;
const riteRoad = ROADS.find((r) => r.to === 'bloodrite')!;

const game = (): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 0;
  s.players[0].epoch = 4;
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  return s;
};
const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};
const build = (s: GameState, type: BuildingType, lo = 5): Building => {
  const p = s.players[0];
  for (let r = lo; r <= 24; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(p.startX) + dx;
        const ty = Math.round(p.startY) + dy;
        if (!placeProblem(s, type, tx, ty, true, 0)) return placeBuilding(s, 0, type, tx, ty, true);
      }
  throw new Error('no room');
};
/** Player 0 stands in an age, having walked the Path of Blood up to it. */
const standIn = (s: GameState, age: AgeId) => {
  const p = s.players[0];
  p.walked = ['warband', 'ironblood', 'totalwar', ...(age === 'industrial' || age === 'totalwar' ? [] : [age])];
  p.age = age;
  p.statsVersion++;
};
/** Moves the citizens of both players far off, so only the units a test places stand near its buildings. */
const clear = (s: GameState) => {
  for (const e of s.ents) if (e.kind === 'unit') ((e.x = 1.5), (e.y = 1.5));
};

describe('the fork at the end of the Path of Blood', () => {
  it('is two tier-4 ages, each a branch path of the Path of Blood, turning off the Industrial Age for a people that walked Total War', () => {
    for (const [road, age, path] of [[craftRoad, 'hemocraft', 'hemocraft'], [riteRoad, 'bloodrite', 'rite']] as const) {
      expect(AGES[age].tier).toBe(4);
      expect(AGES[age].path).toBe(path);
      expect(PATHS[path].branch).toBe('blood');
      expect(road.from).toBe('industrial');
      expect(road.walked).toBe('totalwar');
      expect(ROADS.filter((r) => r.from === age).map((r) => r.to)).toEqual(['industrial']);
    }
    expect(craftRoad.shuns).toBe('bloodrite');
    expect(riteRoad.shuns).toBe('hemocraft');
    expect(pathLine('hemocraft')).toEqual(['warband', 'ironblood', 'totalwar', 'hemocraft']);
  });

  it('stays hidden from a people that never walked Total War, and waits on its deeds', () => {
    const s = game();
    const p = s.players[0];
    build(s, 'workshop');
    build(s, 'temple');
    expect(roadKnown(s, p, craftRoad)).toBe(false);
    expect(roadKnown(s, p, riteRoad)).toBe(false);
    standIn(s, 'industrial');
    expect(roadKnown(s, p, craftRoad)).toBe(true);
    expect(roadProblem(s, p, craftRoad)).toMatch(/graft 8/);
    expect(roadProblem(s, p, riteRoad)).toMatch(/levy/);
    p.stats.grafted = craftRoad.deed!.n;
    expect(roadProblem(s, p, craftRoad)).toBeNull();
  });

  it('takes one branch, and shuts the other for good', () => {
    const s = game();
    const p = s.players[0];
    build(s, 'workshop');
    build(s, 'temple');
    standIn(s, 'industrial');
    p.stats.grafted = craftRoad.deed!.n;
    p.stats.levied = riteRoad.deed!.n;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'hemocraft' }]);
    run(s, craftRoad.time + 0.2);
    expect(ageOf(p)).toBe('hemocraft');
    // Warband, Iron and Blood, Total War and Hemocraft: four of the line, so the plunder carries three times.
    expect(pathDepth(p)).toBe(4);
    expect(pathCarry(p)).toEqual({ path: 'hemocraft', times: 3 });
    expect(modsOf(s, 0).plunder).toBeCloseTo(AGES.hemocraft.add!.plunder! + 3 * PATHS.hemocraft.carry!.plunder!);
    // Back to Industry: the rite is closed, and the advance is refused.
    const back = ROADS.find((r) => r.from === 'hemocraft' && r.to === 'industrial')!;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'industrial' }]);
    run(s, back.time + 0.2);
    expect(ageOf(p)).toBe('industrial');
    expect(roadProblem(s, p, riteRoad)).toMatch(/closed to it for good/);
    expect(roadProblem(s, p, craftRoad)).toBeNull();
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'bloodrite' }]);
    run(s, riteRoad.time + 0.2);
    expect(ageOf(p)).toBe('industrial');
  });

  it('bars what each branch gives up', () => {
    const s = game();
    const p = s.players[0];
    standIn(s, 'hemocraft');
    expect(barred(p, 'priest')).toBeTruthy();
    expect(barred(p, 'trader')).toBeTruthy();
    expect(buildBarred(p, 'transfusion')).toBeNull();
    expect(buildBarred(p, 'drainrig')).toBeNull();
    expect(buildBarred(p, 'warcamp')).toBeTruthy();
    standIn(s, 'bloodrite');
    expect(barred(p, 'priest')).toBeNull();
    expect(buildBarred(p, 'transfusion')).toBeTruthy();
    expect(buildBarred(p, 'bloodtower')).toBeNull();
  });
});

describe('Hemocraft', () => {
  const setup = (age: AgeId) => {
    const s = game();
    standIn(s, age);
    clear(s);
    const rig = build(s, 'drainrig', 16);
    const foe = spawnUnit(s, 1, 'infantry', rig.x + 3, rig.y);
    const engine = spawnUnit(s, 1, 'siege', rig.x - 3, rig.y);
    for (const u of [foe, engine]) u.stance = 'stand';
    return { s, rig, foe, engine };
  };

  it('bleeds the living enemy standing by a rig into the store, but not machines', () => {
    const { s, foe, engine } = setup('hemocraft');
    const hp = foe.hp, ehp = engine.hp;
    run(s, 5);
    expect(foe.hp).toBeCloseTo(hp - 5 * HEMOCRAFT.bleed, 5);
    expect(engine.hp).toBe(ehp);
    expect(bloodOf(s.players[0])).toBeCloseTo(5 * HEMOCRAFT.bleed * HEMOCRAFT.yield, 5);
  });

  it('drains nothing in Total War, nor in a peace', () => {
    const { s, foe } = setup('totalwar');
    const hp = foe.hp;
    run(s, 5);
    expect(foe.hp).toBe(hp);
    const b = setup('hemocraft');
    b.s.peaceUntil = b.s.tick + secs(60);
    const bhp = b.foe.hp;
    run(b.s, 5);
    expect(b.foe.hp).toBe(bhp);
  });

  it('bleeds at most `most` at once, nearest first', () => {
    const { s, rig, foe } = setup('hemocraft');
    const crowd: Unit[] = [];
    for (let i = 0; i < HEMOCRAFT.most + 2; i++) crowd.push(spawnUnit(s, 1, 'infantry', rig.x + 1.5 + i * 0.4, rig.y + 2));
    for (const u of crowd) u.stance = 'stand';
    const before = [foe, ...crowd].map((u) => u.hp);
    run(s, 1);
    const bled = [foe, ...crowd].filter((u, i) => u.hp < before[i]).length;
    expect(bled).toBe(HEMOCRAFT.most);
  });

  it('grafts for less blood and feeds them from farther off', () => {
    const s = game();
    standIn(s, 'totalwar');
    expect(graftCost(s.players[0])).toBe(HEMO.cost);
    expect(feedReach(s.players[0])).toBe(HEMO.reach);
    standIn(s, 'hemocraft');
    expect(graftCost(s.players[0])).toBe(HEMO.cost * HEMOCRAFT.graft);
    expect(feedReach(s.players[0])).toBe(HEMOCRAFT.reach);
  });
});

describe('the Blood-rite', () => {
  it('draws blood from the enemy who fall near a Temple', () => {
    const s = game();
    standIn(s, 'bloodrite');
    clear(s);
    const temple = build(s, 'temple', 8);
    const foe = spawnUnit(s, 1, 'infantry', temple.x + 4, temple.y);
    hurt(s, foe, foe.hp + 10, 0, null);
    expect(bloodOf(s.players[0])).toBeGreaterThan(0);
    // Off the rite, a Temple is only a Temple.
    const t = game();
    standIn(t, 'totalwar');
    clear(t);
    const other = build(t, 'temple', 8);
    const foe2 = spawnUnit(t, 1, 'infantry', other.x + 4, other.y);
    hurt(t, foe2, foe2.hp + 10, 0, null);
    expect(t.players[0].blood).toBeUndefined();
  });

  it('mends its own hurt living near a Temple with blood, and stops when the store is dry', () => {
    const s = game();
    const p = s.players[0];
    standIn(s, 'bloodrite');
    clear(s);
    const temple = build(s, 'temple', 8);
    const man = spawnUnit(s, 0, 'infantry', temple.x + 3, temple.y);
    man.stance = 'stand';
    const top = maxHp(s, man);
    man.hp = top / 2;
    p.blood = 1;
    run(s, 3);
    // One blood buys 1 / price points of health, then nothing more.
    expect(man.hp).toBeCloseTo(top / 2 + 1 / RITE.price, 5);
    expect(bloodOf(p)).toBe(0);
    p.blood = 100;
    run(s, 2);
    expect(man.hp).toBeCloseTo(top / 2 + 1 / RITE.price + 2 * RITE.mend, 5);
    expect(bloodOf(p)).toBeCloseTo(100 - 2 * RITE.mend * RITE.price, 5);
    expect(BLOOD.reach).toBeGreaterThan(RITE.reach);
  });

  it('survives a save', () => {
    const s = game();
    standIn(s, 'bloodrite');
    const back = deserialize(serialize(s));
    expect(ageOf(back.players[0])).toBe('bloodrite');
    expect(pathDepth(back.players[0])).toBe(4);
  });
});
