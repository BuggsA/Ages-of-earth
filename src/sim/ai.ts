import { applyCommand, heroBusy, MAX_QUEUE } from './commands';
import { aiTiding } from './tidings';
import { AGES, AI_CLIMB, AI_SHORE, YEAR, ROADS, AI_MERC, MERC, AI_FAITH, AI_LIGHTNING, LIGHTNING, CONSECRATE, AI_LEVELS, AI_BELL, AI_MARK, AI_BLOOD, AI_HEMO, AI_FORK, AI_RITE, AI_CURSE, AI_ORDERS, AI_HEART, ORDERS, RITE, BLOOD, CALL_UP, AI_PROWL, AI_SCOUT, WARCAMP, AI_RAID, AI_STEPPE, AI_HORDE, AI_WEB, AI_WONDER, AI_FAIR, AI_SORTIE, AI_VIGIL, AI_CONVOY, AI_ORE, ORE_TRADE, AI_WILD, AI_WINTER, BONUS, BUILDINGS, COUNTER, FLOCK, SIGNATURES, TRIBUTE, LAST_EPOCH, MARKET, POP_MAX, RALLY, TECHS, VIGIL, WORKS, AMOUNT, SALVAGE, domainOf, secs, unitEpoch, unitStats, type Road } from './data';
import { NAVAL, distToRect, nearestWalkable, placeProblem, shoreWater, walkable } from './grid';
import { raiseCost } from './reclaim';
import { buildingCostFor, modsOf, techCostFor, techProblem, trainCostFor } from './stats';
import type { AgeId, AiMemory, Animal, Building, BuildingType, Command, Cost, GameState, Landmark, Player, Res, Rubble, Ruin, TechId, TradePost, Unit, UnitType } from './types';
import { RARES, RES, R_BERRY, R_BOG, R_FISH, R_GOLD, R_MEAT, R_NONE, R_STONE, R_TREE } from './types';
import { ageDef, ageOf, barred, buildBarred, deedsDone, oreDone, oreOnly, hasCoils, hasWalked, deedsProgress, hiresAt, isHire, inField, type DeedProgress, isSideRoad, mainRoad, relicsKept, roadKnown, roadsFrom } from './ages';
import { carriedBy } from './relics';
import { swordsOf } from './merc';
import { fairground, feastOpen, nextFeastIn } from './fair';
import { claimants, favours, landmarkAt } from './landmarks';
import { cargoRoom, coastNear, findResource, freeFarm, nearestTemple, TILE_OF_RARE } from './units';
import { goalForPost, nearestMarket, portSpot, postAt, tripGold } from './trade';
import { findRoute } from './path';
import { isEnemy, maxHp, townCenters } from './world';
import { callUpProblem } from './warcamp';
import { GRAFTABLE, bleeds, bloodOf, cursed, grafted, levyProblem, levyWait, sworn } from './blood';
import { offeringOf, riteProblem } from './fork';
import { graftCost, stationsOf, waiting } from './hemo';
import { borderMap, landOwnerAt, suppliedAt } from './borders';
import { workProblem } from './works';
import { aiKin, aiVow, aiWay, wayBarred } from './ways';
import { AI_WAYS, KILL_CAMP, KIN, SICKNESS, WAYS } from './data';
import { beaconProblem, lit } from './beacon';
import { rallyProblem } from './rally';
import { consecrateProblem, consecrates } from './consecrate';
import { sees } from './vision';
import { seasonAt } from './seasons';
import { flooded } from './flood';
import { isHousehold } from './household';
import { isNomad } from './nomad';
import { disarmProblem, isPolis } from './polis';
import { catchOf, herdsOut, yarding } from './year';
import { DEER, FLOOD, HOUSEHOLD, LEGION, NOMAD, POLIS, SNARE, SPOILS } from './data';
import { citizenCap, isLegion, legionary } from './legion';
import { treesNear } from './snares';
import { isMobile } from './steppe';
import { isRider, standing } from './tribute';
import { flockCap, flockOf, grassy, grazeRange, milkable } from './flocks';
import { progress, scenarioById } from './campaign';

/**
 * The computer opponent. It plays by the same rules and through the same commands as a person: it
 * grows its people, hunts, spreads them over food, wood, gold and stone, builds houses before it runs
 * out of room, raises barracks, ranges, stables, a forge, a temple and a siege workshop, researches
 * better tools and weapons, trades at the market, advances through the epochs, trains a hero and an
 * army that counters what it sees, brings priests to heal and convert and siege to break walls,
 * rings the town bell when overrun, defends its town and attacks in waves that grow over time, and
 * builds a wonder when it is rich (and goes all out against yours). It walks the web of ages (#50):
 * it surveys for bog iron and digs its way into the Iron Age, takes the merchant road when it trades
 * and hires soldiers at the Market, turns pilgrim when it keeps relics, and reads a rival's road to
 * answer it. Difficulty sets how fast it
 * gathers, how many citizens it keeps, when and how hard it attacks and how many tricks it knows.
 *
 * It decides from the match state alone and its memory (kept in the state, so a saved match plays on
 * the same), with the match's own seeded dice, so it plays the same way in every browser.
 */

function memory(s: GameState, id: number): AiMemory {
  let mem = s.ai[id];
  if (!mem) {
    mem = { next: 10 + id * 7, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: id, bell: -1 };
    s.ai[id] = mem;
  }
  return mem;
}

/** The match's own dice, so the opponent's choices are the same everywhere. */
function roll(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * A coin of its own for one decision, from the match's seed, the player and the question (#320): tossing it
 * leaves the match's dice where they were, so a match where nobody heads for the steppe plays as it did.
 */
function coin(s: GameState, id: number, salt: number): number {
  let t = (s.seed + Math.imul(id + 1, 0x9e3779b9) + salt) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const SHARE: Record<Res, number>[] = [
  { food: 0.5, wood: 0.4, gold: 0.05, stone: 0.05 },
  { food: 0.42, wood: 0.34, gold: 0.15, stone: 0.09 },
  { food: 0.4, wood: 0.3, gold: 0.23, stone: 0.07 },
  { food: 0.38, wood: 0.3, gold: 0.26, stone: 0.06 },
  { food: 0.36, wood: 0.3, gold: 0.28, stone: 0.06 },
];
/** Citizens wanted before advancing out of each epoch. */
const ADVANCE_AT = [11, 17, 22, 28];
const TILE_OF: Record<Res, number> = { food: R_BERRY, wood: R_TREE, stone: R_STONE, gold: R_GOLD };
/** Technologies in the order the opponent wants them (economy first). */
const TECH_ORDER: TechId[] = [
  // Heirlooms first (#224, #232): techProblem keeps them shut until both their ages are walked, and once
  // one opens it is the prize of the road the computer chose for it, so it is bought before anything else.
  'bellFoundry', 'ironHulls', 'jointStock', 'masonsLodge', 'stElmo', 'telegraphy', 'galvanic', 'galvanicBlood', 'militaryOrders',
  'plow', 'drying', 'hounds', 'axes', 'wheelbarrow', 'picks', 'forging', 'bloomery', 'scaleArmor', 'fletching', 'husbandry', 'irrigation', 'saws', 'shafts', 'handcart',
  'ironCasting', 'chainMail', 'bodkin', 'masonry', 'theology', 'conscription', 'blastFurnace', 'plateArmor', 'chemistry', 'blackPowder', 'saltCuring', 'bloodForged',
  'gillnets', 'shipwright', 'lighthouse', 'steamEngine', 'rifling', 'aviation', 'caravan', 'banking', 'pilgrimage', 'credit', 'ropewalk', 'litany',
];
/** Seconds a computer keeps its traders off a road after losing one on it. */
const TRADER_WARY = 240;
const ECONOMY: TechId[] = ['plow', 'axes', 'wheelbarrow', 'picks', 'irrigation', 'saws', 'shafts', 'handcart', 'gillnets', 'steamEngine'];

export function aiStep(s: GameState): void {
  for (const p of s.players) {
    if (!p.ai || p.defeated) continue;
    const mem = memory(s, p.id);
    if (s.tick < mem.next) continue;
    mem.next = s.tick + secs(AI_LEVELS[p.ai].think);
    think(s, p, mem);
  }
}

interface View {
  p: Player;
  citizens: Unit[];
  army: Unit[];
  priests: Unit[];
  traders: Unit[];
  /** Merchant ships, on the sea road. */
  cogs: Unit[];
  fishers: Unit[];
  /** Warships and transports. */
  navy: Unit[];
  planes: Unit[];
  buildings: Building[];
  home: { x: number; y: number };
  tc: Building | null;
  /** Spendable after setting aside what the next epoch costs. */
  budget: Record<Res, number>;
  /** What a campaign chapter's goals ask of the army (only for the chapter's own seat). */
  plan: Plan;
  /** Citizens digging bog iron toward the Iron Age's deed, kept at it while it is unfinished (#50). */
  diggers: Set<number>;
  /** An attack is due and the army is short of a wave: soldiers come first (#79). */
  armyFirst: boolean;
  /** A citizen out claiming a landmark, left alone by the town's work. */
  claimers: Set<number>;
  /** Its packed Town Centers and Houses on the road (#320): never soldiers. */
  wagons: Unit[];
  /** How many citizens may hunt deer, and how far from home: more and further for a people bound for the steppe (#320). */
  hunt: { n: number; r: number };
  /** About to strike camp (#320): the Town Center starts nothing new, so its queue empties and it can pack. */
  packing: boolean;
  /** The town's working hands: its citizens, and a legion's foot soldiers too (#501). */
  hands: number;
}

/** A foot soldier of a legion's town counts among its hands (#501). */
const legionHand = (u: Unit): boolean => u.type === 'infantry' && !u.thrall && !u.inside;

/** A legion's soldier at the axe or the quarry with little in hand: free for a hunt or a raid like an idle one (#501). */
const atTheAxe = (v: View, u: Unit): boolean => isLegion(v.p) && legionHand(u) && u.order.k === 'gather' && u.carry <= 2;

/** The legion's soldiers free to work: idle or already at the axe, the quarry or a foundation (never those in a fight or a wave). */
/** Whether a legion's town is far enough along for its soldiers to carry the wood and stone: at least two are already at the axe or the quarry, in an epoch the computer works them in. */
function legionAtWork(v: View): boolean {
  return isLegion(v.p) && v.p.epoch <= LEGION.aiUntil && v.army.filter((u) => legionHand(u) && u.order.k === 'gather').length >= 2;
}

function legionHands(v: View): Unit[] {
  return isLegion(v.p) && v.p.epoch <= LEGION.aiUntil ? v.army.filter((u) => legionHand(u) && (u.order.k === 'idle' || u.order.k === 'gather' || u.order.k === 'build')) : [];
}

function afford(v: View, cost: Cost): boolean {
  return RES.every((r) => !cost[r] || v.budget[r] >= cost[r]);
}

function spend(v: View, cost: Cost): void {
  for (const r of RES) v.budget[r] -= cost[r] ?? 0;
}

function think(s: GameState, p: Player, mem: AiMemory): void {
  const L = AI_LEVELS[p.ai!];
  const citizens: Unit[] = [];
  const army: Unit[] = [];
  const priests: Unit[] = [];
  const traders: Unit[] = [];
  const cogs: Unit[] = [];
  const fishers: Unit[] = [];
  const navy: Unit[] = [];
  const planes: Unit[] = [];
  const wagons: Unit[] = [];
  const buildings: Building[] = [];
  let king: Unit | null = null;
  for (const e of s.ents) {
    if (e.owner !== p.id || e.hp <= 0) continue;
    if (e.kind === 'unit' && s.kings[p.id] === e.id) king = e;
    else if (e.kind === 'unit') {
      const list =
        e.type === 'citizen' ? citizens : e.type === 'wagon' ? wagons : e.type === 'priest' ? priests : e.type === 'trader' ? traders : e.type === 'cog' ? cogs : e.type === 'fisher' ? fishers : e.type === 'warship' || e.type === 'transport' ? navy : e.type === 'fighter' || e.type === 'bomber' ? planes : army;
      list.push(e);
    } else buildings.push(e);
  }
  const tc = buildings.find((b) => b.type === 'towncenter' && b.built) ?? null;
  // A King stays out of harm's way, sheltered in the Town Center.
  if (king && tc && !king.inside && king.order.k !== 'garrison') applyCommand(s, { t: 'garrison', p: p.id, ids: [king.id], target: tc.id });
  // A steppe camp on the move (#320): home is where its Town Center is being driven or pitched.
  const moving = tc ? null : (buildings.find((b) => b.type === 'towncenter' && b.pitch !== undefined) ?? wagons.find((w) => w.packed === 'towncenter') ?? null);
  const home = tc ? { x: tc.x, y: tc.y } : moving ? { x: moving.x, y: moving.y } : { x: p.startX, y: p.startY };
  const v: View = { p, citizens, army, priests, traders, cogs, fishers, navy, planes, buildings, home, tc, budget: { ...p.res }, plan: NO_PLAN, diggers: new Set(), armyFirst: false, claimers: new Set(), wagons, hunt: { n: 3, r: 16 }, packing: !!mem.steppe?.pack, hands: citizens.length + (isLegion(p) && p.epoch <= LEGION.aiUntil ? army.filter(legionHand).length : 0) };
  // The Hunters' Way (#463 s1) lives by the chase in the Stone Age: more hunters, ranging farther, with camps pitched at the kill.
  if (p.way === 'hunt' && p.epoch === 0) v.hunt = { n: AI_WAYS.hunters, r: AI_WAYS.huntReach };
  const issue = (c: Command) => applyCommand(s, c);

  // The iron road's survey (#50) is cheap and first in line: in the Stone Age, citizens eat every scrap.
  // It waits for a town of `survey` citizens (#79): at ten, it held up the citizens of a town that might
  // find no bog at all, the very ones that win the first fight.
  ironRoad(s, v, mem, issue);
  oreRoad(s, v, mem, issue);
  steppeRoad(s, v, mem, issue);
  readYear(s, v);
  huntTheYear(s, v, issue);

  // Tidings at the fire (#443), one plain rule a card, answered before the town spends its stores.
  const tiding = aiTiding(s, p);
  if (tiding) {
    issue({ t: 'tiding', p: p.id, ...tiding });
    v.budget = { ...p.res };
  }

  // People first: a growing town pays for everything else.
  const advancing = buildings.some((b) => b.advance >= 0);
  const queuedCitizens = buildings.reduce((n, b) => n + b.queue.filter((q) => q.unit === 'citizen').length, 0);
  const wantCitizens = Math.min(L.citizens + p.epoch * 3, isLegion(p) ? citizenCap(p) : 60);
  // The Warband Way (#463 s1) eats by raiding: in the Stone Age, out of a treaty, its first band of foot comes before more hands (once; later bands come as soldiers do).
  if (L.clever && p.way === 'warband' && p.epoch === 0 && s.tick >= s.peaceUntil && !mem.prowl && mem.prowled === undefined && citizens.length >= AI_WAYS.bandAt && army.filter(prowler).length < AI_WAYS.band) {
    const yard = buildings.find((b) => b.type === 'barracks' && b.built && b.queue.length === 0);
    const cost = yard ? trainCostFor(s, p.id, 'infantry', 'barracks', yard) : null;
    if (yard && cost && afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: yard.id, unit: 'infantry' });
      spend(v, cost);
    } else if (yard) spend(v, trainCostFor(s, p.id, 'infantry', 'barracks', yard));
  }
  // The Hearth Way (#463 s1) grows by calling its kin, two at a time (three in winter). Out of winter two kin cost more
  // a head than one citizen trained alone (#486), so it doesn't wait on them then: it calls them when it holds the food
  // and trains a citizen when it doesn't. In a Stone Age winter, once its first hands are at work, it saves for the call.
  const hearth = L.clever && p.way === 'hearth';
  const winter = seasonAt(s) === 3;
  const kinOnly = hearth && winter && p.epoch === 0 && citizens.length >= AI_WAYS.kinFrom && citizens.length + queuedCitizens + KIN.winter <= wantCitizens && p.cap - p.pop >= KIN.winter;
  if (hearth && tc && !advancing && citizens.length + queuedCitizens + KIN.winter <= wantCitizens && aiKin(s, p, tc, winter ? 0 : AI_WAYS.kinKeep)) {
    issue({ t: 'kin', p: p.id, building: tc.id });
    spend(v, KIN.cost);
  } else if (kinOnly && !advancing && !threatNear(s, v).unit) {
    // Saving for the next call: the army and the rest wait on the food it needs, unless raiders are at the door.
    spend(v, KIN.cost);
  } else if (tc && !advancing && !v.packing && !kinOnly && citizens.length + queuedCitizens < wantCitizens && tc.queue.length < (hearth ? 1 : 2)) {
    const cost = unitStats('citizen', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: tc.id, unit: 'citizen' });
      spend(v, cost);
    }
  }

  // Traders pay for themselves: they come before the epoch's savings and the army.
  merchants(s, v, mem, issue);
  seaMerchants(s, v, issue);

  // In a campaign chapter, its goals come before the epoch's savings.
  v.plan = chapterGoals(s, v, mem, issue);

  // Epochs: once there are enough people, set the cost aside (so the army doesn't eat it) and advance;
  // but when an attack is due and the army is short of it, soldiers come first.
  const waveSize = L.wave + mem.wave * L.waveGrowth;
  const short = s.tick > secs(L.firstAttack - 150) && army.length < waveSize && !mem.attacking;
  // A beaten town (#113): once a wave has gone out, an army that stays short of the next one holds the
  // next age back only so long. Waiting longer, it lost every soldier it trained to the rival at its
  // gates and stayed an age behind for ten minutes and more, food-starved.
  if (!short || mem.wave === 0) delete mem.short;
  else if (!mem.short || mem.short.epoch !== p.epoch) mem.short = { since: s.tick, epoch: p.epoch };
  const armyFirst = short && (!mem.short || s.tick - mem.short.since <= secs(L.armyWait));
  v.armyFirst = armyFirst;
  // Which road it takes is the web's to say (#50): the trunk, or a side road it has chosen once it opens.
  const wantEpoch = p.epoch < Math.min(LAST_EPOCH, v.plan.maxEpoch) && !advancing && !armyFirst && citizens.length + (isLegion(p) && p.epoch > 0 ? army.filter(legionHand).length : 0) >= ADVANCE_AT[p.epoch] && s.tick > secs(150 + p.epoch * 150);
  // Patience for a road's deeds counts only while the Town Center holds for them (#113): army-first
  // kept a town from holding for minutes, and it came back out of patience at once.
  if (!wantEpoch) delete mem.waiting;
  const journey = advancing ? null : (!armyFirst && turnRoad(s, v, mem)) || (wantEpoch ? nextRoad(s, v, mem) : null);
  if (journey) {
    const { road, wait } = journey;
    // The main road forward goes without a target, as it always has; any other road is named.
    if (!wait && tc && tc.queue.length === 0 && afford(v, road.cost)) issue({ t: 'advance', p: p.id, building: tc.id, ...(road === mainRoad(p) ? {} : { to: road.to }) });
    spend(v, road.cost);
    // A nomad people buys its road's stone (#532): the gold for it is set aside too, or the army spends all but the road's own gold and the stone waits.
    if (isNomad(p)) spend(v, { gold: stoneGold(s, p, road.cost) });
  } else if (armyFirst && !advancing && p.epoch < Math.min(LAST_EPOCH, v.plan.maxEpoch) && banked(p) && !armyDeed(s, p, mem)) {
    // A climb nearly paid for keeps its savings while the army comes first (#532): a wave that came home short spent the whole price on soldiers, minutes from the next age.
    const road = mainRoad(p)!;
    spend(v, road.cost);
    if (isNomad(p)) spend(v, { gold: stoneGold(s, p, road.cost) });
  }

  // In the age of flight, save up for an airfield before anything smaller takes the wood.
  if (L.clever && p.epoch >= 4 && v.hands >= 24 && !buildings.some((b) => b.type === 'airfield') && !lightningBound(s, v, mem)) {
    const cost = buildingCostFor(s, p.id, 'airfield');
    const recent = s.tick - (mem.ordered.airfield ?? -99999) < secs(40);
    const spot = !recent && afford(v, cost) ? findSpot(s, 'airfield', home.x, home.y, 6, 22) : null;
    if (!spot || !construct(s, v, mem, 'airfield', spot, 3, issue)) spend(v, cost);
  }

  forwardField(s, v, mem, issue);

  townBell(s, v, mem, issue);
  greatWork(s, v, mem, issue);
  const way = AI_LEVELS[v.p.ai!].clever ? aiWay(s, v.p) : null;
  if (way) issue({ t: 'way', p: v.p.id, way });
  if (AI_LEVELS[v.p.ai!].clever && aiVow(s, v.p)) issue({ t: 'vow', p: v.p.id });
  lightBeacons(s, v, issue);
  beaconsForLightning(s, v, mem, issue);
  rallyTheLine(s, v, issue);
  research(s, v, v.hands >= wantCitizens - 2, issue);
  trade(s, v, issue);
  planBuildings(s, v, mem, issue);
  trapLine(s, v, mem, issue);
  floodWork(s, v, issue);
  hemoBuild(s, v, mem, issue);
  excavate(s, v, mem, issue);
  salvage(s, v, mem, issue);
  claimWalk(s, v, mem, issue);
  strikeCamp(s, v, mem, issue);
  tendFlock(s, v, issue);
  assignCitizens(s, v, issue);
  wilds(s, v, mem, issue);
  // Ships and aircraft are few and dear: they get first call on the treasury.
  seafaring(s, v, mem, issue);
  airforce(s, v, mem, issue);
  polisArms(s, v, mem, issue);
  legionWork(s, v, mem, issue);
  military(s, v, mem, issue);
  priestly(s, v, mem, issue);
}

// ---- Research and trade ----------------------------------------------------------------------------

function research(s: GameState, v: View, peopleEnough: boolean, issue: (c: Command) => void): void {
  const { p } = v;
  const L = AI_LEVELS[p.ai!];
  const order = L.clever ? TECH_ORDER : ECONOMY;
  for (const tech of order) {
    if (techProblem(s, p.id, tech)) continue;
    // Racks are worth their wood once big game (a boar or mammoth) is down.
    if (tech === 'drying' && !s.carcasses?.some((c) => c.full > AMOUNT.meat)) continue;
    // Hounds are for hunters with a camp, once there is game worth the fight.
    if (tech === 'hounds' && !s.carcasses?.some((c) => c.full > AMOUNT.meat)) continue;
    // Trade technologies only pay with traders on the road.
    if (TECHS[tech].at === 'market' && v.traders.length < 3) continue;
    // An heirloom (#232) joins a queue that has room: a Dock that never stops training would otherwise never learn its own.
    const room = TECHS[tech].walked ? MAX_QUEUE : 1;
    const at = v.buildings.find((b) => b.type === TECHS[tech].at && b.built && b.queue.length < room && b.advance < 0);
    if (!at) continue;
    // The Town Center trains citizens first, and learns nothing while it waits to strike camp.
    if (at.type === 'towncenter' && ((!peopleEnough && v.hands < 12) || v.packing)) continue;
    const cost = techCostFor(s, p.id, tech);
    // Keep something back for soldiers and the next epoch.
    const keep: Cost = { food: 100, wood: 100, gold: 50 };
    if (!RES.every((r) => !cost[r] || v.budget[r] >= cost[r]! + (keep[r] ?? 0))) continue;
    issue({ t: 'research', p: p.id, building: at.id, tech });
    spend(v, cost);
    return;
  }
}

function trade(s: GameState, v: View, issue: (c: Command) => void): void {
  const { p } = v;
  const nomad = isNomad(p);
  if (!(AI_LEVELS[p.ai!].clever || nomad) || !v.buildings.some((b) => b.type === 'market' && b.built)) return;
  // A nomad people (#501) quarries no stone: it buys a lot whenever it runs short and has the gold.
  // The next road's stone is bought ahead of the road (the climb from the Warband asks more than a small store).
  const road = nomad ? mainRoad(p) : undefined;
  if (nomad && p.res.stone < Math.max(NOMAD.aiStone, road?.cost.stone ?? 0) && p.res.gold >= Math.max(NOMAD.aiGold, s.market.stone + NOMAD.aiMargin + (road?.cost.gold ?? 0))) {
    issue({ t: 'trade', p: p.id, res: 'stone', buy: true });
    return;
  }
  // And it has no fields: grain is bought from the settled with the gold it mines and takes.
  if (nomad && p.res.food < NOMAD.aiFood && p.res.gold >= Math.max(NOMAD.aiGold, s.market.food + 40) && s.market.food < NOMAD.aiFoodPrice) {
    issue({ t: 'trade', p: p.id, res: 'food', buy: true });
    return;
  }
  // Its timber has no field to feed and piles up while the gold runs short: the surplus is sold, down to a price worth taking.
  if (nomad && p.res.wood > NOMAD.aiSellWood && p.res.gold < NOMAD.aiGoldShort && s.market.wood > NOMAD.aiWoodFloor) {
    issue({ t: 'trade', p: p.id, res: 'wood', buy: false });
    return;
  }
  if (!AI_LEVELS[p.ai!].clever) return;
  // Ore in hand sells at once: the doors count what was mined, not what is kept.
  for (const r of RARES) {
    // Blood-iron is kept for grafts while a Station stands to quench them with it.
    if (r === 'bloodiron' && stationsOf(s, p.id).length) continue;
    if ((p.rare?.[r] ?? 0) >= ORE_TRADE.lot) {
      issue({ t: 'trade', p: p.id, res: r, buy: false });
      return;
    }
  }
  // Sell what piles up for gold; buy what is short when gold piles up. On a chapter's clock, a smaller pile is worth selling.
  const pile = v.plan.wave ? 600 : 1500;
  for (const r of ['food', 'wood', 'stone'] as const) {
    if (p.res[r] > pile && p.res.gold < 400 && s.market[r] > MARKET.min + 10) {
      issue({ t: 'trade', p: p.id, res: r, buy: false });
      return;
    }
  }
  const rich = v.plan.wave ? 500 : 1200;
  for (const r of ['food', 'wood'] as const) {
    if (p.res[r] < 100 && p.res.gold > rich && s.market[r] < 250) {
      issue({ t: 'trade', p: p.id, res: r, buy: true });
      return;
    }
  }
}

/** Whether a Path of Blood road it has chosen still waits on a deed its army must earn (the slain, the plunder): its soldiers are that road's price. */
function armyDeed(s: GameState, p: Player, mem: AiMemory): boolean {
  // Undecided counts as bound: the choice is made when it is first ready to climb, which army-first puts off.
  const ahead = ageOf(p) === 'warband' ? ROADS.filter((r) => r.from === 'gunpowder' && r.to === 'ironblood') : roadsFrom(p).filter((r) => AGES[r.to].path === 'blood' && roadKnown(s, p, r));
  return ahead.some((r) => mem.roads?.[r.to] !== false && !!r.deed && !oreOnly(s, r) && !deedsDone(p, r, s));
}

/** Whether a `banked` share of the main road's whole price is in hand. */
function banked(p: Player): boolean {
  const road = mainRoad(p);
  if (!road) return false;
  let need = 0;
  let have = 0;
  for (const r of RES) {
    need += road.cost[r] ?? 0;
    have += Math.min(p.res[r], road.cost[r] ?? 0);
  }
  return need > 0 && have >= need * AI_CLIMB.banked;
}

/** The gold a nomad people (#501) needs at the Market for the stone a price asks beyond its store: each lot dearer than the last, and the margin `trade` keeps. */
function stoneGold(s: GameState, p: Player, cost: Cost): number {
  const lots = Math.ceil(Math.max(0, (cost.stone ?? 0) - p.res.stone) / MARKET.lot);
  let gold = 0;
  for (let i = 0; i < lots; i++) gold += Math.min(MARKET.max, s.market.stone + i * MARKET.step);
  return lots > 0 ? gold + NOMAD.aiMargin : 0;
}

// ---- The web of ages (#50) ---------------------------------------------------------------------------

/**
 * Whether the computer walks the web at all: a clever opponent does, in an ordinary match and as a
 * chapter's rival; a chapter's own seat keeps to the trunk, its clock spent on the chapter's goals.
 */
const walksWeb = (v: View): boolean => AI_LEVELS[v.p.ai!].clever && v.plan === NO_PLAN;

/**
 * How a side age suits a people: 1 when its signature line comes cheaper there (Greek and Roman foot
 * in the Iron Age, Egyptian priests among the pilgrims), -1 when it bars that line (Mongol riders in
 * the Iron Age, Chinese siege among the pilgrims), 0 otherwise. Read from the age's own rules, so a
 * new age is judged without a table to keep.
 */
function fit(p: Player, to: AgeId): number {
  const sig = SIGNATURES[p.civ].type;
  const age = AGES[to];
  const cls = unitStats(sig, 0).cls;
  // The Path of Blood (#307) suits a people that fights with foot or riders; the others keep to trade, faith and craft.
  if (age.path === 'blood') return cls === 'infantry' || cls === 'cavalry' ? 0 : -1;
  // The Silk Road (#326) waits until the computer knows how to move its Market with the camp.
  if (to === 'silk') return -1;
  // The Steppe Road (#320): its first age is judged as any side age; the Horde follows it (#322, see `wants`).
  if (age.no?.units.includes(sig)) return -1;
  return (age.price?.[cls] ?? 1) < 1 ? 1 : 0;
}

/**
 * The heirloom (#224) a road into `to` would open: one whose other age the people has already walked,
 * and that it hasn't learned yet. Null when the road opens none.
 */
export function heirloomAhead(p: Player, to: AgeId): TechId | null {
  for (const id of TECH_ORDER) {
    const pair = TECHS[id].walked;
    if (!pair || !pair.includes(to) || p.techs.includes(id)) continue;
    const other = pair[0] === to ? pair[1] : pair[0];
    if (hasWalked(p, other)) return id;
  }
  return null;
}

/**
 * Whether it means to walk the road to a side age, decided the first time it asks (#50). A road that
 * opens an heirloom with an age it has already walked (#232) is taken at `AI_WEB.heir` odds rather than
 * `take`: the second road is the plan, not a coin toss. A road that bars its people's strength still isn't.
 */
function wants(s: GameState, p: Player, mem: AiMemory, to: AgeId): boolean {
  const roads = (mem.roads ??= {});
  // The Hunters' Way (#463 s1) keeps no fields and little food in store: the steppe's flocks start from a store it lacks.
  if (roads[to] === undefined && AGES[to].mobile && p.way === 'hunt') roads[to] = false;
  if (roads[to] === undefined && to === 'horde') {
    // The Horde is the steppe's second step (#322): a people that rode the steppe goes on, as the Path of Blood's later steps do.
    roads[to] = hasWalked(p, 'steppe');
  } else if (roads[to] === undefined && (to === 'ironblood' || to === 'totalwar')) {
    // The later steps of the Path of Blood are no new coin toss: a people that walked the step before goes on.
    roads[to] = hasWalked(p, to === 'ironblood' ? 'warband' : 'ironblood');
  } else if (roads[to] === undefined && (to === 'hemocraft' || to === 'bloodrite')) {
    // The fork (#355 s5) is chosen once, both roads together: never Hemocraft against a rival army of steel, where a drain finds no blood.
    const open = AI_LEVELS[p.ai!].fork !== false;
    const hemo = livingShare(s, p) >= AI_FORK.living && coin(s, p.id, 0x4e30) < AI_FORK.hemo;
    roads.hemocraft = open && hemo;
    roads.bloodrite = open && !hemo;
  } else if (roads[to] === undefined) {
    const f = fit(p, to);
    // The steppe tosses a coin of its own: asked early by every clever town, it would shift the dice of every match.
    if (f === 0 && AGES[to].mobile && !heirloomAhead(p, to)) roads[to] = coin(s, p.id, 0x57e9) < AI_STEPPE.take;
    // A nomad host (#501) lives by tribute and plunder: the Path of Blood is its road, the trading posts are not.
    else if (isNomad(p) && f === 0 && AGES[to].path === 'blood') roads[to] = true;
    else if (isNomad(p) && to === 'merchant') roads[to] = false;
    else roads[to] = f > 0 || (f === 0 && roll(s) < (AGES[to].path === 'blood' ? AI_BLOOD.take : heirloomAhead(p, to) ? AI_WEB.heir : AI_WEB.take));
  }
  return roads[to]!;
}

/**
 * Whether a chosen road's deeds are worth holding the Town Center for, rather than taking the trunk now:
 * each one a `nearly` share done, or under way where that costs nothing more (relics in its Temples,
 * citizens digging; traders on the road cost the Bronze Age army its wood), for at most `patience` seconds from when it first held
 * (twice that with every deed a `close` share done). Out of patience, it gives the road up for good.
 */
function worthWaiting(s: GameState, v: View, mem: AiMemory, r: Road): boolean {
  const { p } = v;
  const underWay = (d: DeedProgress) =>
    d.have >= d.need * AI_WEB.nearly ||
    (d.deed.stat === 'relicGold' && relicsKept(s, p.id) > 0) ||
    (d.deed.stat === 'iron' && v.diggers.size > 0);
  const deeds = deedsProgress(p, r);
  // An ore door under way (#356 s5): a crew is digging the ore, so the road is worth holding for.
  const digging = !!r.ore && !!s.rares?.includes(r.ore.id) && v.citizens.some((u) => u.order.k === 'gather' && u.order.rare === r.ore!.id);
  if (!digging && !deeds.every(underWay)) return false;
  mem.waiting ??= s.tick;
  // A deed nearly done earns more patience (#113): a Greek town gave up its dig at 135 bog iron of 150,
  // seconds from the Iron Age, with the price of it banked.
  const close = deeds.every((d) => d.have >= d.need * AI_WEB.close);
  if (s.tick - mem.waiting <= secs((r.to === 'horde' ? AI_HORDE.hold : AI_WEB.patience) * (close ? 2 : 1))) return true;
  mem.roads![r.to] = false;
  delete mem.waiting;
  return false;
}

/** A road to take, and whether to hold off taking it for now. */
interface Journey {
  road: Road;
  wait: boolean;
}

/**
 * The road forward when it is ready to advance: a side road it has chosen, once that road is known and
 * its deeds are done (or nearly done, worth holding for); the trunk otherwise.
 */
function nextRoad(s: GameState, v: View, mem: AiMemory): Journey | null {
  const { p } = v;
  const main = mainRoad(p);
  if (walksWeb(v)) {
    for (const r of roadsFrom(p)) {
      if (!isSideRoad(r) || AGES[r.to].tier <= p.epoch || !roadKnown(s, p, r) || !wants(s, p, mem, r.to)) continue;
      if (deedsDone(p, r, s)) {
        delete mem.waiting;
        return { road: r, wait: false };
      }
      if (worthWaiting(s, v, mem, r)) return { road: r, wait: true };
    }
  }
  delete mem.waiting;
  // The steppe (#320) is kept a while, so the flock it came for pays.
  if (walksWeb(v) && ageDef(p).mobile && s.tick - (mem.steppe?.since ?? s.tick) < secs(AI_STEPPE.stay)) return null;
  // The Horde stays `stay` seconds before it climbs on: tribute is what it came for (#322).
  if (walksWeb(v) && ageOf(p) === 'horde') {
    const st = (mem.steppe ??= {});
    st.horde ??= s.tick;
    if (s.tick - st.horde < secs(AI_HORDE.stay)) return null;
  }
  if (walksWeb(v)) {
    const hold = bloodHold(s, v, mem);
    if (hold === 'stay') return null;
    if (hold) return { road: hold, wait: true };
  }
  return main ? { road: main, wait: false } : null;
}

/**
 * The Path of Blood (#307) holds the climb on the trunk three times: in the Middle Ages for the Warband's
 * deed (the slain, held as other deeds are), in the Warband for the plunder the Iron and Blood road asks
 * (`AI_BLOOD.patience` seconds, then the road is given up), and in Iron and Blood itself for `stay` seconds,
 * since its camps are what it came for. Returns the road held for, 'stay', or null.
 */
function bloodHold(s: GameState, v: View, mem: AiMemory): Road | 'stay' | null {
  const { p } = v;
  const here = ageOf(p);
  const blood = (mem.blood ??= {});
  if (here === 'ironblood') {
    blood.since ??= s.tick;
    // Total War's deed is trained at the camps, which Industry strikes: stay until it is done (or the patience runs out).
    const toWar = ROADS.find((r) => r.from === 'industrial' && r.to === 'totalwar');
    if (toWar && wants(s, p, mem, 'totalwar') && !deedsDone(p, toWar, s) && s.tick - blood.since < secs(AI_BLOOD.patience)) return 'stay';
    return s.tick - blood.since < secs(AI_BLOOD.stay) ? 'stay' : null;
  }
  const road =
    here === 'warband'
      ? ROADS.find((r) => r.from === 'gunpowder' && r.to === 'ironblood')
      : roadsFrom(p).find((r) => AGES[r.to].path === 'blood' && AGES[r.to].tier === p.epoch && roadKnown(s, p, r));
  if (!road || !wants(s, p, mem, road.to) || (here !== 'warband' && !roadKnown(s, p, road))) return null;
  if (deedsDone(p, road, s)) return null;
  if (here !== 'warband') return worthWaiting(s, v, mem, road) ? road : null;
  blood.hold ??= s.tick;
  if (s.tick - blood.hold <= secs(AI_BLOOD.patience)) return road;
  mem.roads![road.to] = false;
  return null;
}

/**
 * A turn sideways, between advances: into the pilgrims' age from the Middle Ages once the relics it keeps
 * (`relics` of them at least) have paid the deed, or into the Age of Sail once its boats have landed the catch; and back out onto the trunk when its road has been
 * countered, the Temples that held its relics fallen or robbed.
 */
function turnRoad(s: GameState, v: View, mem: AiMemory): Journey | null {
  const { p } = v;
  if (!walksWeb(v)) return null;
  const here = ageOf(p);
  const fork = forkTurn(s, v, mem);
  if (fork) return fork;
  // Bound for the fork, Industry doesn't turn back to Total War.
  const forking = here === 'industrial' && !!forkRoad(s, p, mem);
  const kept = relicsKept(s, p.id);
  // A detour (#232): a pilgrim town with the catch landed and a Dock, whose Age of Sail would open an heirloom, steps back to
  // the Middle Ages to take it, and doesn't turn pilgrim again on the way (the road to Sail is the plan).
  const sailRoad = ROADS.find((r) => r.from === 'middle' && r.to === 'sail');
  const toSail = AI_LEVELS[p.ai!].detour && !!sailRoad && !!heirloomAhead(p, 'sail') && count(v, 'dock', true) > 0 && deedsDone(p, sailRoad, s) && wants(s, p, mem, 'sail');
  for (const r of roadsFrom(p)) {
    if (AGES[r.to].tier !== p.epoch || (forking && r.to === 'totalwar')) continue;
    if (toSail && here === 'pilgrim' && r.to === 'middle') return { road: r, wait: false };
    if (toSail && r.to === 'pilgrim') continue;
    if (r.to === 'aeronaut' && v.planes.length > 0 && roadKnown(s, p, r) && wants(s, p, mem, r.to)) return { road: r, wait: false };
    if (here === 'aeronaut' && r.to === 'industrial' && count(v, 'airfield', true) === 0) {
      mem.roads ??= {};
      mem.roads.aeronaut = false;
      return { road: r, wait: false };
    }
    // The other future (#231): a town of towers and no aircraft goes over to lightning once its beacons are lit;
    // with its last tower fallen it brings the steam engines back.
    if (r.to === 'lightning' && v.planes.length === 0 && count(v, 'tower', true) >= AI_LIGHTNING.towers && roadKnown(s, p, r) && deedsDone(p, r, s) && wants(s, p, mem, r.to)) return { road: r, wait: false };
    if (here === 'lightning' && r.to === 'industrial' && count(v, 'tower', true) === 0) {
      mem.roads ??= {};
      mem.roads.lightning = false;
      return { road: r, wait: false };
    }
    // A people that settled in the Middle Ages after the steppe turns horde again once the herd's deeds are done (#322).
    if (r.to === 'horde') {
      if (roadKnown(s, p, r) && deedsDone(p, r, s) && wants(s, p, mem, r.to)) return { road: r, wait: false };
      continue;
    }
    if (here === 'pilgrim' && r.to === 'middle' && kept === 0) return { road: r, wait: false };
    // A coastal people turns sailor once its boats have landed the catch; with its last Dock gone, it comes ashore.
    if (here === 'sail' && r.to === 'middle' && count(v, 'dock', true) === 0) {
      mem.roads ??= {};
      mem.roads.sail = false;
      return { road: r, wait: false };
    }
    if (r.to === 'sail' && count(v, 'dock', true) > 0 && roadKnown(s, p, r) && deedsDone(p, r, s) && wants(s, p, mem, r.to)) return { road: r, wait: false };
    // The Path of Blood (#307): a war-people with a Barracks turns Warband once the slain are counted, and Iron and Blood once the plunder is in.
    if (AGES[r.to].path === 'blood') {
      if (roadKnown(s, p, r) && deedsDone(p, r, s) && wants(s, p, mem, r.to)) return { road: r, wait: false };
      continue;
    }
    if (r.to !== 'pilgrim' || kept < AI_WEB.relics || !roadKnown(s, p, r) || !deedsDone(p, r, s) || !wants(s, p, mem, r.to)) continue;
    // Bound for the Path of Blood, it doesn't turn pilgrim (#532): the pilgrims' age shuts the Warband, which waits on its slain or comes next.
    const warband = roadsFrom(p).find((w) => w.to === 'warband');
    if (warband && roadKnown(s, p, warband) && wants(s, p, mem, 'warband')) continue;
    return { road: r, wait: false };
  }
  return null;
}

/** The road into the branch of the fork (#355 s5) the computer chose, out of the Industrial Age; undefined before Total War, or given up. */
function forkRoad(s: GameState, p: Player, mem: AiMemory): Road | undefined {
  if (!hasWalked(p, 'totalwar')) return undefined;
  const to: AgeId | null = wants(s, p, mem, 'hemocraft') ? 'hemocraft' : wants(s, p, mem, 'bloodrite') ? 'bloodrite' : null;
  return to ? ROADS.find((r) => r.from === 'industrial' && r.to === to) : undefined;
}

/**
 * The fork at the end of the Path of Blood (#355 s5). In Total War, once its town has grown to `AI_HEMO.town` citizens, it chooses its
 * branch and works that deed (`hemoBuild`). It stays `AI_FORK.stay` seconds at least from then, then makes peace into Industry once a
 * deed is done and that road's clue stands: its chosen branch's, or else the other's (the rite's always, Hemocraft's only against a rival
 * that bleeds), and the branch it takes becomes its choice. It saves the price of peace and of the branch together before it goes. In
 * Industry it turns down the branch. No deed done `patience` seconds after its town grew, or a road still shut `back` seconds into
 * Industry, gives the fork up: it stays at war, or goes back to it.
 */
function forkTurn(s: GameState, v: View, mem: AiMemory): Journey | null {
  const { p } = v;
  const here = ageOf(p);
  if (here !== 'totalwar' && here !== 'industrial') return null;
  const blood = (mem.blood ??= {});
  if (here === 'totalwar' && blood.war === undefined && v.citizens.length < AI_HEMO.town) return null;
  const road = forkRoad(s, p, mem);
  if (!road) return null;
  const giveUp = () => {
    mem.roads!.hemocraft = false;
    mem.roads!.bloodrite = false;
  };
  if (here === 'industrial') {
    blood.fork ??= s.tick;
    if (roadKnown(s, p, road) && deedsDone(p, road, s)) return { road, wait: false };
    if (s.tick - blood.fork >= secs(AI_FORK.back)) giveUp();
    return null;
  }
  delete blood.fork;
  blood.war ??= s.tick;
  const other = ROADS.find((r) => r.from === 'industrial' && r.walked === 'totalwar' && r.to === road.shuns)!;
  const open = (r: Road) => deedsDone(p, r, s) && roadKnown(s, p, r);
  const ready = open(road) ? road : open(other) && (other.to === 'bloodrite' || livingShare(s, p) >= AI_FORK.living) ? other : null;
  if (!ready) {
    if (s.tick - blood.war >= secs(AI_FORK.patience)) giveUp();
    return null;
  }
  if (s.tick - blood.war < secs(AI_FORK.stay)) return null;
  mem.roads!.hemocraft = ready.to === 'hemocraft';
  mem.roads!.bloodrite = ready.to === 'bloodrite';
  const peace = roadsFrom(p).find((r) => r.to === 'industrial');
  if (!peace) return null;
  // Peace waits until the branch's price is in hand too: a town that sits in Industry saving for it has struck its camps for nothing.
  const both: Cost = {};
  for (const r of RES) if (peace.cost[r] || ready.cost[r]) both[r] = (peace.cost[r] ?? 0) + (ready.cost[r] ?? 0);
  return { road: { ...peace, cost: both }, wait: false };
}

/**
 * The iron road (#39), in the Stone Age: a people the Iron Age would suit has the land surveyed at a
 * Storehouse; if the survey finds bog iron, it keeps a few citizens digging until the deed is done.
 */
function ironRoad(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  // A household people (#501) digs no bog iron.
  if (isHousehold(p)) return;
  const road = roadsFrom(p).find((r) => r.to === 'iron');
  // Once the deed is dug, or the road given up, bog iron is only a poor gold mine: diggers go back to
  // what the town needs (#79). Left to it, they walked from one bog to the next all through the Stone Age.
  // In the Iron Age itself the bog pays double gold: its diggers stay.
  if (ageOf(p) === 'iron') return;
  if (!road || deedsDone(p, road, s) || mem.roads?.iron === false) {
    releaseDiggers(s, v, issue);
    return;
  }
  if (p.epoch !== 0 || !walksWeb(v) || v.hands < (isLegion(p) ? LEGION.aiSurvey : AI_WEB.survey) || count(v, 'barracks', true) === 0 || fit(p, 'iron') < 0) return;
  if (!road.found) return;
  if (!p.techs.includes(road.found)) {
    if (!wants(s, p, mem, 'iron') || techProblem(s, p.id, road.found)) return;
    const at = v.buildings.find((b) => b.type === TECHS[road.found!].at && b.built && b.queue.length === 0);
    const cost = techCostFor(s, p.id, road.found);
    if (!at || !afford(v, cost)) return;
    issue({ t: 'research', p: p.id, building: at.id, tech: road.found });
    spend(v, cost);
    return;
  }
  if (!roadKnown(s, p, road) || !wants(s, p, mem, 'iron') || deedsDone(p, road, s)) return;
  for (const u of [...v.citizens, ...legionHands(v)]) if (u.order.k === 'gather' && (u.order.bog || s.res[u.order.tile] === R_BOG)) v.diggers.add(u.id);
  // Holding the Town Center for the deed, it digs harder (#79): idle savings are the dearest wait.
  const crew = mem.waiting !== undefined ? AI_WEB.diggers * 2 : AI_WEB.diggers;
  if (v.diggers.size >= crew) return;
  // The nearest gatherers of wood or gold (or anyone idle) go to the nearest bog.
  const bog = findResource(s, R_BOG, v.home.x, v.home.y, 40);
  if (bog < 0) return;
  const bx = (bog % s.w) + 0.5;
  const by = Math.floor(bog / s.w) + 0.5;
  const free = [...v.citizens, ...legionHands(v)]
    .filter((u) => !u.inside && !v.diggers.has(u.id) && u.carry <= 2 && (u.order.k === 'idle' || (u.order.k === 'gather' && (u.order.res === 'wood' || u.order.res === 'gold'))))
    .sort((a, c) => (a.x - bx) * (a.x - bx) + (a.y - by) * (a.y - by) - ((c.x - bx) * (c.x - bx) + (c.y - by) * (c.y - by)) || a.id - c.id);
  const ids = free.slice(0, crew - v.diggers.size).map((u) => u.id);
  if (!ids.length) return;
  issue({ t: 'gather', p: p.id, ids, tile: bog });
  for (const id of ids) v.diggers.add(id);
}

/**
 * The ore road (#356 s5): a road with an ore door, in a world that holds the ore, is walked by mining it when the
 * computer means to take that road: a crew digs the nearest vein and the door opens in place of the deeds. When the
 * door is open, the road is given up, or the vein is gone, the crew goes back to what the town needs. A world without
 * the ore leaves it on the deeds, as before.
 */
function oreRoad(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  if (!s.rares?.length || !walksWeb(v)) return;
  // The Warband is held for the Iron and Blood road before it is on offer (bloodHold), so its ore is dug from there.
  const road = roadsFrom(p).find((r) => r.ore && s.rares!.includes(r.ore.id)) ?? (ageOf(p) === 'warband' ? ROADS.find((r) => r.from === 'gunpowder' && r.to === 'ironblood' && r.ore && s.rares!.includes(r.ore.id)) : undefined);
  const crew = v.citizens.filter((u) => u.order.k === 'gather' && u.order.rare !== undefined);
  for (const u of crew) v.diggers.add(u.id);
  const open = !road || oreDone(p, road) || deedsDone(p, road, s) || mem.roads?.[road.to] === false || !roadKnown(s, p, road);
  if (open) {
    const idle = crew.filter((u) => u.carry <= 2 && !u.inside);
    if (idle.length) {
      const want = wanted(v, coldComing(s, v));
      const have: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
      for (const u of v.citizens) {
        const j = jobOf(u);
        if (j && j !== 'build') have[j]++;
      }
      for (const u of idle) {
        v.diggers.delete(u.id);
        have.stone--;
        const need = [...RES].sort((a, b) => want[b] - have[b] - (want[a] - have[a]))[0];
        if (sendTo(s, v, u, need, issue) || sendTo(s, v, u, 'wood', issue)) have[need]++;
      }
    }
    return;
  }
  if (!wants(s, p, mem, road.to) || count(v, 'storehouse', true) === 0) return;
  const kind = TILE_OF_RARE[road.ore!.id];
  if (v.diggers.size >= AI_ORE.crew) return;
  const vein = findResource(s, kind, v.home.x, v.home.y, AI_ORE.reach);
  if (vein < 0) return;
  const bx = (vein % s.w) + 0.5;
  const by = Math.floor(vein / s.w) + 0.5;
  const free = v.citizens
    .filter((u) => !u.inside && !v.diggers.has(u.id) && u.carry <= 2 && (u.order.k === 'idle' || (u.order.k === 'gather' && (u.order.res === 'wood' || u.order.res === 'gold'))))
    .sort((a, c) => (a.x - bx) * (a.x - bx) + (a.y - by) * (a.y - by) - ((c.x - bx) * (c.x - bx) + (c.y - by) * (c.y - by)) || a.id - c.id);
  const ids = free.slice(0, AI_ORE.crew - v.diggers.size).map((u) => u.id);
  if (!ids.length) return;
  issue({ t: 'gather', p: p.id, ids, tile: vein });
  for (const id of ids) v.diggers.add(id);
}

/** Citizens still digging bog iron when no deed needs it go to the resource the town is shortest of (#79). */
function releaseDiggers(s: GameState, v: View, issue: (c: Command) => void): void {
  const bog = v.citizens.filter((u) => u.order.k === 'gather' && (u.order.bog || s.res[u.order.tile] === R_BOG) && u.carry <= 2 && !u.inside);
  if (!bog.length) return;
  const want = wanted(v, coldComing(s, v));
  const have: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const u of v.citizens) {
    const j = jobOf(u);
    if (j && j !== 'build') have[j]++;
  }
  for (const u of bog) {
    have.gold--;
    const need = [...RES].sort((a, b) => want[b] - have[b] - (want[a] - have[a]))[0];
    if (sendTo(s, v, u, need, issue) || sendTo(s, v, u, 'wood', issue)) have[need]++;
  }
}

/**
 * Whether it is bound for the merchants' age (#50): in the Bronze Age, on a map with trading posts, and
 * of a mind to take that road. It then raises its Market before it is otherwise due (its traders are the
 * Bronze Age's usual few: each costs the army wood).
 */
function merchantBound(s: GameState, v: View, mem: AiMemory): boolean {
  return walksWeb(v) && s.posts.length > 0 && ageOf(v.p) === 'bronze' && wants(s, v.p, mem, 'merchant');
}

/** Whether any rival stands in this age: a people's age is on the scoreboard for all to read. */
function rivalIn(s: GameState, p: Player, ages: AgeId[]): boolean {
  return s.players.some((o) => !o.defeated && isEnemy(s, p.id, o.id) && ages.includes(ageOf(o)));
}

/** Whether a living rival has learned a craft (#242): an heirloom shows in what a people does, and the clever computer reads it. */
function rivalHas(s: GameState, p: Player, tech: TechId): boolean {
  return s.players.some((o) => !o.defeated && isEnemy(s, p.id, o.id) && o.techs.includes(tech));
}

/** The warships to keep (#242): a rival's Iron-Bound Hulls makes its ships 30% sturdier, so a fleet that means to meet them is `hulls` bigger. */
export function fleetWanted(s: GameState, p: Player, base: number): number {
  return base > 0 && rivalHas(s, p, 'ironHulls') ? base + AI_WEB.hulls : base;
}

// ---- Building --------------------------------------------------------------------------------------

/** A free spot for a building near a point, keeping a lane open around it. */
export function findSpot(s: GameState, type: BuildingType, x: number, y: number, minR: number, maxR: number, margin = 1, ok?: (tx: number, ty: number) => boolean): { tx: number; ty: number } | null {
  const n = BUILDINGS[type].size;
  const cx = Math.floor(x - n / 2);
  const cy = Math.floor(y - n / 2);
  for (let r = minR; r <= maxR; r++) {
    // Start each ring at a different side, so buildings don't all line up.
    const start = Math.floor(roll(s) * 8 * Math.max(1, r));
    // The ring's tiles in reading order (its top row, then its two sides row by row, then its bottom row),
    // worked out one at a time rather than listed: this search runs whenever the computer builds.
    const len = r === 0 ? 1 : 8 * r;
    for (let k = 0; k < len; k++) {
      let j = (k + start) % len;
      let dx: number;
      let dy: number;
      if (r === 0) dx = dy = 0;
      else if (j < 2 * r + 1) {
        dx = j - r;
        dy = -r;
      } else if ((j -= 2 * r + 1) < 2 * (2 * r - 1)) {
        dx = j & 1 ? r : -r;
        dy = -r + 1 + (j >> 1);
      } else {
        dx = j - 2 * (2 * r - 1) - r;
        dy = r;
      }
      const tx = cx + dx;
      const ty = cy + dy;
      if (placeProblem(s, type, tx, ty)) continue;
      if (margin && !laneClear(s, tx, ty, n, type === 'farm')) continue;
      if (ok && !ok(tx, ty)) continue;
      return { tx, ty };
    }
  }
  return null;
}

/**
 * A spot inside the field of one of our finished coils, so a building raised in the Age of Lightning works lit
 * and no coil has to chase it (#231 s4). The nearest coil to home that has room wins; null when none has.
 */
function fieldSpot(s: GameState, v: View, type: BuildingType): { tx: number; ty: number } | null {
  const n = BUILDINGS[type].size;
  const r2 = LIGHTNING.reach * LIGHTNING.reach;
  for (const t of v.buildings) {
    if (t.type !== 'tower' || !t.built || t.hp <= 0) continue;
    const inside = (tx: number, ty: number): boolean => {
      const dx = tx + n / 2 - t.x, dy = ty + n / 2 - t.y;
      return dx * dx + dy * dy <= r2;
    };
    const spot = findSpot(s, type, t.x, t.y, 2, LIGHTNING.reach, 1, inside);
    if (spot) return spot;
  }
  return null;
}

/** How much open water joins a tile (counted up to `cap`). */
function waterReach(s: GameState, start: number, cap: number): number {
  const seen = new Set<number>([start]);
  const queue = [start];
  for (let q = 0; q < queue.length && seen.size < cap; q++) {
    const i = queue[q];
    const x = i % s.w;
    const y = (i - x) / s.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const ni = ny * s.w + nx;
      if (seen.has(ni) || !walkable(s, nx, ny, NAVAL)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen.size;
}

/** A spot for a dock on a shore near a point, on water big enough to sail, as close to fish as may be. */
export function findDockSpot(s: GameState, x: number, y: number, maxR: number): { tx: number; ty: number } | null {
  let best: { tx: number; ty: number } | null = null;
  let bestScore = Infinity;
  const fish: number[] = [];
  for (let ty = Math.max(0, Math.floor(y) - maxR - 6); ty < Math.min(s.h, y + maxR + 6); ty++) {
    for (let tx = Math.max(0, Math.floor(x) - maxR - 6); tx < Math.min(s.w, x + maxR + 6); tx++) if (s.res[ty * s.w + tx] === R_FISH) fish.push(ty * s.w + tx);
  }
  for (let ty = Math.floor(y) - maxR; ty <= y + maxR; ty++) {
    for (let tx = Math.floor(x) - maxR; tx <= x + maxR; tx++) {
      const cx = tx + 1.5;
      const cy = ty + 1.5;
      const home = Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y));
      // Too little water beside it is a problem `placeProblem` would find too, last and dearest; most of the land fails here.
      if (home > maxR || shoreWater(s, tx, ty, 3) < 3 || placeProblem(s, 'dock', tx, ty)) continue;
      let near = 99;
      for (const f of fish) {
        const fx = (f % s.w) + 0.5 - cx;
        const fy = Math.floor(f / s.w) + 0.5 - cy;
        near = Math.min(near, Math.sqrt(fx * fx + fy * fy));
      }
      const score = home + near * 0.8;
      if (score >= bestScore) continue;
      // The water beside it must be more than a pond.
      let water = -1;
      for (let k = -1; k <= 3 && water < 0; k++) {
        for (const [wx, wy] of [[tx + k, ty - 1], [tx + k, ty + 3], [tx - 1, ty + k], [tx + 3, ty + k]]) {
          if (walkable(s, wx, wy, NAVAL)) {
            water = wy * s.w + wx;
            break;
          }
        }
      }
      if (water < 0 || waterReach(s, water, 80) < 80) continue;
      bestScore = score;
      best = { tx, ty };
    }
  }
  return best;
}

/** The ring of tiles around a footprint has no buildings or resources on it (so nothing gets walled in). */
function laneClear(s: GameState, tx: number, ty: number, n: number, farm: boolean): boolean {
  for (let y = ty - 1; y <= ty + n; y++) {
    for (let x = tx - 1; x <= tx + n; x++) {
      if (x >= tx && x < tx + n && y >= ty && y < ty + n) continue;
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
      const i = y * s.w + x;
      const b = s.bldAt[i];
      if (b && !(farm && (s.byId.get(b) as Building | undefined)?.type === 'farm')) return false;
      if (s.res[i] !== R_NONE && !farm) return false;
      if (!walkable(s, x, y) && !b) return false;
    }
  }
  return true;
}

/** Order a building with a few citizens pulled off other work (wood first, farmers last). */
function construct(s: GameState, v: View, mem: AiMemory, type: BuildingType, spot: { tx: number; ty: number }, builders: number, issue: (c: Command) => void): boolean {
  const cost = raiseCost(s, v.p.id, type, spot.tx, spot.ty);
  if (!afford(v, cost)) return false;
  const cx = spot.tx + BUILDINGS[type].size / 2;
  const cy = spot.ty + BUILDINGS[type].size / 2;
  const rank = (u: Unit) => {
    const o = u.order;
    const job = o.k === 'idle' ? 0 : o.k === 'gather' && o.res === 'wood' ? 1 : o.k === 'gather' ? 2 : o.k === 'build' ? 4 : 3;
    const dx = u.x - cx;
    const dy = u.y - cy;
    // A legion's soldiers raise the town before its few citizens leave the fields.
    return job * 1000 + Math.sqrt(dx * dx + dy * dy) - (legionary(s, u) ? 500 : 0);
  };
  const crew = [...v.citizens, ...legionHands(v)]
    .filter((u) => !(u.order.k === 'farm' && u.order.phase === 'work') && u.order.k !== 'build' && !u.inside)
    .sort((a, b) => rank(a) - rank(b) || a.id - b.id)
    .slice(0, builders);
  if (!crew.length) return false;
  issue({ t: 'build', p: v.p.id, ids: crew.map((u) => u.id), type, tx: spot.tx, ty: spot.ty });
  spend(v, cost);
  mem.ordered[type] = s.tick;
  return true;
}

/**
 * A spot for a Market on the fairground (#379 s1): within `FAIR.reach` of our lowest-id finished Temple
 * that keeps a relic, so feast days pay it in the Age of Fairs (`fair.ts`). Null when no Temple keeps one.
 */
export function fairSpot(s: GameState, v: View): { tx: number; ty: number } | null {
  const id = v.p.id;
  const shrine = shrineOf(s, v);
  if (!shrine) return null;
  const half = BUILDINGS.market.size / 2;
  return findSpot(s, 'market', shrine.x, shrine.y, 2, AI_FAIR.ring, 1, (tx, ty) => fairground(s, id, { x: tx + half, y: ty + half }));
}

/**
 * Whether to hold this unit back for the feast (#356): within `AI_FAIR.save` seconds of a feast opening, when the levy
 * would cut its price at this building and the army already numbers `AI_FAIR.army`.
 */
export function feastSoon(s: GameState, p: Player, unit: UnitType, b: { x: number; y: number }, army: number, hoard = 0, price = 1): boolean {
  if (unit === 'hero' || feastOpen(s) || !ageDef(p).fairs || !fairground(s, p.id, b)) return false;
  // A purse already deep enough to buy `AI_FAIR.hoard` of them keeps plenty for the levy: this one is bought now.
  if (hoard >= AI_FAIR.hoard * price) return false;
  return nextFeastIn(s) <= secs(AI_FAIR.save) && army >= AI_FAIR.army;
}

/** Our lowest-id finished Temple that keeps a relic: the fairground's heart and the vigil's post. */
function shrineOf(s: GameState, v: View): Building | undefined {
  return v.buildings.find((b) => b.type === 'temple' && b.built && b.hp > 0 && s.relics.some((r) => r.temple === b.id));
}

/** The port spot of the trading post most of our cogs sail to (ties: the lowest post id), or null with none at sea. */
function convoyPort(s: GameState, v: View): { x: number; y: number } | null {
  let best: TradePost | null = null;
  let most = 0;
  for (const post of s.posts) {
    let n = 0;
    for (const c of v.cogs) if (c.order.k === 'trade' && c.order.post === post.id) n++;
    if (n > most) {
      most = n;
      best = post;
    }
  }
  return best ? portSpot(s, best, v.p.id) : null;
}

/** Where a clever computer's priests keep vigil (#379 s2): its shrine, in an age that pays for it (`vigil.ts`). */
function vigilPost(s: GameState, v: View): Building | undefined {
  return AI_LEVELS[v.p.ai!].clever && ageDef(v.p).vigils ? shrineOf(s, v) : undefined;
}

function count(v: View, type: BuildingType, builtOnly = false): number {
  return v.buildings.filter((b) => b.type === type && (!builtOnly || b.built)).length;
}

function planBuildings(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p, home } = v;
  const L = AI_LEVELS[p.ai!];
  const pending = v.buildings.filter((b) => !b.built);
  const recently = (type: BuildingType, sec = 20) => s.tick - (mem.ordered[type] ?? -99999) < secs(sec);
  const enemy = enemyHome(s, p);
  const towardEnemy = (d: number) => {
    const dx = enemy.x - home.x;
    const dy = enemy.y - home.y;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: home.x + (dx / l) * d, y: home.y + (dy / l) * d };
  };

  // Lost the Town Center: rebuilding it comes first.
  if (!v.tc && !v.buildings.some((b) => b.type === 'towncenter') && !v.wagons.some((w) => w.packed === 'towncenter') && v.citizens.length && !recently('towncenter', 30)) {
    // The clock is short (`HEART`): spend what the town has, not what the next epoch leaves over.
    v.budget = { ...p.res };
    const spot = findSpot(s, 'towncenter', home.x, home.y, 0, 14);
    if (spot) construct(s, v, mem, 'towncenter', spot, 4, issue);
    return;
  }

  // A spare heart (#452): with one Town Center standing, raise another far from the rival, so losing the first isn't losing the match.
  if (L.spareHeart !== false && v.tc && p.epoch >= AI_HEART.epoch[p.ai!] && !isMobile(p) && !recently('towncenter', AI_HEART.retry) && !v.wagons.some((w) => w.packed === 'towncenter') && v.buildings.filter((b) => b.type === 'towncenter').length === 1) {
    const cost = raiseCost(s, p.id, 'towncenter', 0, 0);
    if (RES.every((r) => !cost[r] || v.budget[r] >= cost[r]! + (r === 'wood' || r === 'stone' ? AI_HEART.reserve : 0))) {
      const dx = home.x - enemy.x;
      const dy = home.y - enemy.y;
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      const m = 8;
      const x = Math.min(s.w - m, Math.max(m, home.x + (dx / l) * AI_HEART.away));
      const y = Math.min(s.h - m, Math.max(m, home.y + (dy / l) * AI_HEART.away));
      const far = (tx: number, ty: number) => (tx - enemy.x) * (tx - enemy.x) + (ty - enemy.y) * (ty - enemy.y) >= (home.x - enemy.x) * (home.x - enemy.x) + (home.y - enemy.y) * (home.y - enemy.y);
      const spot = findSpot(s, 'towncenter', x, y, 0, AI_HEART.reach, 1, far);
      if (spot) {
        construct(s, v, mem, 'towncenter', spot, AI_HEART.builders, issue);
        return;
      }
      mem.ordered.towncenter = s.tick;
    }
  }

  // A reclaiming people raises what fell on the same ground again, at a fraction of the price.
  for (const f of s.fallen ?? []) {
    if (f.owner !== p.id || f.until <= s.tick || pending.length > 1 || recently(f.type, 8)) continue;
    if (construct(s, v, mem, f.type, { tx: f.tx, ty: f.ty }, 3, issue)) return;
  }

  // Houses ahead of need (two at once later on).
  const housesBuilding = pending.filter((b) => b.type === 'house').length;
  const room = p.cap - p.pop;
  if (p.cap < POP_MAX && room <= 3 + p.epoch * 2 && housesBuilding < (p.pop > 40 ? 2 : 1) && !recently('house', 4)) {
    // A household people (#501) lays its houses in streets: beside its others, a lane apart, for the tax is paid by the street.
    const street = isHousehold(p) && v.buildings.some((b) => b.type === 'house')
      ? (tx: number, ty: number) => v.buildings.some((b) => b.type === 'house' && Math.abs(b.tx - tx) <= HOUSEHOLD.aiStreet && Math.abs(b.ty - ty) <= HOUSEHOLD.aiStreet)
      : undefined;
    const spot = (street && findSpot(s, 'house', home.x, home.y, 3, 22, 1, street)) || findSpot(s, 'house', home.x, home.y, 5, 22);
    if (spot) construct(s, v, mem, 'house', spot, 1, issue);
  }
  if (pending.length > 2) return;

  // Drop sites by the woods and mines being worked far from any.
  for (const res of ['wood', 'gold', 'stone'] as Res[]) {
    const workers = v.citizens.filter((u) => u.order.k === 'gather' && u.order.res === res);
    if (workers.length < 3 || count(v, 'storehouse') >= 5 || recently('storehouse', 30)) continue;
    const far = workers.filter((u) => {
      const o = u.order as Extract<Unit['order'], { k: 'gather' }>;
      const tx = (o.tile % s.w) + 0.5;
      const ty = Math.floor(o.tile / s.w) + 0.5;
      return !v.buildings.some((b) => b.built && BUILDINGS[b.type].drop.includes(res) && distToRect(tx, ty, b) < 7);
    });
    if (far.length >= 3) {
      const o = far[0].order as Extract<Unit['order'], { k: 'gather' }>;
      const spot = findSpot(s, 'storehouse', (o.tile % s.w) + 0.5, Math.floor(o.tile / s.w) + 0.5, 2, 6);
      if (spot && construct(s, v, mem, 'storehouse', spot, 2, issue)) return;
    }
  }

  // The road into the Horde opens with a Stable (#322): save the wood for it before the small things take it.
  if (ageOf(p) === 'steppe' && walksWeb(v) && v.citizens.length >= 14 && count(v, 'stable') === 0 && !recently('stable', 25) && wants(s, p, mem, 'horde')) {
    const cost = buildingCostFor(s, p.id, 'stable');
    const spot = afford(v, cost) ? findSpot(s, 'stable', home.x, home.y, 4, 18) : null;
    if (!spot || !construct(s, v, mem, 'stable', spot, 3, issue)) spend(v, cost);
  }
  // Fields once the berries near home run short of feeding everyone who should be on food.
  const berries = findResource(s, R_BERRY, home.x, home.y, 14);
  const farms = count(v, 'farm');
  const freeFields = v.buildings.filter((b) => b.type === 'farm' && !v.citizens.some((u) => u.order.k === 'farm' && u.order.target === b.id)).length;
  // Autumn onward the clever computer plans for winter: berries fail in the cold, so fields go up first, unless in the
  // Stone Age the larder holds the winter's food already (#486): planning anyway, it raised a field a citizen with the
  // wood the Bronze Age wanted. Later a town's stock is no larder: its people eat from the fields.
  const coldComing_ = coldComing(s, v) && (p.epoch > 0 || p.res.food < AI_WINTER.larder);
  // On the Shore (#473) each fishing boat feeds the town in a farmer's place, and its wood is wanted for the next age.
  // The turning year (#479): ice ahead (autumn, for the clever) or on the mere, a boat feeds a third as many.
  const boatsFeed = s.homeland === 'shore' ? Math.round(v.fishers.length * (coldComing_ || catchOf(s) < 1 ? YEAR.ice : 1)) : 0;
  const foodWanted = Math.round(wanted(v).food) - (berries >= 0 && !coldComing_ ? 6 : 0) + (coldComing_ ? AI_WINTER.fields : 0) - boatsFeed;
  // The Hunters on the Herd Plains (#529) sow while their spared herd is away on its autumn trek: in summer, its ground
  // still shut, they put by the wood for `AI_WAYS.trekFields` fields, so the fields go up as soon as the herd is gone.
  if (L.clever && p.way === 'hunt' && p.epoch === 0 && s.homeland === 'herds' && seasonAt(s) === 1 && farms < AI_WAYS.trekFields && wayBarred(s, p, 'farm')) {
    spend(v, { wood: (buildingCostFor(s, p.id, 'farm').wood ?? 0) * (AI_WAYS.trekFields - farms) });
  }
  if (farms < foodWanted && freeFields < 2 && !recently('farm', 2) && !buildBarred(p, 'farm') && !wayBarred(s, p, 'farm')) {
    const spot = findSpot(s, 'farm', home.x, home.y, 3, 16);
    if (spot && construct(s, v, mem, 'farm', spot, 1, issue)) return;
  }

  const n = v.hands;
  const clever = L.clever;

  // A Storehouse to survey from, for a people the Iron Age would suit (#50); after the Barracks, so the
  // town can defend itself before it spends on prospecting.
  if (p.epoch === 0 && walksWeb(v) && n >= AI_WEB.survey && count(v, 'barracks', true) > 0 && !p.techs.includes('survey') && count(v, 'storehouse') === 0 && !recently('storehouse', 30) && wants(s, p, mem, 'iron')) {
    const tree = findResource(s, R_TREE, home.x, home.y, 16);
    const near = tree >= 0 ? { x: (tree % s.w) + 0.5, y: Math.floor(tree / s.w) + 0.5 } : home;
    const spot = findSpot(s, 'storehouse', near.x, near.y, 2, 6);
    if (spot && construct(s, v, mem, 'storehouse', spot, 2, issue)) return;
  }
  // A Hunting Camp by a far kill, so the butchers carry meat a short way and the land round it is held against wolves.
  if (p.epoch === 0 || s.carcasses?.length) {
    // The Hunters' Way (#463 s1) pitches its camps for nothing at the kill, so it pitches them early and often, by any
    // kill on its far hunt; the Hearth keeps none.
    const hunter = p.way === 'hunt' && p.epoch === 0;
    const W = AI_WAYS;
    const meat = hunter ? W.campMeat : AI_WILD.campMeat;
    const near = hunter ? W.huntReach : AI_WILD.campNear;
    const kill = (s.carcasses ?? []).find((c) => {
      const tx = (c.tile % s.w) + 0.5;
      const ty = Math.floor(c.tile / s.w) + 0.5;
      if (s.res[c.tile] !== R_MEAT || s.amount[c.tile] < meat) return false;
      if ((tx - home.x) * (tx - home.x) + (ty - home.y) * (ty - home.y) > near * near) return false;
      return !v.buildings.some((b) => BUILDINGS[b.type].drop.includes('food') && distToRect(tx, ty, b) < AI_WILD.campFar && (b.built || b.type === 'huntcamp'));
    });
    if (kill && !buildBarred(p, 'huntcamp') && (hunter ? n >= W.campAt && count(v, 'huntcamp') < W.camps && !recently('huntcamp', W.campAgain) : n >= 12 && p.res.wood >= 120 && count(v, 'huntcamp') < 3 && !recently('huntcamp', 25))) {
      const spot = findSpot(s, 'huntcamp', (kill.tile % s.w) + 0.5, Math.floor(kill.tile / s.w) + 0.5, 2, 5);
      if (spot && construct(s, v, mem, 'huntcamp', spot, hunter ? 1 : 2, issue)) return;
    }
    // A clever computer in the Bronze Age or later puts a Watch Tower by a far kill whose camp stands, so the butchers have cover.
    const camped = clever && p.epoch >= 1 ? (s.carcasses ?? []).find((c) => {
      const tx = (c.tile % s.w) + 0.5;
      const ty = Math.floor(c.tile / s.w) + 0.5;
      if (s.res[c.tile] !== R_MEAT || s.amount[c.tile] < AI_WILD.campMeat) return false;
      const dh = (tx - home.x) * (tx - home.x) + (ty - home.y) * (ty - home.y);
      if (dh <= AI_WILD.mammothNear * AI_WILD.mammothNear || dh > AI_WILD.campNear * AI_WILD.campNear) return false;
      return v.buildings.some((b) => b.type === 'huntcamp' && distToRect(tx, ty, b) < AI_WILD.towerNear) && !v.buildings.some((b) => b.type === 'tower' && distToRect(tx, ty, b) < AI_WILD.towerNear + 2);
    }) : undefined;
    if (camped && n >= 12 && !recently('tower', 60) && v.budget.wood >= 50 && v.budget.stone >= 125 && count(v, 'tower') < 6) {
      const spot = findSpot(s, 'tower', (camped.tile % s.w) + 0.5, Math.floor(camped.tile / s.w) + 0.5, 2, 6);
      if (spot && construct(s, v, mem, 'tower', spot, 2, issue)) return;
    }
  }

  // Against a people of iron (cheap, hard-hitting foot), a second range early (#50).
  const ironRival = clever && rivalIn(s, p, ['iron']);

  // Trading posts make a Market worth saving for: set its wood aside so soldiers don't eat it.
  // Bound for the merchants' age, it raises one early, but never with soldiers owed (#79): set aside
  // there, the Market's wood starved the Bronze Age army and the town stalled behind army-first.
  if (s.posts.length && (p.epoch >= 2 || (merchantBound(s, v, mem) && !v.armyFirst)) && n >= 18 && count(v, 'market') === 0 && !recently('market', 25)) {
    const cost = buildingCostFor(s, p.id, 'market');
    const spot = afford(v, cost) ? (clever && fairSpot(s, v)) || findSpot(s, 'market', home.x, home.y, 6, 18) : null;
    if (spot && construct(s, v, mem, 'market', spot, 3, issue)) return;
    spend(v, cost);
  }

  // In the Age of Fairs, a Market on the fairground if none stands there yet (#379 s1): the feast pays only there.
  if (clever && ageDef(p).fairs && count(v, 'market') < AI_FAIR.markets && !recently('market', 25) && !v.buildings.some((b) => b.type === 'market' && fairground(s, p.id, b))) {
    const spot = fairSpot(s, v);
    if (spot && construct(s, v, mem, 'market', spot, 3, issue)) return;
  }

  // A dock, where there is fish and water to sail near home: early on the Shore (#473), where fish is the food.
  if (n >= (s.homeland === 'shore' ? AI_SHORE.dockAt : 9) && count(v, 'dock') === 0 && !recently('dock', 40) && s.tick - (mem.dockless ?? -99999) > secs(120)) {
    const spot = findDockSpot(s, home.x, home.y, 24);
    if (!spot) mem.dockless = s.tick;
    else if (construct(s, v, mem, 'dock', spot, 2, issue)) return;
  }

  // In the Age of Lightning a coil goes up by a workshop that stands dark (#231), so its training runs fast again.
  if (ageOf(p) === 'lightning' && count(v, 'tower') < AI_LIGHTNING.most && !recently('tower', AI_LIGHTNING.gap)) {
    const dark = v.buildings.find((b) => b.built && b.type !== 'tower' && BUILDINGS[b.type].trains.length > 0 && !inField(s, b));
    // With Galvanic Revival (#240) a ruin it dug that lies outside every field is worth a coil first: it then pays gold.
    const wired = modsOf(s, p.id).galvanic ? (s.ruins ?? []).find((r) => r.by === p.id && !inField(s, { x: r.x, y: r.y, owner: p.id })) : undefined;
    const at = wired ?? dark;
    const spot = at ? findSpot(s, 'tower', at.x, at.y, 2, 6) : null;
    if (spot && construct(s, v, mem, 'tower', spot, 2, issue)) return;
  }

  const want: [BuildingType, boolean][] = [
    // A Warband (#463 s1) raises its Barracks early: its soldiers are how it eats.
    ['barracks', n >= (p.way === 'warband' ? AI_WAYS.barracksAt : 8) && count(v, 'barracks') === 0],
    ['range', n >= 12 && count(v, 'range') === 0],
    ['range', ironRival && p.epoch >= 1 && n >= 16 && count(v, 'range') < 2],
    ['stable', p.epoch >= 1 && n >= 14 && count(v, 'stable') === 0],
    ['forge', p.epoch >= 1 && n >= 16 && count(v, 'forge') === 0],
    // Relics lying loose are worth a Temple early.
    ['temple', clever && p.epoch >= 1 && n >= 16 && count(v, 'temple') === 0 && looseRelics(s) > 0],
    // The Sickness (#541): a Temple is its clinic, built as soon as the taint builds or the fever breaks.
    ['temple', clever && p.epoch >= 1 && count(v, 'temple') === 0 && ailing(p)],
    ['tower', p.epoch >= 1 && count(v, 'tower') < L.towers && n >= 16],
    ['market', clever && p.epoch >= 1 && n >= 20 && count(v, 'market') === 0],
    // A nomad people (#501) buys its stone: its Market comes early, at every level of play.
    ['market', isNomad(p) && p.epoch >= 1 && n >= NOMAD.aiMarket && count(v, 'market') === 0],
    ['workshop', clever && p.epoch >= 2 && n >= 20 && count(v, 'workshop') === 0],
    ['temple', clever && p.epoch >= 2 && n >= 22 && count(v, 'temple') === 0],
    ['barracks', p.epoch >= 2 && n >= 22 && count(v, 'barracks') < 2],
    ['range', p.epoch >= 2 && n >= 24 && count(v, 'range') < 2],
    ['stable', p.epoch >= 3 && n >= 26 && count(v, 'stable') < 2],
  ];
  for (const [type, ok] of want) {
    if (!ok || recently(type, 25) || BUILDINGS[type].epoch > p.epoch || buildBarred(p, type)) continue;
    // Not a building whose every line the age bars (a Stable in the Iron Age).
    const lines = BUILDINGS[type].trains;
    if (lines.length && lines.every((u) => barred(p, u))) continue;
    const at = type === 'tower' ? towardEnemy(9) : type === 'market' || type === 'temple' ? home : towardEnemy(6);
    const spot = (type !== 'tower' && ageOf(p) === 'lightning' && fieldSpot(s, v, type)) || (type === 'market' && fairSpot(s, v)) || findSpot(s, type, at.x, at.y, type === 'market' || type === 'temple' ? 6 : 0, 18);
    if (spot && construct(s, v, mem, type, spot, type === 'tower' ? 2 : 3, issue)) return;
  }

  // A forward Tower at the edge of our land: a foothold, so the next wave has a border to fight from (#132 s5).
  if (clever && L.fort && p.epoch >= 1 && n >= AI_RAID.pop && !recently('tower', 60) && count(v, 'tower') >= L.towers && count(v, 'tower') < L.towers + 1) {
    const at = towardEnemy(AI_RAID.fort);
    const spot = findSpot(s, 'tower', at.x, at.y, 0, 5);
    if (spot && construct(s, v, mem, 'tower', spot, 2, issue)) return;
  }

  // A wonder, when rich in the last epoch.
  if (clever && p.epoch >= 3 && count(v, 'wonder') === 0 && !recently('wonder', 60)) {
    const cost = buildingCostFor(s, p.id, 'wonder');
    if (RES.every((r) => !cost[r] || v.budget[r] >= cost[r]! + 200)) {
      const spot = findSpot(s, 'wonder', home.x, home.y, 6, 20);
      if (spot) construct(s, v, mem, 'wonder', spot, 8, issue);
    }
  }
}

// ---- Citizens --------------------------------------------------------------------------------------

function jobOf(u: Unit): Res | 'build' | null {
  const o = u.order;
  if (o.k === 'gather') return o.res;
  if (o.k === 'farm' || o.k === 'hunt' || o.k === 'milk' || o.k === 'snare') return 'food';
  if (o.k === 'build') return 'build';
  return null;
}

/**
 * The turning year (#479): a clever computer reads its homeland's seasons. On the Herd Plains it follows its
 * herds out in autumn and winter (its camps go up by the far kills); in the Deep Wood's winter it sends more
 * hunters to the yarded deer, since the berries fail.
 */
function readYear(s: GameState, v: View): void {
  if (!AI_LEVELS[v.p.ai!].clever) return;
  if (herdsOut(s)) v.hunt = { n: v.hunt.n, r: Math.max(v.hunt.r, YEAR.follow) };
  // A nomad camp (#501) drifts with the grass, so the yard may lie a long way off: its hunters range as far as the deer walk.
  if (yarding(s)) v.hunt = { n: v.hunt.n + YEAR.yardHunters, r: isNomad(v.p) ? Math.max(v.hunt.r, YEAR.walk) : v.hunt.r };
}

/**
 * When its homeland's year brings game in reach (the Herd Plains' herds, home or followed out; the Deep Wood's
 * yard in winter), a clever computer takes a forager, else a farmer, off to hunt, one a think, until it has
 * `v.hunt.n` on the hunt. Elsewhere its hunters come only from people newly sent to food (#479).
 */
function huntTheYear(s: GameState, v: View, issue: (c: Command) => void): void {
  if (!AI_LEVELS[v.p.ai!].clever || !(s.homeland === 'herds' || yarding(s)) || isMobile(v.p)) return;
  let hunting = 0;
  for (const u of v.citizens) if (u.order.k === 'hunt' || (u.order.k === 'gather' && s.res[u.order.tile] === R_MEAT)) hunting++;
  if (hunting >= v.hunt.n) return;
  const deer = nearestDeer(s, v.home.x, v.home.y, v.hunt.r, spared(s, v.p));
  if (!deer) return;
  const pick = (ok: (u: Unit) => boolean) => {
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const u of v.citizens) {
      if (u.inside || v.diggers.has(u.id) || !ok(u)) continue;
      const d = (u.x - deer.x) * (u.x - deer.x) + (u.y - deer.y) * (u.y - deer.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  };
  const u = pick((c) => c.order.k === 'gather' && s.res[c.order.tile] === R_BERRY) ?? pick((c) => c.order.k === 'farm');
  if (u) issue({ t: 'hunt', p: v.p.id, ids: [u.id], target: deer.id });
}

/**
 * A clever computer leaves `YEAR.spare` of each of its own home herds alive on the Herd Plains, so they come
 * home in spring with calves (#479), and a pair (`DEER.pair`) of every wild herd in the Stone Age, when game is
 * what it lives on; a wild herd breeds each spring (#491). A rival's herd it hunts down gladly. Undefined where nothing is spared.
 * A people of the Hunters' Way on the Herd Plains spares no wild deer within `KILL_CAMP.home` of its Town Centers (#529):
 * they bar the fields it sows while its own herd is away on the trek.
 */
export function spared(s: GameState, p: Player): ((a: Animal) => boolean) | undefined {
  if (!AI_LEVELS[p.ai!].clever) return undefined;
  const tcs = p.way === 'hunt' && p.epoch === 0 && s.homeland === 'herds' ? townCenters(s, p.id) : [];
  const r2 = KILL_CAMP.home * KILL_CAMP.home;
  const fields = (a: Animal) => tcs.some((b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) <= r2);
  // A herd is spared at its own count: a town's at `YEAR.spare`, a wild one at `DEER.pair`.
  const keep = (a: Animal) => (a.town === p.id && s.homeland === 'herds' ? YEAR.spare : a.town === undefined && p.epoch === 0 && !fields(a) ? DEER.pair : -1);
  const left = new Map<number, number>();
  for (const a of s.animals) if (a.kind === 'deer' && a.hp > 0 && keep(a) >= 0) left.set(a.herd ?? a.id, (left.get(a.herd ?? a.id) ?? 0) + 1);
  if (!left.size) return undefined;
  return (a) => (left.get(a.herd ?? a.id) ?? Infinity) <= keep(a);
}

/** Autumn onward, a clever computer plans for the winter ahead (`AI_WINTER`). */
function coldComing(s: GameState, v: View): boolean {
  return AI_LEVELS[v.p.ai!].clever && seasonAt(s) >= AI_WINTER.from;
}

/** A nomad people's lean on the epoch's shares (#501): it quarries no stone, so the stone hands go to the gold that buys it. */
const nomadShare = (r: Res, share: Record<Res, number>): number => (r === 'stone' ? 0 : r === 'gold' ? 1 + share.stone / Math.max(0.01, share.gold) : 1);

/** How many citizens each resource should have now: the epoch's shares, leaning away from what piles up. */
function wanted(v: View, cold = false): Record<Res, number> {
  const share = SHARE[v.p.epoch];
  const weight: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  let total = 0;
  for (const r of RES) {
    const stock = v.p.res[r];
    const lean = stock > 1200 ? 0.15 : stock > 700 ? 0.4 : stock > 400 ? 0.7 : stock < 80 ? 1.4 : 1;
    weight[r] = share[r] * lean * (cold && r === 'food' ? 1 + AI_WINTER.food : 1) * (legionAtWork(v) && (r === 'wood' || r === 'stone') ? LEGION.aiCitizenWood : 1) * (r === 'gold' && isHousehold(v.p) ? 0 : 1) * (isNomad(v.p) ? nomadShare(r, share) : 1);
    total += weight[r];
  }
  const n = v.citizens.filter((u) => u.order.k !== 'build' && !u.inside).length;
  const out: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const r of RES) out[r] = (weight[r] / total) * n;
  return out;
}

function nearestDeer(s: GameState, x: number, y: number, r: number, skip?: (a: Animal) => boolean): Animal | null {
  let best: Animal | null = null;
  let bestD = r * r;
  for (const a of s.animals) {
    if (a.kind !== 'deer' || skip?.(a)) continue;
    const dx = a.x - x;
    const dy = a.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** Send a citizen to gather a resource (game, berries, then free fields, for food). False if there is none to be had. */
function sendTo(s: GameState, v: View, u: Unit, res: Res, issue: (c: Command) => void): boolean {
  if (res === 'food') {
    const meat = findResource(s, R_MEAT, v.home.x, v.home.y, v.p.way === 'hunt' && v.p.epoch === 0 ? AI_WAYS.huntReach : 14);
    if (meat >= 0) {
      issue({ t: 'gather', p: v.p.id, ids: [u.id], tile: meat });
      return true;
    }
    // A few hunters while there is game close to home.
    // A flock short of milkers (#320) is the surest food on the steppe.
    const milkers = v.citizens.filter((c) => c.order.k === 'milk').length;
    const ewe = milkers < milkersWanted(s, v) ? milkable(s, v.p.id, v.home.x, v.home.y, FLOCK.follow) : null;
    if (ewe) {
      issue({ t: 'milk', p: v.p.id, ids: [u.id], target: ewe.id });
      return true;
    }
    const hunters = v.citizens.filter((c) => c.order.k === 'hunt').length;
    const deer = hunters < v.hunt.n ? nearestDeer(s, v.home.x, v.home.y, v.hunt.r, spared(s, v.p)) : null;
    if (deer) {
      issue({ t: 'hunt', p: v.p.id, ids: [u.id], target: deer.id });
      return true;
    }
    const berry = findResource(s, R_BERRY, v.home.x, v.home.y, 16);
    if (berry >= 0) {
      issue({ t: 'gather', p: v.p.id, ids: [u.id], tile: berry });
      return true;
    }
    // The Nile flood (#501 s1): no one is sent to a field under the river.
    const farm = flooded(s, v.p.id) ? null : freeFarm(s, v.p.id, v.home.x, v.home.y, 24);
    if (farm) {
      issue({ t: 'work', p: v.p.id, ids: [u.id], target: farm.id });
      return true;
    }
    return false;
  }
  if (res === 'gold' && isHousehold(v.p)) return false;
  // A nomad people (#501) quarries no stone: it buys it or takes it.
  if (res === 'stone' && isNomad(v.p)) return false;
  const from = nearestDropTo(v, u);
  let tile = findResource(s, TILE_OF[res], from.x, from.y, 26);
  if (tile < 0) tile = findResource(s, TILE_OF[res], u.x, u.y, 60);
  if (tile < 0) return false;
  issue({ t: 'gather', p: v.p.id, ids: [u.id], tile });
  return true;
}

function assignCitizens(s: GameState, v: View, issue: (c: Command) => void): void {
  const want = wanted(v, coldComing(s, v));
  const have: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const u of v.citizens) {
    const j = jobOf(u);
    if (j && j !== 'build' && !v.diggers.has(u.id)) have[j]++;
  }
  // Foundations nobody is working on get the nearest wood cutter.
  for (const b of v.buildings) {
    if (b.built || v.citizens.some((u) => u.order.k === 'build' && u.order.target === b.id) || legionHands(v).some((u) => u.order.k === 'build' && u.order.target === b.id)) continue;
    const helper = [...v.citizens, ...legionHands(v)]
      .filter((u) => !u.inside && !v.claimers.has(u.id) && (u.order.k === 'idle' || (u.order.k === 'gather' && u.order.res === 'wood')))
      .sort((a, c) => distToRect(a.x, a.y, b) - distToRect(c.x, c.y, b) || a.id - c.id)[0];
    if (helper) issue({ t: 'work', p: v.p.id, ids: [helper.id], target: b.id });
  }
  const neediest = (skip: Set<Res>) => {
    let best: Res | null = null;
    let gap = -Infinity;
    for (const r of RES) {
      if (skip.has(r)) continue;
      const g = want[r] - have[r];
      if (g > gap) {
        gap = g;
        best = r;
      }
    }
    return best;
  };
  for (const u of v.citizens.filter((c) => c.order.k === 'idle' && !c.inside && !c.queue.length && !v.claimers.has(c.id))) {
    const skip = new Set<Res>();
    for (let tries = 0; tries < 4; tries++) {
      const r = neediest(skip);
      if (!r) break;
      if (sendTo(s, v, u, r, issue)) {
        have[r]++;
        break;
      }
      skip.add(r);
    }
  }
  // Rebalance: one citizen a decision moves from the most crowded resource to the most needed one.
  let over: Res | null = null;
  let under: Res | null = null;
  let most = 1.5;
  let least = 1.5;
  for (const r of RES) {
    if (have[r] - want[r] > most) {
      most = have[r] - want[r];
      over = r;
    }
    if (want[r] - have[r] > least) {
      least = want[r] - have[r];
      under = r;
    }
  }
  if (over && under) {
    const mover = v.citizens.find((u) => jobOf(u) === over && u.carry <= 2 && u.order.k !== 'farm' && u.order.k !== 'hunt' && u.order.k !== 'milk' && u.order.k !== 'snare' && !u.inside && !v.diggers.has(u.id));
    if (mover) sendTo(s, v, mover, under, issue);
  }
}

// ---- The legion (#501) --------------------------------------------------------------------------

/**
 * A Roman computer's idle foot soldiers go to work between waves: all but the `LEGION.aiGuard` lowest-id ones (the standing guard
 * the other duties draw on) walk to timber, or to stone for `LEGION.aiStone` of them, near home. A wave or a raid takes them off
 * the work with the rest of the army, and the survivors go back after.
 */
function legionWork(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  if (!isLegion(v.p) || v.p.epoch > LEGION.aiUntil || mem.attacking || threatNear(s, v).unit) return;
  const hands = v.army.filter(legionHand).sort((a, b) => a.id - b.id);
  const crew = hands.slice(LEGION.aiGuard).filter((u) => u.order.k === 'idle' && !u.queue.length && !v.claimers.has(u.id) && distTo(u, v.home) <= 40);
  let stone = hands.filter((u) => u.order.k === 'gather' && u.order.res === 'stone').length;
  let all = hands.filter((u) => u.order.k === 'gather').length;
  for (const u of crew) {
    const res: Res = stone < (all + 1) * LEGION.aiStone ? 'stone' : 'wood';
    if (sendTo(s, v, u, res, issue) || sendTo(s, v, u, res === 'stone' ? 'wood' : 'stone', issue)) {
      if (res === 'stone') stone++;
      all++;
    }
  }
}

function distTo(u: { x: number; y: number }, at: { x: number; y: number }): number {
  const dx = u.x - at.x;
  const dy = u.y - at.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---- The polis (#501) ---------------------------------------------------------------------------

/** The polis brings its harvest in before it marches: in `POLIS.harvest` season its citizens stay at the fields, unless the wave is all-in. */
function polisHarvest(s: GameState, v: View): boolean {
  return isPolis(v.p) && seasonAt(s) === POLIS.harvest && !v.plan.allIn;
}

/**
 * A Greek computer trains no foot soldiers, so it arms its citizens: when rivals reach the town (those nearest them), and when a wave
 * is due and the citizens it may spare would fill it (those nearest home). It arms at most `POLIS.aiShare` of its people and keeps
 * `POLIS.aiKeep` at work. When no wave is out and no foe is near, `POLIS.aiRest` seconds after it last armed, the citizens it armed
 * (`levy`) standing idle near home lay their arms down and go back to work.
 */
function polisArms(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  if (!isPolis(p)) return;
  const L = AI_LEVELS[p.ai!];
  const hoplites = v.army.filter((u) => u.type === 'infantry');
  const free = v.citizens.filter((u) => !u.inside);
  const most = Math.floor((v.citizens.length + hoplites.length) * POLIS.aiShare) - hoplites.length;
  const spare = Math.max(0, Math.min(most, v.citizens.length - POLIS.aiKeep, Math.floor(p.res.wood / (POLIS.arm.wood ?? 1))));
  const threat = threatNear(s, v);
  const call = (n: number, x: number, y: number) => {
    const picked = free
      .map((u) => ({ u, d: (u.x - x) * (u.x - x) + (u.y - y) * (u.y - y) }))
      .sort((a, b) => a.d - b.d || a.u.id - b.u.id)
      .slice(0, n)
      .map((e) => e.u.id);
    if (!picked.length) return;
    issue({ t: 'arm', p: p.id, ids: picked });
    mem.polisAt = s.tick;
  };
  if (threat.unit && threat.count >= POLIS.aiThreat) {
    const have = v.army.length;
    if (spare > 0 && have < threat.count + 2) call(Math.min(spare, threat.count + 2 - have), threat.unit.x, threat.unit.y);
    return;
  }
  const waveSize = v.plan.wave || L.wave + mem.wave * L.waveGrowth;
  const due = !v.plan.hold && !polisHarvest(s, v) && (v.plan.wave ? true : s.tick >= secs(L.firstAttack)) && s.tick >= s.peaceUntil;
  if (due && !mem.attacking && v.army.length < waveSize && v.army.length + spare >= waveSize) {
    call(waveSize - v.army.length, v.home.x, v.home.y);
    return;
  }
  if (mem.attacking || s.tick - (mem.polisAt ?? -99999) < secs(POLIS.aiRest)) return;
  const home = hoplites.filter((u) => u.levy && u.order.k === 'idle' && !disarmProblem(s, p, u)).map((u) => u.id);
  if (home.length && (!due || v.army.length + spare < waveSize)) issue({ t: 'disarm', p: p.id, ids: home });
}

// ---- The Nile flood (#501 s1) --------------------------------------------------------------------

/**
 * While its fields lie under the river, a flood people's computer takes `FLOOD.move` farmers a think off the fields: to berries or
 * the hunt if any are near, else to the wood, where its builders are pulled from, so the corvée raises what it builds. When the
 * river falls they go back to the fields as usual.
 */
function floodWork(s: GameState, v: View, issue: (c: Command) => void): void {
  if (!flooded(s, v.p.id)) return;
  let moved = 0;
  for (const u of v.citizens) {
    if (moved >= FLOOD.move) return;
    if (u.order.k !== 'farm' || u.inside) continue;
    if (sendTo(s, v, u, 'food', issue) || sendTo(s, v, u, 'wood', issue)) moved++;
  }
}

// ---- Snares in the wood (#485) ----------------------------------------------------------------------

/**
 * In the Deep Wood a clever computer with `SNARE.aiAt` citizens, from its second year (`SNARE.aiFrom`), lays a trap line: up to `SNARE.ai` snares, one at a
 * time, in thick woods (`SNARE.aiTrees`) at least `SNARE.aiFar` tiles from any tree its people are felling, and keeps `SNARE.aiTenders`
 * citizens walking it, taken off the berries first. Elsewhere the woods are left to the axe.
 */
function trapLine(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  if (!AI_LEVELS[v.p.ai!].clever || s.homeland !== 'wood' || isMobile(v.p) || v.citizens.length < SNARE.aiAt || s.tick < secs(SNARE.aiFrom)) return;
  const snares = v.buildings.filter((b) => b.type === 'snare');
  if (snares.length < SNARE.ai && snares.every((b) => b.built) && s.tick - (mem.ordered.snare ?? -99999) > secs(20)) {
    const felling: number[] = [];
    for (const u of v.citizens) if (u.order.k === 'gather' && u.order.res === 'wood') felling.push(u.order.tile);
    const far = (tx: number, ty: number) => felling.every((t) => Math.max(Math.abs((t % s.w) - tx), Math.abs(Math.floor(t / s.w) - ty)) >= SNARE.aiFar);
    const spot = findSpot(s, 'snare', v.home.x, v.home.y, 4, 16, 0, (tx, ty) => treesNear(s, tx, ty) >= SNARE.aiTrees && far(tx, ty) && !placeProblem(s, 'snare', tx, ty, true, v.p.id));
    if (spot) construct(s, v, mem, 'snare', spot, 1, issue);
  }
  const line = snares.find((b) => b.built);
  if (!line) return;
  let tenders = 0;
  for (const u of v.citizens) if (u.order.k === 'snare') tenders++;
  if (tenders >= SNARE.aiTenders) return;
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const pass of [(u: Unit) => u.order.k === 'gather' && s.res[u.order.tile] === R_BERRY, (u: Unit) => u.order.k === 'gather' && u.order.res === 'food']) {
    for (const u of v.citizens) {
      if (u.inside || u.queue.length || v.diggers.has(u.id) || !pass(u)) continue;
      const d = (u.x - line.x) * (u.x - line.x) + (u.y - line.y) * (u.y - line.y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (best) break;
  }
  if (best) issue({ t: 'work', p: v.p.id, ids: [best.id], target: line.id });
}

// ---- The wild (#171) ---------------------------------------------------------------------------------

function nearestBeast(s: GameState, kind: Animal['kind'], x: number, y: number, r: number): Animal | null {
  let best: Animal | null = null;
  let bestD = r * r;
  for (const a of s.animals) {
    if (a.kind !== kind || a.hp <= 0) continue;
    const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** A hunting party for the mammoth near home, and soldiers to clear the wolves near it. */
function wilds(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const hunting = (u: Unit, kind: Animal['kind']) => u.order.k === 'hunt' && s.animals.some((a) => a.id === (u.order as { target: number }).target && a.kind === kind);
  // Autumn and winter: meat keeps, berries fail, so the clever computer hunts with a smaller town.
  const cold = coldComing(s, v);
  const eager = cold ? AI_WINTER.hunters : 0;
  // The far hunt over (the beast down, the escort idle), the soldiers walk home.
  if (mem.huntEscort) {
    const home: number[] = [];
    const out: number[] = [];
    const towers = v.buildings.filter((b) => b.type === 'tower' && b.built && b.hp > 0);
    const meatNear = (b: Building) => (s.carcasses ?? []).some((c) => s.amount[c.tile] > 0 && distToRect((c.tile % s.w) + 0.5, Math.floor(c.tile / s.w) + 0.5, b) < AI_WILD.towerNear + 4);
    const freed = new Set<number>();
    for (const id of mem.huntEscort) {
      const u = s.byId.get(id);
      if (!u || u.kind !== 'unit' || u.owner !== v.p.id || u.hp <= 0) continue;
      if (u.inside) {
        // Sheltered in the hunt's Tower: they stay, adding arrows, while meat is left to butcher.
        const t = s.byId.get(u.inside);
        if (t && t.kind === 'building' && meatNear(t)) out.push(id);
        else if (t && !freed.has(t.id)) { freed.add(t.id); issue({ t: 'ungarrison', p: v.p.id, building: t.id }); }
        continue;
      }
      if (u.order.k === 'idle') {
        const t = towers.find((b) => b.garrison.length < (BUILDINGS.tower.garrison ?? 0) && distToRect(u.x, u.y, b) < AI_WILD.towerNear + 4 && meatNear(b));
        if (t) { issue({ t: 'garrison', p: v.p.id, ids: [id], target: t.id }); out.push(id); }
        else home.push(id);
      } else if (u.order.k === 'hunt' || u.order.k === 'garrison') out.push(id);
    }
    if (home.length) issue({ t: 'move', p: v.p.id, ids: home, x: v.home.x, y: v.home.y });
    mem.huntEscort = out.length ? out : undefined;
  }
  if (v.citizens.length >= AI_WILD.mammothAt - eager && !v.citizens.some((u) => hunting(u, 'mammoth'))) {
    let m = nearestBeast(s, 'mammoth', v.home.x, v.home.y, AI_WILD.mammothNear);
    // A clever computer also goes for a far mammoth, with soldiers along to take the charge, if no rival is by it.
    let escort: Unit[] = [];
    if (!m && AI_LEVELS[v.p.ai!].clever && v.p.epoch <= 2 && s.tick >= s.peaceUntil) {
      const far = nearestBeast(s, 'mammoth', v.home.x, v.home.y, AI_WILD.far);
      const idle = v.army.filter((u) => !u.inside && (u.order.k === 'idle' || atTheAxe(v, u)) && u.type !== 'siege' && u.type !== 'hero');
      if (far && far.state !== 'fight' && idle.length >= AI_WILD.escort + AI_WILD.guard && !ruinDanger(s, v.p, far, AI_WILD.safe)) {
        m = far;
        escort = idle.sort((a, b) => (a.x - far.x) * (a.x - far.x) + (a.y - far.y) * (a.y - far.y) - ((b.x - far.x) * (b.x - far.x) + (b.y - far.y) * (b.y - far.y)) || a.id - b.id).slice(0, AI_WILD.escort);
      }
    }
    if (m && m.state !== 'fight') {
      const party = v.citizens
        .filter((u) => !u.inside && u.carry <= 2 && !v.diggers.has(u.id) && u.order.k === 'gather' && (u.order.res === 'food' || u.order.res === 'wood'))
        .sort((a, b) => (a.x - m.x) * (a.x - m.x) + (a.y - m.y) * (a.y - m.y) - ((b.x - m.x) * (b.x - m.x) + (b.y - m.y) * (b.y - m.y)) || a.id - b.id)
        .slice(0, AI_WILD.party);
      if (party.length === AI_WILD.party) {
        issue({ t: 'hunt', p: v.p.id, ids: [...escort, ...party].map((u) => u.id), target: m.id });
        if (escort.length) mem.huntEscort = escort.map((u) => u.id);
      }
    }
  }
  // A boar guarding berries near home: three citizens spear it together, once the town has six.
  if (v.citizens.length >= AI_WILD.boarAt - eager && !v.citizens.some((u) => hunting(u, 'boar'))) {
    const b = nearestBeast(s, 'boar', v.home.x, v.home.y, AI_WILD.boarNear);
    if (b && b.state !== 'fight') {
      const party = v.citizens
        .filter((u) => !u.inside && u.carry <= 2 && !v.diggers.has(u.id) && u.order.k === 'gather' && (u.order.res === 'food' || u.order.res === 'wood'))
        .sort((a, c) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) - ((c.x - b.x) * (c.x - b.x) + (c.y - b.y) * (c.y - b.y)) || a.id - c.id)
        .slice(0, AI_WILD.boarParty);
      if (party.length === AI_WILD.boarParty) issue({ t: 'hunt', p: v.p.id, ids: party.map((u) => u.id), target: b.id });
    }
  }
  if (mem.attacking || v.army.some((u) => hunting(u, 'wolf') || hunting(u, 'raider'))) return;
  const wolf = nearestBeast(s, 'wolf', v.home.x, v.home.y, AI_WILD.clear);
  const free = v.army.filter((u) => !u.inside && (u.order.k === 'idle' || atTheAxe(v, u) || (u.order.k === 'move' && !u.order.amove)) && u.type !== 'siege');
  if (wolf) {
    const need = cold && seasonAt(s) === 3 ? AI_WILD.pack - AI_WINTER.pack : AI_WILD.pack;
    if (free.length >= need) issue({ t: 'hunt', p: v.p.id, ids: free.map((u) => u.id), target: wolf.id });
    return;
  }
  // A raider camp within reach: its loot is worth a squad, once the town has soldiers to spare (and no rival is by it).
  const camp = nearestBeast(s, 'raider', v.home.x, v.home.y, AI_WILD.raidNear);
  if (camp && camp.state !== 'fight' && free.length >= AI_WILD.raid && !ruinDanger(s, v.p, camp, AI_WILD.safe)) {
    issue({ t: 'hunt', p: v.p.id, ids: free.map((u) => u.id), target: camp.id });
  }
}

// ---- The steppe (#320) --------------------------------------------------------------------------------

/**
 * The steppe road, in the Stone Age: a clever computer that means to follow the herds raises a Hunting Camp
 * by the deer (the road's clue) and sends more hunters, and further, until its butchers have the deed's meat.
 * On the steppe itself its hunters range as far, and it notes when it arrived.
 */
function steppeRoad(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  if (isMobile(p)) {
    (mem.steppe ??= {}).since ??= s.tick;
    v.hunt = { n: AI_STEPPE.hunters, r: AI_STEPPE.reach };
    // A people born on the move (#501) still rides for the Steppe Road from the Stone Age, and follows its clue to the deer.
    if (ageDef(p).mobile) return;
  }
  if (p.epoch !== 0 || !walksWeb(v) || v.citizens.length < AI_STEPPE.at) return;
  const road = roadsFrom(p).find((r) => AGES[r.to].mobile);
  if (!road || deedsDone(p, road, s) || fit(p, road.to) < 0 || !wants(s, p, mem, road.to)) return;
  v.hunt = { n: AI_STEPPE.hunters, r: AI_STEPPE.reach };
  const clue = road.clue;
  if (!clue || count(v, clue) > 0 || s.tick - (mem.ordered[clue] ?? -99999) < secs(25)) return;
  let herd: Animal | null = null;
  let bestD = AI_STEPPE.campTo * AI_STEPPE.campTo;
  for (const a of s.animals) {
    if (a.kind !== 'deer' || a.hp <= 0) continue;
    const d = (a.x - v.home.x) * (a.x - v.home.x) + (a.y - v.home.y) * (a.y - v.home.y);
    if (d >= AI_STEPPE.campFrom * AI_STEPPE.campFrom && d < bestD) {
      bestD = d;
      herd = a;
    }
  }
  if (!herd) return;
  const spot = findSpot(s, clue, herd.x, herd.y, 2, 5);
  if (spot) construct(s, v, mem, clue, spot, 2, issue);
}

const grownSheep = (s: GameState, owner: number): Animal[] => s.animals.filter((a) => a.kind === 'sheep' && a.owner === owner && a.hp > 0 && a.lamb === undefined);

/** The road from the steppe into the Horde (#322), while the computer wants it and its deeds are not yet done; null otherwise. */
function hordeClimb(s: GameState, v: View, mem: AiMemory): Road | null {
  const { p } = v;
  if (ageOf(p) !== 'steppe' || !walksWeb(v) || !wants(s, p, mem, 'horde')) return null;
  const road = roadsFrom(p).find((r) => r.to === 'horde');
  return road && !deedsDone(p, road, s) ? road : null;
}

/** How many milkers its flock wants: one for each `perMilker` grown sheep, one for each sheep while the Horde's milk is to be drawn (#322). */
function milkersWanted(s: GameState, v: View): number {
  const grown = grownSheep(s, v.p.id).length;
  const mem = s.ai[v.p.id];
  if (mem && hordeClimb(s, v, mem)) return Math.min(AI_HORDE.milkers, grown);
  // A people with no fields (#501) draws all the milk there is.
  return Math.ceil(grown / (isNomad(v.p) ? NOMAD.aiPerMilker : AI_STEPPE.perMilker));
}

/**
 * The flock: a lamb whenever there is food to spare, milkers enough for the grown sheep (one berry picker or
 * woodcutter at a time goes over), and a sheep too fat to breed slaughtered, one at a time.
 */
function tendFlock(s: GameState, v: View, issue: (c: Command) => void): void {
  const { p } = v;
  const mobile = isMobile(p);
  const grown = grownSheep(s, p.id);
  const climb = mobile ? hordeClimb(s, v, s.ai[p.id] ?? ({} as AiMemory)) : null;
  const hordeWanted = !!climb;
  if (!mobile && !grown.length) return;
  // A people born on the move (#501) has no fields: its first lambs are its farms, raised ahead of the savings for the next epoch.
  const purse = isNomad(p) && flockOf(s, p.id) < NOMAD.aiFlock ? p.res.food - NOMAD.aiSpare : v.budget.food - (hordeWanted ? AI_HORDE.spare : AI_STEPPE.spare);
  if (mobile && v.tc && flockOf(s, p.id) < flockCap(s, p.id) && purse >= (FLOCK.cost.food ?? 0)) {
    issue({ t: 'lamb', p: p.id, building: v.tc.id });
    spend(v, FLOCK.cost);
  }
  if (!grown.length) return;
  const near = (u: Unit, a: { x: number; y: number }) => (u.x - a.x) * (u.x - a.x) + (u.y - a.y) * (u.y - a.y);
  const milkers = v.citizens.filter((u) => u.order.k === 'milk').length;
  if (milkers < milkersWanted(s, v)) {
    const ewe = milkable(s, p.id, v.home.x, v.home.y, FLOCK.follow);
    const hand = ewe
      ? v.citizens
          .filter((u) => !u.inside && !u.queue.length && u.carry <= 2 && !v.diggers.has(u.id) && !v.claimers.has(u.id) && (u.order.k === 'idle' || (hordeWanted && u.order.k === 'farm') || (u.order.k === 'gather' && (u.order.res === 'wood' || s.res[u.order.tile] === R_BERRY))))
          .sort((a, b) => near(a, ewe) - near(b, ewe) || a.id - b.id)[0]
      : undefined;
    if (ewe && hand) issue({ t: 'milk', p: p.id, ids: [hand.id], target: ewe.id });
  }
  // Fat that can't become a lamb (the flock full, or the people settled) is meat: one sheep at a time.
  const ids = new Set(grown.map((a) => a.id));
  if (v.citizens.some((u) => u.order.k === 'hunt' && ids.has(u.order.target))) return;
  // The Horde's hunting deed counts butchered sheep (#322): once the milk is in and the meat is short, the flock is culled, down to `AI_HORDE.least`.
  const butchery = (!!climb && grown.length > AI_HORDE.least && deedsProgress(p, climb).every((d) => d.deed.stat === 'hunted' || d.have >= d.need) && deedsProgress(p, climb).some((d) => d.deed.stat === 'hunted' && d.have < d.need))
    // A nomad camp (#501) a long way from the Deep Wood's winter yard kills its surplus sheep for meat while the deer are far off.
    || (isNomad(p) && yarding(s) && grown.length > AI_HORDE.least);
  if (mobile && flockOf(s, p.id) < flockCap(s, p.id) && !butchery) return;
  let fat: Animal | null = null;
  for (const a of grown) if (((a.fat ?? 0) >= FLOCK.breed || butchery) && (!fat || (a.fat ?? 0) > (fat.fat ?? 0))) fat = a;
  if (!fat) return;
  const prey = fat;
  const butcher = v.citizens
    .filter((u) => !u.inside && !u.queue.length && u.carry <= 2 && !v.diggers.has(u.id) && !v.claimers.has(u.id) && (u.order.k === 'idle' || u.order.k === 'milk' || (u.order.k === 'gather' && u.order.res === 'food')))
    .sort((a, b) => near(a, prey) - near(b, prey) || a.id - b.id)[0];
  if (butcher) issue({ t: 'hunt', p: p.id, ids: [butcher.id], target: prey.id });
}

/** Sixteen ways out from camp, a compass's points and the points between them (unit length, no trigonometry). */
const COMPASS: [number, number][] = [
  [1, 0], [0.9239, 0.3827], [0.7071, 0.7071], [0.3827, 0.9239], [0, 1], [-0.3827, 0.9239], [-0.7071, 0.7071], [-0.9239, 0.3827],
  [-1, 0], [-0.9239, -0.3827], [-0.7071, -0.7071], [-0.3827, -0.9239], [0, -1], [0.3827, -0.9239], [0.7071, -0.7071], [0.9239, -0.3827],
];

/** How good a pasture lies around a point: its fresh grass within a flock's range, and the deer and berries by it. */
function pasture(s: GameState, x: number, y: number, r = FLOCK.range): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let n = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const tx = cx + dx;
      const ty = cy + dy;
      if (grassy(s, tx, ty)) n++;
      else if (tx >= 0 && ty >= 0 && tx < s.w && ty < s.h && s.res[ty * s.w + tx] === R_BERRY) n += 2;
    }
  }
  for (const a of s.animals) if (a.kind === 'deer' && a.hp > 0 && (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) <= 144) n += 6;
  return n;
}

/** Whether a Town Center could be pitched at (or right by) a point: on open ground that no rival holds. */
function pitchable(s: GameState, owner: number, x: number, y: number): boolean {
  const n = BUILDINGS.towncenter.size;
  const bx = Math.round(x - n / 2);
  const by = Math.round(y - n / 2);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!placeProblem(s, 'towncenter', bx + dx, by + dy, true, owner)) return true;
  return false;
}

/** The best fresh pasture `move` to `far` tiles from camp that lies no nearer the rival, worth the drive; or null. */
function newPasture(s: GameState, v: View): { x: number; y: number } | null {
  const enemy = enemyHome(s, v.p);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  // A people born on the move (#501) has the whole of the land to graze: it looks farther, and goes sideways to the rival too.
  const nomad = isNomad(v.p);
  const away = dist(v.home, enemy) - (nomad ? NOMAD.aiSideways : 2);
  let best: { x: number; y: number } | null = null;
  const r = grazeRange(s, v.p.id);
  let score = pasture(s, v.home.x, v.home.y, r) * 1.25 + 10;
  for (const d of nomad ? [AI_STEPPE.move, AI_STEPPE.far, NOMAD.aiFar] : [AI_STEPPE.move, (AI_STEPPE.move + AI_STEPPE.far) / 2, AI_STEPPE.far]) {
    for (const [ux, uy] of COMPASS) {
      const at = { x: Math.floor(v.home.x + ux * d) + 0.5, y: Math.floor(v.home.y + uy * d) + 0.5 };
      if (at.x < 4 || at.y < 4 || at.x > s.w - 4 || at.y > s.h - 4 || !walkable(s, Math.floor(at.x), Math.floor(at.y))) continue;
      if (dist(at, enemy) < away || !pitchable(s, v.p.id, at.x, at.y)) continue;
      const n = pasture(s, at.x, at.y, r);
      if (n > score) {
        score = n;
        best = at;
      }
    }
  }
  return best;
}

/**
 * Striking camp: when its flock has grazed the pasture out, or the game round camp is gone, and no rival
 * soldiers are near, it packs its Town Center (letting the queue empty first), drives the wagon to fresh
 * pasture and pitches it there. A wagon that finds no room falls back halfway toward where it came from.
 */
function strikeCamp(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  const wagon = v.wagons.find((w) => w.packed === 'towncenter' && !w.inside);
  if (wagon) {
    const st = (mem.steppe ??= {});
    const to = st.to ?? { x: wagon.x, y: wagon.y, at: s.tick };
    st.to = to;
    const left = (to.x - wagon.x) * (to.x - wagon.x) + (to.y - wagon.y) * (to.y - wagon.y);
    if (left > 2.25 && s.tick - to.at < secs(AI_STEPPE.drive)) {
      if (wagon.order.k === 'idle') issue({ t: 'move', p: p.id, ids: [wagon.id], x: to.x, y: to.y });
      return;
    }
    issue({ t: 'pitch', p: p.id, ids: [wagon.id] });
    if (s.byId.has(wagon.id)) {
      // No room here: back halfway toward the old camp, and try again there.
      const from = st.from ?? v.home;
      st.to = { x: (wagon.x + from.x) / 2, y: (wagon.y + from.y) / 2, at: s.tick };
      issue({ t: 'move', p: p.id, ids: [wagon.id], x: st.to.x, y: st.to.y });
    } else {
      delete st.to;
      delete st.from;
    }
    return;
  }
  const st = mem.steppe;
  // A people born on the move (#501) strikes camp at every level of play: it is how it eats.
  if (!st || !isMobile(p) || !(walksWeb(v) || isNomad(p))) {
    if (st) delete st.pack;
    return;
  }
  const tc = v.tc;
  if (st.pack) {
    // Waiting for the Town Center's queue to empty before it packs.
    if (!tc || tc.advance >= 0 || threatNear(s, v).count || s.tick - st.pack.at > secs(45)) {
      delete st.pack;
      return;
    }
    if (tc.queue.length) return;
    issue({ t: 'pack', p: p.id, building: tc.id });
    st.struck = s.tick;
    st.from = { x: tc.x, y: tc.y };
    st.to = { x: st.pack.x, y: st.pack.y, at: s.tick };
    delete st.pack;
    return;
  }
  // A people born on the move (#501) lives by its flock alone, and moves on sooner.
  const every = isNomad(p) ? NOMAD.aiEvery : AI_STEPPE.every;
  if (!tc || tc.advance >= 0 || s.tick - (st.struck ?? st.since ?? s.tick) < secs(every)) return;
  const grown = grownSheep(s, p.id);
  const hungry = grown.filter((a) => a.hungry).length;
  const grazedOut = grown.length >= 2 && hungry >= grown.length * AI_STEPPE.hungry;
  const huntedOut = !nearestDeer(s, v.home.x, v.home.y, AI_STEPPE.bare) && findResource(s, R_BERRY, v.home.x, v.home.y, AI_STEPPE.bare) < 0;
  // A people born on the move (#501) packs for a flock that stays hungry, not one caught between two mouthfuls.
  if (isNomad(p) && !ageDef(p).mobile && !huntedOut) {
    if (!grazedOut) delete st.starved;
    else st.starved ??= s.tick;
    if (s.tick - (st.starved ?? s.tick) < secs(NOMAD.aiHungry)) return;
  }
  if ((!grazedOut && !huntedOut) || threatNear(s, v).count) return;
  const to = newPasture(s, v);
  // None worth it: look again in half a minute.
  if (!to) {
    st.struck = s.tick - secs(every - 30);
    return;
  }
  st.pack = { x: to.x, y: to.y, at: s.tick };
  delete st.starved;
}

// ---- Ancient ruins (#64) -----------------------------------------------------------------------------

/** Citizens sent to dig a ruin, how many citizens the town needs before it spares them, and seconds to keep off a ruin it fled. */
const RUIN_DIGGERS = 2;
const RUIN_TOWN = 10;
const RUIN_WARY = 180;

/** Rival soldiers it can see within `r` tiles of a ruin, or a rival tower or Town Center it knows of within `r + 8`. */
function ruinDanger(s: GameState, p: Player, ruin: { x: number; y: number }, r: number): boolean {
  for (const e of s.ents) {
    if (e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    const dx = e.x - ruin.x;
    const dy = e.y - ruin.y;
    if (e.kind === 'unit') {
      if (e.inside || e.type === 'citizen' || e.type === 'trader' || e.type === 'fisher' || !p.vis[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
      if (dx * dx + dy * dy <= r * r) return true;
    } else if ((e.type === 'towncenter' || e.type === 'tower') && p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)] && dx * dx + dy * dy <= (r + 8) * (r + 8)) return true;
  }
  return false;
}

/**
 * Dig up the nearest ruin nobody's guarding, with a pair of citizens spared from wood, stone and gold
 * once the town has enough of them; call them home when rival soldiers come near, and keep off that
 * ruin for a few minutes.
 */
function excavate(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  if (!s.ruins) return;
  const digging = v.citizens.filter((u) => u.order.k === 'dig');
  for (const u of digging) {
    const ruin = s.ruins.find((r) => u.order.k === 'dig' && r.id === u.order.target);
    if (!ruin || !ruinDanger(s, v.p, ruin, 9)) continue;
    (mem.ruinFled ??= {})[ruin.id] = s.tick;
    issue({ t: 'move', p: v.p.id, ids: digging.filter((d) => d.order.k === 'dig' && d.order.target === ruin.id).map((d) => d.id), x: v.home.x, y: v.home.y });
    return;
  }
  if (digging.length || v.citizens.length < RUIN_TOWN || threatNear(s, v).count) return;
  let best: Ruin | null = null;
  let bestD = Infinity;
  for (const r of s.ruins) {
    if (r.by >= 0 || s.tick - (mem.ruinFled?.[r.id] ?? -99999) < secs(RUIN_WARY) || ruinDanger(s, v.p, r, 12)) continue;
    const d = (r.x - v.home.x) * (r.x - v.home.x) + (r.y - v.home.y) * (r.y - v.home.y);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  if (!best) return;
  const ruin = best;
  const spare = v.citizens
    .filter((u) => !u.inside && !u.queue.length && u.carry <= 2 && (u.order.k === 'idle' || (u.order.k === 'gather' && u.order.res !== 'food')))
    .sort((a, b) => (a.x - ruin.x) * (a.x - ruin.x) + (a.y - ruin.y) * (a.y - ruin.y) - ((b.x - ruin.x) * (b.x - ruin.x) + (b.y - ruin.y) * (b.y - ruin.y)) || a.id - b.id)
    .slice(0, RUIN_DIGGERS);
  if (spare.length === RUIN_DIGGERS) issue({ t: 'dig', p: v.p.id, ids: spare.map((u) => u.id), target: ruin.id });
}

/**
 * A salvaging people (#503) sends a pair of spare citizens to strip the nearest rubble nobody's guarding. Rubble of its own fall it leaves alone while the foundations can still be raised (the rebuild
 * above does that), and strips it only once there is no gold to rebuild with.
 */
function salvage(s: GameState, v: View, _mem: AiMemory, issue: (c: Command) => void): void {
  if (!s.rubble || !ageDef(v.p).salvage) return;
  const working = v.citizens.filter((u) => u.order.k === 'salvage');
  for (const u of working) {
    const r = s.rubble.find((x) => u.order.k === 'salvage' && x.id === u.order.target);
    if (!r || !ruinDanger(s, v.p, r, 9)) continue;
    issue({ t: 'move', p: v.p.id, ids: working.map((d) => d.id), x: v.home.x, y: v.home.y });
    return;
  }
  if (working.length || v.citizens.length < RUIN_TOWN || threatNear(s, v).count) return;
  let best: Rubble | null = null;
  let bestD = Infinity;
  for (const r of s.rubble) {
    const d = (r.x - v.home.x) * (r.x - v.home.x) + (r.y - v.home.y) * (r.y - v.home.y);
    if (d > SALVAGE.find * SALVAGE.find || ruinDanger(s, v.p, r, 12)) continue;
    // Its own: the rebuild comes first, the stones only when it cannot pay for it.
    if (r.owner === v.p.id && v.p.res.gold >= 100) continue;
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  if (!best) return;
  const site = best;
  const spare = v.citizens
    .filter((u) => !u.inside && !u.queue.length && u.carry <= 2 && (u.order.k === 'idle' || (u.order.k === 'gather' && u.order.res !== 'food')))
    .sort((a, b) => (a.x - site.x) * (a.x - site.x) + (a.y - site.y) * (a.y - site.y) - ((b.x - site.x) * (b.x - site.x) + (b.y - site.y) * (b.y - site.y)) || a.id - b.id)
    .slice(0, RUIN_DIGGERS);
  if (spare.length === RUIN_DIGGERS) issue({ t: 'salvage', p: v.p.id, ids: spare.map((u) => u.id), target: site.id });
}

// ---- Contested landmarks -------------------------------------------------------------------------------

/**
 * The nearest landmark within reach of home for it to go after: for a citizen (`free`), one nobody keeps;
 * for soldiers, one a rival keeps, or one nobody keeps that a rival is part way to claiming.
 */
export function markToTake(s: GameState, v: View, free: boolean, safe: boolean): Landmark | null {
  let best: Landmark | null = null;
  const rival = enemyHome(s, v.p);
  // Going for lordship, no landmark is too far.
  const reach = s.mode === 'lords' ? AI_MARK.lordsReach : Math.max(AI_MARK.near, AI_MARK.rival * Math.sqrt((rival.x - v.home.x) * (rival.x - v.home.x) + (rival.y - v.home.y) * (rival.y - v.home.y)));
  let bestD = reach * reach;
  for (const m of s.landmarks ?? []) {
    // Soldiers also go to a landmark of ours that rivals are standing on.
    if (free ? m.owner >= 0 : m.owner >= 0 ? !isEnemy(s, v.p.id, m.owner) && !pulledDown(s, v.p, m) : !(m.by >= 0 && m.claim > 0 && isEnemy(s, v.p.id, m.by))) continue;
    if (safe && ruinDanger(s, v.p, m, 10)) continue;
    // Soldiers go for a rival's Old Ford first: it is the road its army strikes down (clever computers only).
    const w = markWorth(s, v, m) * (!free && m.kind === 'ford' && m.owner >= 0 && isEnemy(s, v.p.id, m.owner) && AI_LEVELS[v.p.ai!].clever ? AI_MARK.worth.fordRival : 1);
    const d = ((m.x - v.home.x) * (m.x - v.home.x) + (m.y - v.home.y) * (m.y - v.home.y)) / (w * w);
    if (d < bestD || (d === bestD && best && m.id < best.id)) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/** True while rivals stand alone round a landmark we (or an ally) keep: it is being pulled down. */
function pulledDown(s: GameState, p: Player, m: Landmark): boolean {
  if (m.owner < 0 || isEnemy(s, p.id, m.owner)) return false;
  const there = claimants(s, m);
  if (there.size !== 1) return false;
  return isEnemy(s, p.id, [...there][0][1].player);
}

/** How much a landmark is worth walking for, as a divisor of its distance: more for what this town needs now. */
function markWorth(s: GameState, v: View, m: Landmark): number {
  if (!AI_LEVELS[v.p.ai!].worthy) return 1;
  return markNeed(s, v, m) * (favours(s, v.p.id, m.kind) ? AI_MARK.worth.kin : 1);
}

function markNeed(s: GameState, v: View, m: Landmark): number {
  const w = AI_MARK.worth;
  if (m.kind === 'cairn') {
    // Room for people matters once houses are nearly full.
    return v.p.pop + 4 >= v.p.cap ? w.cairnFull : w.cairn;
  }
  if (m.kind === 'spring') return v.citizens.some((u) => u.hp < maxHp(s, u) * 0.7) || v.army.some((u) => u.hp < maxHp(s, u) * 0.7) ? w.springHurt : w.spring;
  return m.kind === 'flint' ? w.flint : m.kind === 'ford' ? w.ford : w.crag;
}

/**
 * One citizen walks out to claim the nearest landmark nobody keeps, once the town can spare one; called
 * home when it's theirs, when rival soldiers come near, or when it has taken too long.
 */
function claimWalk(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  if (!s.landmarks) return;
  const w = mem.markWalker;
  if (w) {
    const m = landmarkAt(s, w.id);
    const u = s.byId.get(w.unit);
    const alive = u && u.kind === 'unit' && u.hp > 0;
    // Done once anyone keeps it: theirs to enjoy, or a rival's that a lone citizen can't take.
    const over = !m || m.owner >= 0 || s.tick - w.since > secs(AI_MARK.walk) || ruinDanger(s, v.p, m, 9);
    if (!alive || (u.order.k !== 'idle' && u.order.k !== 'move')) {
      delete mem.markWalker;
      return;
    }
    // Rival soldiers beside the walker on the road recall it too, not only ones at the landmark.
    if (over || ruinDanger(s, v.p, u, 7)) {
      delete mem.markWalker;
      issue({ t: 'stop', p: v.p.id, ids: [u.id] });
      return;
    }
    v.claimers.add(u.id);
    // A walker out ahead of a slower escort halts and lets it close up.
    const e = mem.markEscort;
    if (e && e.unit === u.id && e.mark === m.id) {
      let near = Infinity;
      for (const id of e.ids) {
        const o = s.byId.get(id);
        if (o && o.kind === 'unit' && o.hp > 0) near = Math.min(near, (o.x - u.x) * (o.x - u.x) + (o.y - u.y) * (o.y - u.y));
      }
      if (near > AI_MARK.lead * AI_MARK.lead && near < Infinity) {
        if (u.order.k === 'move') issue({ t: 'stop', p: v.p.id, ids: [u.id] });
        return;
      }
    }
    if (u.order.k === 'idle' && (u.x - m.x) * (u.x - m.x) + (u.y - m.y) * (u.y - m.y) > 4) issue({ t: 'move', p: v.p.id, ids: [u.id], x: m.x, y: m.y });
    return;
  }
  if (v.citizens.length < AI_MARK.townAt || threatNear(s, v).count) return;
  const m = markToTake(s, v, true, true);
  if (!m) return;
  const walker = v.citizens
    .filter((u) => !u.inside && !u.queue.length && u.carry <= 2 && !v.diggers.has(u.id) && (u.order.k === 'idle' || (u.order.k === 'gather' && u.order.res !== 'food')))
    .sort((a, b) => (a.x - m.x) * (a.x - m.x) + (a.y - m.y) * (a.y - m.y) - ((b.x - m.x) * (b.x - m.x) + (b.y - m.y) * (b.y - m.y)) || a.id - b.id)[0];
  if (!walker) return;
  mem.markWalker = { id: m.id, unit: walker.id, since: s.tick };
  v.claimers.add(walker.id);
  issue({ t: 'move', p: v.p.id, ids: [walker.id], x: m.x, y: m.y });
}

/**
 * Between waves, a band of soldiers takes (or takes back) the nearest landmark a rival keeps or is
 * claiming, and holds there until it is the computer's own (or nobody's claim is in the rival's hands). Returns the soldiers on that duty, so they aren't called back to the muster.
 */
function guardMarks(s: GameState, v: View, mem: AiMemory, ready: Unit[], issue: (c: Command) => void): Set<number> {
  const held = new Set<number>();
  if (!s.landmarks || s.tick < s.peaceUntil) return held;
  escortWalker(s, v, mem, ready, held, issue);
  const g = mem.markGuard;
  if (g) {
    const m = landmarkAt(s, g.id);
    const ids = g.ids.filter((id) => {
      const u = s.byId.get(id);
      return u && u.kind === 'unit' && u.hp > 0;
    });
    const settled = m && (m.owner >= 0 ? !isEnemy(s, v.p.id, m.owner) && !pulledDown(s, v.p, m) : !(m.by >= 0 && isEnemy(s, v.p.id, m.by)));
    if (!m || settled || !ids.length || s.tick - g.since > secs(AI_MARK.hold)) {
      delete mem.markGuard;
      return held;
    }
    g.ids = ids;
    for (const id of ids) held.add(id);
    // Those that wandered off after a fight walk back onto it.
    const off = ids.filter((id) => {
      const u = s.byId.get(id) as Unit;
      return u.order.k === 'idle' && (u.x - m.x) * (u.x - m.x) + (u.y - m.y) * (u.y - m.y) > 4;
    });
    if (off.length) issue({ t: 'move', p: v.p.id, ids: off, x: m.x, y: m.y, amove: true });
    return held;
  }
  const band = ready.filter((u) => u.type !== 'siege' && u.order.k === 'idle');
  // When a rival is about to be lord of every landmark, any soldiers will do to break it.
  const lordRace = (s.landTeam ?? -1) >= 0 && s.landTeam !== v.p.team;
  if (band.length < (lordRace ? 1 : s.mode === 'lords' ? AI_MARK.lordsParty : AI_MARK.party)) return held;
  const m = markToTake(s, v, false, false);
  if (!m) return held;
  const ids = band
    .sort((a, b) => (a.x - m.x) * (a.x - m.x) + (a.y - m.y) * (a.y - m.y) - ((b.x - m.x) * (b.x - m.x) + (b.y - m.y) * (b.y - m.y)) || a.id - b.id)
    .slice(0, AI_MARK.guard)
    .map((u) => u.id);
  mem.markGuard = { id: m.id, ids, since: s.tick };
  for (const id of ids) held.add(id);
  issue({ t: 'move', p: v.p.id, ids, x: m.x, y: m.y, amove: true });
  return held;
}

/**
 * A walker bound for a landmark more than `AI_MARK.far` tiles from home gets `AI_MARK.escort` idle
 * soldiers sent along, who clear the road (attack-move) and stay by the landmark until the walk is over.
 */
function escortWalker(s: GameState, v: View, mem: AiMemory, ready: Unit[], held: Set<number>, issue: (c: Command) => void): void {
  const w = mem.markWalker;
  const e = mem.markEscort;
  const m = w ? landmarkAt(s, w.id) : undefined;
  if (e && (!w || w.unit !== e.unit || w.id !== e.mark || !m)) {
    // The claim is won: the escort lingers a while so a passing raider can't pull it straight down.
    const won = landmarkAt(s, e.mark);
    if (won && won.owner === v.p.id && !e.until) e.until = s.tick + secs(AI_MARK.linger);
    if (!e.until || s.tick >= e.until || !won || won.owner !== v.p.id) {
      delete mem.markEscort;
      return;
    }
    e.ids = e.ids.filter((id) => {
      const u = s.byId.get(id);
      return u && u.kind === 'unit' && u.hp > 0;
    });
    for (const id of e.ids) held.add(id);
    return;
  }
  if (e && m) {
    e.ids = e.ids.filter((id) => {
      const u = s.byId.get(id);
      return u && u.kind === 'unit' && u.hp > 0;
    });
    // Every one fallen on the road: the walker gets a fresh escort below, if the town has soldiers to spare.
    if (e.ids.length) {
      for (const id of e.ids) held.add(id);
      return;
    }
    delete mem.markEscort;
  }
  if (!w || !m || (m.x - v.home.x) * (m.x - v.home.x) + (m.y - v.home.y) * (m.y - v.home.y) < AI_MARK.far * AI_MARK.far) return;
  const band = ready
    .filter((u) => u.type !== 'siege' && u.order.k === 'idle')
    .sort((a, b) => (a.x - m.x) * (a.x - m.x) + (a.y - m.y) * (a.y - m.y) - ((b.x - m.x) * (b.x - m.x) + (b.y - m.y) * (b.y - m.y)) || a.id - b.id);
  // A small army stays home: the escort comes from what is left beyond a guard of `AI_MARK.party`.
  if (band.length < AI_MARK.escort + AI_MARK.party) return;
  const ids = band.slice(0, AI_MARK.escort).map((u) => u.id);
  mem.markEscort = { unit: w.unit, mark: m.id, ids };
  for (const id of ids) held.add(id);
  issue({ t: 'move', p: v.p.id, ids, x: m.x, y: m.y, amove: true });
}

function nearestDropTo(v: View, u: Unit): { x: number; y: number } {
  let best = v.home;
  let bestD = Infinity;
  for (const b of v.buildings) {
    if (!b.built || !BUILDINGS[b.type].drop.length) continue;
    const d = distToRect(u.x, u.y, b);
    if (d < bestD) {
      bestD = d;
      best = { x: b.x, y: b.y };
    }
  }
  return best;
}

// ---- Army ------------------------------------------------------------------------------------------

/** Where to strike: an enemy wonder first (it must fall), then a King (or where one shelters), then the nearest Town Center. */
function enemyHome(s: GameState, p: Player): { x: number; y: number } {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const id of s.kings) {
    const k = id ? s.byId.get(id) : undefined;
    if (!k || k.kind !== 'unit' || k.inside || !isEnemy(s, p.id, k.owner)) continue;
    const kx = k.x - p.startX;
    const ky = k.y - p.startY;
    const d = kx * kx + ky * ky - 5e5;
    if (d < bestD) {
      bestD = d;
      best = { x: k.x, y: k.y };
    }
  }
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    const dx = e.x - p.startX;
    const dy = e.y - p.startY;
    const shelter = s.mode === 'regicide' && e.garrison.some((id) => s.kings.includes(id));
    const shrine = e.type === 'temple' && relicRace(s, p) && s.relics.some((r) => r.temple === e.id);
    const d = dx * dx + dy * dy + (e.type === 'wonder' || shrine ? -1e6 : shelter ? -5e5 : e.type === 'towncenter' ? 0 : e.type === 'wall' || e.type === 'gate' ? 1e5 : 400);
    if (d < bestD) {
      bestD = d;
      best = { x: e.x, y: e.y };
    }
  }
  if (best) return best;
  const foe = s.players.find((o) => !o.defeated && isEnemy(s, p.id, o.id));
  return foe ? { x: foe.startX, y: foe.startY } : { x: s.w / 2, y: s.h / 2 };
}

// ---- Ships and aircraft ----------------------------------------------------------------------------

/** Fishing boats on the shoals, and a fleet to guard them and raid the enemy's. */
function seafaring(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  const L = AI_LEVELS[p.ai!];
  const dock = v.buildings.find((b) => b.type === 'dock' && b.built);
  if (!dock) return;
  // On the Shore a clever computer spares each shoal its seed for spring (#482), unless it's hungry.
  const sparing = L.clever && s.homeland === 'shore' && p.res.food >= YEAR.fishHungry;
  const thin = (i: number) => sparing && s.amount[i] <= YEAR.fishSpare;
  // Fishing boats: as many as there are shoals near the dock (that it would fish), up to a few.
  const shoals = countFish(s, dock.x, dock.y, 14, thin);
  const shore = s.homeland === 'shore' ? AI_SHORE.boats : 0;
  const wantBoats = Math.min(shoals, 2 + p.epoch + shore, (L.clever ? 6 : 4) + shore);
  const queued = (u: UnitType) => dock.queue.filter((q) => q.unit === u).length;
  if (v.fishers.length + queued('fisher') < wantBoats && dock.queue.length < 2) {
    const cost = unitStats('fisher', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: dock.id, unit: 'fisher' });
      spend(v, cost);
    }
  }
  for (const f of v.fishers) {
    const o = f.order;
    // A boat on a shoal down to its seed moves on, once it has landed its catch; with nowhere else, it rests.
    const moveOn = o.k === 'gather' && o.phase !== 'drop' && s.res[o.tile] === R_FISH && thin(o.tile);
    if (o.k !== 'idle' && !moveOn) continue;
    const t = findResource(s, R_FISH, f.x, f.y, 18, thin);
    if (t >= 0) issue({ t: 'gather', p: p.id, ids: [f.id], tile: t });
    else if (moveOn) issue({ t: 'stop', p: p.id, ids: [f.id] });
  }
  // Warships: once the Bronze Age opens them, if the enemy has boats or the map is mostly sea.
  if (!L.clever || p.epoch < 1) return;
  seaLanding(s, v, mem, dock, issue);
  // A sailor keeps a small fleet and hunts rival merchant ships, since its ships are cheap and sturdy.
  const sailor = ageOf(p) === 'sail';
  const enemyShips = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.hp > 0 && isEnemy(s, p.id, e.owner) && (e.type === 'warship' || e.type === 'fisher' || e.type === 'transport' || (sailor && e.type === 'cog')) && p.vis[Math.floor(e.y) * s.w + Math.floor(e.x)] === 1);
  const warships = v.navy.filter((u) => u.type === 'warship');
  const baseShips = s.mapType === 'sea' ? Math.min(2 + p.epoch, 6) : enemyShips.length ? Math.min(2 + Math.floor(enemyShips.length / 2), 5) : sailor ? 2 : 0;
  const wantShips = fleetWanted(s, p, baseShips);
  if (warships.length + queued('warship') < wantShips && dock.queue.length < 2 && v.army.length >= 3) {
    const cost = unitStats('warship', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: dock.id, unit: 'warship' });
      spend(v, cost);
    } else if (warships.length < 2) spend(v, cost);
  }
  // In the Age of Sail the first `AI_CONVOY.escorts` warships (id order) keep the port where most of our cogs load (#379 s3):
  // a cog that loads with one beside it carries more (`convoy.ts`), and the port is where a rival's raiders come.
  const port = ageDef(p).convoys ? convoyPort(s, v) : null;
  const escorts = new Set(port ? warships.slice(0, AI_CONVOY.escorts).map((u) => u.id) : []);
  for (const u of warships) {
    if (!port || !escorts.has(u.id) || u.order.k !== 'idle') continue;
    if ((u.x - port.x) * (u.x - port.x) + (u.y - port.y) * (u.y - port.y) > AI_CONVOY.stay * AI_CONVOY.stay) issue({ t: 'move', p: p.id, ids: [u.id], x: port.x, y: port.y });
  }
  const idle = warships.filter((u) => u.order.k === 'idle' && !escorts.has(u.id));
  if (!idle.length) return;
  // Raid when the army attacks (or when there's a fleet to sink in sight); otherwise guard the dock.
  // A rival Station or Blood Tower near the shore is a warship's to shell first (#355 s5): it does not bleed, and they are the lifeline.
  const works = !enemyShips.length && mem.attacking && L.hemo !== false ? shoreBlood(s, p, dock) : null;
  if (works && idle.length >= Math.min(2, warships.length)) {
    issue({ t: 'attack', p: p.id, ids: idle.map((u) => u.id), target: works.id });
    return;
  }
  const prey = enemyShips[0] ?? (mem.attacking ? enemyDock(s, p) : null);
  if (prey && idle.length >= Math.min(2, warships.length)) issue({ t: 'move', p: p.id, ids: idle.map((u) => u.id), x: prey.x, y: prey.y, amove: true });
  else {
    const far = idle.filter((u) => (u.x - dock.x) * (u.x - dock.x) + (u.y - dock.y) * (u.y - dock.y) > 100);
    if (far.length) issue({ t: 'move', p: p.id, ids: far.map((u) => u.id), x: dock.x, y: dock.y });
  }
}

/**
 * On a map with a great sea, a transport carries part of the army straight across it and puts
 * them ashore by the enemy's town, while the rest waits at home for the next wave.
 */
function seaLanding(s: GameState, v: View, mem: AiMemory, dock: Building, issue: (c: Command) => void): void {
  const { p } = v;
  if (s.mapType !== 'sea') return;
  const enemy = enemyHome(s, p);
  const queued = dock.queue.filter((q) => q.unit === 'transport').length;
  const ships = v.navy.filter((u) => u.type === 'transport');
  const lz = mem.landing;
  if (lz) {
    const ship = s.byId.get(lz.ship);
    if (!ship || ship.kind !== 'unit' || ship.hp <= 0) {
      mem.landing = undefined;
      return;
    }
    const riders = lz.ids.map((id) => s.byId.get(id)).filter((u): u is Unit => !!u && u.kind === 'unit' && u.hp > 0);
    if (lz.phase === 'load') {
      const aboard = ship.cargo.length;
      if (aboard >= riders.length || s.tick - lz.since > secs(45)) {
        if (aboard >= 3) {
          issue({ t: 'unload', p: p.id, ids: [ship.id], x: enemy.x, y: enemy.y });
          lz.phase = 'sail';
          lz.since = s.tick;
        } else mem.landing = undefined;
      }
    } else if (ship.cargo.length === 0) {
      // Ashore: on to the town.
      const ashore = riders.filter((u) => !u.inside);
      if (ashore.length) issue({ t: 'move', p: p.id, ids: ashore.map((u) => u.id), x: enemy.x, y: enemy.y, amove: true });
      mem.landing = undefined;
      mem.landed = s.tick;
    } else if (s.tick - lz.since > secs(150)) mem.landing = undefined;
    return;
  }
  // A transport, once there is an army worth halving.
  if (!ships.length && !queued && v.army.length >= 8 && dock.queue.length < 2 && unitEpoch('transport') <= p.epoch) {
    const cost = unitStats('transport', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: dock.id, unit: 'transport' });
      spend(v, cost);
    }
  }
  const ship = ships.find((u) => u.order.k === 'idle' && u.cargo.length === 0);
  if (!ship) return;
  const due = s.tick >= secs(AI_LEVELS[p.ai!].firstAttack) && s.tick >= s.peaceUntil && s.tick - (mem.landed ?? 0) > secs(240);
  const crew = v.army
    .filter((u) => !u.inside && u.type !== 'siege' && u.order.k === 'idle' && (u.x - v.home.x) * (u.x - v.home.x) + (u.y - v.home.y) * (u.y - v.home.y) < 18 * 18)
    .slice(0, Math.min(cargoRoom(s, ship), Math.floor(v.army.length / 2)));
  if (!due || mem.attacking || crew.length < 5 || !coastNear(s, enemy.x, enemy.y, 24)) {
    // Wait at the dock.
    if ((ship.x - dock.x) * (ship.x - dock.x) + (ship.y - dock.y) * (ship.y - dock.y) > 100) issue({ t: 'move', p: p.id, ids: [ship.id], x: dock.x, y: dock.y });
    return;
  }
  issue({ t: 'board', p: p.id, ids: crew.map((u) => u.id), target: ship.id });
  mem.landing = { ship: ship.id, ids: crew.map((u) => u.id), since: s.tick, phase: 'load' };
}

function countFish(s: GameState, x: number, y: number, r: number, skip?: (i: number) => boolean): number {
  let n = 0;
  for (let ty = Math.max(0, Math.floor(y - r)); ty <= Math.min(s.h - 1, y + r); ty++) {
    for (let tx = Math.max(0, Math.floor(x - r)); tx <= Math.min(s.w - 1, x + r); tx++) if (s.res[ty * s.w + tx] === R_FISH && !skip?.(ty * s.w + tx)) n++;
  }
  return n;
}

/** The enemy's dock it knows of, if any. */
function enemyDock(s: GameState, p: Player): Building | null {
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'dock' && e.hp > 0 && isEnemy(s, p.id, e.owner) && p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)]) return e;
  return null;
}

/**
 * A spot for a forward Airfield (#379): when the enemy building worth bombing lies beyond `AI_SORTIE.gap` of our nearest
 * finished Airfield, a spot `step` tiles from that Airfield toward it. Null when the target is in reach, unknown, or
 * we already hold `fields` Airfields.
 */
export function forwardFieldSpot(s: GameState, v: View): { tx: number; ty: number } | null {
  if (!ageDef(v.p).sortie || v.buildings.filter((b) => b.type === 'airfield').length >= AI_SORTIE.fields) return null;
  const target = enemyTarget(s, v.p);
  if (!target) return null;
  let from: Building | null = null;
  let best = Infinity;
  for (const b of v.buildings) {
    if (b.type !== 'airfield' || !b.built) continue;
    const d = (b.x - target.x) * (b.x - target.x) + (b.y - target.y) * (b.y - target.y);
    if (d < best) { best = d; from = b; }
  }
  if (!from || best <= AI_SORTIE.gap * AI_SORTIE.gap) return null;
  const l = Math.sqrt(best);
  const at = { x: from.x + ((target.x - from.x) / l) * AI_SORTIE.step, y: from.y + ((target.y - from.y) / l) * AI_SORTIE.step };
  return findSpot(s, 'airfield', at.x, at.y, 0, AI_SORTIE.search);
}

/** Sorties (the Age of Aeronauts): a clever computer with an Airfield raises another toward the enemy, so its bombers can reach. */
function forwardField(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  if (!AI_LEVELS[v.p.ai!].clever || v.hands < 20 || s.tick - (mem.ordered.airfield ?? -99999) < secs(60)) return;
  if (v.buildings.some((b) => b.type === 'airfield' && !b.built)) return;
  const spot = forwardFieldSpot(s, v);
  if (spot) construct(s, v, mem, 'airfield', spot, 3, issue);
}

/** Idle fighters park over the forward Airfield (the built one nearest the enemy, when it isn't the first), so bombers staging there are covered (#379). */
function guardForwardField(s: GameState, v: View, idle: Unit[], issue: (c: Command) => void): void {
  const fields = v.buildings.filter((b) => b.type === 'airfield' && b.built);
  const target = enemyTarget(s, v.p);
  if (fields.length < 2 || !target) return;
  let fwd = fields[0];
  let best = Infinity;
  for (const b of fields) {
    const d = (b.x - target.x) * (b.x - target.x) + (b.y - target.y) * (b.y - target.y);
    if (d < best) { best = d; fwd = b; }
  }
  if (fwd === fields[0]) return;
  const far = idle.filter((u) => (u.x - fwd.x) * (u.x - fwd.x) + (u.y - fwd.y) * (u.y - fwd.y) > 8 * 8);
  if (far.length) issue({ t: 'move', p: v.p.id, ids: far.map((u) => u.id), x: fwd.x, y: fwd.y });
}

/** Fighters to keep the sky clear, bombers to break the enemy's town. */
function airforce(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  const field = v.buildings.find((b) => b.type === 'airfield' && b.built);
  if (!field) return;
  const fighters = v.planes.filter((u) => u.type === 'fighter');
  const bombers = v.planes.filter((u) => u.type === 'bomber');
  if (field.queue.length < 2 && v.army.length >= 3) {
    const unit: UnitType = fighters.length < Math.max(2, bombers.length) ? 'fighter' : 'bomber';
    if ((unit === 'fighter' ? fighters.length : bombers.length) < 4 + mem.wave) {
      const cost = unitStats(unit, p.epoch).cost;
      // Paid for now, or (for the first few) saved up for while the army waits its turn.
      if (afford(v, cost)) {
        issue({ t: 'train', p: p.id, building: field.id, unit });
        spend(v, cost);
      } else if (v.planes.length < 3) spend(v, cost);
    }
  }
  // Fighters chase enemy aircraft near home, else fly with the attack.
  const enemyAir = s.ents.find((e): e is Unit => e.kind === 'unit' && e.hp > 0 && (e.type === 'fighter' || e.type === 'bomber') && isEnemy(s, p.id, e.owner) && (e.x - v.home.x) * (e.x - v.home.x) + (e.y - v.home.y) * (e.y - v.home.y) < 30 * 30);
  const freeFighters = fighters.filter((u) => u.order.k === 'idle');
  if (enemyAir && freeFighters.length) issue({ t: 'attack', p: p.id, ids: freeFighters.map((u) => u.id), target: enemyAir.id });
  else if (freeFighters.length && AI_LEVELS[p.ai!].clever && AI_LEVELS[p.ai!].fieldGuard !== false) guardForwardField(s, v, freeFighters, issue);
  // Bombers set out in a group against the enemy's town when the army attacks, or every couple of minutes.
  const ready = bombers.filter((u) => u.order.k === 'idle');
  // In a chapter whose goal is a Town Center, bombers fly with the army, at it: alone they only feed the enemy's guns.
  const goal = v.plan.target;
  const alone = goal ? mem.attacking : mem.attacking || s.tick - (mem.sortie ?? 0) > secs(120);
  if (ready.length >= 2 && alone && s.tick >= s.peaceUntil) {
    const target = goal ?? enemyTarget(s, p);
    if (target) {
      issue({ t: 'attack', p: p.id, ids: ready.map((u) => u.id), target: target.id });
      if (!enemyAir && freeFighters.length) issue({ t: 'move', p: p.id, ids: freeFighters.map((u) => u.id), x: target.x, y: target.y, amove: true });
      mem.sortie = s.tick;
    }
  }
}

/** How many of a rival's buildings go dark if this coil falls (#231): in its field and in no other coil's. 0 for anything but a finished coil. */
function darkened(s: GameState, b: Building): number {
  if (b.type !== 'tower' || !b.built || !hasCoils(s.players[b.owner])) return 0;
  const r2 = LIGHTNING.reach * LIGHTNING.reach;
  const near = (a: Building, c: Building): boolean => (a.x - c.x) * (a.x - c.x) + (a.y - c.y) * (a.y - c.y) <= r2;
  let n = 0;
  for (const o of s.ents) {
    if (o.kind !== 'building' || o.owner !== b.owner || o.hp <= 0 || o === b || !near(o, b)) continue;
    if (!s.ents.some((c) => c.kind === 'building' && c.type === 'tower' && c.owner === b.owner && c.built && c.hp > 0 && c !== b && near(o, c))) n++;
  }
  return n;
}

/** A building of the enemy's worth bombing: their nearest Town Center, or any building known. */
export function enemyTarget(s: GameState, p: Player): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  const hemo = !p.ai || AI_LEVELS[p.ai].hemo !== false;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !isEnemy(s, p.id, e.owner) || !p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
    if (e.type === 'wall' || e.type === 'gate' || e.type === 'farm') continue;
    const dx = e.x - p.startX;
    const dy = e.y - p.startY;
    const holds = e.type === 'temple' && s.relics.some((r) => r.temple === e.id);
    const shrine = holds && relicRace(s, p);
    // A pilgrim people's wealth is the relics in its Temples (#50): they come before its Town Center.
    // A Bell Foundry people's relics pay it 50% more gold (#224), so its Temples are worth the same pull on any road (#242).
    const pilgrims = holds && (ageOf(s.players[e.owner]) === 'pilgrim' || s.players[e.owner].techs.includes('bellFoundry'));
    // A Transfusion Station keeps a Hemocraft army fed (#355 s5): bring it down and the army crashes. A Blood Tower is half the pull.
    const blood = !hemo ? 0 : e.type === 'transfusion' ? AI_HEMO.bomb : e.type === 'bloodtower' ? AI_HEMO.bomb / 2 : 0;
    // On a feast day a rival's fairground Market is where the gold is (#379): raid it while the purse is full.
    const feast = e.type === 'market' && e.built && ageDef(s.players[e.owner]).fairs && feastOpen(s) && fairground(s, e.owner, e) ? AI_FAIR.raid : 0;
    const d = dx * dx + dy * dy - blood - feast + (e.type === 'wonder' || shrine ? -1e6 : pilgrims ? -AI_WEB.bell : e.type === 'towncenter' ? -400 : -AI_LIGHTNING.raid * darkened(s, e));
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function pickUnit(v: View, mem: AiMemory, building: Building): UnitType | null {
  const trains = lines(v.p, building).filter((t) => t !== 'citizen' && t !== 'hero' && unitEpoch(t) <= v.p.epoch && !barred(v.p, t, building.type));
  if (!trains.length) return null;
  return trains[mem.unitTurn++ % trains.length];
}

/** The line that fares best against an arm, by the counter triangle, among those its age allows. */
function bestAllowed(p: Player, arm: 'infantry' | 'ranged' | 'cavalry'): UnitType | null {
  let best: UnitType | null = null;
  let edge = 0;
  for (const u of ['infantry', 'ranged', 'cavalry'] as const) {
    if (barred(p, u) || unitEpoch(u) > p.epoch) continue;
    const e = BONUS[u][arm] / BONUS[arm][u];
    if (e > edge) {
      edge = e;
      best = u;
    }
  }
  return best;
}

/** The soldiers a building gives an army: its own lines, or at a hiring building (the merchants' Market, #37) the hired ones. */
function lines(p: Player, b: Building): UnitType[] {
  const hires = hiresAt(p, b.type);
  return hires.length ? hires : BUILDINGS[b.type].trains;
}

/** What the enemy fields most of, to counter it. */
function enemyMix(s: GameState, p: Player): Record<'infantry' | 'ranged' | 'cavalry', number> {
  const mix = { infantry: 0, ranged: 0, cavalry: 0 };
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    if (e.type === 'infantry' || e.type === 'ranged' || e.type === 'cavalry') mix[e.type]++;
  }
  return mix;
}

/** The computer's own Wonder while it rises or counts down: the one it has to hold (#374). */
function ownWonder(v: View): Building | null {
  return v.buildings.find((b) => b.type === 'wonder' && b.hp > 0 && (!b.built || b.timer >= 0)) ?? null;
}

/** The nearest rival soldier within `AI_WONDER.reach` tiles of the Wonder. */
function wonderThreat(s: GameState, p: Player, w: Building): Unit | null {
  let best: Unit | null = null;
  let bestD = AI_WONDER.reach;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, p.id, e.owner) || e.type === 'citizen' || e.type === 'trader') continue;
    const d = distToRect(e.x, e.y, w);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Enemy soldiers close to home, and the nearest of them. */
function threatNear(s: GameState, v: View): { unit: Unit | null; count: number; dist: number } {
  let threat: Unit | null = null;
  let threatD = Infinity;
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, v.p.id, e.owner) || e.type === 'citizen' || e.type === 'trader') continue;
    let near = Infinity;
    // Snares out in the woods (#485) are not the town: foes by them don't ring its bell.
    for (const b of v.buildings) if (b.type !== 'snare') near = Math.min(near, distToRect(e.x, e.y, b));
    if (near < 12) {
      n++;
      if (near < threatD) {
        threatD = near;
        threat = e;
      }
    }
  }
  return { unit: threat, count: n, dist: threatD };
}

/**
 * The people's great work (seed #133), called once an epoch: a trading or farming people spends it while
 * its town is busy at it, a fighting people when a wave marches out or a raid reaches its town.
 */
function greatWork(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  if (!AI_LEVELS[p.ai!].clever || workProblem(s, p)) return;
  const w = WORKS[p.civ];
  const busy = p.civ === 'chinese' ? v.traders.length >= 3 : v.hands >= 14;
  const fight = (mem.attacking && v.army.length >= 6) || threatNear(s, v).count >= 4;
  if (w.mul?.farm && flooded(s, p.id)) return; // a farming work is wasted while the fields lie under the river
  if (w.use === 'eco' ? busy : fight) issue({ t: 'greatWork', p: p.id });
}

/** A clever computer lights a tower's beacon when three or more rival soldiers close in on it: it sees farther, and the flame is seen by all. */
function lightBeacons(s: GameState, v: View, issue: (c: Command) => void): void {
  if (!AI_LEVELS[v.p.ai!].clever) return;
  for (const b of v.buildings) {
    if (b.type !== 'tower' || beaconProblem(s, v.p, b)) continue;
    let n = 0;
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, v.p.id, e.owner) || e.type === 'citizen' || e.type === 'trader') continue;
      if (distToRect(e.x, e.y, b) < 12 && ++n >= 3) break;
    }
    if (n >= 3 || flameNear(s, v, b)) {
      issue({ t: 'beacon', p: v.p.id, building: b.id });
      return;
    }
  }
}

/** Whether a web-walking Industrial computer means to take the road to lightning (#231): it raises no Airfield then. */
function lightningBound(s: GameState, v: View, mem: AiMemory): boolean {
  const here = ageOf(v.p);
  if (here === 'lightning') return true;
  return here === 'industrial' && walksWeb(v) && roadsFrom(v.p).some((r) => r.to === 'lightning') && wants(s, v.p, mem, 'lightning');
}

/** Bound for lightning, it lights a tower's beacon every `AI_LIGHTNING.every` seconds until the road's deed is done (#231). */
function beaconsForLightning(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  if (ageOf(p) !== 'industrial' || !lightningBound(s, v, mem)) return;
  const road = roadsFrom(p).find((r) => r.to === 'lightning');
  if (!road || deedsDone(p, road, s) || s.tick - (mem.zap ?? -99999) < secs(AI_LIGHTNING.every)) return;
  const b = v.buildings.find((e) => e.type === 'tower' && !beaconProblem(s, p, e));
  if (!b) return;
  issue({ t: 'beacon', p: p.id, building: b.id });
  mem.zap = s.tick;
}

/** A clever computer's hero cries out when the lines have met: at least four of its soldiers beside the hero and a rival soldier in reach. */
function rallyTheLine(s: GameState, v: View, issue: (c: Command) => void): void {
  if (!AI_LEVELS[v.p.ai!].clever) return;
  for (const h of s.ents) {
    if (h.kind !== 'unit' || h.type !== 'hero' || h.owner !== v.p.id || rallyProblem(s, v.p, h)) continue;
    let mine = 0, foes = 0;
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || e.inside || e.id === h.id) continue;
      const dx = e.x - h.x, dy = e.y - h.y;
      if (dx * dx + dy * dy > RALLY.radius * RALLY.radius) continue;
      if (e.owner === v.p.id) { if (e.type !== 'citizen' && e.type !== 'trader' && e.type !== 'priest') mine++; }
      else if (isEnemy(s, v.p.id, e.owner) && e.type !== 'citizen' && e.type !== 'trader') foes++;
    }
    if (mine >= 4 && foes >= 2) issue({ t: 'cry', p: v.p.id, id: h.id });
  }
}

/** A rival's beacon that this player can see burning, within `AI_RAID.flame` tiles of the tower: its army is on the move near us, so we answer the flame. */
function flameNear(s: GameState, v: View, tower: Building): boolean {
  const r2 = AI_RAID.flame * AI_RAID.flame;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'tower' || e.hp <= 0 || !isEnemy(s, v.p.id, e.owner) || !lit(s, e) || !sees(s, v.p.id, e.x, e.y)) continue;
    const dx = e.x - tower.x, dy = e.y - tower.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

function townBell(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  // A warband does not hide (#463 s1): its bell does not ring.
  if (!AI_LEVELS[v.p.ai!].clever || !v.tc || (v.p.way && WAYS[v.p.way].noBell)) return;
  const bell = AI_LEVELS[v.p.ai!].bell;
  const t = threatNear(s, v);
  const defenders = v.army.filter((u) => !u.inside).length;
  if (mem.bell < 0 && t.count >= bell.ring && defenders < t.count / 2) {
    issue({ t: 'bell', p: v.p.id, ring: true });
    mem.bell = s.tick;
    mem.bellNear = t.dist;
    mem.bellMoved = s.tick;
  } else if (mem.bell >= 0 && t.dist < (mem.bellNear ?? Infinity) - 1) {
    mem.bellNear = t.dist;
    mem.bellMoved = s.tick;
  } else if (mem.bell >= 0 && s.tick - mem.bell > secs(bell.hold) && (t.count <= bell.quiet || (t.dist >= AI_BELL.far && s.tick - (mem.bellMoved ?? mem.bell) > secs(AI_BELL.stale)))) {
    // Or a siege that has stopped coming (#487): foes parked outside the Town Center's reach for a minute
    // kept a whole town sheltered for eight minutes. Anyone who steps closer starts the minute afresh.
    // A straggler or two is the Town Center's arrows to deal with (#113): waiting for none at all, a
    // beaten town kept fifteen citizens inside for nine minutes while a rival's trickle came and went.
    issue({ t: 'bell', p: v.p.id, ring: false });
    mem.bell = -1;
    mem.bellNear = undefined;
  }
}

/** An Old Ford we keep, on the way to the rival (within `AI_RAID.stage` of home and nearer to it than home is): waves muster there. */
export function stagingFord(s: GameState, owner: number, home: { x: number; y: number }, enemy: { x: number; y: number }): Landmark | null {
  let best: Landmark | null = null;
  let bd = Infinity;
  const homeEnemy = (enemy.x - home.x) * (enemy.x - home.x) + (enemy.y - home.y) * (enemy.y - home.y);
  for (const m of s.landmarks ?? []) {
    if (m.kind !== 'ford' || m.owner !== owner) continue;
    const d = (m.x - home.x) * (m.x - home.x) + (m.y - home.y) * (m.y - home.y);
    if (d > AI_RAID.stage * AI_RAID.stage || d < 64) continue;
    if ((enemy.x - m.x) * (enemy.x - m.x) + (enemy.y - m.y) * (enemy.y - m.y) >= homeEnemy) continue;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/** Whether the people is in Iron and Blood or Total War, the ages of War Camps. */
const atWar = (p: Player): boolean => ageOf(p) === 'ironblood' || ageOf(p) === 'totalwar';

/**
 * The muster camp (#315): a people at war keeps a War Camp at home, near the Town Center: in Iron and Blood it trains
 * the foot soldiers Total War asks as its deed (while the road is wanted), in Total War it is the ground citizens are
 * called to arms at. Foot soldiers at home pitch it; one at a time, and not again for `again` seconds.
 */
function pitchHomeCamp(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  if (!atWar(p) || buildBarred(p, 'warcamp') || v.buildings.some((b) => b.type === 'warcamp')) return;
  if (ageOf(p) === 'ironblood' && !wants(s, p, mem, 'totalwar')) return;
  const blood = (mem.blood ??= {});
  if (blood.muster !== undefined && s.tick - blood.muster < secs(AI_BLOOD.again)) return;
  const r2 = (AI_BLOOD.home + 8) * (AI_BLOOD.home + 8);
  const crew = v.army.filter((u) => u.type === 'infantry' && !u.inside && (u.x - v.home.x) * (u.x - v.home.x) + (u.y - v.home.y) * (u.y - v.home.y) <= r2).sort((a, b) => a.id - b.id).slice(0, 3);
  if (!crew.length) return;
  const cost = buildingCostFor(s, p.id, 'warcamp');
  if (!afford(v, cost)) return;
  const spot = findSpot(s, 'warcamp', v.home.x, v.home.y, AI_BLOOD.home - 3, AI_BLOOD.home + 6);
  if (!spot) return;
  issue({ t: 'build', p: p.id, ids: crew.map((u) => u.id), type: 'warcamp', tx: spot.tx, ty: spot.ty });
  spend(v, cost);
  blood.muster = s.tick;
}

/**
 * The call to arms (#315): in Total War, with `foes` or more enemy soldiers within `alarm` tiles of the Town Center,
 * the camp nearest them calls up the citizens round it, up to `CALL_UP.most`, always leaving `held` citizens at work.
 */
function callToArms(s: GameState, v: View, issue: (c: Command) => void): void {
  const { p } = v;
  if (ageOf(p) !== 'totalwar') return;
  const spare = v.citizens.length - AI_BLOOD.held;
  if (spare < 1) return;
  const a2 = AI_BLOOD.alarm * AI_BLOOD.alarm;
  let fx = 0;
  let fy = 0;
  let foes = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, p.id, e.owner) || e.type === 'citizen' || e.type === 'priest' || e.type === 'trader' || domainOf(e.type) !== 'land') continue;
    if ((e.x - v.home.x) * (e.x - v.home.x) + (e.y - v.home.y) * (e.y - v.home.y) > a2) continue;
    fx += e.x;
    fy += e.y;
    foes++;
  }
  if (foes < AI_BLOOD.foes) return;
  fx /= foes;
  fy /= foes;
  let camp: Building | null = null;
  let bestD = Infinity;
  for (const b of v.buildings) {
    if (b.type !== 'warcamp' || callUpProblem(s, p, b)) continue;
    const d = (b.x - fx) * (b.x - fx) + (b.y - fy) * (b.y - fy);
    if (d < bestD) {
      bestD = d;
      camp = b;
    }
  }
  if (!camp) return;
  issue({ t: 'callUp', p: p.id, building: camp.id, n: Math.min(CALL_UP.most, spare) });
}

/**
 * The Warband's verb (#502): a soldier carrying `SPOILS.home` gold or more, and not mid-blow, turns for home to bank it, since a laden
 * soldier felled in the field hands its pack to the rival. Returns the soldiers still free for the wave.
 */
function haulHome(v: View, fighters: Unit[], issue: (c: Command) => void): Unit[] {
  const { p } = v;
  if (!ageDef(p).haul) return fighters;
  const laden = fighters.filter((u) => (u.spoils ?? 0) >= SPOILS.home && u.order.k !== 'attack');
  if (!laden.length) return fighters;
  const fresh = laden.filter((u) => !(u.order.k === 'move' && !u.order.amove)).map((u) => u.id);
  if (fresh.length) issue({ t: 'move', p: p.id, ids: fresh, x: v.home.x, y: v.home.y });
  const going = new Set(laden.map((u) => u.id));
  return fighters.filter((u) => !going.has(u.id));
}

/** Soldiers a War Camp counts as keepers: the people's land fighters, as `warcamp.ts` reads them. */
const campKeeper = (u: Unit): boolean => u.type !== 'citizen' && u.type !== 'priest' && u.type !== 'trader' && domainOf(u.type) === 'land';

/**
 * The Path of Blood (#307): soldiers left by each finished War Camp (`AI_BLOOD.keep`, in id order), so it
 * doesn't burn (`WARCAMP.grace`) and its trainees stay as its guard; the wave's orders pass them by.
 */
function campGuards(v: View): Set<number> {
  const guards = new Set<number>();
  if (!atWar(v.p)) return guards;
  const r2 = (WARCAMP.watch - 2) * (WARCAMP.watch - 2);
  for (const b of v.buildings) {
    if (b.type !== 'warcamp' || !b.built) continue;
    let n = 0;
    for (const u of v.army) {
      if (n >= AI_BLOOD.keep) break;
      if (u.inside || guards.has(u.id) || !campKeeper(u) || u.type === 'hero') continue;
      if ((u.x - b.x) * (u.x - b.x) + (u.y - b.y) * (u.y - b.y) > r2) continue;
      guards.add(u.id);
      n++;
    }
  }
  return guards;
}

/**
 * The Path of Blood (#307): a wave that has marched to within `reach` tiles of the rival's home pitches a War
 * Camp where it stands, back from the Town Center's and Towers' arrows (`clear`), with its foot soldiers; its
 * trainees then rally to it. One camp at a time, and a burnt one is not pitched again for `again` seconds.
 */
function pitchCamp(s: GameState, v: View, mem: AiMemory, wave: Unit[], enemy: { x: number; y: number }, issue: (c: Command) => void): void {
  const { p } = v;
  if (!atWar(p) || buildBarred(p, 'warcamp')) return;
  // A camp already out at the front (not the muster camp at home) is enough.
  if (v.buildings.some((b) => b.type === 'warcamp' && (b.x - v.home.x) * (b.x - v.home.x) + (b.y - v.home.y) * (b.y - v.home.y) > (AI_BLOOD.home + 12) * (AI_BLOOD.home + 12))) return;
  const blood = (mem.blood ??= {});
  if (blood.camp !== undefined && s.tick - blood.camp < secs(AI_BLOOD.again)) return;
  const foot = wave.filter((u) => u.type === 'infantry' && !u.inside);
  if (foot.length < 3) return;
  let cx = 0;
  let cy = 0;
  for (const u of foot) {
    cx += u.x;
    cy += u.y;
  }
  cx /= foot.length;
  cy /= foot.length;
  if ((cx - enemy.x) * (cx - enemy.x) + (cy - enemy.y) * (cy - enemy.y) > AI_BLOOD.reach * AI_BLOOD.reach) return;
  const cost = buildingCostFor(s, p.id, 'warcamp');
  if (!afford(v, cost)) return;
  const clear2 = AI_BLOOD.clear * AI_BLOOD.clear;
  const spot = findSpot(s, 'warcamp', cx, cy, 0, 5, 1, (tx, ty) => {
    const x = tx + 1;
    const y = ty + 1;
    return !s.ents.some((e) => e.kind === 'building' && e.hp > 0 && e.built && isEnemy(s, p.id, e.owner) && (e.type === 'towncenter' || e.type === 'tower') && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) <= clear2);
  });
  if (!spot) return;
  const crew = foot.sort((a, b) => (a.x - spot.tx) * (a.x - spot.tx) + (a.y - spot.ty) * (a.y - spot.ty) - ((b.x - spot.tx) * (b.x - spot.tx) + (b.y - spot.ty) * (b.y - spot.ty)) || a.id - b.id).slice(0, 4);
  issue({ t: 'build', p: p.id, ids: crew.map((u) => u.id), type: 'warcamp', tx: spot.tx, ty: spot.ty });
  spend(v, cost);
  blood.camp = s.tick;
}

/**
 * A forward Transfusion Station (#355 s5): once the wave's War Camp stands out at the front, a Station is raised beside it, so grafted
 * soldiers fight within `HEMO.reach` of a feed instead of running dry. One at a time, and not again for `AI_HEMO.again` seconds.
 */
function pitchStation(s: GameState, v: View, mem: AiMemory, wave: Unit[], issue: (c: Command) => void): void {
  const { p } = v;
  if (!hemoPlay(p) || ageOf(p) !== 'totalwar' || buildBarred(p, 'transfusion')) return;
  const far2 = (AI_BLOOD.home + 12) * (AI_BLOOD.home + 12);
  const camp = v.buildings.find((b) => b.type === 'warcamp' && b.built && b.hp > 0 && (b.x - v.home.x) * (b.x - v.home.x) + (b.y - v.home.y) * (b.y - v.home.y) > far2);
  if (!camp) return;
  const near2 = AI_HEMO.forward * AI_HEMO.forward;
  if (stationsOf(s, p.id).some((b) => (b.x - camp.x) * (b.x - camp.x) + (b.y - camp.y) * (b.y - camp.y) <= near2)) return;
  if (v.buildings.some((b) => b.type === 'transfusion' && !b.built)) return;
  if (s.tick - (mem.ordered.transfusion ?? -99999) < secs(AI_HEMO.again)) return;
  const foot = wave.filter((u) => u.type === 'infantry' && !u.inside);
  if (foot.length < 2) return;
  const spot = findSpot(s, 'transfusion', camp.x, camp.y, 2, AI_HEMO.forward - 2);
  if (!spot) return;
  const cost = raiseCost(s, p.id, 'transfusion', spot.tx, spot.ty);
  if (!afford(v, cost)) return;
  const d = (u: Unit) => (u.x - spot.tx) * (u.x - spot.tx) + (u.y - spot.ty) * (u.y - spot.ty);
  const crew = foot.sort((a, b) => d(a) - d(b) || a.id - b.id).slice(0, 3);
  issue({ t: 'build', p: p.id, ids: crew.map((u) => u.id), type: 'transfusion', tx: spot.tx, ty: spot.ty });
  spend(v, cost);
  mem.ordered.transfusion = s.tick;
}

/** The nearest rival War Camp the computer has seen within `AI_BLOOD.answer` tiles of home, or null. */
export function rivalWarCamp(s: GameState, p: Player, home: { x: number; y: number }): Building | null {
  let best: Building | null = null;
  let bestD = AI_BLOOD.answer * AI_BLOOD.answer;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'warcamp' || !e.built || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    if (!p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
    const d = (e.x - home.x) * (e.x - home.x) + (e.y - home.y) * (e.y - home.y);
    if (d >= bestD) continue;
    bestD = d;
    best = e;
  }
  return best;
}

// ---- Hemocraft (#355 s5) -------------------------------------------------------------------------------

/** Whether a people stands in a branch of the fork (#355 s2): Hemocraft or the Blood-rite. */
const forkAge = (p: Player): boolean => !!ageDef(p).hemocraft || !!ageDef(p).rite;

/** Whether the computer plays Hemocraft: a clever one in the ages of War Camps or on the fork past them (off only in `scripts/ai-ab.ts`). */
const hemoPlay = (p: Player): boolean => AI_LEVELS[p.ai!].clever && AI_LEVELS[p.ai!].hemo !== false && (atWar(p) || forkAge(p));

/**
 * What a rival's blood stands on, which machines go for: a Transfusion Station or Blood Tower, a Drain Rig that drains (Hemocraft), a
 * Temple that is an altar (the Blood-rite), and any rig or altar holding captives.
 */
function bloodWork(s: GameState, e: Building): boolean {
  if (HEMO_WORKS.includes(e.type)) return true;
  if (e.type !== 'drainrig' && e.type !== 'temple') return false;
  // A rig or altar holding captives (#355): razing it sets them free.
  if (e.captives?.length) return true;
  const age = ageDef(s.players[e.owner]);
  return e.type === 'drainrig' ? !!age.hemocraft : !!age.rite;
}

/** The buildings a rival's Hemocraft stands on, which machines go for. */
const HEMO_WORKS: readonly BuildingType[] = ['transfusion', 'bloodtower'];

/** A point `d` tiles from home toward `to`, or `to` itself when it is nearer. */
function toward(home: { x: number; y: number }, to: { x: number; y: number }, d: number): { x: number; y: number } {
  const dx = to.x - home.x;
  const dy = to.y - home.y;
  const l = Math.sqrt(dx * dx + dy * dy);
  return l <= d ? { x: to.x, y: to.y } : { x: home.x + (dx / l) * d, y: home.y + (dy / l) * d };
}

/** Where rival living soldiers come near home: the middle of `AI_HEMO.foes` or more within `watch` tiles, kept in memory. */
function noteFoes(s: GameState, v: View, mem: AiMemory): void {
  const r2 = AI_HEMO.watch * AI_HEMO.watch;
  let fx = 0;
  let fy = 0;
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, v.p.id, e.owner) || !GRAFTABLE.includes(e.type)) continue;
    if ((e.x - v.home.x) * (e.x - v.home.x) + (e.y - v.home.y) * (e.y - v.home.y) > r2) continue;
    fx += e.x;
    fy += e.y;
    n++;
  }
  if (n >= AI_HEMO.foes) (mem.blood ??= {}).foe = { x: fx / n, y: fy / n };
}

/** The share of the rivals' fighters that bleed (1 when they field none): a Blood Tower is worth its blood only against the living. */
function livingShare(s: GameState, p: Player): number {
  let living = 0;
  let machines = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    if (GRAFTABLE.includes(e.type)) living++;
    else if (e.type === 'siege' || e.type === 'warship' || e.type === 'fighter' || e.type === 'bomber') machines++;
  }
  return living + machines ? living / (living + machines) : 1;
}

/** Whether it still wants a Blood Tower: fewer than `towers`, rival living soldiers come, and the rival's army mostly bleeds. */
function towerWanted(s: GameState, v: View, mem: AiMemory): boolean {
  return !!mem.blood?.foe && count(v, 'bloodtower') < (forkAge(v.p) ? AI_FORK.towers : AI_HEMO.towers) && !buildBarred(v.p, 'bloodtower') && livingShare(s, v.p) >= AI_HEMO.living;
}

/**
 * The town's Hemocraft (#355 s5), one building a think: a Drain Rig toward where the rival's soldiers come (so the dead of the fights at
 * home bleed into its store), in Total War a Transfusion Station by the muster point, and Blood Towers where living armies come, each
 * once its blood is in store. Short of the blood for a tower, it gives citizens to the levy.
 */
function hemoBuild(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  if (!hemoPlay(p)) return;
  noteFoes(s, v, mem);
  // A town still growing spends its wood and hands on the town first.
  if (v.citizens.length < AI_HEMO.town) return;
  const recently = (type: BuildingType, t: number) => s.tick - (mem.ordered[type] ?? -99999) < secs(t);
  const foe = mem.blood?.foe ?? enemyHome(s, p);
  if (count(v, 'drainrig') === 0 && !buildBarred(p, 'drainrig') && !recently('drainrig', AI_HEMO.again)) {
    const at = toward(v.home, foe, AI_HEMO.rig);
    const spot = findSpot(s, 'drainrig', at.x, at.y, 0, 8);
    if (spot && construct(s, v, mem, 'drainrig', spot, 2, issue)) return;
  }
  if (forkBuild(s, v, mem, issue)) return;
  if ((ageOf(p) === 'totalwar' || ageOf(p) === 'hemocraft') && v.army.length >= AI_HEMO.army && count(v, 'transfusion') === 0 && !buildBarred(p, 'transfusion') && !recently('transfusion', AI_HEMO.again)) {
    const at = mem.muster ?? toward(v.home, enemyHome(s, p), 8);
    const spot = findSpot(s, 'transfusion', at.x, at.y, 2, 8);
    if (spot && construct(s, v, mem, 'transfusion', spot, 3, issue)) return;
  }
  if (!towerWanted(s, v, mem) || recently('bloodtower', AI_HEMO.gap)) return;
  const short = BUILDINGS.bloodtower.blood! - bloodOf(p);
  if (short > 0) {
    bleedTown(s, v, mem, short, issue);
    return;
  }
  const at = toward(v.home, mem.blood!.foe!, AI_HEMO.tower);
  const r2 = AI_HEMO.spread * AI_HEMO.spread;
  const spot = findSpot(s, 'bloodtower', at.x, at.y, 0, 6, 1, (tx, ty) => !v.buildings.some((b) => b.type === 'bloodtower' && (b.x - tx - 1) * (b.x - tx - 1) + (b.y - ty - 1) * (b.y - ty - 1) < r2));
  if (spot) construct(s, v, mem, 'bloodtower', spot, 2, issue);
}

/**
 * The fork (#355 s5), one building a think, and the levy it wants. Bound for the rite in Total War, a full town gives citizens to the levy
 * for the road's deed. In Hemocraft a second Drain Rig stands out where rival soldiers come (else toward the rival), so the Blood Towers
 * raised there ring it and whoever fights them bleeds into the store. In the rite, a second Temple stands `AI_FORK.altar` tiles out the
 * same way, an altar the army musters by, and while the store is under `AI_FORK.store` a full town gives the levy, to mend with.
 */
function forkBuild(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): boolean {
  const { p } = v;
  const here = ageOf(p);
  const foe = mem.blood?.foe ?? enemyHome(s, p);
  const recently = (type: BuildingType, t: number) => s.tick - (mem.ordered[type] ?? -99999) < secs(t);
  if (here === 'totalwar' && mem.roads?.bloodrite) {
    const road = forkRoad(s, p, mem);
    if (road && !deedsDone(p, road, s)) bleedTown(s, v, mem, BLOOD.levy, issue, true);
    return false;
  }
  if (!forkAge(p)) return false;
  const spread = (type: BuildingType) => (tx: number, ty: number) => !v.buildings.some((b) => b.type === type && (b.x - tx - 1) * (b.x - tx - 1) + (b.y - ty - 1) * (b.y - ty - 1) < AI_HEMO.spread * AI_HEMO.spread);
  if (ageDef(p).rite) {
    if (bloodOf(p) < AI_FORK.store) bleedTown(s, v, mem, AI_FORK.store - bloodOf(p), issue);
    if (count(v, 'temple') >= AI_FORK.altars || buildBarred(p, 'temple') || recently('temple', AI_HEMO.again)) return false;
    const at = toward(v.home, foe, AI_FORK.altar);
    const spot = findSpot(s, 'temple', at.x, at.y, 0, 6, 1, spread('temple'));
    return !!spot && construct(s, v, mem, 'temple', spot, 3, issue);
  }
  if (count(v, 'drainrig') >= AI_FORK.rigs || buildBarred(p, 'drainrig') || recently('drainrig', AI_HEMO.again)) return false;
  const at = toward(v.home, foe, AI_HEMO.tower);
  const spot = findSpot(s, 'drainrig', at.x, at.y, 0, 6, 1, spread('drainrig'));
  return !!spot && construct(s, v, mem, 'drainrig', spot, 2, issue);
}

/** The Blood-rite's forward altar (#355 s5): the built Temple nearest the front (where rival soldiers come), when it stands nearer it than home does; else null. */
function forwardAltar(v: View, enemy: { x: number; y: number }): Building | null {
  if (!ageDef(v.p).rite) return null;
  let best: Building | null = null;
  let bestD = (enemy.x - v.home.x) * (enemy.x - v.home.x) + (enemy.y - v.home.y) * (enemy.y - v.home.y);
  for (const b of v.buildings) {
    if (b.type !== 'temple' || !b.built || b.hp <= 0) continue;
    const d = (enemy.x - b.x) * (enemy.x - b.x) + (enemy.y - b.y) * (enemy.y - b.y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/**
 * The levy (#355 s5), when it pays: `short` blood is wanted for a graft or a tower, and the town is within `AI_HEMO.spare` of the
 * citizens it wants (never under `AI_BLOOD.held`), with the food to train them again. The citizens nearest the rig give their blood;
 * with none in its reach, the nearest free ones walk over, and the next think takes them. For a road's `deed` (the Blood-rite's), one
 * citizen at a time goes even with no food to spare: the town trains the one back when it can.
 */
function bleedTown(s: GameState, v: View, mem: AiMemory, short: number, issue: (c: Command) => void, deed = false): void {
  const { p } = v;
  const blood = (mem.blood ??= {});
  if (blood.levy !== undefined && s.tick - blood.levy < secs(AI_HEMO.levyGap)) return;
  const want = Math.min(AI_LEVELS[p.ai!].citizens + p.epoch * 3, 60);
  const spare = v.citizens.length - Math.max(AI_BLOOD.held, want - AI_HEMO.spare);
  const n = Math.min(spare, deed ? 1 : BLOOD.levyMost, Math.ceil(short / BLOOD.levy));
  if (n < 1 || (!deed && v.budget.food < unitStats('citizen', p.epoch).cost.food! * n)) return;
  const rig = v.buildings.find((b) => b.type === 'drainrig' && b.built && b.hp > 0);
  if (!rig || levyWait(s, rig) > 0) return;
  blood.levy = s.tick;
  if (!levyProblem(s, p, rig)) {
    issue({ t: 'callUp', p: p.id, building: rig.id, n });
    return;
  }
  const free = v.citizens.filter((u) => !u.inside && u.order.k !== 'build' && !(u.order.k === 'farm' && u.order.phase === 'work') && !v.diggers.has(u.id) && !v.claimers.has(u.id));
  const d = (u: Unit) => (u.x - rig.x) * (u.x - rig.x) + (u.y - rig.y) * (u.y - rig.y);
  const walkers = free.sort((a, b) => d(a) - d(b) || a.id - b.id).slice(0, n);
  if (walkers.length) issue({ t: 'move', p: p.id, ids: walkers.map((u) => u.id), x: rig.x, y: rig.y + rig.size / 2 + 1 });
}

/**
 * Grafting between waves (#355 s5): the idle soldiers within `AI_HEMO.near` tiles of a Transfusion Station go inside, as many as there
 * is room and blood for; the Station opens its doors once it has grafted them all. Short of the blood for `batch` of them, the town gives
 * citizens to the levy. Returns the soldiers sent in, so the rest of the turn leaves them be.
 */
function transfuse(s: GameState, v: View, mem: AiMemory, ready: Unit[], issue: (c: Command) => void): Set<number> {
  const sent = new Set<number>();
  const { p } = v;
  if (!hemoPlay(p)) return sent;
  const r2 = AI_HEMO.near * AI_HEMO.near;
  const cost = graftCost(p);
  let blood = bloodOf(p);
  for (const b of stationsOf(s, p.id)) {
    const heading = v.army.filter((u) => u.order.k === 'garrison' && u.order.target === b.id).length;
    blood -= (waiting(s, b).length + heading) * cost;
    const room = BUILDINGS.transfusion.garrison! - b.garrison.length - heading;
    const near = ready.filter((u) => GRAFTABLE.includes(u.type) && !sent.has(u.id) && !grafted(s, u) && (u.x - b.x) * (u.x - b.x) + (u.y - b.y) * (u.y - b.y) <= r2);
    const want = Math.min(room, near.length);
    if (want <= 0) continue;
    const free = Math.max(0, blood);
    const n = Math.min(want, Math.floor(free / cost));
    if (n < want && want >= AI_HEMO.batch) bleedTown(s, v, mem, want * cost - free, issue);
    if (n <= 0) continue;
    const d = (u: Unit) => (u.x - b.x) * (u.x - b.x) + (u.y - b.y) * (u.y - b.y);
    const go = near.sort((a, c) => d(a) - d(c) || a.id - c.id).slice(0, n);
    issue({ t: 'garrison', p: p.id, ids: go.map((u) => u.id), target: b.id });
    for (const u of go) sent.add(u.id);
    blood -= n * cost;
  }
  return sent;
}

/** Whether a soldier is on its way into one of its people's Transfusion Stations. */
function bound(s: GameState, u: Unit): boolean {
  if (u.order.k !== 'garrison') return false;
  const b = s.byId.get(u.order.target);
  return !!b && b.kind === 'building' && b.type === 'transfusion';
}

/** A Station whose soldiers inside wait on blood it hasn't got opens its doors: they are wanted out here more than in there. */
function openStations(s: GameState, v: View, issue: (c: Command) => void): void {
  if (!hemoPlay(v.p)) return;
  for (const b of stationsOf(s, v.p.id)) {
    if (b.muster !== undefined || !waiting(s, b).length || bloodOf(v.p) >= graftCost(v.p)) continue;
    issue({ t: 'ungarrison', p: v.p.id, building: b.id });
  }
}

/** The rival blood work (`bloodWork`) seen nearest a point within `r` tiles (a Station counts as `AI_HEMO.spread` tiles nearer), or null. */
export function hemoTarget(s: GameState, p: Player, x: number, y: number, r: number): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !isEnemy(s, p.id, e.owner) || !bloodWork(s, e)) continue;
    if (!p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
    const d = Math.sqrt((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y));
    if (d > r) continue;
    const rank = d - (e.type === 'transfusion' ? AI_HEMO.spread : 0);
    if (rank < bestD) {
      bestD = rank;
      best = e;
    }
  }
  return best;
}

/** A rival blood work (`bloodWork`) seen that a warship can shell from the water, nearest the dock first, or null. */
function shoreBlood(s: GameState, p: Player, dock: Building): Building | null {
  const range = Math.floor(unitStats('warship', p.epoch).range);
  let best: Building | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !isEnemy(s, p.id, e.owner) || !bloodWork(s, e) || !p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
    const d = (e.x - dock.x) * (e.x - dock.x) + (e.y - dock.y) * (e.y - dock.y);
    if (d >= bestD || !coastNear(s, e.x, e.y, range)) continue;
    bestD = d;
    best = e;
  }
  return best;
}

/** Whether a rival plays Hemocraft where the computer can see it: a blood work (`bloodWork`) seen, or `AI_HEMO.grafted` grafted soldiers in sight. */
function rivalBleeds(s: GameState, p: Player): boolean {
  let n = 0;
  for (const e of s.ents) {
    if (e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    const at = Math.floor(e.y) * s.w + Math.floor(e.x);
    if (e.kind === 'building' && p.seen[at] && bloodWork(s, e)) return true;
    if (grafted(s, e) && p.vis[at] === 1 && ++n >= AI_HEMO.grafted) return true;
  }
  return false;
}

/** The answer to a rival's Hemocraft (#355 s5): the siege marching with a wave goes for a blood work (`bloodWork`) near it. Machines are the counter. */
function machinesAtBlood(s: GameState, v: View, onAttack: Unit[], issue: (c: Command) => void): void {
  const by = new Map<number, number[]>();
  for (const u of onAttack) {
    if (u.type !== 'siege') continue;
    if (u.order.k === 'attack') {
      const t = s.byId.get(u.order.target);
      if (t && t.kind === 'building' && bloodWork(s, t)) continue;
    }
    const t = hemoTarget(s, v.p, u.x, u.y, AI_HEMO.hunt);
    if (!t) continue;
    const ids = by.get(t.id) ?? [];
    ids.push(u.id);
    by.set(t.id, ids);
  }
  for (const [target, ids] of [...by].sort((a, b) => a[0] - b[0])) issue({ t: 'attack', p: v.p.id, ids, target });
}

// ---- The Horde (#322) ----------------------------------------------------------------------------------

/** Rival soldiers (no citizens, priests or traders; no ships) standing within `r` tiles of a point. */
function foesWithin(s: GameState, p: Player, x: number, y: number, r: number): Unit[] {
  const out: Unit[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, p.id, e.owner) || e.type === 'citizen' || e.type === 'priest' || e.type === 'trader' || e.type === 'wagon' || domainOf(e.type) !== 'land') continue;
    if ((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) <= r * r) out.push(e);
  }
  return out;
}

/**
 * The horde exacts tribute (#322): idle riders (`riders` at least, up to `TRIBUTE.most`) ride to the rival land
 * nearest home that lies inside their supply, `clear` tiles from the rival's Town Centers and Towers, and stand
 * their ground there. The band comes home under `weary` riders or with `foes` rival soldiers within `alarm`
 * tiles. Returns the riders held there, whom the waves pass by.
 */
function exactTribute(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): Set<number> {
  const { p } = v;
  const held = new Set<number>();
  const st = mem.steppe;
  if (modsOf(s, p.id).tribute <= 0) {
    if (st?.band) delete st.band;
    return held;
  }
  const mine = (mem.steppe ??= {});
  const live = (mine.band ?? []).map((id) => s.byId.get(id)).filter((u): u is Unit => !!u && u.kind === 'unit' && u.hp > 0 && !u.inside);
  if (mine.band) {
    const at = mine.at ?? v.home;
    const foes = foesWithin(s, p, at.x, at.y, AI_HORDE.alarm);
    if (live.length < AI_HORDE.weary || foes.length > live.length) {
      // Losing: ride home, and stop standing.
      if (live.length) {
        issue({ t: 'stance', p: p.id, ids: live.map((u) => u.id), stance: 'aggressive' });
        issue({ t: 'move', p: p.id, ids: live.map((u) => u.id), x: mem.muster?.x ?? v.home.x, y: mem.muster?.y ?? v.home.y });
      }
      delete mine.band;
      delete mine.at;
      mine.recalled = s.tick;
      return held;
    }
    mine.band = live.map((u) => u.id);
    // On arrival, stand the ground.
    const near = live.filter((u) => (u.x - at.x) * (u.x - at.x) + (u.y - at.y) * (u.y - at.y) <= 25 && u.stance !== 'stand');
    if (near.length) issue({ t: 'stance', p: p.id, ids: near.map((u) => u.id), stance: 'stand' });
    for (const u of live) held.add(u.id);
    return held;
  }
  if (s.tick < s.peaceUntil || s.tick - (mine.recalled ?? -1e9) < secs(AI_HORDE.redo) || mem.attacking || !v.tc) return held;
  const riders = v.army.filter((u) => u.type === 'cavalry' && !u.inside && u.order.k === 'idle' && isRider(u) && standing(u)).sort((a, b) => a.id - b.id);
  // A people born on the move (#501), off the Steppe Road, sends a smaller band and stands it past its own supply: it takes stone
  // as well as gold, and needs it from the Bronze Age. In the Horde it rides in force, as any horde does.
  const nomad = isNomad(p) && !ageDef(p).mobile;
  if (riders.length < (nomad ? NOMAD.aiRiders : AI_HORDE.riders)) return held;
  // The nearest rival with gold (or, for a nomad people, stone), and a spot of its land on our side of its Town Center.
  const own = borderMap(s);
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const b of s.ents) {
    if (b.kind !== 'building' || b.type !== 'towncenter' || !b.built || b.hp <= 0 || !isEnemy(s, p.id, b.owner) || (s.players[b.owner].res.gold < 50 && !(nomad && s.players[b.owner].res.stone >= 50))) continue;
    const dx = v.home.x - b.x;
    const dy = v.home.y - b.y;
    const dl = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dl >= bestD) continue;
    for (let r = AI_HORDE.clear; r <= AI_HORDE.clear + 8; r++) {
      const x = b.x + (dx / dl) * r;
      const y = b.y + (dy / dl) * r;
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h || own[ty * s.w + tx] !== b.owner || !walkable(s, tx, ty) || (!nomad && !suppliedAt(s, own, p.team, tx, ty))) continue;
      const covered = s.ents.some((e) => e.kind === 'building' && e.hp > 0 && e.built && e.owner === b.owner && (e.type === 'towncenter' || e.type === 'tower') && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) < AI_HORDE.clear * AI_HORDE.clear);
      if (covered || foesWithin(s, p, x, y, AI_HORDE.alarm).length >= AI_HORDE.foes) continue;
      best = { x, y };
      bestD = dl;
      break;
    }
  }
  if (!best) return held;
  const band = riders.slice(0, TRIBUTE.most);
  // A plain move, not an attack-move: the band is there for the gold, and a Town Center's arrows are no place for a fight.
  issue({ t: 'move', p: p.id, ids: band.map((u) => u.id), x: best.x, y: best.y });
  mine.band = band.map((u) => u.id);
  mine.at = best;
  mine.out = s.tick;
  for (const u of band) held.add(u.id);
  return held;
}

/**
 * A computer whose gold riders drain (#322): `answer` or more rival riders standing in its land, with its army
 * at least as many, ride out to drive them off. True when it gave the order. The riders on the move are met by
 * the spears its trainers already pick for a rival's horse (`COUNTER`).
 */
function answerRiders(s: GameState, v: View, fighters: Unit[], issue: (c: Command) => void): boolean {
  const { p } = v;
  if (!s.players.some((q) => !q.defeated && isEnemy(s, p.id, q.id) && modsOf(s, q.id).tribute > 0)) return false;
  const riders: Unit[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, p.id, e.owner) || !isRider(e) || !standing(e) || modsOf(s, e.owner).tribute <= 0) continue;
    if (landOwnerAt(s, Math.floor(e.x), Math.floor(e.y)) === p.id) riders.push(e);
  }
  if (riders.length < AI_HORDE.answer) return false;
  const ready = fighters.filter((u) => u.order.k === 'idle' && u.type !== 'siege');
  if (ready.length < riders.length) return false;
  const x = riders.reduce((n, u) => n + u.x, 0) / riders.length;
  const y = riders.reduce((n, u) => n + u.y, 0) / riders.length;
  issue({ t: 'move', p: p.id, ids: ready.map((u) => u.id), x, y, amove: true });
  return true;
}

function military(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  const L = AI_LEVELS[p.ai!];
  const enemy = v.plan.target ?? enemyHome(s, p);
  const dx = enemy.x - v.home.x;
  const dy = enemy.y - v.home.y;
  const dl = Math.sqrt(dx * dx + dy * dy) || 1;
  mem.muster = { x: v.home.x + (dx / dl) * 8, y: v.home.y + (dy / dl) * 8 };
  const ford = L.clever ? stagingFord(s, p.id, v.home, enemy) : null;
  if (ford) mem.muster = { x: ford.x, y: ford.y };
  // The Blood-rite (#355 s5) gathers its army by its forward altar, where the hurt are mended and the fallen foe pays blood.
  const front = mem.blood?.foe ?? enemy;
  const altar = L.clever && L.hemo !== false ? forwardAltar(v, front) : null;
  if (altar) mem.muster = toward(altar, front, 3);

  // A hero to lead the army.
  if (L.clever && v.tc && v.army.length >= 6 && !heroBusy(s, p.id) && v.tc.queue.length < 2 && v.tc.advance < 0) {
    const cost = unitStats('hero', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: v.tc.id, unit: 'hero' });
      spend(v, cost);
    }
  }

  // Train: counter the enemy's main arm when there is one to see, otherwise take turns. A rival on the
  // iron road (#50) fields cheap, hard-hitting foot and no horse: before its army shows, mass archers.
  const mix = enemyMix(s, p);
  const main = (Object.keys(mix) as (keyof typeof mix)[]).sort((a, b) => mix[b] - mix[a])[0];
  const ironRival = L.clever && rivalIn(s, p, ['iron']);
  let counter: UnitType | null = mix[main] >= 3 ? COUNTER[main] : ironRival ? COUNTER.infantry : null;
  // An age that bars the answer (the horse, in the Iron Age) answers with the best line it keeps (#79):
  // archers against archers, rather than foot that archers cut down twice as fast.
  if (counter && mix[main] >= 3 && barred(p, counter)) counter = bestAllowed(p, main);
  const counterOdds = ironRival && counter === COUNTER.infantry ? AI_WEB.read : 0.7;
  const answer = { archers: 0, others: 0 };
  const tally = (u: UnitType) => {
    if (u === COUNTER.infantry) answer.archers++;
    else if (u === 'infantry' || u === 'cavalry') answer.others++;
  };
  if (ironRival) {
    for (const u of v.army) tally(u.type);
    for (const b of v.buildings) for (const q of b.queue) if (q.unit) tally(q.unit);
  }
  const keepCitizensGrowing = v.citizens.length < (p.way === 'warband' ? AI_WAYS.barracksAt : 8);
  // A horde (#322) wants riders to stand in rival land: it trains them more often until it has a full band.
  const riderless = L.clever && modsOf(s, p.id).tribute > 0 && v.army.filter((u) => u.type === 'cavalry').length < TRIBUTE.most + 2;
  const siege = v.army.filter((u) => u.type === 'siege').length;
  // A rival with the Masons' Lodge raises sturdier buildings (+15%): one more engine to break them (#242).
  const lodge = L.clever && rivalHas(s, p, 'masonsLodge') ? AI_WEB.lodge : 0;
  // A rival on Hemocraft (#355 s5) is answered with machines: flesh can't stand its grafted soldiers, and its Stations are their lifeline.
  const bleeds = L.clever && L.hemo !== false && rivalBleeds(s, p) ? AI_HEMO.siege : 0;
  for (const b of v.buildings) {
    if (!b.built || b.queue.length >= Math.min(2, MAX_QUEUE) || keepCitizensGrowing) continue;
    const trains = lines(p, b);
    if (!trains.length || trains.includes('citizen') || b.type === 'dock' || b.type === 'airfield') continue;
    // Against a people of iron, archers come first (#50): the lines that don't answer its foot train only
    // while they number under half the archers.
    if (ironRival && b.type !== 'workshop' && b.type !== 'temple' && !trains.includes(COUNTER.infantry) && answer.others * 2 >= answer.archers) continue;
    // The Market hires (#37) only in an age that hires there, after the traders have had first call on its queue.
    if (b.type === 'market' && !hiresAt(p, b.type).length) continue;
    let unit: UnitType | null;
    if (b.type === 'workshop') unit = siege < Math.max(v.plan.siege, p.epoch >= 2 ? 3 : 2) + lodge + bleeds && (v.army.length >= 6 || siege < v.plan.siege) ? 'siege' : null;
    else if (b.type === 'temple') unit = v.priests.length < (ailing(p) ? SICKNESS.tendMost : 0) + (v.army.length >= 6 ? Math.max(consecrates(s, p.id) ? AI_FAITH.priests : 2, L.clever && ageDef(p).rite ? AI_FORK.priests : 0) : 0) + (looseRelics(s) > 0 ? 1 : 0) + (vigilPost(s, v) ? VIGIL.most : 0) ? 'priest' : null;
    else {
      unit = counter && trains.includes(counter) && unitEpoch(counter) <= p.epoch && !barred(p, counter, b.type) && roll(s) < counterOdds ? counter : pickUnit(v, mem, b);
      if (unit && unitEpoch(unit) > p.epoch) unit = pickUnit(v, mem, b);
      // Play to the people's strength: when not countering, favour the signature line about half the time.
      const sig = SIGNATURES[p.civ].type;
      if (unit !== counter && sig !== 'siege' && sig !== 'priest' && trains.includes(sig) && unitEpoch(sig) <= p.epoch && !barred(p, sig, b.type) && roll(s) < (sig === 'cavalry' && riderless ? AI_HORDE.cavalry : 0.5)) unit = sig;
    }
    // A legion's town keeps its hands in foot soldiers (#501): the barracks trains them until it has enough to work and fight.
    if (isLegion(p) && p.epoch <= LEGION.aiUntil && b.type === 'barracks' && trains.includes('infantry') && v.army.filter(legionHand).length < LEGION.aiHands + p.epoch * LEGION.aiHandsEpoch) unit = 'infantry';
    if (!unit || unitEpoch(unit) > p.epoch || barred(p, unit, b.type)) continue;
    // Just before a feast opens, a clever computer with an army in hand holds its muster at the fairground to buy it at the levy (#356).
    // What it costs here: a levy, an age's price or a hire for gold (#37).
    const cost = trainCostFor(s, p.id, unit, b.type, b);
    if (L.clever && feastSoon(s, p, unit, b, v.army.length, v.budget.gold, cost.gold ?? 0) && !threatNear(s, v).unit) continue;
    if (!afford(v, cost)) continue;
    // A sword for hire draws wages (`MERC`): hire it only with its keep, and the keep of every sword already hired, left in the purse.
    if (isHire(p, b.type, unit) && v.budget.gold < (cost.gold ?? 0) + AI_MERC.reserve * MERC.wage * (swordsOf(s, p.id).length + 1)) continue;
    issue({ t: 'train', p: p.id, building: b.id, unit });
    spend(v, cost);
    tally(unit);
    // A War Camp's trainees stay by it, its guard (#307).
    const rally = b.type === 'warcamp' ? { x: b.x, y: b.y + b.size / 2 + 1 } : mem.muster;
    if (!b.rally || Math.abs(b.rally.x - rally.x) > 1 || Math.abs(b.rally.y - rally.y) > 1) issue({ t: 'rally', p: p.id, building: b.id, x: rally.x, y: rally.y });
  }

  if (L.clever) callToArms(s, v, issue);
  if (L.clever) openStations(s, v, issue);
  // Defend: enemies near home draw the whole army.
  const threat = threatNear(s, v).unit;
  // Soldiers on their way to (or aboard) a landing ship are not the land army's to command.
  const sailing = new Set(mem.landing?.ids);
  const guards = L.clever ? campGuards(v) : new Set<number>();
  // The horde's riders in a rival's land (#322) are held there, out of the waves' orders.
  if (L.clever) for (const id of exactTribute(s, v, mem, issue)) guards.add(id);
  let fighters = v.army.filter((u) => !u.inside && !sailing.has(u.id) && !guards.has(u.id));
  if (L.clever && L.curseAnswer !== false) fighters = answerCurse(s, v, mem, fighters, issue);
  if (L.clever && L.breakOath !== false) breakOath(s, v, fighters, issue);
  // A Wonder of its own rising or counting down is held (#374): rivals near it draw the whole army, and a share of the army stays by it, out of the waves.
  const wonder = L.clever && L.wonderGuard !== false ? ownWonder(v) : null;
  if (wonder && !threat) {
    const foe = wonderThreat(s, p, wonder);
    if (foe) {
      const responders = fighters.filter((u) => u.order.k !== 'attack');
      if (responders.length) issue({ t: 'move', p: p.id, ids: responders.map((u) => u.id), x: foe.x, y: foe.y, amove: true });
      mem.attacking = false;
      return;
    }
    const n = Math.min(fighters.length, Math.max(AI_WONDER.least, Math.min(AI_WONDER.most, Math.ceil(fighters.length * AI_WONDER.share))));
    const post = fighters.slice(0, n);
    const strays = post.filter((u) => u.order.k === 'idle' && distToRect(u.x, u.y, wonder) > AI_WONDER.stay);
    if (strays.length) issue({ t: 'move', p: p.id, ids: strays.map((u) => u.id), x: wonder.x, y: wonder.y + wonder.size / 2 + 1, amove: true });
    const held = new Set(post.map((u) => u.id));
    fighters = fighters.filter((u) => !held.has(u.id));
  }
  if (threat) {
    const responders = fighters.filter((u) => u.order.k !== 'attack');
    if (responders.length) issue({ t: 'move', p: p.id, ids: responders.map((u) => u.id), x: threat.x, y: threat.y, amove: true });
    mem.attacking = false;
    return;
  }

  // A horde's riders wait at home for their band (#322): the waves leave them be until it sets out. A people born on the move (#501),
  // off the Steppe Road, gathers a smaller band, and a merchant rival's trade road calls its riders out before it.
  const gathering = isNomad(p) && !ageDef(p).mobile ? !watchPost(s, p) && fighters.filter((u) => u.type === 'cavalry').length < NOMAD.aiRiders : fighters.filter((u) => u.type === 'cavalry').length < TRIBUTE.most;
  if (L.clever && !mem.steppe?.band && modsOf(s, p.id).tribute > 0 && gathering) fighters = fighters.filter((u) => u.type !== 'cavalry');
  // Riders standing in our land take our gold (#322): the army rides out to drive them off.
  if (L.clever && answerRiders(s, v, fighters, issue)) {
    mem.attacking = false;
    return;
  }

  // The Warband hauls its plunder home (#502): a laden soldier leaves the wave and walks to the Town Center to bank it.
  if (L.clever) fighters = haulHome(v, fighters, issue);
  // Between waves, soldiers go into a Transfusion Station to be grafted (#355 s5); those on their way in are not the wave's.
  if (L.clever && !mem.attacking) transfuse(s, v, mem, fighters.filter((u) => u.order.k === 'idle'), issue);
  fighters = fighters.filter((u) => !bound(s, u));

  // Attack in waves once the army is big enough (at once against a wonder); between waves, gather at the muster point.
  const ready = fighters.filter((u) => u.order.k === 'idle' || (u.order.k === 'move' && !u.order.amove));
  // A chapter's goals may set the waves instead: none while holding out, smaller and sooner when the rival town must fall.
  const plan = v.plan;
  const waveSize = plan.wave || L.wave + mem.wave * L.waveGrowth;
  const onAttack = fighters.filter((u) => u.order.k === 'attack' || (u.order.k === 'move' && u.order.amove));
  if (mem.attacking && onAttack.length === 0) mem.attacking = false;
  const wonderRace = s.ents.some((e) => e.kind === 'building' && e.type === 'wonder' && e.hp > 0 && isEnemy(s, p.id, e.owner)) || relicRace(s, p);
  if (mem.attacking && !plan.allIn && !wonderRace && onAttack.length && wornDeep(s, p, onAttack)) {
    issue({ t: 'move', p: p.id, ids: fighters.map((u) => u.id), x: mem.muster.x, y: mem.muster.y });
    mem.attacking = false;
    return;
  }
  if (L.clever && L.hemo !== false && mem.attacking) machinesAtBlood(s, v, onAttack, issue);
  if (L.clever && !mem.attacking) pitchHomeCamp(s, v, mem, issue);
  if (L.clever && mem.attacking) pitchCamp(s, v, mem, onAttack, enemy, issue);
  if (L.clever && mem.attacking) pitchStation(s, v, mem, onAttack, issue);
  // A rival's War Camp in reach is a raid worth more than a house (#307): kill its keepers and it burns.
  if (L.clever && !mem.attacking && !plan.hold ) {
    const camp = rivalWarCamp(s, p, v.home);
    const band = camp ? ready.filter(prowler) : [];
    if (camp && band.length >= AI_BLOOD.strike) {
      issue({ t: 'move', p: p.id, ids: band.map((u) => u.id), x: camp.x, y: camp.y, amove: true });
      return;
    }
  }
  const due = !plan.hold && !polisHarvest(s, v) && (plan.wave ? true : s.tick >= secs(L.firstAttack)) && s.tick >= s.peaceUntil;
  if (due && !mem.attacking && (fighters.length >= waveSize || (wonderRace && fighters.length >= 4) || (plan.allIn && fighters.length >= 12))) {
    issue({ t: 'move', p: p.id, ids: fighters.map((u) => u.id), x: enemy.x, y: enemy.y, amove: true });
    mem.attacking = true;
    mem.wave++;
    delete mem.prowl; // the band marches with the wave
    return;
  }
  if (mem.attacking && ready.length >= (plan.allIn ? 1 : 4)) {
    // Reinforcements join the attack.
    issue({ t: 'move', p: p.id, ids: ready.map((u) => u.id), x: enemy.x, y: enemy.y, amove: true });
    return;
  }
  // Between waves, a small band falls on rival citizens working far from their town (#260).
  const watching = new Set<number>();
  if (L.clever && L.scouts !== false && !mem.attacking) for (const id of scouting(s, v, mem, ready, issue)) watching.add(id);
  if (L.clever && !plan.hold) for (const id of prowl(s, v, mem, ready, issue)) watching.add(id);
  // Between waves, a few riders cut the rivals' trade roads near home.
  if (L.clever) {
    const riders = ready.filter((u) => u.type === 'cavalry' && u.order.k === 'idle');
    const prey = riders.length ? enemyTrader(s, v, v.home, AI_WEB.raidNear, false) : null;
    if (prey) {
      issue({ t: 'attack', p: p.id, ids: riders.slice(0, 3).map((u) => u.id), target: prey.id });
      return;
    }
    // A merchant rival's age stands on its trade (#50), and a Joint-Stock Company keeps it so on any road (#242): a band of riders lies in wait by the trading
    // post nearest its town, and falls on the traders it sees coming.
    const post = riders.length ? watchPost(s, p) : null;
    if (post) {
      const band = riders.slice(0, AI_WEB.riders);
      const quarry = enemyTrader(s, v, post, AI_WEB.raid, true);
      if (quarry) {
        issue({ t: 'attack', p: p.id, ids: band.map((u) => u.id), target: quarry.id });
        return;
      }
      const away = band.filter((u) => (u.x - post.x) * (u.x - post.x) + (u.y - post.y) * (u.y - post.y) > 16);
      if (away.length) issue({ t: 'move', p: p.id, ids: away.map((u) => u.id), x: post.x, y: post.y, amove: true });
      for (const u of band) watching.add(u.id);
    }
  }
  if (L.clever) for (const id of guardMarks(s, v, mem, ready.filter((u) => !watching.has(u.id)), issue)) watching.add(id);
  const strays = ready.filter((u) => {
    if (watching.has(u.id)) return false;
    const ox = u.x - mem.muster!.x;
    const oy = u.y - mem.muster!.y;
    return ox * ox + oy * oy > 36 && u.order.k === 'idle';
  });
  if (strays.length) issue({ t: 'move', p: p.id, ids: strays.map((u) => u.id), x: mem.muster.x, y: mem.muster.y });
}

/**
 * One rider scouts by itself (explore) and a pair of soldiers patrol the trade road to the nearest trading post, or the border
 * toward the rival (#454 s4). Returns the soldiers newly sent, so the rest of the turn leaves them be.
 */
function scouting(s: GameState, v: View, mem: AiMemory, ready: Unit[], issue: (c: Command) => void): number[] {
  const { p } = v;
  const out: number[] = [];
  if (s.tick < secs(AI_SCOUT.after)) return out;
  const mine = (id: number) => {
    const e = s.byId.get(id);
    return e && e.kind === 'unit' && e.owner === p.id && e.hp > 0 ? e : null;
  };
  const scout = mem.scout ? mine(mem.scout.id) : null;
  if (!scout || (scout.order.k === 'idle' && s.tick - mem.scout!.sent >= secs(AI_SCOUT.rest))) {
    const rider = scout ?? ready.find((u) => u.type === 'cavalry');
    if (rider) {
      issue({ t: 'explore', p: p.id, ids: [rider.id] });
      mem.scout = { id: rider.id, sent: s.tick };
      out.push(rider.id);
    }
  }
  const walking = (u: Unit) => u.order.k === 'patrol' || (u.order.k === 'attack' && u.order.back?.k === 'patrol');
  const guards = (mem.guards ?? []).filter((id) => {
    const u = mine(id);
    return u && walking(u);
  });
  const pool = ready.filter((u) => (u.type === 'infantry' || u.type === 'ranged') && u.id !== mem.scout?.id);
  if (guards.length < AI_SCOUT.guards && (legionAtWork(v) ? v.army.length : ready.length) >= AI_SCOUT.army && pool.length) {
    const band = pool.slice(0, AI_SCOUT.guards - guards.length);
    const market = v.buildings.some((b) => b.type === 'market' && b.built);
    let post: TradePost | null = null;
    let bestD = Infinity;
    if (market) for (const q of s.posts) {
      const d = (q.x - v.home.x) * (q.x - v.home.x) + (q.y - v.home.y) * (q.y - v.home.y);
      if (d < bestD) {
        bestD = d;
        post = q;
      }
    }
    const ids = band.map((u) => u.id);
    if (post) issue({ t: 'patrol', p: p.id, ids, x: post.x, y: post.y, post: post.id });
    else if (mem.muster) {
      const dx = mem.muster.x - v.home.x;
      const dy = mem.muster.y - v.home.y;
      const dl = Math.sqrt(dx * dx + dy * dy) || 1;
      issue({ t: 'patrol', p: p.id, ids, x: v.home.x + (dx / dl) * AI_SCOUT.reach, y: v.home.y + (dy / dl) * AI_SCOUT.reach });
    }
    guards.push(...ids);
    out.push(...ids);
  }
  mem.guards = guards;
  return out;
}

/** Soldiers who can go prowling: not siege, and not the hero, who leads the army. */
function prowler(u: Unit): boolean {
  return u.type === 'infantry' || u.type === 'ranged' || u.type === 'cavalry';
}

/** Armed: a rival unit that can fight a prowling band off. */
function armed(u: Unit): boolean {
  return prowler(u) || u.type === 'hero';
}

/**
 * The rival citizen nearest a point that a band of `n` may fall on (#260): one the computer's own units see,
 * within `reach` tiles of its home, more than `safe` tiles from any rival Town Center or Tower, no rival soldier
 * within `guard` tiles, and at most `odds` rival citizens per raider within 4 tiles. Null when there is none.
 */
export function prey(s: GameState, p: Player, home: { x: number; y: number }, at: { x: number; y: number }, within: number, n: number): Unit | null {
  const P = AI_PROWL;
  const forts: Building[] = [];
  const guards: Unit[] = [];
  const folk: Unit[] = [];
  for (const e of s.ents) {
    if (e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    if (e.kind === 'building') {
      if (e.built && (e.type === 'towncenter' || e.type === 'tower')) forts.push(e);
    } else if (!e.inside) {
      if (armed(e)) guards.push(e);
      else if (e.type === 'citizen') folk.push(e);
    }
  }
  let best: Unit | null = null;
  let bestD = within * within;
  for (const c of folk) {
    if (!p.vis[Math.floor(c.y) * s.w + Math.floor(c.x)]) continue;
    const d = (c.x - at.x) * (c.x - at.x) + (c.y - at.y) * (c.y - at.y);
    if (d >= bestD) continue;
    const hx = c.x - home.x;
    const hy = c.y - home.y;
    if (hx * hx + hy * hy > P.reach * P.reach) continue;
    if (forts.some((b) => distToRect(c.x, c.y, b) <= P.safe)) continue;
    if (guards.some((g) => (g.x - c.x) * (g.x - c.x) + (g.y - c.y) * (g.y - c.y) <= P.guard * P.guard)) continue;
    let mob = 0;
    for (const o of folk) if ((o.x - c.x) * (o.x - c.x) + (o.y - c.y) * (o.y - c.y) <= 16) mob++;
    if (mob > n * P.odds) continue;
    bestD = d;
    best = c;
  }
  return best;
}

/**
 * Hunters hunted (#260): between waves a clever computer sends a small band at rival citizens working far
 * from their town (a far kill, a ruin, a landmark, wild gold) when nothing of theirs guards them, chases on to
 * the next one near, and comes home when rival soldiers come or the time is up. Returns the band's ids, so
 * the rest of the army leaves them be.
 */
function prowl(s: GameState, v: View, mem: AiMemory, ready: Unit[], issue: (c: Command) => void): Set<number> {
  const P = AI_PROWL;
  const { p } = v;
  const held = new Set<number>();
  const home = mem.muster ?? v.home;
  if (mem.prowl) {
    const band: Unit[] = [];
    for (const id of mem.prowl.ids) {
      const u = s.byId.get(id);
      if (u && u.kind === 'unit' && u.hp > 0) band.push(u);
    }
    const lead = band[0];
    const quarry = s.byId.get(mem.prowl.target);
    const hunted = quarry && quarry.kind === 'unit' && quarry.hp > 0 && !quarry.inside ? quarry : null;
    // Walking to a camp: it looks farther round, and keeps walking until it is there.
    const camp = mem.prowl.look !== undefined ? s.byId.get(mem.prowl.look) : undefined;
    const walking = !!lead && !hunted && !!camp && camp.hp > 0 && (camp.x - lead.x) * (camp.x - lead.x) + (camp.y - lead.y) * (camp.y - lead.y) > 9;
    // At the camp with nobody there to chase: it sets about the camp itself, with `burn` seconds more to do it.
    const arrived = !!lead && !hunted && !!camp && camp.hp > 0 && !walking;
    const burning = mem.prowl.burn !== undefined && !!camp && camp.hp > 0;
    const next = lead && !hunted && !burning ? prey(s, p, v.home, lead, camp ? P.look : P.chase, band.length) : null;
    const threatened = lead && s.ents.some((e) => e.kind === 'unit' && e.hp > 0 && !e.inside && isEnemy(s, p.id, e.owner) && armed(e) && (e.x - lead.x) * (e.x - lead.x) + (e.y - lead.y) * (e.y - lead.y) <= P.guard * P.guard);
    const limit = secs(mem.prowl.raid ? AI_WAYS.raidTime : P.time) + (mem.prowl.burn !== undefined ? secs(P.burn) : 0);
    if (!lead || threatened || s.tick - mem.prowl.since > limit || (!hunted && !next && !walking && !burning && !arrived)) {
      if (band.length) issue({ t: 'move', p: p.id, ids: band.map((u) => u.id), x: home.x, y: home.y });
      delete mem.prowl;
      mem.prowled = s.tick;
      return held;
    }
    if (next) {
      issue({ t: 'attack', p: p.id, ids: band.map((u) => u.id), target: next.id });
      mem.prowl.target = next.id;
      delete mem.prowl.look;
      delete mem.prowl.burn;
    } else if (arrived && camp && mem.prowl.burn === undefined) {
      issue({ t: 'attack', p: p.id, ids: band.map((u) => u.id), target: camp.id });
      mem.prowl.burn = s.tick;
    }
    for (const u of band) held.add(u.id);
    return held;
  }
  // A Warband (#463 s1) goes out more often, and first for the rival's food: its blows there carry the food home.
  const raider = p.way === 'warband' && p.epoch <= AI_WAYS.raidUntil;
  const every = raider ? AI_WAYS.raidEvery : P.every;
  if (s.tick < s.peaceUntil || s.tick - (mem.prowled ?? -secs(every)) < secs(every)) return held;
  const free = ready.filter((u) => prowler(u) && !u.inside);
  if (free.length < P.band) return held;
  const larder = raider ? rivalCamp(s, p, v.home, AI_WAYS.raidAt, AI_WAYS.raidReach, true) : null;
  const target = larder ?? prey(s, p, v.home, v.home, P.reach, Math.min(P.most, free.length)) ?? rivalCamp(s, p, v.home);
  if (!target) return held;
  const band = free
    .map((u) => ({ u, d: (u.x - target.x) * (u.x - target.x) + (u.y - target.y) * (u.y - target.y) }))
    .sort((a, b) => a.d - b.d || a.u.id - b.u.id)
    .slice(0, P.most + (target.kind === 'building' && towerCovers(s, p, target) ? P.extra : 0))
    .map((o) => o.u);
  if (target.kind === 'building') {
    issue({ t: 'move', p: p.id, ids: band.map((u) => u.id), x: target.x, y: target.y });
    mem.prowl = { ids: band.map((u) => u.id), target: -1, since: s.tick, look: target.id, ...(target === larder ? { raid: true } : {}) };
  } else {
    issue({ t: 'attack', p: p.id, ids: band.map((u) => u.id), target: target.id });
    mem.prowl = { ids: band.map((u) => u.id), target: target.id, since: s.tick };
  }
  for (const u of band) held.add(u.id);
  return held;
}

/** True when one of the computer's own finished Towers stands within `cover` tiles of a point: a band there has cover to fall back on. */
export function towerCovers(s: GameState, p: Player, at: { x: number; y: number }): boolean {
  const r = AI_PROWL.cover * AI_PROWL.cover;
  return s.ents.some((e) => e.kind === 'building' && e.type === 'tower' && e.built && e.hp > 0 && e.owner === p.id && (e.x - at.x) * (e.x - at.x) + (e.y - at.y) * (e.y - at.y) <= r);
}

/**
 * The nearest rival Hunting Camp the computer has seen within `reach` of home and clear of the rival's forts (#260), or null.
 * A Warband's raid (#463 s1) asks the same of any of `types`, the rival's food buildings, wherever they stand (the
 * computer's waves know where the rival's town is too) and only out of reach of the forts' arrows (`AI_WAYS.raidSafe`).
 */
export function rivalCamp(s: GameState, p: Player, home: { x: number; y: number }, types: BuildingType[] = ['huntcamp'], reach = AI_PROWL.reach, raid = false): Building | null {
  const P = AI_PROWL;
  const safe = raid ? AI_WAYS.raidSafe : P.safe;
  let best: Building | null = null;
  let bestD = reach * reach;
  for (const e of s.ents) {
    if (e.kind !== 'building' || !types.includes(e.type) || !e.built || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    if (!raid && !p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
    const d = (e.x - home.x) * (e.x - home.x) + (e.y - home.y) * (e.y - home.y);
    if (d >= bestD) continue;
    if (s.ents.some((f) => f.kind === 'building' && f.hp > 0 && f.built && f.owner === e.owner && (f.type === 'towncenter' || f.type === 'tower') && distToRect(e.x, e.y, f) <= safe)) continue;
    // A raid (#486) also passes over a larder with rival soldiers standing by it: the band would only be thrown away.
    if (raid && s.ents.some((f) => f.kind === 'unit' && f.hp > 0 && !f.inside && isEnemy(s, p.id, f.owner) && armed(f) && (f.x - e.x) * (f.x - e.x) + (f.y - e.y) * (f.y - e.y) <= P.guard * P.guard)) continue;
    bestD = d;
    best = e;
  }
  return best;
}

/** A wave worn down deep in enemy land, out of reach of its own supply and clear of any fight (#132 s4). */
export function wornDeep(s: GameState, p: Player, wave: Unit[]): boolean {
  let hp = 0;
  let full = 0;
  let cx = 0;
  let cy = 0;
  for (const u of wave) {
    hp += u.hp;
    full += maxHp(s, u);
    cx += u.x;
    cy += u.y;
  }
  if (hp >= full * AI_RAID.weary) return false;
  cx /= wave.length;
  cy /= wave.length;
  const own = borderMap(s);
  const here = own[Math.floor(cy) * s.w + Math.floor(cx)];
  if (here < 0 || !isEnemy(s, p.id, here) || suppliedAt(s, own, p.team, Math.floor(cx), Math.floor(cy))) return false;
  const r2 = AI_RAID.calm * AI_RAID.calm;
  return !s.ents.some((e) => e.kind === 'unit' && e.hp > 0 && !e.inside && isEnemy(s, p.id, e.owner) && (e.x - cx) * (e.x - cx) + (e.y - cy) * (e.y - cy) <= r2);
}

/** Relics on the ground, for anyone to take. */
function looseRelics(s: GameState): number {
  let n = 0;
  for (const r of s.relics) if (!r.carrier && !r.temple) n++;
  return n;
}

/** A rival side keeps every relic: their temples must fall before the countdown ends. */
function relicRace(s: GameState, p: Player): boolean {
  return s.relicTeam >= 0 && s.relicTeam !== p.team;
}

/**
 * Priests bring relics home first (the nearest loose one nobody of ours is fetching), then walk with
 * the army (healing as they go) and turn the enemy's best units.
 */
/**
 * The rite a Blood-rite priest should chant now (`AI_RITE`), or null: a curse on the target with the most uncursed soldiers around it (one pinned in a fight counts double),
 * else, with the store low, a sacrifice of the dearest victim worth `dear` blood. Looks only at the bleeding enemy within 9 tiles.
 */
export function riteWork(s: GameState, p: Player, pr: Unit): { target: Unit; how: 'sacrifice' | 'curse' } | null {
  const foes: Unit[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, p.id, e.owner) || !bleeds(e)) continue;
    if ((e.x - pr.x) * (e.x - pr.x) + (e.y - pr.y) * (e.y - pr.y) <= 81) foes.push(e);
  }
  const soldier = (u: Unit) => u.type !== 'citizen' && u.type !== 'priest' && u.type !== 'trader';
  const r2 = RITE.spread * RITE.spread;
  const rich = bloodOf(p) >= RITE.curse + AI_RITE.keep;
  // Mine within `pinned` tiles of a rival soldier hold it in the fight: it can't step back from a curse (#434, `answerCurse`), so it counts double.
  const mine = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.hp > 0 && !e.inside && e.owner === p.id && soldier(e));
  const pin2 = AI_RITE.pinned * AI_RITE.pinned;
  const pinned = new Set<number>();
  for (const o of foes) if (soldier(o) && mine.some((m) => (m.x - o.x) * (m.x - o.x) + (m.y - o.y) * (m.y - o.y) <= pin2)) pinned.add(o.id);
  // Wait a beat: a pack none of ours holds yet, with our foot soldiers closing on it, is about to be pinned, and a curse cast then falls on soldiers that can't step back.
  const reach2 = AI_RITE.closing * AI_RITE.closing;
  const unpinned = (c: Unit) => !foes.some((o) => pinned.has(o.id) && (o.x - c.x) * (o.x - c.x) + (o.y - c.y) * (o.y - c.y) <= r2);
  const closing = (c: Unit) =>
    mine.some((m) => unitStats(m.type, s.players[m.owner].epoch).range === 0 && (m.order.k === 'attack' || m.order.k === 'move') && (m.x - c.x) * (m.x - c.x) + (m.y - c.y) * (m.y - c.y) <= reach2);
  let curseAt: Unit | null = null;
  let packed = 0;
  let best = 0;
  let offer: Unit | null = null;
  let dear = 0;
  for (const e of foes) {
    if (rich && riteProblem(s, p.id, 'curse', e) === null) {
      let n = 0;
      let score = 0;
      for (const o of foes) {
        if (!soldier(o) || cursed(s, o) || (o.x - e.x) * (o.x - e.x) + (o.y - e.y) * (o.y - e.y) > r2) continue;
        n++;
        score += pinned.has(o.id) ? 2 : 1;
      }
      if (score > best) {
        best = score;
        packed = n;
        curseAt = e;
      }
    }
    if (bloodOf(p) < AI_FORK.store) {
      const n = offeringOf(s, e);
      if (n >= AI_RITE.dear && n > dear && riteProblem(s, p.id, 'sacrifice', e) === null) {
        dear = n;
        offer = e;
      }
    }
  }
  if (curseAt && packed >= AI_RITE.pack) {
    // The wait has a limit: a marching soldier that never lands can't hold the curse past `patience` seconds.
    const mem = memory(s, p.id);
    if (unpinned(curseAt) && closing(curseAt)) {
      mem.riteWait ??= s.tick;
      if (s.tick - mem.riteWait < secs(AI_RITE.patience)) return offer ? { target: offer, how: 'sacrifice' } : null;
    }
    delete mem.riteWait;
    return { target: curseAt, how: 'curse' };
  }
  if (s.ai[p.id]) delete s.ai[p.id].riteWait;
  return offer ? { target: offer, how: 'sacrifice' } : null;
}

/**
 * The computer answers a curse on its own army (#434, `AI_CURSE`): cursed soldiers that aren't winning step back for the curse's last
 * seconds, and its riders go for the Blood-rite priest within reach. Returns the fighters the waves may still command.
 */
function answerCurse(s: GameState, v: View, mem: AiMemory, fighters: Unit[], issue: (c: Command) => void): Unit[] {
  const { p } = v;
  const soldier = (u: Unit) => u.type !== 'citizen' && u.type !== 'priest' && u.type !== 'trader';
  const hurt = fighters.filter((u) => soldier(u) && cursed(s, u));
  if (!hurt.length) return fighters;
  const near2 = AI_CURSE.near * AI_CURSE.near;
  const foes = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.hp > 0 && !e.inside && soldier(e) && isEnemy(s, p.id, e.owner));
  const held = new Set<number>();
  const back: number[] = [];
  for (const u of hurt) {
    if (u.cursed! - s.tick > secs(AI_CURSE.late)) continue;
    const retreating = u.order.k === 'move' && !u.order.amove;
    let theirs = 0;
    let ours = 0;
    for (const f of foes) if ((f.x - u.x) * (f.x - u.x) + (f.y - u.y) * (f.y - u.y) <= near2) theirs++;
    for (const f of hurt) if ((f.x - u.x) * (f.x - u.x) + (f.y - u.y) * (f.y - u.y) <= near2) ours++;
    const losing = u.hp < maxHp(s, u) * AI_CURSE.hurt || theirs > ours;
    if (!retreating && !(losing && theirs > 0) && u.order.k !== 'idle') continue;
    held.add(u.id);
    if (!retreating && u.order.k !== 'idle') back.push(u.id);
  }
  if (back.length) issue({ t: 'move', p: p.id, ids: back, x: mem.muster!.x, y: mem.muster!.y });
  // The riders: a Blood-rite priest of a rival within reach is the one who cast it.
  const r2 = AI_CURSE.reach * AI_CURSE.reach;
  const riders = fighters.filter((u) => u.type === 'cavalry' && !held.has(u.id));
  let prey: Unit | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.type !== 'priest' || e.hp <= 0 || e.inside || !isEnemy(s, p.id, e.owner) || !ageDef(s.players[e.owner]).rite) continue;
    for (const r of riders) {
      const d = (e.x - r.x) * (e.x - r.x) + (e.y - r.y) * (e.y - r.y);
      if (d <= r2 && d < bestD) {
        bestD = d;
        prey = e;
      }
    }
  }
  if (prey) {
    const go = riders
      .filter((r) => !(r.order.k === 'attack' && r.order.target === prey!.id))
      .sort((a, b) => (a.x - prey!.x) * (a.x - prey!.x) + (a.y - prey!.y) * (a.y - prey!.y) - ((b.x - prey!.x) * (b.x - prey!.x) + (b.y - prey!.y) * (b.y - prey!.y)) || a.id - b.id)
      .slice(0, AI_CURSE.riders);
    if (go.length) issue({ t: 'attack', p: p.id, ids: go.map((r) => r.id), target: prey.id });
  }
  return fighters.filter((u) => !held.has(u.id));
}

/**
 * The computer reads a rival's Military Orders (#459, `AI_ORDERS`): against a sworn army, its riders (or archers, with no riders) ride
 * down the nearest priest swearing it, since no priest of its own can touch the soldiers while that one stands.
 */
export function breakOath(s: GameState, v: View, fighters: Unit[], issue: (c: Command) => void): void {
  const { p } = v;
  let hunters = fighters.filter((u) => u.type === 'cavalry');
  if (!hunters.length) hunters = fighters.filter((u) => u.type === 'ranged');
  if (!hunters.length) return;
  const r2 = AI_ORDERS.reach * AI_ORDERS.reach;
  const o2 = ORDERS.reach * ORDERS.reach;
  const near = (a: Unit, b: Unit, d2: number) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) <= d2;
  // The rival priests who swear a soldier that our hunters can reach.
  const swearers: Unit[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.type !== 'priest' || e.hp <= 0 || e.inside || !isEnemy(s, p.id, e.owner) || !modsOf(s, e.owner).sworn) continue;
    if (s.ents.some((f) => f.kind === 'unit' && f.owner === e.owner && f.hp > 0 && !f.inside && GRAFTABLE.includes(f.type) && near(f, e, o2) && hunters.some((h) => near(h, f, r2)))) swearers.push(e);
  }
  let prey: Unit | null = null;
  let bestD = Infinity;
  for (const e of swearers) {
    for (const h of hunters) {
      const d = (e.x - h.x) * (e.x - h.x) + (e.y - h.y) * (e.y - h.y);
      if (d < bestD) {
        bestD = d;
        prey = e;
      }
    }
  }
  if (!prey) return;
  const target = prey;
  const on = hunters.filter((h) => h.order.k === 'attack' && h.order.target === target.id).length;
  const go = hunters
    .filter((h) => !(h.order.k === 'attack' && s.byId.get(h.order.target)?.type === 'priest'))
    .sort((a, b) => (a.x - target.x) * (a.x - target.x) + (a.y - target.y) * (a.y - target.y) - ((b.x - target.x) * (b.x - target.x) + (b.y - target.y) * (b.y - target.y)) || a.id - b.id)
    .slice(0, Math.max(0, AI_ORDERS.riders - on));
  if (go.length) issue({ t: 'attack', p: p.id, ids: go.map((h) => h.id), target: target.id });
}

/** Whether the town is sick, or soon will be (#541): fever, or taint past `SICKNESS.aiTemple`. */
const ailing = (p: Player): boolean => !!p.fever || (p.taint ?? 0) >= SICKNESS.aiTemple;

/**
 * The Sickness (#541): the computer keeps quarantine while the fever runs above `aiQuarantine` and lifts it when the town is well, and
 * while it is sick its priests wait by the Temple (idle ones walk back to it) to nurse the town.
 */
function nurse(s: GameState, v: View, issue: (c: Command) => void): void {
  const { p } = v;
  if (!AI_LEVELS[p.ai!].clever) return;
  const bad = !!p.fever && p.fever.sev >= SICKNESS.aiQuarantine;
  if (bad && !p.quarantine && v.traders.length) issue({ t: 'quarantine', p: p.id, on: true });
  else if (!p.fever && p.quarantine) issue({ t: 'quarantine', p: p.id, on: false });
  if (!p.fever) return;
  const temple = v.buildings.find((b) => b.type === 'temple' && b.built && b.hp > 0);
  if (!temple) return;
  const near = SICKNESS.aiTend * SICKNESS.aiTend;
  for (const pr of v.priests) {
    if (pr.inside || carriedBy(s, pr) || pr.order.k !== 'idle') continue;
    if ((pr.x - temple.x) * (pr.x - temple.x) + (pr.y - temple.y) * (pr.y - temple.y) > near) issue({ t: 'move', p: p.id, ids: [pr.id], x: temple.x, y: temple.y + 3 });
  }
}

function priestly(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  nurse(s, v, issue);
  if (!v.priests.length) return;
  chantBand(s, v, issue);
  const army = v.army.filter((u) => !u.inside && u.type !== 'siege');
  const fetching = new Set<number>();
  for (const pr of v.priests) if (pr.order.k === 'relic') fetching.add(pr.order.target);
  // In the Age of Pilgrims the first `VIGIL.most` priests (in id order) keep vigil at the shrine (#379 s2).
  const shrine = vigilPost(s, v);
  const keepers = new Set(shrine ? v.priests.filter((pr) => !carriedBy(s, pr)).slice(0, VIGIL.most).map((pr) => pr.id) : []);
  // The Blood-rite (#355 s4): a clever computer's priest curses a packed force, or offers up a dear victim to fill a low store. A priest
  // between jobs has already picked up an idle priest's own healing, so idle, healing and walking priests all count.
  const ritual = new Set<number>();
  if (AI_LEVELS[v.p.ai!].clever && AI_LEVELS[v.p.ai!].rite !== false && ageDef(v.p).rite) {
    for (const pr of v.priests) {
      if (pr.inside || pr.cool > 0 || carriedBy(s, pr) || !(pr.order.k === 'idle' || pr.order.k === 'heal' || pr.order.k === 'move')) continue;
      const rite = riteWork(s, v.p, pr);
      if (!rite) continue;
      ritual.add(pr.id);
      issue({ t: 'convert', p: v.p.id, ids: [pr.id], target: rite.target.id, rite: rite.how });
    }
  }
  for (const pr of v.priests) {
    // An idle priest takes up healing by itself within ticks of seeing anyone hurt (`units.ts`), and the computer gives no heal
    // orders, so a healing priest is one between jobs too: a relic, a ward or a conversion comes first, but not a walk away.
    const healing = pr.order.k === 'heal' && AI_LEVELS[v.p.ai!].healers !== false;
    if (!(pr.order.k === 'idle' || healing) || pr.inside || ritual.has(pr.id)) continue;
    const held = carriedBy(s, pr);
    if (held) {
      const t = nearestTemple(s, v.p.id, pr.x, pr.y);
      if (t) issue({ t: 'work', p: v.p.id, ids: [pr.id], target: t.id });
      else if ((pr.x - v.home.x) * (pr.x - v.home.x) + (pr.y - v.home.y) * (pr.y - v.home.y) > 49) issue({ t: 'move', p: v.p.id, ids: [pr.id], x: v.home.x, y: v.home.y + 3 });
      continue;
    }
    if (nearestTemple(s, v.p.id, pr.x, pr.y)) {
      let relic = -1;
      let bestD = Infinity;
      const rivals = s.players.filter((o) => !o.defeated && isEnemy(s, v.p.id, o.id));
      for (const r of s.relics) {
        if (r.carrier || r.temple || fetching.has(r.id)) continue;
        // Not from under a rival's walls.
        const mine = (r.x - v.home.x) * (r.x - v.home.x) + (r.y - v.home.y) * (r.y - v.home.y);
        if (rivals.some((o) => (r.x - o.startX) * (r.x - o.startX) + (r.y - o.startY) * (r.y - o.startY) < mine * 0.6)) continue;
        const d = (r.x - pr.x) * (r.x - pr.x) + (r.y - pr.y) * (r.y - pr.y);
        if (d < bestD) {
          bestD = d;
          relic = r.id;
        }
      }
      if (relic >= 0) {
        fetching.add(relic);
        issue({ t: 'relic', p: v.p.id, ids: [pr.id], target: relic });
        continue;
      }
    }
    // A building of ours is being chanted over: stand by it and slow the chant (#216).
    const ward = wardPost(s, v, pr);
    if (ward && ward.hot) {
      // A work order on the chanted-over building: the priest stands by it and sings back louder (#219).
      if (consecrates(s, v.p.id)) issue({ t: 'work', p: v.p.id, ids: [pr.id], target: ward.b.id });
      else issue({ t: 'move', p: v.p.id, ids: [pr.id], x: ward.b.x, y: ward.b.y });
      continue;
    }
    if (pr.cool > 0) continue;
    // Something worth converting close by?
    let best: Unit | null = null;
    let bestScore = 0;
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, v.p.id, e.owner)) continue;
      // Kings, grafts and the sworn (#355 s6) never turn.
      if (s.kings.includes(e.id) || grafted(s, e) || sworn(s, e)) continue;
      const dx = e.x - pr.x;
      const dy = e.y - pr.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 81) continue;
      const worth = e.type === 'hero' ? 5 : e.type === 'siege' ? 4 : e.type === 'cavalry' ? 3 : 1;
      const score = worth / (1 + d2);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best) {
      issue({ t: 'convert', p: v.p.id, ids: [pr.id], target: best.id });
      continue;
    }
    // A keeper goes back to the shrine and stays: each one adds to every relic payment.
    if (shrine && keepers.has(pr.id)) {
      const r = VIGIL.reach - AI_VIGIL.slack;
      if ((pr.x - shrine.x) * (pr.x - shrine.x) + (pr.y - shrine.y) * (pr.y - shrine.y) > r * r) issue({ t: 'move', p: v.p.id, ids: [pr.id], x: shrine.x, y: shrine.y });
      continue;
    }
    // Healing is the work a priest keeps up with the army for: it stays at it.
    if (healing) continue;
    // Against a pilgrim rival, a spare priest stands by a tower, gate or Temple.
    if (ward) {
      issue({ t: 'move', p: v.p.id, ids: [pr.id], x: ward.b.x, y: ward.b.y });
      continue;
    }
    // Otherwise keep up with the army.
    if (army.length) {
      let cx = 0;
      let cy = 0;
      for (const a of army) {
        cx += a.x;
        cy += a.y;
      }
      cx /= army.length;
      cy /= army.length;
      const dx = cx - pr.x;
      const dy = cy - pr.y;
      if (dx * dx + dy * dy > 49) issue({ t: 'move', p: v.p.id, ids: [pr.id], x: cx, y: cy });
    } else if (mem.muster) issue({ t: 'move', p: v.p.id, ids: [pr.id], x: mem.muster.x, y: mem.muster.y });
  }
}

/**
 * Counter-chant (#216), for the computer: the building a free priest should stand by, within `counter.range`
 * of it so its voice slows a rival's chant. `hot`: a rival is chanting it now (the nearest one within
 * `AI_FAITH.ward` tiles of the priest). Otherwise, with a pilgrim rival in the match, a priest when none of
 * ours stands by the most exposed tower, gate or Temple (nearest the rival's town). Null: nothing to ward.
 */
function wardPost(s: GameState, v: View, pr: Unit): { b: Building; hot: boolean } | null {
  const r2 = CONSECRATE.counter.range * CONSECRATE.counter.range;
  const reach2 = AI_FAITH.ward * AI_FAITH.ward;
  const near = (b: Building, u: Unit): boolean => (u.x - b.x) * (u.x - b.x) + (u.y - b.y) * (u.y - b.y) <= r2;
  let hot: Building | null = null;
  let hotD = Infinity;
  for (const b of v.buildings) {
    if (b.hp <= 0 || !b.built || CONSECRATE.never.includes(b.type)) continue;
    if (!b.faith || b.faithBy === undefined || b.faithBy === v.p.id || !isEnemy(s, v.p.id, b.faithBy)) continue;
    const d = (pr.x - b.x) * (pr.x - b.x) + (pr.y - b.y) * (pr.y - b.y);
    if (d <= reach2 && d < hotD) {
      hotD = d;
      hot = b;
    }
  }
  if (hot) return near(hot, pr) ? null : { b: hot, hot: true };
  const rival = s.players.find((o) => !o.defeated && isEnemy(s, v.p.id, o.id) && consecrates(s, o.id));
  if (!rival) return null;
  let post: Building | null = null;
  let postD = Infinity;
  for (const b of v.buildings) {
    if (b.hp <= 0 || !b.built || (b.type !== 'tower' && b.type !== 'gate' && b.type !== 'temple')) continue;
    if (v.priests.some((o) => o.id !== pr.id && !o.inside && near(b, o))) continue;
    const d = (rival.startX - b.x) * (rival.startX - b.x) + (rival.startY - b.y) * (rival.startY - b.y);
    if (d < postD) {
      postD = d;
      post = b;
    }
  }
  return post && !near(post, pr) ? { b: post, hot: false } : null;
}

/**
 * Faith takes the walls (#209): a pilgrim computer builds no siege, so the priests that have kept up with
 * its army (idle, walking or healing) chant over, together, the rival building nearest the army: a tower
 * or a gate first, then a Temple that keeps relics. A band already chanting draws in every free priest.
 */
function chantBand(s: GameState, v: View, issue: (c: Command) => void): void {
  if (!consecrates(s, v.p.id)) return;
  const army = v.army.filter((u) => !u.inside && u.type !== 'siege');
  if (!army.length) return;
  let cx = 0;
  let cy = 0;
  for (const a of army) {
    cx += a.x;
    cy += a.y;
  }
  cx /= army.length;
  cy /= army.length;
  const keep = (AI_FAITH.reach + AI_FAITH.keep) * (AI_FAITH.reach + AI_FAITH.keep);
  // Healing and keeping up with the army both give way: a pilgrim people's priests are its siege.
  const free = v.priests.filter((pr) => (pr.order.k === 'idle' || pr.order.k === 'move' || pr.order.k === 'heal') && !pr.inside && pr.cool <= 0 && !carriedBy(s, pr) && (pr.x - cx) * (pr.x - cx) + (pr.y - cy) * (pr.y - cy) <= keep);
  if (!free.length) return;
  // Join a chant already under way.
  let target: Building | null = null;
  let voices = 0;
  for (const pr of v.priests) {
    if (pr.order.k !== 'convert') continue;
    const b = s.byId.get(pr.order.target);
    if (!b || b.kind !== 'building' || consecrateProblem(s, v.p.id, b)) continue;
    target = b;
    voices++;
  }
  if (!target) {
    let best = AI_FAITH.reach * AI_FAITH.reach;
    for (const e of s.ents) {
      if (e.kind !== 'building' || consecrateProblem(s, v.p.id, e) || !v.p.vis[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
      const near = e.type === 'tower' || e.type === 'gate' ? AI_FAITH.wall : e.type === 'temple' && s.relics.some((r) => r.temple === e.id) ? AI_FAITH.relic : 1;
      const d = ((e.x - cx) * (e.x - cx) + (e.y - cy) * (e.y - cy)) * near;
      if (d < best) {
        best = d;
        target = e;
      }
    }
  }
  if (!target || free.length + voices < AI_FAITH.band) return;
  issue({ t: 'convert', p: v.p.id, ids: free.map((pr) => pr.id), target: target.id });
}

// ---- Trade -----------------------------------------------------------------------------------------

/** A rival's trader on the road within reach of a place (home, or a post its riders watch), nearest first; only one in sight now, if `seen`. */
function enemyTrader(s: GameState, v: View, at: { x: number; y: number }, r: number, seen: boolean): Unit | null {
  let best: Unit | null = null;
  let bestD = r * r;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.type !== 'trader' || e.hp <= 0 || e.inside || !isEnemy(s, v.p.id, e.owner)) continue;
    if (seen && !v.p.vis[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
    const d = (e.x - at.x) * (e.x - at.x) + (e.y - at.y) * (e.y - at.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** The trading post a band of riders watches against merchant rivals (#50): the one nearest any of their towns, or null with no merchant rival. */
export function watchPost(s: GameState, p: Player): TradePost | null {
  let best: TradePost | null = null;
  let bestD = Infinity;
  for (const o of s.players) {
    if (o.defeated || !isEnemy(s, p.id, o.id) || (ageOf(o) !== 'merchant' && ageOf(o) !== 'fair' && !o.techs.includes('jointStock'))) continue;
    for (const post of s.posts) {
      const d = (post.x - o.startX) * (post.x - o.startX) + (post.y - o.startY) * (post.y - o.startY);
      if (d < bestD) {
        bestD = d;
        best = post;
      }
    }
  }
  return best;
}

/** How close a road from one point to another passes to a third (squared). */
function passes(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  const qx = ax + dx * t - px;
  const qy = ay + dy * t - py;
  return qx * qx + qy * qy;
}

/** The road a trader would walk from a Market to a post (the pathfinder's own route), as waypoints [x0, y0, x1, y1, …]. */
function road(s: GameState, p: Player, from: { x: number; y: number }, post: TradePost): number[] {
  // From the nearest open ground: a Market's own tiles are built over.
  const t = nearestWalkable(s, from.x, from.y, 6, p.team);
  if (t < 0) return [];
  const x = (t % s.w) + 0.5;
  const y = Math.floor(t / s.w) + 0.5;
  const r = findRoute(s, x, y, goalForPost(post), 8000, p.team);
  return r.complete ? [x, y, ...r.points] : [];
}

/**
 * How close a road comes to danger (squared): a rival's starting place or any Town Center or tower of
 * theirs it knows of. Roads bend around water and hills, so it is measured along the road walked, not
 * the straight line: on a map with a sea in the middle, the straight line to the far post can be safe
 * while the road runs through a rival's town.
 */
function roadDanger(s: GameState, p: Player, pts: number[]): number {
  const danger: { x: number; y: number }[] = [];
  for (const o of s.players) if (!o.defeated && isEnemy(s, p.id, o.id)) danger.push({ x: o.startX, y: o.startY });
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || (e.type !== 'towncenter' && e.type !== 'tower') || !isEnemy(s, p.id, e.owner)) continue;
    if (p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)]) danger.push({ x: e.x, y: e.y });
  }
  let clear = Infinity;
  for (let i = 0; i + 3 < pts.length; i += 2) for (const d of danger) clear = Math.min(clear, passes(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], d.x, d.y));
  return clear;
}

/** A road's length in tiles. */
function roadLength(pts: number[]): number {
  let l = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const dx = pts[i + 2] - pts[i];
    const dy = pts[i + 3] - pts[i + 1];
    l += Math.sqrt(dx * dx + dy * dy);
  }
  return l;
}

/**
 * Traders: once there is a Market and gold to spare, keep a few on the road that pays best for the
 * time it takes without passing a rival's town (failing that, the one that keeps farthest from them).
 * With no road that reaches a post at all, none are trained.
 */
function merchants(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  if (!s.posts.length || p.epoch < 1 || v.citizens.length < 18 || p.quarantine) return;
  const market = v.buildings.find((b) => b.type === 'market' && b.built);
  if (!market) return;
  // Traders that were on the road last turn and are gone now were lost on it: keep off that road a while.
  const lost = (mem.roadLost ??= {});
  const alive = new Set(v.traders.map((u) => u.id));
  for (const id in mem.caravans ?? {}) if (!alive.has(Number(id))) lost[mem.caravans![id]] = s.tick;
  mem.caravans = {};
  for (const u of v.traders) if (u.order.k === 'trade') mem.caravans[u.id] = u.order.post;
  const shunned = (post: number) => s.tick - (lost[post] ?? -99999) < secs(TRADER_WARY);
  // The roads from each Market, worked out once a decision.
  const roads = new Map<number, { post: number; score: number }>();
  const bestRoad = (from: Building) => {
    let best = roads.get(from.id);
    if (best) return best;
    best = { post: -1, score: -Infinity };
    for (const post of s.posts) {
      const pts = road(s, p, from, post);
      if (!pts.length) continue;
      const clear = shunned(post.id) ? 0 : roadDanger(s, p, pts);
      // A safe road scores by its gold for each tile walked; an unsafe one only by how far it keeps from danger.
      const score = clear >= 18 * 18 ? 1e6 + tripGold(s, p.id, from, post) / Math.max(1, roadLength(pts)) : clear;
      if (score > best.score) best = { post: post.id, score };
    }
    roads.set(from.id, best);
    return best;
  };
  const L = AI_LEVELS[p.ai!];
  const want = p.epoch >= 2 ? L.traders : Math.ceil(L.traders / 2);
  const queued = market.queue.filter((q) => q.unit === 'trader').length;
  if (v.traders.length + queued < want && market.queue.length < 2 && p.pop < p.cap && bestRoad(market).score >= 1e6) {
    // (Only on a road that keeps clear of rival towns: none are trained to be lost on the others.)
    const cost = unitStats('trader', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: market.id, unit: 'trader' });
      spend(v, cost);
    }
  }
  // Idle traders take the best road; those on a road that has just cost one turn onto a better one.
  for (const u of v.traders) {
    if (u.inside || !(u.order.k === 'idle' || (u.order.k === 'trade' && shunned(u.order.post)))) continue;
    const from = nearestMarket(s, p.id, u.x, u.y) ?? market;
    const best = bestRoad(from).post;
    if (best >= 0 && !(u.order.k === 'trade' && u.order.post === best)) issue({ t: 'route', p: p.id, ids: [u.id], post: best });
  }
  // A post flooded by its own traders (#493): move one to the fresher post when that pays a fifth more.
  for (const u of v.traders) {
    if (u.inside || u.order.k !== 'trade' || u.order.phase === 'back' || shunned(u.order.post)) continue;
    const cur = postAt(s, u.order.post);
    const from = nearestMarket(s, p.id, u.x, u.y) ?? market;
    const best = postAt(s, bestRoad(from).post);
    if (cur && best && best.id !== cur.id && tripGold(s, p.id, from, best) > tripGold(s, p.id, from, cur) * 1.2) issue({ t: 'route', p: p.id, ids: [u.id], post: best.id });
  }
}

/**
 * Merchant ships: with a Dock, a port post within reach and gold to spare, keep one (two at Hard) sailing
 * to the port that pays best; a sunk one is not replaced until the Dock has had a quiet spell.
 */
function seaMerchants(s: GameState, v: View, issue: (c: Command) => void): void {
  const { p } = v;
  const L = AI_LEVELS[p.ai!];
  if (!L.traders || p.epoch < 2 || v.citizens.length < 18) return;
  const dock = v.buildings.find((b) => b.type === 'dock' && b.built);
  if (!dock) return;
  let best: TradePost | null = null;
  let bestGold = 0;
  for (const post of s.posts) {
    if (!portSpot(s, post, p.id)) continue;
    const g = tripGold(s, p.id, dock, post, true);
    if (g > bestGold) {
      bestGold = g;
      best = post;
    }
  }
  if (!best) return;
  const want = p.ai === 'hard' ? 2 : 1;
  const queued = dock.queue.filter((q) => q.unit === 'cog').length;
  if (v.cogs.length + queued < want && dock.queue.length < 2 && p.pop < p.cap) {
    const cost = unitStats('cog', p.epoch).cost;
    if (afford(v, { ...cost, gold: (cost.gold ?? 0) + 100 })) {
      issue({ t: 'train', p: p.id, building: dock.id, unit: 'cog' });
      spend(v, cost);
    }
  }
  for (const u of v.cogs) if (!u.inside && u.order.k === 'idle') issue({ t: 'route', p: p.id, ids: [u.id], post: best.id });
}

// ---- Campaign goals --------------------------------------------------------------------------------

/** How a chapter's goals bend the army's plans: hold at home, attack early with smaller waves, or throw everything in. */
interface Plan {
  hold: boolean;
  /** Wave size when the goals want the rival town gone; 0 when they don't. */
  wave: number;
  allIn: boolean;
  /** The last epoch worth reaching: a chapter's clock is better spent on its goals than on epochs it doesn't ask for. */
  maxEpoch: number;
  /** Siege engines to keep when there are walls and a Town Center to break. */
  siege: number;
  /** Where the army strikes, when the goals name a building (a rival Town Center). */
  target: Building | null;
}
const NO_PLAN: Plan = { hold: false, wave: 0, allIn: false, maxEpoch: 99, siege: 0, target: null };

/** What trains each unit a goal can ask for. */
const TRAINED_AT: Partial<Record<UnitType, BuildingType>> = { siege: 'workshop', warship: 'dock', transport: 'dock', bomber: 'airfield', fighter: 'airfield', priest: 'temple', infantry: 'barracks', ranged: 'range', cavalry: 'stable' };

/**
 * When a computer plays a campaign chapter's own seat (to show a chapter can be won), it works toward
 * the goals: raises the buildings they name, trains the units they count, holds at home while it
 * must survive, and attacks early (then with everything as the clock runs down) when the rival town
 * must fall. Rivals, and every ordinary match, never come here.
 */
function chapterGoals(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): Plan {
  const run = s.scenario;
  const { p } = v;
  if (!run || run.result || p.id !== 0) return NO_PLAN;
  const sc = scenarioById(run.id);
  if (!sc) return NO_PLAN;
  const recently = (type: BuildingType, sec: number) => s.tick - (mem.ordered[type] ?? -99999) < secs(sec);
  const open = sc.objectives.filter((o, i) => !run.done[i] && (!o.bonus || o.kind === 'units' || o.kind === 'build' || o.kind === 'epoch'));
  // Epochs only as far as a goal (a bonus one too) asks; with no epoch goals, as far as the rivals have got.
  let maxEpoch = p.epoch;
  for (const o of open) if (o.kind === 'epoch') maxEpoch = Math.max(maxEpoch, o.n);
  for (const q of s.players) if (q.team !== p.team && !q.defeated) maxEpoch = Math.max(maxEpoch, q.epoch);
  const plan: Plan = { hold: false, wave: 0, allIn: false, maxEpoch, siege: 0, target: null };
  const enemy = enemyHome(s, p);
  const ex = enemy.x - v.home.x;
  const ey = enemy.y - v.home.y;
  const el = Math.sqrt(ex * ex + ey * ey) || 1;
  const fx = ex / el;
  const fy = ey / el;
  for (const o of open) {
    const [now, goal] = progress(s, o, p.id);
    if (o.kind === 'survive') plan.hold = true;
    else if (o.kind === 'destroy') {
      // Bigger waves for each rival still standing: a lone early wave into two towns only feeds them.
      const rivals = s.players.filter((q) => q.team !== p.team && !q.defeated).length;
      plan.wave = 10 + (rivals - 1) * 14 + mem.wave * 2;
      plan.siege = 4;
      // A rival's wonder wins the match if it stands: it falls first, before any Town Center (#36).
      plan.target = rivalWonder(s, p) ?? rivalTownCenter(s, p);
      const left = sc.limit ? sc.limit - s.tick / 20 : Infinity;
      plan.allIn = sc.limit ? left < sc.limit * 0.45 : false;
    } else if (o.kind === 'build' && now < goal && o.type) {
      const type = o.type as BuildingType;
      if (BUILDINGS[type].epoch > p.epoch || buildBarred(p, type)) continue;
      const placed = count(v, type);
      if (placed >= goal) continue;
      const cost = buildingCostFor(s, p.id, type);
      if (type === 'wall') {
        if (recently('wall', 15)) continue;
        // A line of wall across the way the rival comes, a little in front of the Town Center.
        const need = goal - placed + 2;
        const cx = v.home.x + fx * (11 + (placed > 0 ? 3 : 0));
        const cy = v.home.y + fy * (11 + (placed > 0 ? 3 : 0));
        const half = Math.ceil(need / 2);
        const x0 = Math.floor(cx - fy * half);
        const y0 = Math.floor(cy + fx * half);
        const x1 = Math.floor(cx + fy * half);
        const y1 = Math.floor(cy - fx * half);
        const all = RES.every((r) => !cost[r] || v.budget[r] >= cost[r]! * need);
        const crew = v.citizens.filter((u) => !u.inside && u.order.k !== 'build' && !(u.order.k === 'farm' && u.order.phase === 'work')).sort((a, b) => a.id - b.id).slice(0, 4);
        if (all && crew.length) {
          issue({ t: 'wall', p: p.id, ids: crew.map((u) => u.id), x0, y0, x1, y1 });
          for (const r of RES) v.budget[r] -= (cost[r] ?? 0) * need;
          mem.ordered.wall = s.tick;
        } else for (const r of RES) v.budget[r] -= (cost[r] ?? 0) * need;
        continue;
      }
      if (recently(type, 25)) {
        spend(v, cost);
        continue;
      }
      let spot: { tx: number; ty: number } | null;
      if (type === 'dock') spot = findDockSpot(s, v.home.x, v.home.y, 30);
      else if (type === 'tower') spot = findSpot(s, type, v.home.x + fx * 8 - fy * (placed % 2 ? 4 : -4), v.home.y + fy * 8 + fx * (placed % 2 ? 4 : -4), 0, 12);
      else spot = findSpot(s, type, v.home.x, v.home.y, 6, 22);
      if (!spot || !construct(s, v, mem, type, spot, type === 'tower' ? 3 : 4, issue)) spend(v, cost);
    } else if (o.kind === 'units' && o.type) {
      const type = o.type as UnitType;
      if (unitEpoch(type) > p.epoch) continue;
      const at = TRAINED_AT[type];
      if (!at) continue;
      const where = v.buildings.filter((b) => b.type === at && b.built);
      if (!where.length) {
        // Raise what trains it, unless the goal list already does.
        if (!open.some((q) => q.kind === 'build' && q.type === at) && !count(v, at) && !recently(at, 30) && BUILDINGS[at].epoch <= p.epoch) {
          const spot = at === 'dock' ? findDockSpot(s, v.home.x, v.home.y, 30) : findSpot(s, at, v.home.x + fx * 6, v.home.y + fy * 6, 0, 18);
          const cost = buildingCostFor(s, p.id, at);
          if (!spot || !construct(s, v, mem, at, spot, 4, issue)) spend(v, cost);
        }
        continue;
      }
      const cost = unitStats(type, p.epoch).cost;
      // Dear units wait for a town that can pay for them and still grow.
      if ((cost.wood ?? 0) + (cost.gold ?? 0) + (cost.food ?? 0) > 300 && v.hands < 25) continue;
      const queued = where.reduce((n, b) => n + b.queue.filter((q) => q.unit === type).length, 0);
      // Keep a few spare: some will be lost before the count is reached.
      if (now + queued >= goal + (o.bonus ? 0 : 1)) continue;
      const b = where.sort((a, c) => a.queue.length - c.queue.length || a.id - c.id)[0];
      if (b.queue.length < 2 && afford(v, cost) && p.pop < p.cap) {
        issue({ t: 'train', p: p.id, building: b.id, unit: type });
        spend(v, cost);
      } else if (!o.bonus) spend(v, cost);
    }
  }
  if (plan.wave) {
    plan.hold = false;
    // Food and wood piling up while the rival town stands: more places to train soldiers.
    if (v.budget.food > 800 && v.budget.wood > 600 && v.hands >= 30) {
      for (const type of ['barracks', 'range', 'stable'] as BuildingType[]) {
        if (count(v, type) >= 4 || recently(type, 30) || BUILDINGS[type].epoch > p.epoch) continue;
        const spot = findSpot(s, type, v.home.x + fx * 6, v.home.y + fy * 6, 0, 20);
        if (spot && construct(s, v, mem, type, spot, 3, issue)) break;
      }
    }
  }
  return plan;
}

/**
 * A rival's wonder, the nearest. The goal names Town Centers, but a wonder left standing five minutes
 * wins the match for its builder: in Wings over the Steppe a seat that had killed three times what it
 * lost marched past the Tsar's wonder at a Town Center and lost to it at 24 minutes.
 */
function rivalWonder(s: GameState, p: Player): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'wonder' || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    const d = (e.x - p.startX) * (e.x - p.startX) + (e.y - p.startY) * (e.y - p.startY);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** The goal's target: the nearest standing Town Center of a rival, one not yet burned first. */
function rivalTownCenter(s: GameState, p: Player): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  const burned = s.scenario?.burned ?? [];
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'towncenter' || !e.built || e.hp <= 0 || !isEnemy(s, p.id, e.owner)) continue;
    const d = (e.x - p.startX) * (e.x - p.startX) + (e.y - p.startY) * (e.y - p.startY) + (burned.includes(e.owner) ? 1e6 : 0);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

