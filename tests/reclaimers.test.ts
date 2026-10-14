import { describe, expect, it } from 'vitest';
import { ageOf, mainRoad, roadKnown, roadProblem, roadTo, shutRoads } from '../src/sim/ages';
import { AGES, BUILDING_TYPES, EPOCHS, ROADS, TECHS, secs, unitStats } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { dig, digWork } from '../src/sim/ruins';
import { deserialize, serialize } from '../src/sim/save';
import { buildTimeFor, techCostFor, trainTimeFor } from '../src/sim/stats';
import { restat, spawnUnit } from '../src/sim/world';
import { buildingGeometry } from '../src/render/buildingModels';
import { ageView, observe, roadLabel } from '../src/ui/webMap';
import type { Building, GameState } from '../src/sim/types';

const road = ROADS.find((r) => r.to === 'reclaimer')!;
const game = () => createGame({ seed: 11, size: 'small', startEpoch: 2, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const rich = (s: GameState) => { s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; };
const excavate = (s: GameState) => {
  const r = s.ruins![0];
  r.find = 'hoard';
  for (let i = 0; i < digWork(); i++) dig(s, r, 0);
};
const enter = (s: GameState) => {
  rich(s); excavate(s);
  step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'reclaimer' }]);
  run(s, road.time + 1);
};

describe('Age of Reclaimers', () => {
  it('is discovered by finishing a dig, only for its winner; partial work and older saves reveal nothing', () => {
    const s = game(); const p = s.players[0]; const r = s.ruins![0];
    expect(roadKnown(s, p, road)).toBe(false);
    expect(roadProblem(s, p, road)).toContain('excavating');
    r.dug = digWork() - 1;
    expect(roadKnown(s, p, road)).toBe(false);
    dig(s, r, 0);
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadKnown(s, s.players[1], road)).toBe(false);
    const d = { entered: [], roads: [] };
    observe(d, s, 0);
    expect(ageView(d, 'reclaimer')).toBe('known');
    expect(roadLabel(road)).toContain('excavating');
    const older = deserialize(serialize(s)); delete older.ruins;
    expect(roadKnown(older, older.players[0], road)).toBe(false);
  });

  it('rejects an undiscovered advance without charging, and leaves the ordinary road available', () => {
    const s = game(); rich(s); const before = { ...s.players[0].res };
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'reclaimer' }]);
    expect(tc(s).advanceTo).toBeUndefined();
    expect(s.players[0].res).toEqual(before);
    expect(mainRoad(s.players[0])!.to).toBe('gunpowder');
  });

  it('takes the road, discounts research and speeds construction/repair while slowing military training', () => {
    const s = game(); enter(s);
    expect(ageOf(s.players[0])).toBe('reclaimer');
    expect(s.players[0].epoch).toBe(3);
    const normal = game(); restat(normal, normal.players[0], () => { normal.players[0].epoch = 3; normal.players[0].age = 'gunpowder'; });
    expect(buildTimeFor(s, 0, 'house')).toBeCloseTo(buildTimeFor(normal, 0, 'house') / 1.25);
    expect(techCostFor(s, 0, 'chemistry').gold).toBe(Math.round(TECHS.chemistry.cost.gold! * 0.8));
    expect(trainTimeFor(s, 0, 'ranged', 'range')).toBeCloseTo(trainTimeFor(normal, 0, 'ranged', 'range') * 1.25);
    expect(trainTimeFor(s, 0, 'citizen', 'towncenter')).toBe(unitStats('citizen', 3).time);
    expect(mainRoad(s.players[0])!.cost).toEqual(EPOCHS[4].cost);
    const back = deserialize(serialize(s));
    expect(roadKnown(back, back.players[0], road)).toBe(true);
    expect(ageOf(back.players[0])).toBe('reclaimer');
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'gunpowder' }]);
    run(s, roadTo(s.players[0], 'gunpowder')!.time + 1);
    expect(ageOf(s.players[0])).toBe('gunpowder');
    expect(buildTimeFor(s, 0, 'house')).toBe(buildTimeFor(normal, 0, 'house'));
    expect(shutRoads(s, s.players[0])).toContain(road);
  });

  it('the existing computer road chooser adopts it once a ruin is excavated', () => {
    const s = game(); const p = s.players[0]; p.ai = 'hard'; rich(s); excavate(s);
    s.peaceUntil = 1e9; s.tick = secs(600);
    for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + i % 6, p.startY + 4 + Math.floor(i / 6));
    for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + i % 4, p.startY - 4 - Math.floor(i / 4));
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { reclaimer: true, pilgrim: false } };
    for (let i = 0; i < secs(120) && ageOf(p) !== 'reclaimer'; i++) step(s);
    expect(ageOf(p)).toBe('reclaimer');
  });

  it('builds all models and gives its towns salvaged columns, keeping walls unchanged', () => {
    for (const type of BUILDING_TYPES) {
      const g = buildingGeometry(type, AGES.reclaimer.tier, '#cc3333', 0, 'reclaimer');
      expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    }
    for (const type of ['house', 'towncenter', 'storehouse', 'forge', 'wonder'] as const) {
      const plain = buildingGeometry(type, 3, '#cc3333');
      const dressed = buildingGeometry(type, 3, '#cc3333', 0, 'reclaimer');
      expect(dressed.getAttribute('position').count).toBeGreaterThan(plain.getAttribute('position').count);
    }
    expect(buildingGeometry('wall', 3, '#cc3333', 5, 'reclaimer')).toBe(buildingGeometry('wall', 3, '#cc3333', 5));
  });
});
