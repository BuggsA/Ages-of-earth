import { describe, expect, it } from 'vitest';
import { ageOf, roadKnown, roadTo } from '../src/sim/ages';
import { BUILDING_TYPES, ROADS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { statsFor, trainCostFor, trainTimeFor } from '../src/sim/stats';
import { restat, placeBuilding, spawnUnit } from '../src/sim/world';
import { buildingGeometry } from '../src/render/buildingModels';
import { ageView, observe } from '../src/ui/webMap';
import type { Building, GameState } from '../src/sim/types';

const game = () => createGame({ seed: 11, size: 'small', startEpoch: 4, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const road = ROADS.find((r) => r.to === 'aeronaut')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const prepare = (s: GameState) => {
  const p = s.players[0]; p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  return placeBuilding(s, 0, 'airfield', p.startX + 8, p.startY + 8, true);
};

describe('Age of Aeronauts', () => {
  it('is hidden until an owned completed Airfield stands, and rejects an unknown journey without charging', () => {
    const s = game(); const p = s.players[0]; const before = { ...p.res };
    expect(roadKnown(s, p, road)).toBe(false);
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'aeronaut' }]);
    expect(tc(s).advanceTo).toBeUndefined(); expect(p.res).toEqual(before);
    const airfield = prepare(s); airfield.built = false;
    expect(roadKnown(s, p, road)).toBe(false); airfield.built = true;
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadKnown(s, s.players[1], road)).toBe(false);
    const d = { entered: [], roads: [] }; observe(d, s, 0);
    expect(ageView(d, 'aeronaut')).toBe('known');
  });

  it('takes the same-tier road, discounts aircraft only, preserves combat strength, and returns to Industrial', () => {
    const s = game(); const baseline = game(); prepare(s);
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'aeronaut' }]); run(s, road.time + 1);
    expect(ageOf(s.players[0])).toBe('aeronaut'); expect(s.players[0].epoch).toBe(4);
    for (const type of ['fighter', 'bomber'] as const) {
      const normal = trainCostFor(baseline, 0, type, 'airfield'); const cost = trainCostFor(s, 0, type, 'airfield');
      for (const res of ['food', 'wood', 'stone', 'gold'] as const) if (normal[res]) expect(cost[res]).toBe(Math.round(normal[res]! * 0.75));
      expect(trainTimeFor(s, 0, type, 'airfield')).toBeCloseTo(trainTimeFor(baseline, 0, type, 'airfield') * 0.75);
      expect(statsFor(s, 0, type).attack).toBe(statsFor(baseline, 0, type).attack);
      expect(statsFor(s, 0, type).hp).toBe(statsFor(baseline, 0, type).hp);
    }
    expect(trainCostFor(s, 0, 'siege', 'workshop').gold).toBe(Math.round(trainCostFor(baseline, 0, 'siege', 'workshop').gold! * 1.2));
    expect(trainTimeFor(s, 0, 'infantry', 'barracks')).toBe(trainTimeFor(baseline, 0, 'infantry', 'barracks'));
    expect(trainCostFor(s, 0, 'citizen', 'towncenter')).toEqual(trainCostFor(baseline, 0, 'citizen', 'towncenter'));
    const saved = deserialize(serialize(s)); expect(ageOf(saved.players[0])).toBe('aeronaut');
    run(saved, 1); run(s, 1); expect(serialize(saved)).toBe(serialize(s));
    const exit = roadTo(s.players[0], 'industrial')!;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'industrial' }]); run(s, exit.time + 1);
    expect(ageOf(s.players[0])).toBe('industrial');
    expect(trainCostFor(s, 0, 'fighter', 'airfield')).toEqual(trainCostFor(baseline, 0, 'fighter', 'airfield'));
  });

  it('the computer specializes an existing air force and leaves after losing its airfields', () => {
    const s = game(); const p = s.players[0]; prepare(s); p.ai = 'hard'; s.peaceUntil = 1e9; s.tick = secs(1000);
    for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + i % 6, p.startY + 4 + Math.floor(i / 6));
    for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + i % 4, p.startY - 4);
    spawnUnit(s, 0, 'fighter', p.startX, p.startY);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { aeronaut: true } };
    run(s, 2); expect(tc(s).advanceTo).toBe('aeronaut');
    restat(s, p, () => { p.age = 'aeronaut'; }); tc(s).advance = -1; delete tc(s).advanceTo;
    for (const e of s.ents) if (e.kind === 'building' && e.owner === 0 && e.type === 'airfield') e.hp = 0;
    p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; s.ai[0].next = 0;
    run(s, 1); expect(tc(s).advanceTo).toBe('industrial'); expect(s.ai[0].roads!.aeronaut).toBe(false);
  });

  it('builds every dressed model with finite vertices', () => {
    for (const type of BUILDING_TYPES) {
      const g = buildingGeometry(type, 4, '#cc3333', 0, 'aeronaut');
      expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true); g.dispose();
    }
  });
});
