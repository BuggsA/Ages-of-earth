import { applyCommand, heroBusy, MAX_QUEUE } from './commands';
import { AGES, AI_FAITH, CONSECRATE, AI_LEVELS, AI_MARK, AI_RAID, AI_WEB, AI_WILD, AI_WINTER, BONUS, BUILDINGS, COUNTER, SIGNATURES, LAST_EPOCH, MARKET, POP_MAX, RALLY, TECHS, WORKS, AMOUNT, secs, unitEpoch, unitStats, type Road } from './data';
import { NAVAL, distToRect, nearestWalkable, placeProblem, walkable } from './grid';
import { buildingCostFor, techCostFor, techProblem, trainCostFor } from './stats';
import type { AgeId, AiMemory, Animal, Building, BuildingType, Command, Cost, GameState, Landmark, Player, Res, Ruin, TechId, TradePost, Unit, UnitType } from './types';
import { RES, R_BERRY, R_BOG, R_FISH, R_GOLD, R_MEAT, R_NONE, R_STONE, R_TREE } from './types';
import { ageOf, barred, deedsDone, deedsProgress, hiresAt, type DeedProgress, isSideRoad, mainRoad, relicsKept, roadKnown, roadsFrom } from './ages';
import { carriedBy } from './relics';
import { claimants, favours, landmarkAt } from './landmarks';
import { cargoRoom, coastNear, findResource, freeFarm, nearestTemple } from './units';
import { goalForPost, nearestMarket, portSpot, tripGold } from './trade';
import { findRoute } from './path';
import { isEnemy, maxHp } from './world';
import { borderMap, suppliedAt } from './borders';
import { workProblem } from './works';
import { beaconProblem, lit } from './beacon';
import { rallyProblem } from './rally';
import { consecrateProblem, consecrates } from './consecrate';
import { sees } from './vision';
import { seasonAt } from './seasons';
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
  'plow', 'drying', 'hounds', 'axes', 'wheelbarrow', 'picks', 'forging', 'bloomery', 'scaleArmor', 'fletching', 'husbandry', 'irrigation', 'saws', 'shafts', 'handcart',
  'ironCasting', 'chainMail', 'bodkin', 'masonry', 'theology', 'conscription', 'blastFurnace', 'plateArmor', 'chemistry',
  'gillnets', 'shipwright', 'lighthouse', 'steamEngine', 'rifling', 'aviation', 'caravan', 'banking', 'pilgrimage', 'credit', 'ropewalk', 'litany',
  // Heirlooms (#224): techProblem keeps them shut until both their ages are walked.
  'bellFoundry', 'ironHulls', 'jointStock', 'masonsLodge',
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
  const buildings: Building[] = [];
  let king: Unit | null = null;
  for (const e of s.ents) {
    if (e.owner !== p.id || e.hp <= 0) continue;
    if (e.kind === 'unit' && s.kings[p.id] === e.id) king = e;
    else if (e.kind === 'unit') {
      const list =
        e.type === 'citizen' ? citizens : e.type === 'priest' ? priests : e.type === 'trader' ? traders : e.type === 'cog' ? cogs : e.type === 'fisher' ? fishers : e.type === 'warship' || e.type === 'transport' ? navy : e.type === 'fighter' || e.type === 'bomber' ? planes : army;
      list.push(e);
    } else buildings.push(e);
  }
  const tc = buildings.find((b) => b.type === 'towncenter' && b.built) ?? null;
  // A King stays out of harm's way, sheltered in the Town Center.
  if (king && tc && !king.inside && king.order.k !== 'garrison') applyCommand(s, { t: 'garrison', p: p.id, ids: [king.id], target: tc.id });
  const home = tc ? { x: tc.x, y: tc.y } : { x: p.startX, y: p.startY };
  const v: View = { p, citizens, army, priests, traders, cogs, fishers, navy, planes, buildings, home, tc, budget: { ...p.res }, plan: NO_PLAN, diggers: new Set(), armyFirst: false, claimers: new Set() };
  const issue = (c: Command) => applyCommand(s, c);

  // The iron road's survey (#50) is cheap and first in line: in the Stone Age, citizens eat every scrap.
  // It waits for a town of `survey` citizens (#79): at ten, it held up the citizens of a town that might
  // find no bog at all, the very ones that win the first fight.
  ironRoad(s, v, mem, issue);

  // People first: a growing town pays for everything else.
  const advancing = buildings.some((b) => b.advance >= 0);
  const queuedCitizens = buildings.reduce((n, b) => n + b.queue.filter((q) => q.unit === 'citizen').length, 0);
  const wantCitizens = Math.min(L.citizens + p.epoch * 3, 60);
  if (tc && !advancing && citizens.length + queuedCitizens < wantCitizens && tc.queue.length < 2) {
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
  const wantEpoch = p.epoch < Math.min(LAST_EPOCH, v.plan.maxEpoch) && !advancing && !armyFirst && citizens.length >= ADVANCE_AT[p.epoch] && s.tick > secs(150 + p.epoch * 150);
  // Patience for a road's deeds counts only while the Town Center holds for them (#113): army-first
  // kept a town from holding for minutes, and it came back out of patience at once.
  if (!wantEpoch) delete mem.waiting;
  const journey = advancing ? null : (!armyFirst && turnRoad(s, v, mem)) || (wantEpoch ? nextRoad(s, v, mem) : null);
  if (journey) {
    const { road, wait } = journey;
    // The main road forward goes without a target, as it always has; any other road is named.
    if (!wait && tc && tc.queue.length === 0 && afford(v, road.cost)) issue({ t: 'advance', p: p.id, building: tc.id, ...(road === mainRoad(p) ? {} : { to: road.to }) });
    spend(v, road.cost);
  }

  // In the age of flight, save up for an airfield before anything smaller takes the wood.
  if (L.clever && p.epoch >= 4 && citizens.length >= 24 && !buildings.some((b) => b.type === 'airfield')) {
    const cost = buildingCostFor(s, p.id, 'airfield');
    const recent = s.tick - (mem.ordered.airfield ?? -99999) < secs(40);
    const spot = !recent && afford(v, cost) ? findSpot(s, 'airfield', home.x, home.y, 6, 22) : null;
    if (!spot || !construct(s, v, mem, 'airfield', spot, 3, issue)) spend(v, cost);
  }

  townBell(s, v, mem, issue);
  greatWork(s, v, mem, issue);
  lightBeacons(s, v, issue);
  rallyTheLine(s, v, issue);
  research(s, v, citizens.length >= wantCitizens - 2, issue);
  trade(s, v, issue);
  planBuildings(s, v, mem, issue);
  excavate(s, v, mem, issue);
  claimWalk(s, v, mem, issue);
  assignCitizens(s, v, issue);
  wilds(s, v, mem, issue);
  // Ships and aircraft are few and dear: they get first call on the treasury.
  seafaring(s, v, mem, issue);
  airforce(s, v, mem, issue);
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
    const at = v.buildings.find((b) => b.type === TECHS[tech].at && b.built && b.queue.length === 0 && b.advance < 0);
    if (!at) continue;
    // The Town Center trains citizens first.
    if (at.type === 'towncenter' && !peopleEnough && v.citizens.length < 12) continue;
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
  if (!AI_LEVELS[p.ai!].clever || !v.buildings.some((b) => b.type === 'market' && b.built)) return;
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
  if (age.no?.units.includes(sig)) return -1;
  const cls = unitStats(sig, 0).cls;
  return (age.price?.[cls] ?? 1) < 1 ? 1 : 0;
}

/** Whether it means to walk the road to a side age, decided the first time it asks (#50). */
function wants(s: GameState, p: Player, mem: AiMemory, to: AgeId): boolean {
  const roads = (mem.roads ??= {});
  if (roads[to] === undefined) {
    const f = fit(p, to);
    roads[to] = f > 0 || (f === 0 && roll(s) < AI_WEB.take);
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
  if (!deeds.every(underWay)) return false;
  mem.waiting ??= s.tick;
  // A deed nearly done earns more patience (#113): a Greek town gave up its dig at 135 bog iron of 150,
  // seconds from the Iron Age, with the price of it banked.
  const close = deeds.every((d) => d.have >= d.need * AI_WEB.close);
  if (s.tick - mem.waiting <= secs(AI_WEB.patience * (close ? 2 : 1))) return true;
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
      if (deedsDone(p, r)) {
        delete mem.waiting;
        return { road: r, wait: false };
      }
      if (worthWaiting(s, v, mem, r)) return { road: r, wait: true };
    }
  }
  delete mem.waiting;
  return main ? { road: main, wait: false } : null;
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
  const kept = relicsKept(s, p.id);
  for (const r of roadsFrom(p)) {
    if (AGES[r.to].tier !== p.epoch) continue;
    if (r.to === 'aeronaut' && v.planes.length > 0 && roadKnown(s, p, r) && wants(s, p, mem, r.to)) return { road: r, wait: false };
    if (here === 'aeronaut' && r.to === 'industrial' && count(v, 'airfield', true) === 0) {
      mem.roads ??= {};
      mem.roads.aeronaut = false;
      return { road: r, wait: false };
    }
    if (here === 'pilgrim' && r.to === 'middle' && kept === 0) return { road: r, wait: false };
    // A coastal people turns sailor once its boats have landed the catch; with its last Dock gone, it comes ashore.
    if (here === 'sail' && r.to === 'middle' && count(v, 'dock', true) === 0) {
      mem.roads ??= {};
      mem.roads.sail = false;
      return { road: r, wait: false };
    }
    if (r.to === 'sail' && count(v, 'dock', true) > 0 && roadKnown(s, p, r) && deedsDone(p, r) && wants(s, p, mem, r.to)) return { road: r, wait: false };
    if (r.to !== 'pilgrim' || kept < AI_WEB.relics || !roadKnown(s, p, r) || !deedsDone(p, r) || !wants(s, p, mem, r.to)) continue;
    return { road: r, wait: false };
  }
  return null;
}

/**
 * The iron road (#39), in the Stone Age: a people the Iron Age would suit has the land surveyed at a
 * Storehouse; if the survey finds bog iron, it keeps a few citizens digging until the deed is done.
 */
function ironRoad(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  const road = roadsFrom(p).find((r) => r.to === 'iron');
  // Once the deed is dug, or the road given up, bog iron is only a poor gold mine: diggers go back to
  // what the town needs (#79). Left to it, they walked from one bog to the next all through the Stone Age.
  // In the Iron Age itself the bog pays double gold: its diggers stay.
  if (ageOf(p) === 'iron') return;
  if (!road || deedsDone(p, road) || mem.roads?.iron === false) {
    releaseDiggers(s, v, issue);
    return;
  }
  if (p.epoch !== 0 || !walksWeb(v) || v.citizens.length < AI_WEB.survey || count(v, 'barracks', true) === 0 || fit(p, 'iron') < 0) return;
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
  if (!roadKnown(s, p, road) || !wants(s, p, mem, 'iron') || deedsDone(p, road)) return;
  for (const u of v.citizens) if (u.order.k === 'gather' && (u.order.bog || s.res[u.order.tile] === R_BOG)) v.diggers.add(u.id);
  // Holding the Town Center for the deed, it digs harder (#79): idle savings are the dearest wait.
  const crew = mem.waiting !== undefined ? AI_WEB.diggers * 2 : AI_WEB.diggers;
  if (v.diggers.size >= crew) return;
  // The nearest gatherers of wood or gold (or anyone idle) go to the nearest bog.
  const bog = findResource(s, R_BOG, v.home.x, v.home.y, 40);
  if (bog < 0) return;
  const bx = (bog % s.w) + 0.5;
  const by = Math.floor(bog / s.w) + 0.5;
  const free = v.citizens
    .filter((u) => !u.inside && !v.diggers.has(u.id) && u.carry <= 2 && (u.order.k === 'idle' || (u.order.k === 'gather' && (u.order.res === 'wood' || u.order.res === 'gold'))))
    .sort((a, c) => (a.x - bx) * (a.x - bx) + (a.y - by) * (a.y - by) - ((c.x - bx) * (c.x - bx) + (c.y - by) * (c.y - by)) || a.id - c.id);
  const ids = free.slice(0, crew - v.diggers.size).map((u) => u.id);
  if (!ids.length) return;
  issue({ t: 'gather', p: p.id, ids, tile: bog });
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

// ---- Building --------------------------------------------------------------------------------------

/** A free spot for a building near a point, keeping a lane open around it. */
export function findSpot(s: GameState, type: BuildingType, x: number, y: number, minR: number, maxR: number, margin = 1): { tx: number; ty: number } | null {
  const n = BUILDINGS[type].size;
  const cx = Math.floor(x - n / 2);
  const cy = Math.floor(y - n / 2);
  for (let r = minR; r <= maxR; r++) {
    // Start each ring at a different side, so buildings don't all line up.
    const start = Math.floor(roll(s) * 8 * Math.max(1, r));
    const ring: [number, number][] = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([dx, dy]);
    for (let k = 0; k < ring.length; k++) {
      const [dx, dy] = ring[(k + start) % ring.length];
      const tx = cx + dx;
      const ty = cy + dy;
      if (placeProblem(s, type, tx, ty)) continue;
      if (margin && !laneClear(s, tx, ty, n, type === 'farm')) continue;
      return { tx, ty };
    }
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
      if (placeProblem(s, 'dock', tx, ty)) continue;
      const cx = tx + 1.5;
      const cy = ty + 1.5;
      const home = Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y));
      if (home > maxR) continue;
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
  const cost = buildingCostFor(s, v.p.id, type);
  if (!afford(v, cost)) return false;
  const cx = spot.tx + BUILDINGS[type].size / 2;
  const cy = spot.ty + BUILDINGS[type].size / 2;
  const rank = (u: Unit) => {
    const o = u.order;
    const job = o.k === 'idle' ? 0 : o.k === 'gather' && o.res === 'wood' ? 1 : o.k === 'gather' ? 2 : o.k === 'build' ? 4 : 3;
    const dx = u.x - cx;
    const dy = u.y - cy;
    return job * 1000 + Math.sqrt(dx * dx + dy * dy);
  };
  const crew = v.citizens
    .filter((u) => !(u.order.k === 'farm' && u.order.phase === 'work') && u.order.k !== 'build' && !u.inside)
    .sort((a, b) => rank(a) - rank(b) || a.id - b.id)
    .slice(0, builders);
  if (!crew.length) return false;
  issue({ t: 'build', p: v.p.id, ids: crew.map((u) => u.id), type, tx: spot.tx, ty: spot.ty });
  spend(v, cost);
  mem.ordered[type] = s.tick;
  return true;
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
  if (!v.tc && !v.buildings.some((b) => b.type === 'towncenter') && v.citizens.length && !recently('towncenter', 30)) {
    const spot = findSpot(s, 'towncenter', home.x, home.y, 0, 14);
    if (spot) construct(s, v, mem, 'towncenter', spot, 4, issue);
    return;
  }

  // Houses ahead of need (two at once later on).
  const housesBuilding = pending.filter((b) => b.type === 'house').length;
  const room = p.cap - p.pop;
  if (p.cap < POP_MAX && room <= 3 + p.epoch * 2 && housesBuilding < (p.pop > 40 ? 2 : 1) && !recently('house', 4)) {
    const spot = findSpot(s, 'house', home.x, home.y, 5, 22);
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

  // Fields once the berries near home run short of feeding everyone who should be on food.
  const berries = findResource(s, R_BERRY, home.x, home.y, 14);
  const farms = count(v, 'farm');
  const freeFields = v.buildings.filter((b) => b.type === 'farm' && !v.citizens.some((u) => u.order.k === 'farm' && u.order.target === b.id)).length;
  // Autumn onward the clever computer plans for winter: berries fail in the cold, so fields go up first.
  const coldComing_ = coldComing(s, v);
  const foodWanted = Math.round(wanted(v).food) - (berries >= 0 && !coldComing_ ? 6 : 0) + (coldComing_ ? AI_WINTER.fields : 0);
  if (farms < foodWanted && freeFields < 2 && !recently('farm', 2)) {
    const spot = findSpot(s, 'farm', home.x, home.y, 3, 16);
    if (spot && construct(s, v, mem, 'farm', spot, 1, issue)) return;
  }

  const n = v.citizens.length;
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
    const kill = (s.carcasses ?? []).find((c) => {
      const tx = (c.tile % s.w) + 0.5;
      const ty = Math.floor(c.tile / s.w) + 0.5;
      if (s.res[c.tile] !== R_MEAT || s.amount[c.tile] < AI_WILD.campMeat) return false;
      if ((tx - home.x) * (tx - home.x) + (ty - home.y) * (ty - home.y) > AI_WILD.campNear * AI_WILD.campNear) return false;
      return !v.buildings.some((b) => BUILDINGS[b.type].drop.includes('food') && distToRect(tx, ty, b) < AI_WILD.campFar && (b.built || b.type === 'huntcamp'));
    });
    if (kill && n >= 12 && p.res.wood >= 120 && count(v, 'huntcamp') < 3 && !recently('huntcamp', 25)) {
      const spot = findSpot(s, 'huntcamp', (kill.tile % s.w) + 0.5, Math.floor(kill.tile / s.w) + 0.5, 2, 5);
      if (spot && construct(s, v, mem, 'huntcamp', spot, 2, issue)) return;
    }
  }

  // Against a people of iron (cheap, hard-hitting foot), a second range early (#50).
  const ironRival = clever && rivalIn(s, p, ['iron']);

  // Trading posts make a Market worth saving for: set its wood aside so soldiers don't eat it.
  // Bound for the merchants' age, it raises one early, but never with soldiers owed (#79): set aside
  // there, the Market's wood starved the Bronze Age army and the town stalled behind army-first.
  if (s.posts.length && (p.epoch >= 2 || (merchantBound(s, v, mem) && !v.armyFirst)) && n >= 18 && count(v, 'market') === 0 && !recently('market', 25)) {
    const cost = buildingCostFor(s, p.id, 'market');
    const spot = afford(v, cost) ? findSpot(s, 'market', home.x, home.y, 6, 18) : null;
    if (spot && construct(s, v, mem, 'market', spot, 3, issue)) return;
    spend(v, cost);
  }

  // A dock, where there is fish and water to sail near home.
  if (n >= 9 && count(v, 'dock') === 0 && !recently('dock', 40) && s.tick - (mem.dockless ?? -99999) > secs(120)) {
    const spot = findDockSpot(s, home.x, home.y, 24);
    if (!spot) mem.dockless = s.tick;
    else if (construct(s, v, mem, 'dock', spot, 2, issue)) return;
  }

  const want: [BuildingType, boolean][] = [
    ['barracks', n >= 8 && count(v, 'barracks') === 0],
    ['range', n >= 12 && count(v, 'range') === 0],
    ['range', ironRival && p.epoch >= 1 && n >= 16 && count(v, 'range') < 2],
    ['stable', p.epoch >= 1 && n >= 14 && count(v, 'stable') === 0],
    ['forge', p.epoch >= 1 && n >= 16 && count(v, 'forge') === 0],
    // Relics lying loose are worth a Temple early.
    ['temple', clever && p.epoch >= 1 && n >= 16 && count(v, 'temple') === 0 && looseRelics(s) > 0],
    ['tower', p.epoch >= 1 && count(v, 'tower') < L.towers && n >= 16],
    ['market', clever && p.epoch >= 1 && n >= 20 && count(v, 'market') === 0],
    ['workshop', clever && p.epoch >= 2 && n >= 20 && count(v, 'workshop') === 0],
    ['temple', clever && p.epoch >= 2 && n >= 22 && count(v, 'temple') === 0],
    ['barracks', p.epoch >= 2 && n >= 22 && count(v, 'barracks') < 2],
    ['range', p.epoch >= 2 && n >= 24 && count(v, 'range') < 2],
    ['stable', p.epoch >= 3 && n >= 26 && count(v, 'stable') < 2],
  ];
  for (const [type, ok] of want) {
    if (!ok || recently(type, 25) || BUILDINGS[type].epoch > p.epoch) continue;
    // Not a building whose every line the age bars (a Stable in the Iron Age).
    const lines = BUILDINGS[type].trains;
    if (lines.length && lines.every((u) => barred(p, u))) continue;
    const at = type === 'tower' ? towardEnemy(9) : type === 'market' || type === 'temple' ? home : towardEnemy(6);
    const spot = findSpot(s, type, at.x, at.y, type === 'market' || type === 'temple' ? 6 : 0, 18);
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
  if (o.k === 'farm' || o.k === 'hunt') return 'food';
  if (o.k === 'build') return 'build';
  return null;
}

/** Autumn onward, a clever computer plans for the winter ahead (`AI_WINTER`). */
function coldComing(s: GameState, v: View): boolean {
  return AI_LEVELS[v.p.ai!].clever && seasonAt(s) >= AI_WINTER.from;
}

/** How many citizens each resource should have now: the epoch's shares, leaning away from what piles up. */
function wanted(v: View, cold = false): Record<Res, number> {
  const share = SHARE[v.p.epoch];
  const weight: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  let total = 0;
  for (const r of RES) {
    const stock = v.p.res[r];
    const lean = stock > 1200 ? 0.15 : stock > 700 ? 0.4 : stock > 400 ? 0.7 : stock < 80 ? 1.4 : 1;
    weight[r] = share[r] * lean * (cold && r === 'food' ? 1 + AI_WINTER.food : 1);
    total += weight[r];
  }
  const n = v.citizens.filter((u) => u.order.k !== 'build' && !u.inside).length;
  const out: Record<Res, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const r of RES) out[r] = (weight[r] / total) * n;
  return out;
}

function nearestDeer(s: GameState, x: number, y: number, r: number): Animal | null {
  let best: Animal | null = null;
  let bestD = r * r;
  for (const a of s.animals) {
    if (a.kind !== 'deer') continue;
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
    const meat = findResource(s, R_MEAT, v.home.x, v.home.y, 14);
    if (meat >= 0) {
      issue({ t: 'gather', p: v.p.id, ids: [u.id], tile: meat });
      return true;
    }
    // A few hunters while there is game close to home.
    const hunters = v.citizens.filter((c) => c.order.k === 'hunt').length;
    const deer = hunters < 3 ? nearestDeer(s, v.home.x, v.home.y, 16) : null;
    if (deer) {
      issue({ t: 'hunt', p: v.p.id, ids: [u.id], target: deer.id });
      return true;
    }
    const berry = findResource(s, R_BERRY, v.home.x, v.home.y, 16);
    if (berry >= 0) {
      issue({ t: 'gather', p: v.p.id, ids: [u.id], tile: berry });
      return true;
    }
    const farm = freeFarm(s, v.p.id, v.home.x, v.home.y, 24);
    if (farm) {
      issue({ t: 'work', p: v.p.id, ids: [u.id], target: farm.id });
      return true;
    }
    return false;
  }
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
    if (b.built || v.citizens.some((u) => u.order.k === 'build' && u.order.target === b.id)) continue;
    const helper = v.citizens
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
    const mover = v.citizens.find((u) => jobOf(u) === over && u.carry <= 2 && u.order.k !== 'farm' && u.order.k !== 'hunt' && !u.inside && !v.diggers.has(u.id));
    if (mover) sendTo(s, v, mover, under, issue);
  }
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
  if (v.citizens.length >= AI_WILD.mammothAt - eager && !v.citizens.some((u) => hunting(u, 'mammoth'))) {
    const m = nearestBeast(s, 'mammoth', v.home.x, v.home.y, AI_WILD.mammothNear);
    if (m && m.state !== 'fight') {
      const party = v.citizens
        .filter((u) => !u.inside && u.carry <= 2 && !v.diggers.has(u.id) && u.order.k === 'gather' && (u.order.res === 'food' || u.order.res === 'wood'))
        .sort((a, b) => (a.x - m.x) * (a.x - m.x) + (a.y - m.y) * (a.y - m.y) - ((b.x - m.x) * (b.x - m.x) + (b.y - m.y) * (b.y - m.y)) || a.id - b.id)
        .slice(0, AI_WILD.party);
      if (party.length === AI_WILD.party) issue({ t: 'hunt', p: v.p.id, ids: party.map((u) => u.id), target: m.id });
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
  if (mem.attacking || v.army.some((u) => hunting(u, 'wolf'))) return;
  const wolf = nearestBeast(s, 'wolf', v.home.x, v.home.y, AI_WILD.clear);
  if (!wolf) return;
  const free = v.army.filter((u) => !u.inside && (u.order.k === 'idle' || (u.order.k === 'move' && !u.order.amove)) && u.type !== 'siege');
  const need = cold && seasonAt(s) === 3 ? AI_WILD.pack - AI_WINTER.pack : AI_WILD.pack;
  if (free.length >= need) issue({ t: 'hunt', p: v.p.id, ids: free.map((u) => u.id), target: wolf.id });
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

// ---- Contested landmarks -------------------------------------------------------------------------------

/**
 * The nearest landmark within reach of home for it to go after: for a citizen (`free`), one nobody keeps;
 * for soldiers, one a rival keeps, or one nobody keeps that a rival is part way to claiming.
 */
function markToTake(s: GameState, v: View, free: boolean, safe: boolean): Landmark | null {
  let best: Landmark | null = null;
  const rival = enemyHome(s, v.p);
  // Going for lordship, no landmark is too far.
  const reach = s.mode === 'lords' ? AI_MARK.lordsReach : Math.max(AI_MARK.near, AI_MARK.rival * Math.sqrt((rival.x - v.home.x) * (rival.x - v.home.x) + (rival.y - v.home.y) * (rival.y - v.home.y)));
  let bestD = reach * reach;
  for (const m of s.landmarks ?? []) {
    // Soldiers also go to a landmark of ours that rivals are standing on.
    if (free ? m.owner >= 0 : m.owner >= 0 ? !isEnemy(s, v.p.id, m.owner) && !pulledDown(s, v.p, m) : !(m.by >= 0 && m.claim > 0 && isEnemy(s, v.p.id, m.by))) continue;
    if (safe && ruinDanger(s, v.p, m, 10)) continue;
    const w = markWorth(s, v, m);
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
  // Fishing boats: as many as there are shoals near the dock, up to a few.
  const shoals = countFish(s, dock.x, dock.y, 14);
  const wantBoats = Math.min(shoals, 2 + p.epoch, L.clever ? 6 : 4);
  const queued = (u: UnitType) => dock.queue.filter((q) => q.unit === u).length;
  if (v.fishers.length + queued('fisher') < wantBoats && dock.queue.length < 2) {
    const cost = unitStats('fisher', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: dock.id, unit: 'fisher' });
      spend(v, cost);
    }
  }
  for (const f of v.fishers) {
    if (f.order.k !== 'idle') continue;
    const t = findResource(s, R_FISH, f.x, f.y, 18);
    if (t >= 0) issue({ t: 'gather', p: p.id, ids: [f.id], tile: t });
  }
  // Warships: once the Bronze Age opens them, if the enemy has boats or the map is mostly sea.
  if (!L.clever || p.epoch < 1) return;
  seaLanding(s, v, mem, dock, issue);
  // A sailor keeps a small fleet and hunts rival merchant ships, since its ships are cheap and sturdy.
  const sailor = ageOf(p) === 'sail';
  const enemyShips = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.hp > 0 && isEnemy(s, p.id, e.owner) && (e.type === 'warship' || e.type === 'fisher' || e.type === 'transport' || (sailor && e.type === 'cog')) && p.vis[Math.floor(e.y) * s.w + Math.floor(e.x)] === 1);
  const warships = v.navy.filter((u) => u.type === 'warship');
  const wantShips = s.mapType === 'sea' ? Math.min(2 + p.epoch, 6) : enemyShips.length ? Math.min(2 + Math.floor(enemyShips.length / 2), 5) : sailor ? 2 : 0;
  if (warships.length + queued('warship') < wantShips && dock.queue.length < 2 && v.army.length >= 3) {
    const cost = unitStats('warship', p.epoch).cost;
    if (afford(v, cost)) {
      issue({ t: 'train', p: p.id, building: dock.id, unit: 'warship' });
      spend(v, cost);
    } else if (warships.length < 2) spend(v, cost);
  }
  const idle = warships.filter((u) => u.order.k === 'idle');
  if (!idle.length) return;
  // Raid when the army attacks (or when there's a fleet to sink in sight); otherwise guard the dock.
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

function countFish(s: GameState, x: number, y: number, r: number): number {
  let n = 0;
  for (let ty = Math.max(0, Math.floor(y - r)); ty <= Math.min(s.h - 1, y + r); ty++) {
    for (let tx = Math.max(0, Math.floor(x - r)); tx <= Math.min(s.w - 1, x + r); tx++) if (s.res[ty * s.w + tx] === R_FISH) n++;
  }
  return n;
}

/** The enemy's dock it knows of, if any. */
function enemyDock(s: GameState, p: Player): Building | null {
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'dock' && e.hp > 0 && isEnemy(s, p.id, e.owner) && p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)]) return e;
  return null;
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

/** A building of the enemy's worth bombing: their nearest Town Center, or any building known. */
function enemyTarget(s: GameState, p: Player): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !isEnemy(s, p.id, e.owner) || !p.seen[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
    if (e.type === 'wall' || e.type === 'gate' || e.type === 'farm') continue;
    const dx = e.x - p.startX;
    const dy = e.y - p.startY;
    const holds = e.type === 'temple' && s.relics.some((r) => r.temple === e.id);
    const shrine = holds && relicRace(s, p);
    // A pilgrim people's wealth is the relics in its Temples (#50): they come before its Town Center.
    const pilgrims = holds && ageOf(s.players[e.owner]) === 'pilgrim';
    const d = dx * dx + dy * dy + (e.type === 'wonder' || shrine ? -1e6 : pilgrims ? -900 : e.type === 'towncenter' ? -400 : 0);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function pickUnit(v: View, mem: AiMemory, building: Building): UnitType | null {
  const trains = lines(v.p, building).filter((t) => t !== 'citizen' && t !== 'hero' && unitEpoch(t) <= v.p.epoch && !barred(v.p, t));
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

/** Enemy soldiers close to home, and the nearest of them. */
function threatNear(s: GameState, v: View): { unit: Unit | null; count: number } {
  let threat: Unit | null = null;
  let threatD = Infinity;
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, v.p.id, e.owner) || e.type === 'citizen' || e.type === 'trader') continue;
    let near = Infinity;
    for (const b of v.buildings) near = Math.min(near, distToRect(e.x, e.y, b));
    if (near < 12) {
      n++;
      if (near < threatD) {
        threatD = near;
        threat = e;
      }
    }
  }
  return { unit: threat, count: n };
}

/**
 * The people's great work (seed #133), called once an epoch: a trading or farming people spends it while
 * its town is busy at it, a fighting people when a wave marches out or a raid reaches its town.
 */
function greatWork(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  const { p } = v;
  if (!AI_LEVELS[p.ai!].clever || workProblem(s, p)) return;
  const w = WORKS[p.civ];
  const busy = p.civ === 'chinese' ? v.traders.length >= 3 : v.citizens.length >= 14;
  const fight = (mem.attacking && v.army.length >= 6) || threatNear(s, v).count >= 4;
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
  if (!AI_LEVELS[v.p.ai!].clever || !v.tc) return;
  const bell = AI_LEVELS[v.p.ai!].bell;
  const t = threatNear(s, v);
  const defenders = v.army.filter((u) => !u.inside).length;
  if (mem.bell < 0 && t.count >= bell.ring && defenders < t.count / 2) {
    issue({ t: 'bell', p: v.p.id, ring: true });
    mem.bell = s.tick;
  } else if (mem.bell >= 0 && t.count <= bell.quiet && s.tick - mem.bell > secs(bell.hold)) {
    // A straggler or two is the Town Center's arrows to deal with (#113): waiting for none at all, a
    // beaten town kept fifteen citizens inside for nine minutes while a rival's trickle came and went.
    issue({ t: 'bell', p: v.p.id, ring: false });
    mem.bell = -1;
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
  const keepCitizensGrowing = v.citizens.length < 8;
  const siege = v.army.filter((u) => u.type === 'siege').length;
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
    if (b.type === 'workshop') unit = siege < Math.max(v.plan.siege, p.epoch >= 2 ? 3 : 2) && (v.army.length >= 6 || siege < v.plan.siege) ? 'siege' : null;
    else if (b.type === 'temple') unit = v.priests.length < (v.army.length >= 6 ? (consecrates(s, p.id) ? AI_FAITH.priests : 2) : 0) + (looseRelics(s) > 0 ? 1 : 0) ? 'priest' : null;
    else {
      unit = counter && trains.includes(counter) && unitEpoch(counter) <= p.epoch && !barred(p, counter) && roll(s) < counterOdds ? counter : pickUnit(v, mem, b);
      if (unit && unitEpoch(unit) > p.epoch) unit = pickUnit(v, mem, b);
      // Play to the people's strength: when not countering, favour the signature line about half the time.
      const sig = SIGNATURES[p.civ].type;
      if (unit !== counter && sig !== 'siege' && sig !== 'priest' && trains.includes(sig) && unitEpoch(sig) <= p.epoch && !barred(p, sig) && roll(s) < 0.5) unit = sig;
    }
    if (!unit || unitEpoch(unit) > p.epoch || barred(p, unit)) continue;
    // What it costs here: a levy, an age's price or a hire for gold (#37).
    const cost = trainCostFor(s, p.id, unit, b.type);
    if (!afford(v, cost)) continue;
    issue({ t: 'train', p: p.id, building: b.id, unit });
    spend(v, cost);
    tally(unit);
    if (!b.rally || Math.abs(b.rally.x - mem.muster.x) > 1) issue({ t: 'rally', p: p.id, building: b.id, x: mem.muster.x, y: mem.muster.y });
  }

  // Defend: enemies near home draw the whole army.
  const threat = threatNear(s, v).unit;
  // Soldiers on their way to (or aboard) a landing ship are not the land army's to command.
  const sailing = new Set(mem.landing?.ids);
  const fighters = v.army.filter((u) => !u.inside && !sailing.has(u.id));
  if (threat) {
    const responders = fighters.filter((u) => u.order.k !== 'attack');
    if (responders.length) issue({ t: 'move', p: p.id, ids: responders.map((u) => u.id), x: threat.x, y: threat.y, amove: true });
    mem.attacking = false;
    return;
  }

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
  const due = !plan.hold && (plan.wave ? true : s.tick >= secs(L.firstAttack)) && s.tick >= s.peaceUntil;
  if (due && !mem.attacking && (fighters.length >= waveSize || (wonderRace && fighters.length >= 4) || (plan.allIn && fighters.length >= 12))) {
    issue({ t: 'move', p: p.id, ids: fighters.map((u) => u.id), x: enemy.x, y: enemy.y, amove: true });
    mem.attacking = true;
    mem.wave++;
    return;
  }
  if (mem.attacking && ready.length >= (plan.allIn ? 1 : 4)) {
    // Reinforcements join the attack.
    issue({ t: 'move', p: p.id, ids: ready.map((u) => u.id), x: enemy.x, y: enemy.y, amove: true });
    return;
  }
  // Between waves, a few riders cut the rivals' trade roads near home.
  const watching = new Set<number>();
  if (L.clever) {
    const riders = ready.filter((u) => u.type === 'cavalry' && u.order.k === 'idle');
    const prey = riders.length ? enemyTrader(s, v, v.home, AI_WEB.raidNear, false) : null;
    if (prey) {
      issue({ t: 'attack', p: p.id, ids: riders.slice(0, 3).map((u) => u.id), target: prey.id });
      return;
    }
    // A merchant rival's age stands on its trade (#50): a band of riders lies in wait by the trading
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
function priestly(s: GameState, v: View, mem: AiMemory, issue: (c: Command) => void): void {
  if (!v.priests.length) return;
  chantBand(s, v, issue);
  const army = v.army.filter((u) => !u.inside && u.type !== 'siege');
  const fetching = new Set<number>();
  for (const pr of v.priests) if (pr.order.k === 'relic') fetching.add(pr.order.target);
  for (const pr of v.priests) {
    if (pr.order.k !== 'idle' || pr.inside) continue;
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
function watchPost(s: GameState, p: Player): TradePost | null {
  let best: TradePost | null = null;
  let bestD = Infinity;
  for (const o of s.players) {
    if (o.defeated || !isEnemy(s, p.id, o.id) || (ageOf(o) !== 'merchant' && ageOf(o) !== 'fair')) continue;
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
  if (!s.posts.length || p.epoch < 1 || v.citizens.length < 18) return;
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
      if (BUILDINGS[type].epoch > p.epoch) continue;
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
      if ((cost.wood ?? 0) + (cost.gold ?? 0) + (cost.food ?? 0) > 300 && v.citizens.length < 25) continue;
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
    if (v.budget.food > 800 && v.budget.wood > 600 && v.citizens.length >= 30) {
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

