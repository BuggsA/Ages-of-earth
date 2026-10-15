import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { ageOf, backProblem, backTo, isSuspended, roadKnown, roadTo, roadsFrom, shutRoads, suspendedTechs, trainsAt } from '../src/sim/ages';
import { EPOCHS, ROADS, STEP_BACK, TECHS, TRUNK, secs, stepBackCost, unitStats } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { generateMap } from '../src/sim/mapgen';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf, statsFor, techProblem, trainCostFor } from '../src/sim/stats';
import type { AgeId, Building, BuildingType, Command, GameEvent, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Stepping back an age, and roads that open only from their own age (#47). */

const game = (startEpoch = 0, seed = 11): GameState =>
  createGame({ seed, size: 'small', startEpoch, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

const events: GameEvent[] = [];
const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  events.push(...s.events);
  for (let i = 1; i < secs(seconds); i++) {
    step(s);
    events.push(...s.events);
  }
};
const rich = (s: GameState) => (s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 });
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const raise = (s: GameState, type: BuildingType): Building => {
  const p = s.players[0];
  const spot = findSpot(s, type, p.startX, p.startY, 6, 24)!;
  return placeBuilding(s, 0, type, spot.tx, spot.ty, true);
};
const advance = (s: GameState, to?: AgeId) => {
  const road = roadTo(s.players[0], to)!;
  run(s, road.time + 1, [{ t: 'advance', p: 0, building: tc(s).id, to }]);
};
const stepBack = (s: GameState) => run(s, STEP_BACK.time + 1, [{ t: 'stepBack', p: 0, building: tc(s).id }]);
/** Give a player technologies as research would, so their stats are worked out again. */
const learn = (s: GameState, ...techs: (keyof typeof TECHS)[]) => {
  const p = s.players[0];
  p.techs.push(...techs);
  p.statsVersion++;
};
const merchantReady = () => {
  const s = game(1);
  rich(s);
  raise(s, 'market');
  s.players[0].stats.traded = 400;
  return s;
};

describe('stepping back an age (#47)', () => {
  it('walks down one tier for its price and time: units fall back to their older form with their share of health', () => {
    const s = game(2);
    rich(s);
    const p = s.players[0];
    const pike = spawnUnit(s, 0, 'infantry', p.startX + 3, p.startY + 3);
    pike.hp = statsFor(s, 0, 'infantry').hp / 2;
    expect(statsFor(s, 0, 'infantry').name).toBe(unitStats('infantry', 2).name);
    const before = { ...p.res };
    expect(backTo(p)).toBe('bronze');
    events.length = 0;
    run(s, STEP_BACK.time - 1, [{ t: 'stepBack', p: 0, building: tc(s).id }]);
    // Paid at once, and still in the Middle Ages until the time is up.
    const cost = stepBackCost(2);
    expect(cost).toEqual({ food: STEP_BACK.food * 2, gold: STEP_BACK.gold * 2 });
    expect(p.res.food).toBe(before.food - cost.food!);
    expect(p.res.gold).toBe(before.gold - cost.gold!);
    expect(ageOf(p)).toBe('middle');
    run(s, 2);
    expect(ageOf(p)).toBe('bronze');
    expect(p.epoch).toBe(1);
    expect(p.backAt).toBeDefined();
    expect(events.find((e) => e.k === 'epoch')).toMatchObject({ owner: 0, epoch: 1, age: 'bronze', back: true });
    expect(statsFor(s, 0, 'infantry').name).toBe(unitStats('infantry', 1).name);
    expect(pike.hp).toBeCloseTo(statsFor(s, 0, 'infantry').hp / 2, 5);
    expect(tc(s).advance).toBe(-1);
    expect(tc(s).back).toBeUndefined();
  });

  it('is not offered in the Stone Age, and a plain advance still walks the trunk', () => {
    const s = game(0);
    rich(s);
    const p = s.players[0];
    expect(backTo(p)).toBeUndefined();
    expect(backProblem(s, p)).not.toBeNull();
    run(s, 1, [{ t: 'stepBack', p: 0, building: tc(s).id }]);
    expect(tc(s).advance).toBe(-1);
    expect(p.res.food).toBe(9000);
    for (let e = 1; e < EPOCHS.length; e++) {
      advance(s);
      expect(ageOf(p)).toBe(TRUNK[e]);
    }
  });

  it('suspends technologies above the new tier, keeps them, and brings them back on the climb', () => {
    const s = game(2);
    rich(s);
    const p = s.players[0];
    learn(s, 'scaleArmor', 'chainMail', 'plow', 'irrigation');
    expect(modsOf(s, 0).armor).toBe(2);
    const farm = modsOf(s, 0).farm;
    stepBack(s);
    expect(ageOf(p)).toBe('bronze');
    // Kept, but idle: Chain Mail and Irrigation are Middle Ages work.
    expect(p.techs).not.toContain('chainMail');
    expect(p.techs).toContain('scaleArmor');
    expect(suspendedTechs(p).sort()).toEqual(['chainMail', 'irrigation']);
    expect(isSuspended(p, 'scaleArmor')).toBe(false);
    expect(modsOf(s, 0).armor).toBe(1);
    expect(modsOf(s, 0).farm).toBeCloseTo(farm / TECHS.irrigation.mul!.farm!, 6);
    expect(techProblem(s, 0, 'chainMail')).toContain('suspended until the Middle Ages');
    const forge = raise(s, 'forge');
    run(s, 1, [{ t: 'research', p: 0, building: forge.id, tech: 'chainMail' }]);
    expect(forge.queue.length).toBe(0);
    // Nobody pays for them twice: the climb brings them back.
    advance(s);
    expect(ageOf(p)).toBe('middle');
    expect(suspendedTechs(p)).toEqual([]);
    expect(modsOf(s, 0).armor).toBe(2);
    expect(modsOf(s, 0).farm).toBeCloseTo(farm, 6);
  });

  it('takes off the queues and refunds what the older age can’t train or research', () => {
    const s = game(2);
    rich(s);
    const p = s.players[0];
    const forge = raise(s, 'forge');
    const barracks = raise(s, 'barracks');
    learn(s, 'scaleArmor');
    run(s, 1, [
      { t: 'research', p: 0, building: forge.id, tech: 'chainMail' },
      { t: 'train', p: 0, building: barracks.id, unit: 'infantry' },
    ]);
    expect(forge.queue.length).toBe(1);
    const gold = p.res.gold;
    const food = p.res.food;
    stepBack(s);
    expect(ageOf(p)).toBe('bronze');
    expect(forge.queue.length).toBe(0);
    const paid = TECHS.chainMail.cost;
    // The step back's own price came out; Chain Mail's went back in.
    expect(p.res.gold).toBe(gold - stepBackCost(2).gold! + paid.gold!);
    expect(p.res.food).toBe(food - stepBackCost(2).food! + paid.food!);
    // A foot soldier the Bronze Age can train stays on its queue (or is already out).
    const spearmen = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'infantry');
    expect(barracks.queue.length + spearmen.length).toBe(1);
  });

  it('can be cancelled for a full refund, and only one Town Center changes age at a time', () => {
    const s = game(2);
    rich(s);
    const p = s.players[0];
    const before = { ...p.res };
    run(s, 5, [{ t: 'stepBack', p: 0, building: tc(s).id }]);
    expect(tc(s).back).toBe(true);
    // No advancing while stepping back.
    run(s, 1, [{ t: 'advance', p: 0, building: tc(s).id }]);
    expect(p.res).toEqual({ food: before.food - stepBackCost(2).food!, wood: before.wood, stone: before.stone, gold: before.gold - stepBackCost(2).gold! });
    run(s, 1, [{ t: 'cancel', p: 0, building: tc(s).id, index: -1 }]);
    expect(p.res).toEqual(before);
    expect(tc(s).advance).toBe(-1);
    expect(tc(s).back).toBeUndefined();
    expect(ageOf(p)).toBe('middle');
    expect(p.backAt).toBeUndefined();
  });

  it('waits out its cooldown before the next step back, but not before the next climb', () => {
    const s = game(3);
    rich(s);
    const p = s.players[0];
    stepBack(s);
    expect(ageOf(p)).toBe('middle');
    expect(backProblem(s, p)).toContain('before stepping back again');
    const res = { ...p.res };
    run(s, 1, [{ t: 'stepBack', p: 0, building: tc(s).id }]);
    expect(tc(s).advance).toBe(-1);
    expect(p.res).toEqual(res);
    // Climbing is never held back.
    advance(s);
    expect(ageOf(p)).toBe('gunpowder');
    run(s, STEP_BACK.cooldown - EPOCHS[3].time);
    expect(backProblem(s, p)).toBeNull();
    stepBack(s);
    expect(ageOf(p)).toBe('middle');
  });

  it('lets a merchant people whose caravans were cut fall back to the Bronze Age: no more hiring, and the road is open again', () => {
    const s = merchantReady();
    const p = s.players[0];
    advance(s, 'merchant');
    expect(ageOf(p)).toBe('merchant');
    const market = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'market')!;
    // Five mercenaries: more than the Market can hire before the step back lands.
    const hire = trainCostFor(s, 0, 'infantry', 'market').gold!;
    run(s, 1, Array.from({ length: 5 }, (): Command => ({ t: 'train', p: 0, building: market.id, unit: 'infantry' })));
    expect(market.queue.length).toBe(5);
    const gold = p.res.gold;
    // Merchants step back to the Bronze Age, the age before their own, not to the Middle Ages.
    expect(backTo(p)).toBe('bronze');
    stepBack(s);
    expect(ageOf(p)).toBe('bronze');
    // The hired soldier on the Market's queue is refunded: Bronze Age Markets don't hire.
    expect(market.queue.length).toBe(0);
    expect(trainsAt(p, 'market')).toEqual(['trader']);
    const hired = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'infantry').length;
    expect(hired).toBeGreaterThan(0);
    expect(hired).toBeLessThan(5);
    expect(p.res.gold).toBe(gold - stepBackCost(2).gold! + (5 - hired) * hire);
    expect(roadTo(p, 'merchant')).toBeDefined();
    // Either road from here: the merchants again, or the Middle Ages.
    expect(roadsFrom(p).map((r) => r.to).sort()).toEqual(['merchant', 'middle']);
  });

  it('shows a side road shut from outside its window, and stepping back opens it', () => {
    const s = merchantReady();
    const p = s.players[0];
    expect(shutRoads(s, p)).toEqual([]);
    advance(s);
    expect(ageOf(p)).toBe('middle');
    const merchantRoad = ROADS.find((r) => r.to === 'merchant')!;
    expect(roadTo(p, 'merchant')).toBeUndefined();
    expect(shutRoads(s, p)).toEqual([merchantRoad]);
    stepBack(s);
    expect(ageOf(p)).toBe('bronze');
    expect(shutRoads(s, p)).toEqual([]);
    advance(s, 'merchant');
    expect(ageOf(p)).toBe('merchant');
    // The road a people is on isn't shown shut behind it.
    expect(shutRoads(s, p)).toEqual([]);
  });

  it('lets an Iron Age people who met massed archers go back to the Stone Age and take the Bronze road to the horse', () => {
    let seed = 1;
    while (!generateMap(seed, 'small', 2).bogIron) seed++;
    const s = game(0, seed);
    rich(s);
    const p = s.players[0];
    learn(s, 'survey');
    p.stats.iron = 150;
    const ironRoad = ROADS.find((r) => r.to === 'iron')!;
    expect(roadKnown(s, p, ironRoad)).toBe(true);
    advance(s, 'iron');
    expect(ageOf(p)).toBe('iron');
    stepBack(s);
    expect(ageOf(p)).toBe('stone');
    // Both roads out of the Stone Age again: the trunk, and the iron road (its deed stays done). Other main
    // paths leave the Stone Age too (the steppe, #297), so this asks for these two, not for only these.
    expect(roadsFrom(p).map((r) => r.to)).toEqual(expect.arrayContaining(['bronze', 'iron']));
    advance(s);
    expect(ageOf(p)).toBe('bronze');
    const stable = raise(s, 'stable');
    run(s, 1, [{ t: 'train', p: 0, building: stable.id, unit: 'cavalry' }]);
    expect(stable.queue.length).toBe(1);
    // From the Bronze Age the iron road is shut behind them.
    expect(shutRoads(s, p)).toEqual([ironRoad]);
  });

  it('keeps a step back in flight across a save, and plays out the same from the same commands', () => {
    const play = () => {
      const s = game(2);
      rich(s);
      learn(s, 'scaleArmor', 'chainMail');
      run(s, 10, [{ t: 'stepBack', p: 0, building: tc(s).id }]);
      return s;
    };
    const a = play();
    const b = deserialize(serialize(play()));
    expect(b.ents.find((e) => e.id === tc(a).id)).toMatchObject({ back: true });
    run(a, STEP_BACK.time);
    run(b, STEP_BACK.time);
    expect(ageOf(a.players[0])).toBe('bronze');
    expect(ageOf(b.players[0])).toBe('bronze');
    expect(b.players[0].backAt).toBe(a.players[0].backAt);
    expect(serialize(b)).toBe(serialize(a));
  });
});
