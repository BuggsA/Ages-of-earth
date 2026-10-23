import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { ageOf, mainRoad, roadKnown, roadProblem, roadTo, trainsAt } from '../src/sim/ages';
import { AGES, EPOCHS, ROADS, TRUNK, secs, unitStats } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf, trainCostFor, trainTimeFor } from '../src/sim/stats';
import type { AgeId, Building, BuildingType, Command, GameState, Unit } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

// These worlds test the roads' deeds: with no rare ore in the seed (#356), the deeds are the only door.
const game = (startEpoch = 1): GameState => {
  const s = createGame({ seed: 11, size: 'small', startEpoch, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.rares = [];
  return s;
};

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < secs(seconds); i++) step(s);
};

const rich = (s: GameState) => (s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 });
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const raise = (s: GameState, type: BuildingType): Building => {
  const p = s.players[0];
  const spot = findSpot(s, type, p.startX, p.startY, 6, 24)!;
  return placeBuilding(s, 0, type, spot.tx, spot.ty, true);
};
/** Walk the advance at the Town Center to its end. */
const advance = (s: GameState, to?: AgeId) => {
  const road = roadTo(s.players[0], to)!;
  run(s, road.time + 1, [{ t: 'advance', p: 0, building: tc(s).id, to }]);
};
/** A Bronze Age player with a Market whose traders have brought home enough. */
const merchantReady = () => {
  const s = game(1);
  rich(s);
  raise(s, 'market');
  s.players[0].stats.traded = 400;
  return s;
};

describe('ages as a web (#37)', () => {
  it('keeps the trunk: every epoch is a trunk age, and a plain advance walks it at the old prices', () => {
    expect(TRUNK.map((a) => AGES[a].tier)).toEqual([0, 1, 2, 3, 4, 5]);
    for (let e = 1; e < EPOCHS.length; e++) {
      const road = ROADS.find((r) => r.from === TRUNK[e - 1] && r.to === TRUNK[e])!;
      expect(road.cost).toEqual(EPOCHS[e].cost);
      expect(road.time).toBe(EPOCHS[e].time);
    }
    const s = game(0);
    rich(s);
    const before = { ...s.players[0].res };
    advance(s);
    expect(s.players[0].epoch).toBe(1);
    expect(ageOf(s.players[0])).toBe('bronze');
    expect(s.players[0].res.food).toBe(before.food - EPOCHS[1].cost.food!);
    for (let e = 2; e < EPOCHS.length; e++) advance(s);
    expect(ageOf(s.players[0])).toBe('atomic');
    expect(mainRoad(s.players[0])).toBeUndefined();
  });

  it('leaves no age without a road out, except the last on the trunk', () => {
    for (const id of Object.keys(AGES) as AgeId[]) {
      if (id === 'atomic') continue;
      expect(ROADS.some((r) => r.from === id), id).toBe(true);
    }
    // And every side age can be reached.
    for (const id of Object.keys(AGES) as AgeId[]) if (id !== 'stone') expect(ROADS.some((r) => r.to === id), id).toBe(true);
  });

  it('hides the merchant road until a Market stands, then asks for the traders’ gold', () => {
    const s = game(1);
    rich(s);
    const p = s.players[0];
    const road = roadTo(p, 'merchant')!;
    expect(roadKnown(s, p, road)).toBe(false);
    run(s, 1, [{ t: 'advance', p: 0, building: tc(s).id, to: 'merchant' }]);
    expect(tc(s).advance).toBe(-1);
    raise(s, 'market');
    expect(roadKnown(s, p, road)).toBe(true);
    p.stats.traded = 120;
    expect(roadProblem(s, p, road)).toContain('120/400');
    run(s, 1, [{ t: 'advance', p: 0, building: tc(s).id, to: 'merchant' }]);
    expect(tc(s).advance).toBe(-1);
    p.stats.traded = 400;
    expect(roadProblem(s, p, road)).toBeNull();
  });

  it('takes the merchant road: tier 2, the Market hires for gold, trade pays more, levies cost more', () => {
    const s = merchantReady();
    const p = s.players[0];
    const gold = p.res.gold;
    advance(s, 'merchant');
    expect(ageOf(p)).toBe('merchant');
    expect(p.epoch).toBe(2);
    expect(p.res.gold).toBe(gold - roadTo({ ...p, age: 'bronze', epoch: 1 }, 'merchant')!.cost.gold!);
    expect(modsOf(s, 0).tradeGold).toBeCloseTo(1.25);

    const market = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'market')!;
    expect(trainsAt(p, 'market')).toEqual(['trader', 'infantry', 'ranged', 'cavalry']);
    const pike = unitStats('infantry', 2).cost;
    const sum = (pike.food ?? 0) + (pike.wood ?? 0) + (pike.gold ?? 0) + (pike.stone ?? 0);
    expect(trainCostFor(s, 0, 'infantry', 'market')).toEqual({ gold: Math.round((sum * 1.2) / 5) * 5 });
    expect(trainTimeFor(s, 0, 'infantry', 'market')).toBeCloseTo(trainTimeFor(s, 0, 'infantry', 'barracks') / 2);
    expect(trainCostFor(s, 0, 'infantry', 'barracks')).toEqual({ food: Math.round(pike.food! * 1.2), wood: Math.round(pike.wood! * 1.2), gold: Math.round(pike.gold! * 1.2) });
    // Citizens and traders are no levy.
    expect(trainCostFor(s, 0, 'trader', 'market')).toEqual(unitStats('trader', 2).cost);

    const food = p.res.food;
    const goldNow = p.res.gold;
    run(s, 1, [{ t: 'train', p: 0, building: market.id, unit: 'infantry' }]);
    expect(p.res.food).toBe(food);
    expect(p.res.gold).toBe(goldNow - trainCostFor(s, 0, 'infantry', 'market').gold!);
    run(s, trainTimeFor(s, 0, 'infantry', 'market') + 1);
    expect(s.ents.some((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'infantry')).toBe(true);
  });

  it('only opens from the Bronze Age, and leads on to Gunpowder or back onto the Middle Ages', () => {
    // Past the window: from the Middle Ages there is no road to the merchants.
    const late = game(2);
    rich(late);
    raise(late, 'market');
    late.players[0].stats.traded = 9999;
    expect(roadTo(late.players[0], 'merchant')).toBeUndefined();
    run(late, 1, [{ t: 'advance', p: 0, building: tc(late).id, to: 'merchant' }]);
    expect(tc(late).advance).toBe(-1);

    const s = merchantReady();
    advance(s, 'merchant');
    expect(mainRoad(s.players[0])!.to).toBe('gunpowder');
    advance(s, 'middle');
    expect(ageOf(s.players[0])).toBe('middle');
    expect(trainsAt(s.players[0], 'market')).toEqual(['trader']);
    expect(trainCostFor(s, 0, 'infantry', 'barracks')).toEqual(unitStats('infantry', 2).cost);

    const t = merchantReady();
    advance(t, 'merchant');
    advance(t);
    expect(ageOf(t.players[0])).toBe('gunpowder');
    expect(t.players[0].epoch).toBe(3);
  });

  it('refunds the road it was on when cancelled, and ignores roads that do not exist', () => {
    const s = merchantReady();
    const p = s.players[0];
    const before = { ...p.res };
    run(s, 1, [{ t: 'advance', p: 0, building: tc(s).id, to: 'merchant' }]);
    expect(tc(s).advance).toBeGreaterThan(-1);
    expect(p.res.gold).toBe(before.gold - 300);
    run(s, 1, [{ t: 'cancel', p: 0, building: tc(s).id, index: -1 }]);
    expect(tc(s).advance).toBe(-1);
    expect(p.res).toEqual(before);
    run(s, 1, [{ t: 'advance', p: 0, building: tc(s).id, to: 'atlantis' as AgeId }]);
    expect(tc(s).advance).toBe(-1);
    expect(p.res).toEqual(before);
  });

  it('keeps the age through a save, and reads an older save (no age) as the trunk', () => {
    const s = merchantReady();
    advance(s, 'merchant');
    const back = deserialize(serialize(s));
    expect(ageOf(back.players[0])).toBe('merchant');
    expect(trainsAt(back.players[0], 'market')).toContain('cavalry');
    delete back.players[0].age;
    expect(ageOf(back.players[0])).toBe('middle');
    // An age out of step with the epoch (a test or a cheat set the epoch) falls back to the trunk.
    back.players[0].age = 'merchant';
    back.players[0].epoch = 3;
    expect(ageOf(back.players[0])).toBe('gunpowder');
  });

  it('plays out the same way twice', () => {
    const play = () => {
      const s = merchantReady();
      advance(s, 'merchant');
      const market = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'market')!;
      run(s, 20, [
        { t: 'train', p: 0, building: market.id, unit: 'cavalry' },
        { t: 'train', p: 0, building: market.id, unit: 'ranged' },
      ]);
      return serialize(s);
    };
    expect(play()).toBe(play());
  });
});
