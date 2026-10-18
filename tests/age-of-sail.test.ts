import { describe, expect, it } from 'vitest';
import { ageOf, barred, buildBarred, roadKnown, roadProblem, roadTo, roadsFrom } from '../src/sim/ages';
import { AGES, ROADS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { statsFor, trainCostFor } from '../src/sim/stats';
import type { Building, GameState } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';
import { placeProblem } from '../src/sim/grid';
import { buildingGeometry } from '../src/render/buildingModels';

/** The Age of Sail: a turn off the Middle Ages for a people that fishes, opened by a Dock and a catch. */

const road = ROADS.find((r) => r.to === 'sail')!;
const game = (): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.players[0].epoch = 2;
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  return s;
};
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
/** A finished Dock on the shore nearest the player's start. */
const addDock = (s: GameState) => {
  const p = s.players[0];
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ty = 1; ty < s.h; ty++) {
    for (let tx = 1; tx < s.w; tx++) {
      if (placeProblem(s, 'dock', tx, ty)) continue;
      const d = (tx - p.startX) ** 2 + (ty - p.startY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { tx, ty };
      }
    }
  }
  if (!best) return false;
  placeBuilding(s, 0, 'dock', best.tx, best.ty, true);
  return true;
};

describe('the Age of Sail', () => {
  it('is a turn off the Middle Ages with a Dock as its clue and a catch as its deed', () => {
    expect(road.from).toBe('middle');
    expect(AGES.sail.tier).toBe(AGES.middle.tier);
    expect(road.clue).toBe('dock');
    expect(road.deed!.stat).toBe('fished');
    expect(ROADS.filter((r) => r.from === 'sail').map((r) => r.to).sort()).toEqual(['gunpowder', 'middle']);
  });

  it('stays hidden without a Dock, then waits on the catch', () => {
    const s = game();
    const p = s.players[0];
    expect(roadKnown(s, p, road)).toBe(false);
    expect(roadsFrom(p).some((r) => r.to === 'sail')).toBe(true);
    expect(addDock(s)).toBe(true);
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadProblem(s, p, road)).toContain('500');
    p.stats.fished = 500;
    expect(roadProblem(s, p, road)).toBeNull();
  });

  it('turns a people sailor: fish and hulls up, ships cheaper, farms down, nothing barred', () => {
    const s = game();
    const p = s.players[0];
    const hp0 = statsFor(s, 0, 'warship').hp;
    expect(addDock(s)).toBe(true);
    p.stats.fished = 500;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'sail' }]);
    for (let i = 0; i < secs(road.time) + 2; i++) step(s);
    expect(ageOf(p)).toBe('sail');
    expect(p.epoch).toBe(2);
    expect(barred(p, 'siege')).toBeNull();
    expect(barred(p, 'cavalry')).toBeNull();
    expect(roadTo(p)!.to).toBe('gunpowder');
    const usual = trainCostFor(game(), 0, 'warship', 'dock');
    const cost = trainCostFor(s, 0, 'warship', 'dock');
    expect(cost.wood!).toBeLessThan(usual.wood!);
    expect(statsFor(s, 0, 'warship').hp).toBeGreaterThan(hp0);
  });

  it('survives a save', () => {
    const s = game();
    s.players[0].age = 'sail';
    s.players[0].stats.fished = 321;
    const back = deserialize(serialize(s));
    expect(ageOf(back.players[0])).toBe('sail');
    expect(back.players[0].stats.fished).toBe(321);
  });

  it('dresses docks, houses, Town Centers, Markets and the Wonder, in one geometry each', () => {
    for (const type of ['dock', 'house', 'towncenter', 'market', 'wonder'] as const) {
      const plain = buildingGeometry(type, AGES.sail.tier, '#cc3333');
      const dressed = buildingGeometry(type, AGES.sail.tier, '#cc3333', 0, 'sail');
      expect(dressed.getAttribute('position').count, type).toBeGreaterThan(plain.getAttribute('position').count);
    }
  });
});

describe('the Age of Sail raises no walls (the fleet is the wall)', () => {
  it('bars walls and gates while sailing, and lets them back on the road home', () => {
    const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const p = s.players[0];
    p.epoch = 2;
    p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    expect(buildBarred(p, 'wall')).toBeNull();
    p.age = 'sail';
    expect(buildBarred(p, 'wall')).toContain('fleet is the wall');
    expect(buildBarred(p, 'gate')).toBeTruthy();
    expect(buildBarred(p, 'farm')).toBeNull();
    expect(buildBarred(p, 'dock')).toBeNull();
    const ids = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').map((u) => u.id);
    step(s, [{ t: 'wall', p: 0, ids, x0: p.startX + 7, y0: p.startY + 9, x1: p.startX + 10, y1: p.startY + 9 }]);
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'wall')).toBe(false);
    p.age = 'middle';
    expect(buildBarred(p, 'wall')).toBeNull();
  });
});

describe('the Age of Merchants stables no horses (cavalry is for hire)', () => {
  it('bars the Stable but not the hired horse, and lifts on the road home', () => {
    const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const p = s.players[0];
    p.epoch = 2;
    expect(buildBarred(p, 'stable')).toBeNull();
    p.age = 'merchant';
    expect(buildBarred(p, 'stable')).toContain('stables no horses');
    expect(buildBarred(p, 'barracks')).toBeNull();
    expect(barred(p, 'cavalry')).toBeNull();
    p.age = 'middle';
    expect(buildBarred(p, 'stable')).toBeNull();
  });
});
