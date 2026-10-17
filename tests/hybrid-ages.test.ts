import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { ageOf, backTo, deedsDone, relicTradeShare, relicsKept, roadKnown, roadProblem, roadTo, roadsFrom, shutRoads, windowsOf } from '../src/sim/ages';
import { AGES, RELIC, ROADS, TRUNK, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { buildingMaxHp, modsOf, trainCostFor, statsFor } from '../src/sim/stats';
import { tripGold } from '../src/sim/trade';
import type { AgeId, Building, BuildingType, Command, GameState, TradePost } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

/** Crossing chains and a hybrid age (#49): relics open the Age of Pilgrims; trade and relics together, the Age of Fairs. */

// These worlds test the roads' deeds: with no rare ore in the seed (#356), the deeds are the only door.
const game = (startEpoch = 0, seed = 11): GameState => {
  const s = createGame({ seed, size: 'small', startEpoch, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
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
const advance = (s: GameState, to?: AgeId) => {
  const road = roadTo(s.players[0], to)!;
  run(s, road.time + 1, [{ t: 'advance', p: 0, building: tc(s).id, to }]);
};
const stepBack = (s: GameState) => run(s, 26, [{ t: 'stepBack', p: 0, building: tc(s).id }]);
/** Lay relics in a Temple as a priest would. */
const keep = (s: GameState, temple: Building, n: number) => {
  for (const r of s.relics.slice(0, n)) {
    r.carrier = 0;
    r.temple = temple.id;
    r.x = temple.x;
    r.y = temple.y;
  }
};
const pilgrimRoad = ROADS.find((r) => r.from === 'middle' && r.to === 'pilgrim')!;
const fairFromMerchant = ROADS.find((r) => r.from === 'merchant' && r.to === 'fair')!;
const fairFromPilgrim = ROADS.find((r) => r.from === 'pilgrim' && r.to === 'fair')!;

/** A Middle Ages people with a Temple and its deed done, ready for the pilgrims' road. */
const pilgrimReady = () => {
  const s = game(2);
  rich(s);
  raise(s, 'temple');
  s.players[0].stats.relicGold = pilgrimRoad.deed!.n;
  return s;
};

describe('relics open a door: the Age of Pilgrims (#49)', () => {
  it('relic gold kept in a Temple counts toward the deed', () => {
    const s = game(2);
    const t = raise(s, 'temple');
    keep(s, t, 1);
    const before = s.players[0].res.gold;
    run(s, 10);
    const got = s.players[0].res.gold - before;
    expect(got).toBeGreaterThan(0);
    expect(s.players[0].stats.relicGold).toBe(got);
  });

  it('shows only once a Temple stands, and opens only when the relics have paid enough', () => {
    const s = game(2);
    rich(s);
    const p = s.players[0];
    expect(roadKnown(s, p, pilgrimRoad)).toBe(false);
    raise(s, 'temple');
    expect(roadKnown(s, p, pilgrimRoad)).toBe(true);
    expect(roadProblem(s, p, pilgrimRoad)).toContain(`0/${pilgrimRoad.deed!.n}`);
    run(s, 1, [{ t: 'advance', p: 0, building: tc(s).id, to: 'pilgrim' }]);
    expect(ageOf(p)).toBe('middle');
    expect(tc(s).advance).toBe(-1);
    p.stats.relicGold = pilgrimRoad.deed!.n;
    expect(roadProblem(s, p, pilgrimRoad)).toBeNull();
  });

  it('the trunk stays intact: a plain advance from the Middle Ages still reaches the Gunpowder Age', () => {
    const s = pilgrimReady();
    advance(s);
    expect(ageOf(s.players[0])).toBe('gunpowder');
  });

  it('is shut from the Bronze Age and from Gunpowder, open again a step back down', () => {
    const s = game(1);
    rich(s);
    raise(s, 'temple');
    const p = s.players[0];
    expect(roadsFrom(p).some((r) => r.to === 'pilgrim')).toBe(false);
    // Not yet reachable, so not shown shut either.
    expect(shutRoads(s, p).some((r) => r.to === 'pilgrim')).toBe(false);
    advance(s);
    advance(s);
    expect(ageOf(p)).toBe('gunpowder');
    expect(shutRoads(s, p).some((r) => r.to === 'pilgrim')).toBe(true);
    stepBack(s);
    expect(ageOf(p)).toBe('middle');
    expect(roadsFrom(p).some((r) => r.to === 'pilgrim')).toBe(true);
  });

  it('pilgrims: a turn at tier 2, relics pay double, priests at half price and stronger, and no siege', () => {
    const s = pilgrimReady();
    const p = s.players[0];
    const priestBefore = trainCostFor(s, 0, 'priest', 'temple');
    const powerBefore = modsOf(s, 0).priest;
    advance(s, 'pilgrim');
    expect(ageOf(p)).toBe('pilgrim');
    expect(p.epoch).toBe(2);
    expect(statsFor(s, 0, 'infantry').name).toBe(statsFor(game(2), 0, 'infantry').name);
    expect(modsOf(s, 0).relicGold).toBe(2);
    expect(modsOf(s, 0).priest).toBeCloseTo(powerBefore * 1.25);
    const priestNow = trainCostFor(s, 0, 'priest', 'temple');
    for (const [r, n] of Object.entries(priestBefore)) expect(priestNow[r as keyof typeof priestNow]).toBe(Math.round(n! * 0.5));
    // A workshop trains nothing.
    const workshop = raise(s, 'workshop');
    run(s, 1, [{ t: 'train', p: 0, building: workshop.id, unit: 'siege' }]);
    expect(workshop.queue.length).toBe(0);
    // Relics pay double: one kept relic over one payout.
    const t = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'temple')!;
    keep(s, t, 1);
    const before = p.stats.relicGold!;
    run(s, RELIC.every * 5);
    expect((p.stats.relicGold! - before) % 2).toBe(0);
    expect(p.stats.relicGold! - before).toBeGreaterThanOrEqual(RELIC.gold * 2 * 4);
  });

  it('has roads out: forward to Gunpowder, back onto the trunk, and the step back lands in the Bronze Age', () => {
    const s = pilgrimReady();
    advance(s, 'pilgrim');
    const p = s.players[0];
    expect(roadTo(p)!.to).toBe('gunpowder');
    expect(roadsFrom(p).map((r) => r.to)).toEqual(expect.arrayContaining(['gunpowder', 'middle', 'fair']));
    expect(backTo(p)).toBe('bronze');
    stepBack(s);
    expect(ageOf(p)).toBe('bronze');
    advance(s);
    // The deed stays done: the turn is open again from the Middle Ages.
    expect(roadProblem(s, p, pilgrimRoad)).toBeNull();
  });
});

describe('a hybrid: the Age of Fairs (#49)', () => {
  const merchantReady = () => {
    const s = game(1);
    rich(s);
    raise(s, 'market');
    s.players[0].stats.traded = 400;
    advance(s, 'merchant');
    return s;
  };

  it('needs both deeds at once, from either window', () => {
    const s = merchantReady();
    const p = s.players[0];
    expect(ageOf(p)).toBe('merchant');
    // Its clue, from the merchants' side, is a Temple.
    expect(roadKnown(s, p, fairFromMerchant)).toBe(false);
    raise(s, 'temple');
    expect(roadKnown(s, p, fairFromMerchant)).toBe(true);
    // Both deeds wanted; each named with its tally.
    let problem = roadProblem(s, p, fairFromMerchant)!;
    expect(problem).toContain(`400/${fairFromMerchant.deed!.n}`);
    expect(problem).toContain(`0/${fairFromMerchant.also![0].n}`);
    p.stats.traded = fairFromMerchant.deed!.n;
    problem = roadProblem(s, p, fairFromMerchant)!;
    expect(problem).not.toContain('traders');
    expect(problem).toContain('Relics');
    expect(deedsDone(p, fairFromMerchant)).toBe(false);
    run(s, 1, [{ t: 'advance', p: 0, building: tc(s).id, to: 'fair' }]);
    expect(tc(s).advance).toBe(-1);
    p.stats.relicGold = fairFromMerchant.also![0].n;
    expect(deedsDone(p, fairFromMerchant)).toBe(true);
    // A plain advance still follows the trunk out of the merchants.
    expect(roadTo(p)!.to).toBe('gunpowder');
    advance(s, 'fair');
    expect(ageOf(p)).toBe('fair');
    expect(p.epoch).toBe(3);
    // Mercenaries are gone with the merchants.
    expect(AGES.fair.hire).toBeUndefined();
  });

  it('opens from the pilgrims too', () => {
    const s = pilgrimReady();
    advance(s, 'pilgrim');
    const p = s.players[0];
    expect(roadKnown(s, p, fairFromPilgrim)).toBe(true);
    p.stats.relicGold = fairFromPilgrim.deed!.n;
    expect(roadProblem(s, p, fairFromPilgrim)).toContain(`0/${fairFromPilgrim.also![0].n}`);
    p.stats.traded = fairFromPilgrim.also![0].n;
    advance(s, 'fair');
    expect(ageOf(p)).toBe('fair');
    // Siege returns.
    const workshop = raise(s, 'workshop');
    run(s, 1, [{ t: 'train', p: 0, building: workshop.id, unit: 'siege' }]);
    expect(workshop.queue.length).toBe(1);
  });

  it('every relic kept makes trade pay more, up to five; buildings stand weaker', () => {
    const s = game(3);
    const p = s.players[0];
    const temple = raise(s, 'temple');
    const market = raise(s, 'market');
    const post: TradePost = { id: 999, x: market.x + 70, y: market.y };
    const hpBefore = buildingMaxHp(s, 0, 'towncenter');
    const usual = tripGold(s, 0, market, post);
    // Into the Age of Fairs as enterAge would put them (the same tier).
    p.stats.traded = 9999;
    p.stats.relicGold = 9999;
    p.age = 'fair';
    p.statsVersion++;
    expect(ageOf(p)).toBe('fair');
    expect(relicTradeShare(s, 0)).toBe(1);
    const fair = tripGold(s, 0, market, post);
    expect(fair).toBeGreaterThan(usual);
    expect(fair / usual).toBeCloseTo(1.25, 1);
    keep(s, temple, 2);
    expect(relicsKept(s, 0)).toBe(2);
    expect(relicTradeShare(s, 0)).toBeCloseTo(1.2);
    expect(tripGold(s, 0, market, post) / usual).toBeCloseTo(1.25 * 1.2, 1);
    // The cap: never more than five relics' worth.
    while (s.relics.length < 7) s.relics.push({ id: 9000 + s.relics.length, x: temple.x, y: temple.y, carrier: 0, temple: 0 });
    keep(s, temple, 7);
    expect(relicTradeShare(s, 0)).toBeCloseTo(1 + AGES.fair.relicTrade!.each * AGES.fair.relicTrade!.most);
    // A rival's relics don't count; nor do a fallen Temple's.
    temple.hp = 0;
    expect(relicsKept(s, 0)).toBe(0);
    expect(buildingMaxHp(s, 0, 'towncenter')).toBe(Math.round(hpBefore * 0.85));
    // Elsewhere, relics never touch trade.
    p.age = undefined;
    p.statsVersion++;
    temple.hp = 100;
    expect(relicTradeShare(s, 0)).toBe(1);
  });

  it('has roads out (forward to Industrial, back onto the trunk at Gunpowder), and a step back lands in the Middle Ages', () => {
    const s = merchantReady();
    const p = s.players[0];
    raise(s, 'temple');
    p.stats.traded = 9999;
    p.stats.relicGold = 9999;
    advance(s, 'fair');
    expect(roadTo(p)!.to).toBe('industrial');
    expect(roadsFrom(p).map((r) => r.to)).toEqual(expect.arrayContaining(['industrial', 'gunpowder']));
    expect(backTo(p)).toBe(TRUNK[2]);
    stepBack(s);
    expect(ageOf(p)).toBe('middle');
  });

  it('shows shut once, with both windows, from the Middle Ages, and only with a Temple', () => {
    const s = game(2);
    expect(shutRoads(s, s.players[0]).some((r) => r.to === 'fair')).toBe(false);
    raise(s, 'temple');
    raise(s, 'market');
    const p = s.players[0];
    const shut = shutRoads(s, p).filter((r) => r.to === 'fair');
    expect(shut.length).toBe(1);
    expect(windowsOf('fair').sort()).toEqual(['merchant', 'pilgrim']);
  });

  it('a save in the Age of Fairs loads as it was', () => {
    const s = merchantReady();
    raise(s, 'temple');
    s.players[0].stats.traded = 9999;
    s.players[0].stats.relicGold = 9999;
    advance(s, 'fair');
    const back = deserialize(serialize(s));
    expect(ageOf(back.players[0])).toBe('fair');
    expect(back.players[0].stats.relicGold).toBe(9999);
  });
});
