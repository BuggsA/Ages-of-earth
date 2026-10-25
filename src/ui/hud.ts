import { crestSvg } from './crests';
import { seasonAt, seasonOf } from '../sim/seasons';
import { flooded } from '../sim/flood';
import { armProblem, disarmProblem, isPolis } from '../sim/polis';
import { scenarioById } from '../sim/campaign';
import { flees } from '../sim/flee';
import { objectivesHtml } from './campaignUi';
import { rankOf } from '../sim/combat';
import { heroBusy, shortfall, shortages, MAX_QUEUE } from '../sim/commands';
import { handsFor } from '../sim/labor';
import { RARE_OF_TILE, findResource } from '../sim/units';
import { FIRE, FISSION, HIVE, INTERCEPT, WILDWOOD, BLOOM, LEVIATHANS, AUTO_WORK, BREACH, CANAL, DAM, INUND, POLDER, RIVERS, SHEPHERD, TOWER_LEVELS, LONGBOW, KEG, ORE_POST, PROSPECTOR, SEA_RAID, ROADS, ROUTES, LABOR, SPOILS, POLIS, HOMELANDS, MILITARY, RARE, MERC, ORDERS, BLOOD, HEMO, HEMO_IRON, HEMOCRAFT, RITE, AGES, WAY, WAYS, WAY_IDS, KIN, CALL_UP, PATHS, WARCAMP, FLOCK, NOMAD, AMOUNT, LIGHTNING, CONSECRATE, BEACON, BOAR, RALLY, STEP_BACK, STEPPE, SILK, SERAI, TRIBUTE, stepBackCost, VETERANCY, BUILDINGS, SHAFT, BUILDING_TYPES, WARHEADS, CIVS, WORK, WORKS, SIGNATURES, EPOCHS, SILO, SALVO, MARKET, ORE_TRADE, RELIC, ROT, REPAIR_SHARE, RUINS, LANDMARKS, TRADE, TIDINGS, RES_LABEL, TECHS, TECH_IDS, TICK_HZ, domainOf, secs, unitEpoch, TIDE, FLOAT } from '../sim/data';
import { scoreOf } from '../sim/game';
import { carriedBy, keptIn, relicAt } from '../sim/relics';
import { caravanBonus, caravanOf, glutNow, homeMarket, marketOf, nearestCaravan, postAt, seraiNear, tripGold } from '../sim/trade';
import { restsAt } from '../sim/passage';
import { loadPrice, sellerNear } from '../sim/oretrade';
import { armingOf, charged, clockOf, fuelOf, held as inReserve, launchProblem, loaded, nextNuke, reserveProblem, revealed, ringsFor, rulesOf, salvoFuel, salvoProblem, stockOf, warheadsOf, WARHEAD_NAMES, type WarheadKind } from '../sim/silo';
import { carriesKegs, kegProblem, kegsOf, millProblem, mills, millsOf, sappers } from '../sim/powder';
import { carriesTorch, fireOn } from '../sim/fire';
import { basinOf, damIdle, drowned, heldBack, isInund, lets, millIdle, sluiceFed, sluiceProblem, waterLine, wateredAt } from '../sim/water';
import { aground, millShares, tidalNear, tideClock, tideMillIdle } from '../sim/tides';
import { isPond } from '../sim/tides';
import { tideWaitLeft } from '../sim/tides';
import { ashoreLeft, bedClock } from '../sim/tides';
import { hutBeds, hutWorks } from '../sim/tides';
import { gateHead, gateReach, gateWorks, pondBehind, tideGateProblem } from '../sim/tides';
import { TIDE_GATE } from '../sim/data';
import { COCKLER } from '../sim/data';
import { COCKLE } from '../sim/data';
import { R_COCKLE } from '../sim/types';
import { RUIN_FINDS, digWork, ruinAt } from '../sim/ruins';
import { LANDMARK_KINDS, claimWork, claimants, favours, landmarkAt } from '../sim/landmarks';
import { workProblem } from '../sim/works';
import { TIDING_CARDS, tidingCost, tidingProblem } from '../sim/tidings';
import { kinCount, kinProblem, vowProblem, wayBarred, wayProblem } from '../sim/ways';
import { catchIn, snareCap, snareFull, snareRate, snareWoods } from '../sim/snares';
import { beaconProblem, lit } from '../sim/beacon';
import { SEAMS, groundAt, seamOf, seamProblem, seamsAt, shaftShare } from '../sim/shafts';
import { callUpProblem, callUpReach, campGrace, musterWait } from '../sim/warcamp';
import { bledFlock, bloodOf, bloodShort, captivesOf, cursed, grafted, levyProblem, sworn, levyReach } from '../sim/blood';
import { feedReach, graftCost, graftLast, graftWait, waiting } from '../sim/hemo';
import { chantedOver, consecrates, faithOf } from '../sim/consecrate';
import { rallyProblem } from '../sim/rally';
import { stirred as stirredNow } from '../sim/combat';
import { sees } from '../sim/vision';
import { buildingCostFor, buildingMaxHp, gunPower, gunRange, modsOf, raiseProblem, statsFor, techCostFor, techProblem, trainCostFor, trainTimeFor } from '../sim/stats';
import { isMobile, packProblem, packsOf, pitchProblem } from '../sim/steppe';
import { castProblem, districtOf } from '../sim/floating';
import { exacting, isRider } from '../sim/tribute';
import { landOwnerAt } from '../sim/borders';
import { flockCap, flockOf, grazeRange, lambProblem } from '../sim/flocks';
import { soldAt } from '../sim/ages';
import { ageDef, ageOf, asleep, crossingLeft, goldenEnds, livesOf, threadsOf, crossingsAhead, keepsakeProblem, leaving, sleepWhy, type Tally, backProblem, buildBarred, canRaise, hasCoils, hasWalked, inField, backTo, barred, deedsProgress, oreClue, oreDone, oreOnly, ironTradeShare, isHire, isSideRoad, journeyOf, mainRoad, pathLine, pathDepth, relicTradeShare, roadKnown, roadProblem, roadsFrom, shutRoads, suspendedTechs, assayed, diggersAt, holdingsOf, holds, keyOf, lacking, opensOf, prospected, trainsAt, windowsOf, leadsOn, leadsTo } from '../sim/ages';
import type { AgeId, BloomSeed, KeyId, RareId, Building, BuildingType, Command, Cost, Ent, GameState, Job, Landmark, Launch, Player, Res, Ruin, Stance, TechId, TradePost, Unit } from '../sim/types';
import { GROVE_BUILDINGS, grows } from '../sim/grove';
import { hiveLine, keepsBees } from '../sim/hive';
import { heartBarred, heartLine, heartOf, rootProblem, wakesForest } from '../sim/wildwood';
import { greenLeft, inBloom, rooted, slingProblem, spireBarred, spireLine } from '../sim/bloom';
import { bombIn, kneelProblem, riseProblem, seedBombProblem } from '../sim/leviathans';
import { isCarrier } from '../sim/units';
import { KEYS, RARES, RES, R_BERRY, R_BLOODIRON, R_BOG, R_SALT, R_SALTPETRE, R_FISH, R_GOLD, R_MEAT, R_STONE, R_TREE } from '../sim/types';
import { costHtml, icon } from './icons';
import { buildingPicture, unitPicture } from './thumbs';
import { idleCitizens } from './idle';
import { workforce, WORKFORCE_JOBS } from './workforce';
import { citizenProblem, isLegion } from '../sim/legion';
import { isHousehold, streetOf, taxRate } from '../sim/household';
import { bowman, isSet } from '../sim/longbow';
import { isNomad } from '../sim/nomad';

/**
 * The heads-up display: resources and population along the top with the epoch and the clock, and along
 * the bottom what is selected (a portrait and its numbers, a training queue, or a whole army as
 * portraits) beside a command card whose buttons change with the selection and answer to hotkeys.
 */

export interface HudActions {
  issue(c: Command): void;
  /** Start placing a building with the selected citizens. */
  place(type: BuildingType): void;
  /** Wait for a left click to patrol to (#454). */
  patrolMode(): void;
  /** Wait for a left click to attack-move to. */
  attackMove(): void;
  /** Wait for a left click on an enemy that bleeds, for a Blood-rite priest to sacrifice or curse (#355 s4). */
  riteMode(how: 'sacrifice' | 'curse'): void;
  /** Wait for a left click on a rival building, for sappers to lay a powder keg at (#577). */
  kegMode(): void;
  /** Wait for a left click on a tree, a root or a rival's living building, for torchbearers to set alight (`fire.ts`). */
  torchMode(): void;
  /** Wait for a left click on the map, for this Missile Silo to launch at (#605). */
  /** Aim a launch from this silo: one warhead (`w`, the people's own if absent), or a salvo's three points (#765). */
  launchMode(silo: number, w?: WarheadKind | 'salvo'): void;
  /** Wait for a left click on the map, for this Seed Spire to sling its Bloom Seed at (the Age of the Bloom). */
  slingMode(spire: number): void;
  /** Wait for a left click on a building to shelter in (or a transport to board). */
  garrisonMode(): void;
  /** Wait for a left click on a shore to land a transport's passengers. */
  unloadMode(): void;
  select(ids: number[]): void;
  focus(x: number, y: number): void;
  sound(name: 'click' | 'error' | 'queue' | 'open'): void;
}

interface Cmd {
  key: string;
  pic: string;
  glyph?: string;
  title: string;
  desc: string;
  cost?: Cost;
  ok: boolean;
  why?: string;
  count?: number;
  on?: boolean;
  run: () => void;
}

/** Explain the shared quote without implying that the automatic drift is a forecast. */
function marketTrend(price: number, res: 'food' | 'wood' | 'stone'): string {
  const base = MARKET.start[res];
  return price < base ? `↑ recovering toward ${base}` : price > base ? `↓ recovering toward ${base}` : `→ steady at ${base}`;
}

const STANCE_NAMES: Record<Stance, string> = { aggressive: 'Attack and destroy', defensive: 'Fight if provoked', stand: 'Hold', run: 'Run' };

const ACT_WORDS: Record<string, string> = {
  idle: 'Standing by',
  walk: 'Walking',
  attack: 'Fighting',
  chop: 'Cutting wood',
  mine: 'Mining',
  forage: 'Gathering berries',
  farm: 'Farming',
  build: 'Building',
  chant: 'Chanting',
  fish: 'Fishing',
};

function orderWords(s: GameState, u: Unit): string {
  const o = u.order;
  if (u.inside && s.byId.get(u.inside)?.kind === 'unit') return 'Aboard a ship';
  switch (o.k) {
    case 'gather': {
      const kind = s.res[o.tile];
      // Cockle beds (#767): the picker reads the tide.
      if (ashoreLeft(s, u) > 0) return o.phase === 'drop' ? 'Off the flats with the cockles, before the flood' : 'Waiting ashore for the cockle beds to bare';
      if (kind === R_COCKLE || o.cockle) return o.phase === 'drop' ? 'Carrying cockles home' : o.phase === 'work' ? 'Picking cockles' : 'Going out to the cockle beds';
      if (kind === R_FISH || u.type === 'fisher') return o.phase === 'drop' ? 'Bringing the catch to the dock' : o.phase === 'work' ? 'Fishing' : 'Sailing to the fishing grounds';
      const what = o.res === 'food' ? (kind === R_MEAT ? 'meat' : 'berries') : o.res === 'wood' ? 'wood' : kind === R_BOG || o.bog ? 'bog iron' : o.res;
      if (o.phase === 'drop') return `Carrying ${what} home`;
      if (o.phase === 'work') return kind === R_TREE ? 'Cutting wood' : kind === R_BERRY ? 'Gathering berries' : kind === R_MEAT ? 'Butchering a deer' : kind === R_GOLD ? 'Mining gold' : kind === R_BOG ? 'Digging bog iron' : RARE_OF_TILE[kind] ? `Mining ${RARE[RARE_OF_TILE[kind]].name.toLowerCase()}` : kind === R_STONE ? 'Quarrying stone' : 'Gathering';
      return `Going to gather ${what}`;
    }
    case 'farm':
      if (flooded(s, u.owner)) return 'Waiting out the flood: the field is under the river';
      {
        const f = s.byId.get(o.target);
        if (f && f.kind === 'building' && drowned(s, f)) return 'Waiting for the water to go: the field is under the sluice\'s flood';
      }
      if ((s.byId.get(o.target) as Building | undefined)?.type === 'garden') return o.phase === 'drop' ? 'Carrying the harvest home' : o.phase === 'work' ? 'Tending a Kitchen Garden' : 'Going to the garden';
      return o.phase === 'drop' ? 'Carrying grain home' : o.phase === 'work' ? 'Farming' : 'Going to the fields';
    case 'build': {
      if (ashoreLeft(s, u) > 0) return 'Waiting ashore for the tide to go out again';
      const target = s.byId.get(o.target);
      if (target?.kind === 'building' && target.built) return u.act === 'build' ? 'Repairing' : 'Going to repair';
      return u.act === 'build' ? 'Building' : 'Going to build';
    }
    case 'attack':
      return u.act === 'attack' ? 'Fighting' : 'Charging';
    case 'move':
      return o.amove ? 'Marching to attack' : 'Moving';
    case 'patrol':
      return `Patrolling (${o.pts.length} points)`;
    case 'explore':
      return 'Exploring';
    case 'deliver':
      return 'Carrying resources home';
    case 'hunt':
      return 'Hunting';
    case 'milk':
      return o.phase === 'drop' ? 'Carrying milk home' : o.phase === 'work' ? 'Milking the flock' : 'Going to milk the flock';
    case 'tame':
      return u.act === 'chant' ? 'Singing a wild beast calm' : 'Going to tame a wild beast';
    case 'snare':
      return o.phase === 'drop' ? 'Carrying the catch home' : o.phase === 'work' ? 'Emptying a snare' : u.act === 'idle' ? 'Waiting by the snares for game' : 'Walking the trap line';
    case 'shaft':
      return o.phase === 'drop' ? `Carrying ${o.res === 'gold' ? 'gold' : 'stone'} up from the shaft` : o.phase === 'work' ? 'Digging the seam' : 'Going down the shaft';
    case 'convert':
      return o.rite === 'sacrifice' ? (u.act === 'chant' ? 'Sacrificing' : 'Going to sacrifice') : o.rite === 'curse' ? (u.act === 'chant' ? 'Cursing' : 'Going to curse') : u.act === 'chant' ? 'Converting' : 'Going to convert';
    case 'heal':
      return 'Healing';
    case 'garrison':
      return u.inside ? 'Sheltering inside' : 'Going to shelter';
    case 'board':
      return 'Going aboard';
    case 'unload':
      return u.cargo.length ? 'Sailing to land passengers' : 'Moving';
    case 'relic':
      return carriedBy(s, u) ? 'Carrying a relic to the Temple' : 'Going for a relic';
    case 'keg':
      return 'Carrying a powder keg to lay';
    case 'kegTile':
      return 'Carrying a powder keg to a causeway';
    case 'torch':
      return 'Carrying a torch to set alight';
    case 'cache':
      return u.ore ? `Carrying ${u.ore.n} ${RARE[u.ore.id].name.toLowerCase()} home` : 'Going for the spilled ore';
    case 'salvage':
      return u.act === 'mine' ? 'Stripping the rubble' : 'Going to strip the rubble';
    case 'dig':
      return u.act === 'mine' ? 'Digging at the ruins' : 'Going to dig at the ruins';
    case 'trade':
      if (u.type === 'cog') return o.phase === 'back' ? (u.carry > 0 ? 'Sailing gold home to the Dock' : 'Going home to the Dock') : 'Sailing goods to the port';
      // Buying rare ore at a post (#573).
      if (o.buy) return o.phase === 'back' && u.ore ? `Bringing ${u.ore.n} ${RARE[u.ore.id].name.toLowerCase()} home to the Market` : o.phase === 'back' ? 'Going home to the Market' : `Going to buy ${RARE[o.buy].name.toLowerCase()} at the trading post`;
      return o.phase === 'back' ? (u.carry > 0 ? 'Bringing gold home to the Market' : 'Going home to the Market') : 'Taking goods to the trading post';
    default:
      if (carriedBy(s, u)) return 'Holding a relic';
      if (u.ore) return `Holding ${u.ore.n} ${RARE[u.ore.id].name.toLowerCase()}: right-click a Storehouse or Town Center`;
      if (u.type === 'trader' && u.carry > 0) return 'Waiting with gold: right-click a Market';
      if (u.type === 'cog' && u.carry > 0) return 'Waiting with gold: right-click a Dock';
      if (u.type === 'wagon') return 'Packed for the road: press P to pitch camp';
      if (u.type === 'tow') return `Under tow with ${u.cargo.length} aboard: press P to moor`;
      if (u.type === 'behemoth') return 'Carrying your Town Center: press P to kneel';
      return ACT_WORDS[u.act] ?? 'Standing by';
  }
}

/** The verbs rubric's line on a choice (#506): what the player will do, and what it shuts. */
const verbLine = (e: { verb?: string; door?: string }) => (e.verb ? `<br><b>You now:</b> ${e.verb}. <b>It shuts:</b> ${e.door}.` : '');

/**
 * The age panel (#555 s4, `docs/age-roads.md` spine §2): the route an age stands on, what you will do there, what it is
 * good at, what it shuts and, as far as you know, where it leads. A turn of your town, said in a few lines.
 */
const agePanel = (s: GameState, p: Player, id: AgeId) => {
  const a = AGES[id];
  const routes = a.routes ?? [];
  const on = leadsTo(s, p, id);
  const hidden = new Set(leadsOn(id).map((r) => r.to)).size > on.length;
  // What the Prospector's Lodge found missing (#562): a door this world can't open, said where the road is read.
  const lacks = lacking(s, p, id).map((d) => `<br><b>This world lacks ${PROSPECTOR.keys[d.key].name.toLowerCase()}:</b> ${d.only ? 'this road stays shut' : 'only the deeds open it'}.`);
  return (
    lacks.join('') +
    (routes.length ? `<br><b>${routes.map((r) => ROUTES[r].name).join(' and ')}:</b> ${routes.map((r) => ROUTES[r].blurb).join('; ')}.` : '<br><b>Off the basic routes:</b> only a rare find opens it.') +
    (a.gateway ? '<br><i>Weak on its own: the road on is why you come.</i>' : '') +
    (a.verb ? `<br><b>You now:</b> ${a.verb}.` : '') +
    (a.good ? `<br><b>Good at:</b> ${a.good}.` : '') +
    (a.door ? `<br><b>It shuts:</b> ${a.door}.` : '') +
    (a.keepsake ? `<br><b>Keepsake:</b> one ${BUILDINGS[a.keepsake.building].name} keeps ${a.keepsake.does} after you leave.` : '') +
    (on.length ? `<br><b>Leads to:</b> ${on.map((t) => `the ${AGES[t].name}`).join(', ')}${hidden ? ', and roads you have not found' : ''}.` : hidden ? '<br><b>Leads to:</b> roads you have not found.' : '')
  );
};

/** What a key resource opens (#562), in a few words: the ages it is the only road to, the shortcuts and the crafts. */
const opensText = (k: KeyId) => {
  const o = opensOf(k);
  const parts = [...o.only.map((a) => `the ${AGES[a].name}`), ...o.shortcut.map((a) => `a shortcut to the ${AGES[a].name}`), ...o.techs.map((t) => TECHS[t].name)];
  return parts.length ? parts.join(', ') : 'nothing yet';
};

/**
 * The Prospector's Lodge's answer (#562): yes or no for every key resource, and what each opens, in the tip. Once
 * charted (#565), how many places of each the map marks.
 */
const prospectLine = (s: GameState, p: Player) => {
  const marks = (k: KeyId) => (k === 'ruin' ? (s.ruins?.length ?? 0) : (p.chart ?? []).filter((c) => c.key === k).length);
  // Assayed (#568): what each people holds of each key resource, and how many key tiles its citizens dig now.
  const dig = assayed(p) ? diggersAt(s) : null;
  const assay = dig
    ? s.players
        .filter((o) => !o.defeated)
        .map((o) => {
          const h = holdingsOf(o);
          const n = [...dig.values()].filter((w) => w === o.id).length;
          // Names come from players online: nothing in one may become markup in the tip.
          return `<br>${o.name.replace(/[<>&"']/g, '')}: ${(['salt', 'saltpetre', 'bloodiron'] as const).map((k) => `${h[k]} ${PROSPECTOR.keys[k].name.toLowerCase()}`).join(', ')}; ${h.bogIron} bog iron dug${n ? `; digging ${n} key tile${n > 1 ? 's' : ''} now` : ''}${o.stats.bought ? `; ${o.stats.bought} key ore bought at the posts` : ''}.`;
        })
        .join('')
    : '';
  const chart = p.chart ? `<br>Charted: ${KEYS.filter((k) => marks(k)).map((k) => `${marks(k)} ${PROSPECTOR.keys[k].name.toLowerCase()}`).join(', ')} marked on your map, under the fog too.` : '';
  // A rare ore this world lacks is sold at a trading post (#573): the lodge says so, and at what price.
  const sold = (k: KeyId) => (RARES as readonly string[]).includes(k) && soldAt(s, k as RareId) ? `, but a trading post sells it (${icon('gold', 12)}${loadPrice(s, k as RareId)} a load of ${ORE_POST.lot})` : '';
  const tip = KEYS.map((k) => `${PROSPECTOR.keys[k].icon} ${PROSPECTOR.keys[k].name}: ${holds(s, k) ? 'yes' : `none in this world${sold(k)}`}. Opens ${opensText(k)}.`).join('<br>');
  return `<span data-tip="<b>What this world holds</b>${tip}${chart || '<br>Yes or no only: not where, nor how much. Chart the Veins (Bronze Age) marks where.'}${assay ? `<br>Assayed:${assay}` : ''}">🧭 ${KEYS.map((k) => `${PROSPECTOR.keys[k].icon}${holds(s, k) ? '✔' : '✘'}`).join(' ')}${p.chart ? (assayed(p) ? ' · ⚖️ assayed' : ' · 🗺️ charted') : ''}</span>`;
};

/** A road's route, for the age-up button's title: a side route by name, nothing for the plain road. */
const routeTag = (id: AgeId) => {
  const side = (AGES[id].routes ?? []).filter((r) => r !== 'plain');
  return side.length ? ` · ${side.map((r) => ROUTES[r].name).join(', ')}` : '';
};

/**
 * Going back as a plan (#555 s10, `docs/age-roads.md` §5): what leaving this age for `to` keeps, puts to sleep, wakes and loses,
 * for the step-back button and the roads. What is kept for good shows on a step back only.
 */
export const planLines = (s: GameState, p: Player, to: AgeId, back: boolean): string => {
  const l = leaving(s, p, to, back);
  const tally = (t: Tally) => t.map(([type, n]) => `${n} ${BUILDINGS[type].name}${n > 1 ? 's' : ''}`).join(', ');
  const lines: string[] = [];
  // The age's keepsake (#555 s11): the one building that keeps its work, or the nudge to raise one before leaving.
  const k = AGES[ageOf(p)].keepsake;
  if (l.keepsake && k) lines.push(`🏺 Kept: your ${BUILDINGS[l.keepsake.type].name}${l.keepsake.keep === ageOf(p) ? ' (the one you chose)' : ' (the oldest; select another and press J to choose it)'} keeps ${k.does}.`);
  else if (k && ageOf(p) !== to) lines.push(`🏺 No keepsake: raise a ${BUILDINGS[k.building].name} before you leave and it keeps ${k.does}.`);
  if (back && l.walked) lines.push(`🏺 Kept: the ${AGES[l.walked].name} counts as walked for good (its heirlooms and the roads that need it), but its own ways rest until you return.`);
  // A crossing (#585): half walked shows what the other half opens; the second sibling's road says it completes one.
  if (l.walked) for (const r of ROADS) {
    const other: AgeId | null = r.crossing?.includes(l.walked) ? crossingLeft(p, r) : null;
    if (other && other !== l.walked && !hasWalked(p, r.to)) lines.push(`🔀 Half a crossing: walk the ${AGES[other].name} too, and the ${AGES[r.to].name} opens from the ${AGES[r.from].name}.`);
  }
  for (const r of crossingsAhead(p, to)) lines.push(`🔀 Opens a crossing: with the ${AGES[to].name} walked as well, the ${AGES[r.to].name} opens from the ${AGES[r.from].name}.`);
  if (l.suspend.length) lines.push(`💤 Sleeps until you climb again: ${l.suspend.map((t) => TECHS[t].name).join(', ')}.`);
  if (l.sleep.length) lines.push(`💤 Sleeps until you return: ${tally(l.sleep)}, standing idle.`);
  if (l.wake.length) lines.push(`☀️ Wakes: ${tally(l.wake)}.`);
  if (l.lost.length) lines.push(`🔥 Lost: ${tally(l.lost)}, burned.`);
  return lines.map((x) => `<br>${x}`).join('');
};

const fmtTime = (ticks: number) => {
  const sec = Math.floor(ticks / TICK_HZ);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};

/** The tide clock's state, for the top bar's signature (#739): it redraws each second the clock moves. */
const tideSig = (s: GameState): string => {
  const c = tideClock(s);
  return c ? `${c.level}:${Math.ceil(c.next)}` : '';
};

/** Seconds on a Bloom Seed's clock: until it roots while in the air, then until it cracks. */
const bloomClock = (s: GameState, l: BloomSeed): number => Math.max(0, Math.ceil(((rooted(s, l) ? l.at : l.lands) - s.tick) / TICK_HZ));

/** What a Bloom Seed in the bar says to this viewer. */
function seedTip(s: GameState, l: BloomSeed, viewer: number): string {
  const who = l.owner === viewer ? 'Your' : `${s.players[l.owner].name}'s`;
  if (!rooted(s, l)) return `${who} Seed is in the air: it roots in ${bloomClock(s, l)} seconds on the open ground nearest the green ring's heart.`;
  const left = Math.max(0, BLOOM.root - l.cut);
  return `${who} Seed has rooted: in ${bloomClock(s, l)} seconds every ${l.owner === viewer ? 'rival ' : ''}building within ${BLOOM.r} tiles of its heart-root cracks into forest. ${left} strokes are left to hack it out: each rival citizen beside the root (the yellow ring) strikes once a second.`;
}

/** The public tide clock (#739), beside the game clock on every screen once the tide has woken: where the sea stands, which way, and when it turns. */
/**
 * The ☢ chip's words for a warhead in the air (#762): a rival is told of three rings and never which are real until the last seconds. The
 * words are the same for a salvo (#765) as for one warhead, so the chip never tells them apart before the reveal.
 */
function warnTip(s: GameState, l: Launch, viewer: number): string {
  const who = s.players[l.owner].name;
  if (s.players[viewer].team === s.players[l.owner].team) {
    if (l.salvo) return `${l.owner === viewer ? 'Your' : `${who}'s`} salvo lands on the amber rings in ${clockOf(s, l)} seconds. Rivals see three rings, as for one warhead and two decoys, each set off up to ${SILO.blur} tiles from its point; all three stay at the last ${SILO.reveal} seconds. A silo destroyed before then scrubs its own warhead.`;
    return `${l.owner === viewer ? 'Your' : `${who}'s`} warhead lands on the amber ring in ${clockOf(s, l)} seconds. Rivals see it among two decoys, each ring set off up to ${SILO.blur} tiles from its point, until the last ${SILO.reveal} seconds. A silo destroyed before then scrubs the launch.`;
  }
  const n = ringsFor(s, l, viewer).length;
  if (revealed(s, l)) return n > 1 ? `${who}'s salvo lands in ${clockOf(s, l)} seconds: all ${n} rings that flash are real.` : `${who}'s warhead lands in ${clockOf(s, l)} seconds, inside the ring that flashes. The decoys are gone.`;
  return `${who}'s Missile Silo has launched: it lands in ${clockOf(s, l)} seconds. Of the red rings, one is real and the others decoys, unless it is a salvo of three silos firing at once, when all are real. Each ring is set off up to ${SILO.blur} tiles from where it falls. With ${SILO.reveal} seconds left the decoys vanish and the real rings flash. A silo destroyed before then scrubs its warhead.\nWatch the missile: it climbs toward the middle of the rings, then, some seconds before they flash, bends toward where it falls.${coverLine(s, l, viewer)}`;
}

/**
 * Missile defence (#759 s2): how many of the rings this viewer is shown lie in their team's charged batteries' cover. A battery fires at a
 * warhead whose ring it covers, so a ring in cover is one an interceptor will try to stop. And (s3) whether the team holds a silo in Reserve.
 */
function coverLine(s: GameState, l: Launch, viewer: number): string {
  const team = s.players[viewer].team;
  // A silo of the team held in Reserve (#759 s3) answers what no battery takes, wherever it falls.
  const kept = s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'silo' && s.players[e.owner].team === team && e.built && e.hp > 0 && inReserve(e));
  const ready = kept.filter((e) => !armingOf(s, e)).length;
  const back = !kept.length ? '' : `\n${ready ? `${ready === 1 ? 'A silo' : `${ready} silos`} held in Reserve stand${ready === 1 ? 's' : ''} ready: each fires a warhead of its store at one warhead no battery answers, wherever it falls, and stops it ${Math.round(INTERCEPT.chance * 100)}% of the time.` : `Your silos held in Reserve are not ready yet: ${Math.min(...kept.map((e) => armingOf(s, e)))}s.`}`;
  const mine = s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'battery' && s.players[e.owner].team === team && charged(s, e));
  if (!mine.length) return back;
  const R = INTERCEPT.reach * INTERCEPT.reach;
  const rings = ringsFor(s, l, viewer);
  const n = rings.filter((g) => mine.some((b) => (b.x - g.x) * (b.x - g.x) + (b.y - g.y) * (b.y - g.y) <= R)).length;
  return back + `\n${n ? `${n} of the ${rings.length} rings lie in your Interceptor Batteries' cover: ${INTERCEPT.fire} seconds before it lands, a battery fires at a warhead falling in a ring it covers, and stops it ${Math.round(INTERCEPT.chance * 100)}% of the time.` : `None of the rings lies in your Interceptor Batteries' cover (the teal circles).`}`;
}

function tideChip(s: GameState): { text: string; tip: string } | null {
  const c = tideClock(s);
  if (!c) return null;
  const top = TIDE.flats.length;
  const name = c.level === top ? 'High water' : c.level === 0 ? 'Low water' : c.rising ? 'Flooding' : 'Ebbing';
  const arrow = c.level === top ? '▲' : c.level === 0 ? '▼' : c.rising ? '↑' : '↓';
  const bars = '▮'.repeat(c.level) + '▯'.repeat(top - c.level);
  const tip = `The tide: ${name.toLowerCase()}. Next turn in ${Math.ceil(c.next)} s.${c.level === 0 ? '' : ` Low water in ${Math.ceil(c.toLow)} s.`}${c.level === top ? '' : ` High water in ${Math.ceil(c.toHigh)} s.`}\nEvery ${TIDE.period / 60} minutes the sea falls through ${top} steps to low water and rises back. As it falls the shallow sea bares, the shallowest first: wet flats anyone may walk, where ships sit aground and a Dock with only flats beside it launches nothing. Whoever stands on the flats when the water comes back is swept ashore and hurt, or drowned far out. Causeways drown only at high water. Tide Mills grind gold at every turn.`;
  return { text: `🌊${arrow}${bars} ${Math.ceil(c.next)}s`, tip };
}

export class Hud {
  /** Showing a build menu for citizens. */
  buildMenu: 'eco' | 'mil' | null = null;
  private cmds: Cmd[] = [];
  private resEl = document.getElementById('res-bar')!;
  private epochEl = document.getElementById('epoch-chip')!;
  private clockEl = document.getElementById('clock')!;
  private idleEl = document.getElementById('idle-btn')!;
  private idleSeen = 0;
  private workforceBtn = document.getElementById('workforce-btn') as HTMLButtonElement;
  private workforcePanel = document.getElementById('workforce-panel')!;
  private wfDrawn = new Map<string, string>();
  private selEl = document.getElementById('selection')!;
  private cmdEl = document.getElementById('commands')!;
  private tipEl = document.getElementById('tooltip')!;
  private noticeEl = document.getElementById('notices')!;
  private bannerEl = document.getElementById('banner')!;
  private timerEl = document.getElementById('timers')!;
  private tidingEl = document.getElementById('tiding')!;
  private tidingSig = '';
  private timerHtml = '';
  private selSig = '';
  private cmdSig = '';
  private topSig = '';
  private bannerTimer = 0;
  private recent = new Map<string, number>();
  private tipFor: HTMLElement | null = null;
  private state: GameState | null = null;
  private viewer = 0;

  constructor(private act: HudActions) {
    this.workforceBtn.addEventListener('click', () => {
      const open = this.workforcePanel.classList.toggle('hidden');
      this.workforceBtn.setAttribute('aria-expanded', String(!open));
      if (!open && this.state) this.drawWorkforce(this.state, this.viewer);
    });
    this.workforcePanel.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!this.state) return;
      const add = target.closest<HTMLElement>('[data-add]');
      if (add) return this.sendWorkers(add.dataset.add as Job, e.shiftKey ? 5 : 1);
      if (target.closest('[data-go]')) {
        const n = Number((this.workforcePanel.querySelector('#wf-n') as HTMLInputElement).value);
        const from = (this.workforcePanel.querySelector('#wf-from') as HTMLSelectElement).value as Job;
        const to = (this.workforcePanel.querySelector('#wf-to') as HTMLSelectElement).value as Job;
        return this.moveWorkers(from, to, n);
      }
      const row = target.closest<HTMLElement>('[data-job]');
      if (!row) return;
      const job = row.dataset.job;
      const ids = workforce(this.state, this.viewer).get(job as Job) ?? [];
      if (ids.length) {
        this.act.select(ids);
        this.act.sound('click');
      }
      this.workforcePanel.classList.add('hidden');
      this.workforceBtn.setAttribute('aria-expanded', 'false');
    });
    this.noticeEl.addEventListener('click', (e) => {
      const f = (e.target as HTMLElement).closest<HTMLElement>('[data-fields]');
      if (f) {
        this.moveWorkers('idle', 'food', Number(f.dataset.fields) || 1);
        f.closest('.notice')?.remove();
        return;
      }
      const m = (e.target as HTMLElement).closest<HTMLElement>('[data-mine]');
      if (m) {
        this.moveWorkers('idle', m.dataset.mine as Job, Number(m.dataset.n) || 1);
        m.closest('.notice')?.remove();
        return;
      }
      const g = (e.target as HTMLElement).closest<HTMLElement>('[data-forage]');
      if (g) {
        this.moveWorkers('idle', 'food', Number(g.dataset.forage) || 1);
        g.closest('.notice')?.remove();
        return;
      }
      const fi = (e.target as HTMLElement).closest<HTMLElement>('[data-fish]');
      if (fi) {
        this.findFish(fi.dataset.fish ?? '');
        fi.closest('.notice')?.remove();
        return;
      }
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-hands]');
      if (!b) return;
      this.sendWorkers(b.dataset.hands as Job, Number(b.dataset.n) || 1);
      b.closest('.shortage')?.remove();
    });
    this.cmdEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
      if (!b) return;
      const c = this.cmds[Number(b.dataset.i)];
      if (c) this.runCmd(c);
    });
    this.cmdEl.addEventListener('contextmenu', (e) => e.preventDefault());
    // Tidings at the fire (#443): either answer is a command, so every screen in an online match plays it the same.
    this.tidingEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-take]');
      const t = this.state?.players[this.viewer]?.tiding;
      if (!b || !t || !this.state) return;
      const take = b.dataset.take === '1';
      const why = take ? tidingProblem(this.state, this.state.players[this.viewer], t.card) : null;
      if (why) {
        this.toast(why, 'bad');
        this.act.sound('error');
        return;
      }
      this.act.issue({ t: 'tiding', p: this.viewer, card: t.card, take });
      this.act.sound('click');
    });
    this.timerEl.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-focus]');
      if (t) {
        const [x, y] = t.dataset.focus!.split(',').map(Number);
        this.act.focus(x, y);
      }
    });
    this.selEl.addEventListener('click', (e) => {
      const q = (e.target as HTMLElement).closest<HTMLElement>('[data-cancel]');
      if (q && this.state) {
        const [b, i] = q.dataset.cancel!.split(':').map(Number);
        this.act.issue({ t: 'cancel', p: this.viewer, building: b, index: i });
        this.act.sound('click');
        return;
      }
      const m = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (m) {
        const ids = m.dataset.pick!.split(',').map(Number);
        if ((e as MouseEvent).shiftKey) this.act.select(this.lastIds.filter((id) => !ids.includes(id)));
        else this.act.select(ids);
      }
    });
    // Tooltips for anything with data-tip (or a command button).
    document.getElementById('hud')!.addEventListener('mousemove', (e) => this.hover(e));
    document.getElementById('hud')!.addEventListener('mouseleave', () => this.hideTip());
  }

  private lastIds: number[] = [];

  private runCmd(c: Cmd): void {
    if (!c.ok) {
      this.act.sound('error');
      const p = this.state?.players[this.viewer];
      // Short of resources: say so with a way to put hands on what is missing, right there.
      if (p && c.cost && c.why && c.why === shortfall(p, c.cost)) this.shortageCard(shortages(p, c.cost), c.why);
      else this.toast(c.why ?? "Can't do that now", 'bad');
      return;
    }
    c.run();
  }

  /** Press a command's hotkey. Returns whether one was found. */
  hotkey(key: string): boolean {
    const k = key.toUpperCase();
    // Two buttons may share a key where one is shut (the Pontoon takes the House's E in the Age of Floating Cities, #770): the open one wins.
    const c = this.cmds.find((x) => x.key === k && x.ok) ?? this.cmds.find((x) => x.key === k);
    if (!c) return false;
    this.runCmd(c);
    return true;
  }

  toast(msg: string, kind: 'bad' | 'good' | 'info' | 'alert' = 'info', onClick?: () => void): void {
    const now = performance.now();
    if ((this.recent.get(msg) ?? 0) > now - 2500) return;
    this.recent.set(msg, now);
    const el = document.createElement('div');
    el.className = `notice ${kind}`;
    el.textContent = msg;
    if (onClick) {
      el.classList.add('clickable');
      el.addEventListener('click', () => (onClick(), el.remove()));
    }
    this.noticeEl.appendChild(el);
    while (this.noticeEl.children.length > 4) this.noticeEl.firstChild!.remove();
    setTimeout(() => (el.style.opacity = '0'), onClick ? 5600 : 2600);
    setTimeout(() => el.remove(), onClick ? 6200 : 3200);
  }

  /** A notice for a button you can't pay for: what is missing, and one button per resource to send the hands it takes. */
  private shortageCard(short: { res: Res; need: number }[], why: string): void {
    this.noticeEl.querySelector('.shortage')?.remove();
    const el = document.createElement('div');
    el.className = 'notice bad shortage';
    const label = (r: Res) => WORKFORCE_JOBS.find((j) => j.key === r)!;
    el.innerHTML = `<span>${why}${short.length > 1 ? ` (and ${short.length - 1} more)` : ''}</span>` + short.map((m) => {
      const n = handsFor(m.res, m.need);
      return `<button type="button" data-hands="${m.res}" data-n="${n}" title="Put ${n} on ${label(m.res).label.toLowerCase()}: about ${LABOR.window} seconds of work covers ${m.need}">${label(m.res).icon} Send ${n}</button>`;
    }).join('');
    this.noticeEl.appendChild(el);
    while (this.noticeEl.children.length > 4) this.noticeEl.firstChild!.remove();
    setTimeout(() => (el.style.opacity = '0'), 6500);
    setTimeout(() => el.remove(), 7200);
  }

  /** Citizens standing idle (bushes picked dry, #344): after a few seconds, one button lays them fields (`reassign` idle→food does it). */
  private idleSince = new Map<number, number>();
  private idleCardAt = 0;
  private foraged = new Set<number>();
  private idleFieldCard(s: GameState, viewer: number): void {
    const p = s.players[viewer];
    const now = performance.now();
    this.idleMinersCard(s, viewer, now);
    this.idleHuntersCard(s, viewer, now);
    this.idleFishersCard(s, viewer, now);
    this.idleBuildersCard(s, viewer, now);
    const idle = idleCitizens(s, viewer);
    const next = new Map<number, number>();
    for (const u of idle) next.set(u.id, this.idleSince.get(u.id) ?? now);
    this.idleSince = next;
    // Only hands that foraged or farmed and ran dry: the starting five stand idle until the player orders them, and no card scolds that.
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.owner !== viewer) continue;
      if (e.order.k === 'farm' || (e.order.k === 'gather' && e.order.res === 'food')) this.foraged.add(e.id);
    }
    const waiting = idle.filter((u) => this.foraged.has(u.id) && now - next.get(u.id)! > 5000).length;
    if (!p || waiting < 3 || now < this.idleCardAt || buildBarred(p, 'farm')) return;
    if (s.ents.some((e) => e.kind === 'building' && e.owner === viewer && e.type === 'farm' && !e.built && e.hp > 0)) return;
    this.idleCardAt = now + 30000;
    const n = Math.min(waiting, AUTO_WORK.lay);
    this.noticeEl.querySelector('.idle-fields')?.remove();
    const el = document.createElement('div');
    el.className = 'notice alert shortage idle-fields';
    el.innerHTML = `<span>${waiting} hands stand idle with nothing to forage.</span><button type="button" data-fields="${n}" title="Lay ${n} ${n === 1 ? 'field' : 'fields'} near them, paid in wood, and put them to farm">🌾 Lay ${n} ${n === 1 ? 'field' : 'fields'}</button>`;
    this.noticeEl.appendChild(el);
    while (this.noticeEl.children.length > 4) this.noticeEl.firstChild!.remove();
    setTimeout(() => (el.style.opacity = '0'), 8000);
    setTimeout(() => el.remove(), 8700);
  }

  /** Miners whose seam ran dry (#344): remember what each digger last dug; 3+ idle for 5 s offer one button that sends them to the nearest other seam or free shaft. */
  private mining = new Map<number, 'stone' | 'gold'>();
  private minersCardAt = 0;
  private idleMinersCard(s: GameState, viewer: number, now: number): void {
    const idle = new Set(idleCitizens(s, viewer).map((u) => u.id));
    const spent: Record<'stone' | 'gold', number> = { stone: 0, gold: 0 };
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.owner !== viewer || e.hp <= 0) continue;
      const o = e.order;
      if ((o.k === 'gather' || o.k === 'shaft') && (o.res === 'stone' || o.res === 'gold')) this.mining.set(e.id, o.res);
      else if (idle.has(e.id) && this.mining.has(e.id)) {
        if (now - (this.idleSince.get(e.id) ?? now) > 5000) spent[this.mining.get(e.id)!]++;
      } else this.mining.delete(e.id);
    }
    const res = spent.gold > spent.stone ? 'gold' : 'stone';
    const waiting = spent.stone + spent.gold;
    if (waiting < 3 || now < this.minersCardAt) return;
    this.minersCardAt = now + 30000;
    const n = Math.min(waiting, AUTO_WORK.lay);
    this.noticeEl.querySelector('.idle-miners')?.remove();
    const el = document.createElement('div');
    el.className = 'notice alert shortage idle-miners';
    el.innerHTML = `<span>${waiting} miners stand idle: their seam is spent.</span><button type="button" data-mine="${res}" data-n="${n}" title="Send ${n} to the nearest ${res} seam, or a free Mine Shaft">⛏ Find more ${res}</button>`;
    this.noticeEl.appendChild(el);
    while (this.noticeEl.children.length > 4) this.noticeEl.firstChild!.remove();
    setTimeout(() => (el.style.opacity = '0'), 8000);
    setTimeout(() => el.remove(), 8700);
  }

  /** Hunters whose game is gone (#344): remember who last hunted; 2+ idle for 5 s offer one button that sends them for berries, a field or meat (`reassign` idle→food). */
  private hunting = new Set<number>();
  private huntersCardAt = 0;
  private idleHuntersCard(s: GameState, viewer: number, now: number): void {
    const idle = new Set(idleCitizens(s, viewer).map((u) => u.id));
    let waiting = 0;
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.owner !== viewer || e.hp <= 0) continue;
      if (e.order.k === 'hunt') this.hunting.add(e.id);
      else if (idle.has(e.id) && this.hunting.has(e.id)) {
        if (!this.foraged.has(e.id) && now - (this.idleSince.get(e.id) ?? now) > 5000) waiting++;
      } else this.hunting.delete(e.id);
    }
    if (waiting < 2 || now < this.huntersCardAt) return;
    this.huntersCardAt = now + 30000;
    const n = Math.min(waiting, AUTO_WORK.lay);
    this.noticeEl.querySelector('.idle-hunters')?.remove();
    const el = document.createElement('div');
    el.className = 'notice alert shortage idle-hunters';
    el.innerHTML = `<span>${waiting} hunters stand idle: the game is gone.</span><button type="button" data-forage="${n}" title="Send ${n} for berries, a free field or meat nearby; a field is laid if there is none">🍖 Find more food</button>`;
    this.noticeEl.appendChild(el);
    while (this.noticeEl.children.length > 4) this.noticeEl.firstChild!.remove();
    setTimeout(() => (el.style.opacity = '0'), 8000);
    setTimeout(() => el.remove(), 8700);
  }

  /** Builders whose work is done (#344): remember who last built; 3+ idle for 5 s offer one button that sends them to the trees (`reassign` idle→wood). */
  private building = new Set<number>();
  private buildersCardAt = 0;
  private idleBuildersCard(s: GameState, viewer: number, now: number): void {
    const idle = new Set(idleCitizens(s, viewer).map((u) => u.id));
    let waiting = 0;
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.owner !== viewer || e.hp <= 0) continue;
      if (e.order.k === 'build') this.building.add(e.id);
      else if (idle.has(e.id) && this.building.has(e.id)) {
        if (now - (this.idleSince.get(e.id) ?? now) > 5000) waiting++;
      } else this.building.delete(e.id);
    }
    if (waiting < 3 || now < this.buildersCardAt) return;
    this.buildersCardAt = now + 30000;
    const n = Math.min(waiting, AUTO_WORK.lay);
    this.noticeEl.querySelector('.idle-builders')?.remove();
    const el = document.createElement('div');
    el.className = 'notice alert shortage idle-builders';
    el.innerHTML = `<span>${waiting} builders stand idle: the work is done.</span><button type="button" data-mine="wood" data-n="${n}" title="Send ${n} to the nearest trees">🪓 Fell timber</button>`;
    this.noticeEl.appendChild(el);
    while (this.noticeEl.children.length > 4) this.noticeEl.firstChild!.remove();
    setTimeout(() => (el.style.opacity = '0'), 8000);
    setTimeout(() => el.remove(), 8700);
  }

  /** Fishing boats whose shoal is spent (#344): they are not citizens, so they get their own watch; 2+ idle for 5 s offer one button that sends them to the nearest shoal in the sea. */
  private fishing = new Set<number>();
  private fishersSince = new Map<number, number>();
  private fishersCardAt = 0;
  private idleFishersCard(s: GameState, viewer: number, now: number): void {
    const next = new Map<number, number>();
    const spent: number[] = [];
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.owner !== viewer || e.type !== 'fisher' || e.hp <= 0) continue;
      if (e.order.k === 'gather') this.fishing.add(e.id);
      else if (e.order.k === 'idle' && !e.queue.length && this.fishing.has(e.id)) {
        const since = this.fishersSince.get(e.id) ?? now;
        next.set(e.id, since);
        if (now - since > 5000) spent.push(e.id);
      } else this.fishing.delete(e.id);
    }
    this.fishersSince = next;
    if (spent.length < 2 || now < this.fishersCardAt) return;
    this.fishersCardAt = now + 30000;
    this.noticeEl.querySelector('.idle-fishers')?.remove();
    const el = document.createElement('div');
    el.className = 'notice alert shortage idle-fishers';
    el.innerHTML = `<span>${spent.length} fishing boats lie idle: their shoal is spent.</span><button type="button" data-fish="${spent.join(',')}" title="Send them to the nearest shoal still in the sea">🐟 Find more fish</button>`;
    this.noticeEl.appendChild(el);
    while (this.noticeEl.children.length > 4) this.noticeEl.firstChild!.remove();
    setTimeout(() => (el.style.opacity = '0'), 8000);
    setTimeout(() => el.remove(), 8700);
  }

  /** Send the listed idle boats to the shoal nearest their middle, anywhere on the map; they fan over the shoals near it. */
  private findFish(list: string): void {
    const s = this.state;
    if (!s) return;
    const boats = list.split(',').map((x) => s.byId.get(Number(x))).filter((e): e is Unit => !!e && e.kind === 'unit' && e.owner === this.viewer && e.type === 'fisher' && e.hp > 0 && e.order.k === 'idle');
    if (!boats.length) return;
    const x = boats.reduce((a, b) => a + b.x, 0) / boats.length;
    const y = boats.reduce((a, b) => a + b.y, 0) / boats.length;
    const tile = findResource(s, R_FISH, x, y, Math.max(s.w, s.h));
    if (tile < 0) {
      this.act.sound('error');
      this.toast('No shoal is left in the sea', 'bad');
      return;
    }
    this.act.issue({ t: 'gather', p: this.viewer, ids: boats.map((b) => b.id), tile, spread: true });
    this.act.sound('click');
  }

  banner(title: string, sub = '', ms = 3200): void {
    this.bannerEl.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    this.bannerEl.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('show'), ms);
  }

  /** Bring every part of the HUD up to date. */
  /** `selectedRuin`: a ruin picked out, and whether the viewer last saw it dug out (#64). */
  /** `selectedLandmark`: a landmark picked out, and who the viewer last saw keep it. */
  update(s: GameState, viewer: number, ids: number[], speed: number, selectedTile: number | null, selectedRelic: number | null = null, selectedPost: number | null = null, selectedRuin: { id: number; dug: boolean } | null = null, selectedLandmark: { id: number; keeper: number } | null = null): void {
    this.state = s;
    this.viewer = viewer;
    this.lastIds = ids;
    this.top(s, viewer, speed);
    this.tidingCard(s, viewer);
    this.idleFieldCard(s, viewer);
    if (!this.workforcePanel.classList.contains('hidden')) this.drawWorkforce(s, viewer);
    const ents = ids.map((id) => s.byId.get(id)).filter((e): e is Ent => !!e && e.hp > 0);
    this.selection(s, viewer, ents, selectedTile, selectedRelic, selectedPost, selectedRuin, selectedLandmark);
    this.commands(s, viewer, ents);
  }

  /** The card of tidings waiting at the viewer's fire (#443), with its fade bar; hidden when none waits. */
  private tidingCard(s: GameState, viewer: number): void {
    const t = s.players[viewer]?.tiding;
    const sig = t ? `${t.card}:${t.draw}` : '';
    if (sig !== this.tidingSig) {
      this.tidingSig = sig;
      this.tidingEl.classList.toggle('hidden', !t);
      document.getElementById('hud')!.classList.toggle('has-tiding', !!t);
      if (!t) {
        this.tidingEl.innerHTML = '';
        return;
      }
      const c = TIDING_CARDS[t.card];
      const cost = Object.entries(tidingCost(t.card)).map(([r, n]) => `${n} ${RES_LABEL[r as keyof typeof RES_LABEL].toLowerCase()}`).join(' + ');
      const gain = t.card === 'traveller' ? '+1 citizen' : t.card === 'hunter' ? `+${TIDINGS.hunter.food} food` : t.card === 'tale' ? 'learn where it lies' : 'safe';
      const risk = t.card === 'storm' ? `maybe: houses lose ${Math.round(TIDINGS.storm.harm * 100)}% health` : t.card === 'fever' ? 'maybe: a citizen dies' : 'nothing happens';
      this.tidingEl.innerHTML = `<h3><span>${c.icon}</span>${c.name}</h3><p>${c.text}</p><div class="row"><button type="button" class="take" data-take="1">${c.take}<small>${cost}: ${gain}</small></button><button type="button" data-take="0">${c.pass}<small>${risk}</small></button></div><div class="fade"><i></i></div>`;
    }
    if (!t) return;
    const left = Math.max(0, Math.min(1, (t.until - s.tick) / secs(TIDINGS.fade)));
    const bar = this.tidingEl.querySelector<HTMLElement>('.fade i');
    if (bar) bar.style.width = `${(left * 100).toFixed(1)}%`;
  }

  /** Ask the sim to move `n` citizens between jobs; it picks who (idle first) and where they go. */
  private moveWorkers(from: Job, to: Job, n: number): void {
    if (!Number.isFinite(n) || n < 1) return;
    this.act.issue({ t: 'reassign', p: this.viewer, from, to, n: Math.floor(n) });
    this.act.sound('click');
  }

  /** The "+" on a job: bring `n` hands to it, from the idle first, then from the biggest other job. */
  private sendWorkers(to: Job, n: number): void {
    if (!this.state) return;
    const jobs = workforce(this.state, this.viewer);
    const sources = (['idle', 'food', 'wood', 'stone', 'gold'] as const).filter((j) => j !== to && (jobs.get(j)?.length ?? 0) > 0);
    sources.sort((a, b) => (a === 'idle' ? -1 : b === 'idle' ? 1 : (jobs.get(b)?.length ?? 0) - (jobs.get(a)?.length ?? 0)));
    let left = n;
    for (const from of sources) {
      if (left <= 0) break;
      const take = Math.min(left, jobs.get(from)!.length);
      this.moveWorkers(from, to, take);
      left -= take;
    }
    if (left === n) {
      this.act.sound('error');
      this.toast('No one to spare from another job', 'bad');
    }
  }

  private drawWorkforce(s: GameState, viewer: number): void {
    const jobs = workforce(s, viewer);
    const total = WORKFORCE_JOBS.reduce((n, job) => n + (jobs.get(job.key)?.length ?? 0), 0);
    const opt = (keys: readonly string[]) => WORKFORCE_JOBS.filter((j) => keys.includes(j.key)).map((j) => `<option value="${j.key}">${j.icon} ${j.label}</option>`).join('');
    // The skeleton is built once so the number box and the pickers keep what the player set while the counts refresh.
    if (!this.workforcePanel.querySelector('#wf-rows')) {
      this.workforcePanel.innerHTML = '<div class="workforce-head" id="wf-head"></div><div id="wf-rows"></div>' +
        `<div class="wf-move"><div class="wf-line">Move <input id="wf-n" type="number" min="1" max="200" value="5" aria-label="How many"></div>` +
        `<div class="wf-line">from <select id="wf-from" aria-label="From job">${opt(['wood', 'food', 'stone', 'gold', 'build', 'idle'])}</select></div>` +
        `<div class="wf-line">to <select id="wf-to" aria-label="To job">${opt(['food', 'wood', 'stone', 'gold', 'build'])}</select> <button type="button" class="wf-go" data-go>Go</button></div></div>` +
        '<div class="workforce-note">Choose a row to select its citizens. + sends one (Shift: five) from the idle first, else the biggest job (on Food, with no bush, field or game in reach, it lays a field for each and they raise it); on Building it joins the nearest unfinished building and goes back to its old work after. Move sends the idle and empty-handed first.</div>';
    }
    // Written only when it changes: rebuilding a button between a press and its release would swallow the click.
    const set = (sel: string, html: string) => {
      if (this.wfDrawn.get(sel) === html) return;
      this.wfDrawn.set(sel, html);
      this.workforcePanel.querySelector(sel)!.innerHTML = html;
    };
    set('#wf-head', `Workforce <span>${total} ${isLegion(s.players[viewer]) ? 'hands' : 'citizens'}</span>`);
    set('#wf-rows', WORKFORCE_JOBS.map((job) => {
      const n = jobs.get(job.key)?.length ?? 0;
      const plus = ['food', 'wood', 'stone', 'gold', 'build'].includes(job.key) ? `<button type="button" class="wf-add" data-add="${job.key}" title="Send one more to ${job.label.toLowerCase()} (Shift: five)" aria-label="Send one more to ${job.label.toLowerCase()}">+</button>` : '';
      return `<div class="wf-row"><button type="button" data-job="${job.key}" ${n ? '' : 'disabled'} title="Select ${job.label.toLowerCase()} citizens"><span>${job.icon} ${job.label}</span><strong>${n}</strong></button>${plus}</div>`;
    }).join(''));
  }

  private top(s: GameState, viewer: number, speed: number): void {
    const p = s.players[viewer];
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === viewer && e.advance >= 0);
    const idle = idleCitizens(s, viewer).length;
    const road = tc ? journeyOf(p, tc) : undefined;
    const adv = road ? Math.floor((tc!.advance / secs(road.time)) * 100) : -1;
    const age = ageDef(p);
    const idleTechs = suspendedTechs(p).map((t) => TECHS[t].name);
    const scores = s.players.map((q) => scoreOf(s, q));
    const sig = `${RES.map((r) => Math.floor(p.res[r])).join(',')}|${RARES.map((r) => Math.floor(p.rare?.[r] ?? 0)).join(',')}|${Math.floor(bloodOf(p))}|${p.pop}/${p.cap}|${ageOf(p)}|${adv}|${p.way ?? ''}${p.deep ? '+' : ''}${p.vowed ? 'v' : ''}|${idleTechs.length}|${idle}|${speed}|${scores.join(',')}|${isHousehold(p) ? Math.round(taxRate(s, viewer) * 60) : ''}|${p.kegs ?? ''}|${(s.launches ?? []).map((l) => `${l.id}:${clockOf(s, l)}${revealed(s, l) ? '!' : ''}${ringsFor(s, l, viewer).length}`).join(',')}|${(s.blooms ?? []).map((l) => `${l.id}:${bloomClock(s, l)}:${l.cut}`).join(',')}|${tideSig(s)}`;
    const sn = seasonOf(s);
    const tide = tideChip(s);
    this.clockEl.textContent = `${sn.icon} ${fmtTime(s.tick)}${tide ? `  ${tide.text}` : ''}`;
    const hl = s.homeland ? HOMELANDS[s.homeland] : undefined;
    this.clockEl.title = `${sn.name}: ${sn.blurb}${hl ? `\n${hl.icon} ${hl.name}: ${hl.blurb}${hl.year[seasonAt(s)] ? `\nThis season: ${hl.year[seasonAt(s)]}` : ''}` : ''}${tide ? `\n${tide.tip}` : ''}`;
    this.timers(s, viewer);
    this.objectives(s);
    if (sig === this.topSig) return;
    this.topSig = sig;
    this.resEl.innerHTML =
      RES.map((r) => `<div class="res" data-tip="<b>${RES_LABEL[r]}</b>${r === 'gold' && isHousehold(p) ? householdHint(s, viewer) : r === 'stone' && isNomad(p) ? NOMAD_STONE : r === 'food' && isNomad(p) ? NOMAD_FOOD : resHint(r)}">${icon(r)}${Math.floor(p.res[r])}</div>`).join('') +
      RARES.filter((r) => (p.rare?.[r] ?? 0) > 0)
        .map((r) => `<div class="res" data-tip="<b>${RARE[r].name}</b>${RARE[r].blurb} Mined from deep veins that only some worlds hold.">${RARE_ICON[r]}${Math.floor(p.rare![r]!)}</div>`)
        .join('') +
      (p.blood !== undefined ? `<div class="res" data-tip="<b>Blood</b>Drawn at Drain Rigs from the enemy who fall near them, and from citizens given to the levy. Spent to raise Blood Towers, and at Transfusion Stations to graft soldiers. In Hemocraft the rigs also bleed the living enemy who stand near them; in the Blood-rite every Temple draws as a rig does, and spends blood to mend your own.">🩸${Math.floor(bloodOf(p))}</div>` : '') +
      (s.blooms ?? []).map((l) => `<div class="res" data-tip="<b>Bloom Seed</b>${seedTip(s, l, viewer)}">🌱 ${s.players[l.owner].name} ${bloomClock(s, l)}s</div>`).join('') +
      (s.launches ?? []).map((l) => `<div class="res" data-tip="<b>Warhead in the air</b>${warnTip(s, l, viewer)}">☢ ${s.players[l.owner].name} ${clockOf(s, l)}s${s.players[viewer].team !== s.players[l.owner].team && !revealed(s, l) ? ` · ${ringsFor(s, l, viewer).length} rings` : ''}</div>`).join('') +
      (p.kegs !== undefined || mills(p) || sappers(p) ? `<div class="res" data-tip="<b>Powder kegs</b>Ground from saltpetre at the Siege Workshops in the Age of Alchemy, ${KEG.ore} a keg, up to ${KEG.most} in store. In the Age of Sappers citizens and foot soldiers lay them at a rival building (K): ${KEG.fuse} seconds later each blows, wrecking every rival building within ${KEG.reach} tiles, unless a rival reaches it first and stamps it out.${mills(p) ? `<br>${millProblem(s, p) ?? `The mills grind: next keg in ${Math.max(0, Math.ceil((KEG.time - (p.grind ?? 0)) / Math.max(1, millsOf(s, viewer).length)))}s.`}` : ''}">🧨${kegsOf(p)}</div>` : '') +
      `<div class="res pop ${p.pop >= p.cap ? 'full' : ''}" data-tip="<b>Population</b>People and soldiers you have, and room for. Houses add 5 each, a Town Center 10 (150 at most).">${icon('pop')}${p.pop}/${p.cap}</div>`;
    const civ = CIVS[p.civ];
    const board = s.players
      .map((q, i) => `<div><span class='swatch' style='background:${q.color}'></span>${q.name}${q.defeated ? ' (out)' : ''}: ${q.id === viewer || q.team === p.team ? scores[i] : '?'}</div>`)
      .join('');
    this.resEl.innerHTML += `<div class="res civ" data-tip="<b>${civ.name}</b>${civ.blurb}<br><i>${SIGNATURES[p.civ].blurb}</i>${p.way ? `<br>${WAYS[p.way].icon} <b>${WAYS[p.way].name}</b>: ${WAYS[p.way].blurb}${p.deep ? `<br>Deepened: ${WAYS[p.way].deep.blurb}` : ''}` : ''}">${crestSvg(p.civ, p.color, 18)}${civ.name}${p.way ? ` ${WAYS[p.way].icon}` : ''}</div><div class="res score" data-tip="<b>Score</b>Gathering, fighting, building, research and epochs.${board}">⭐${scores[viewer]}</div>`;
    this.epochEl.innerHTML = road
      ? `${age.name} <span class="bar" data-tip="<b>${road.back ? 'Stepping back' : 'Advancing'} to the ${AGES[road.to].name}</b>${adv}%"><i style="width:${adv}%"></i></span>`
      : `<span data-tip="<b>${age.name}</b>${age.blurb}${age.path ? `<br><i>${PATHS[age.path].name}: step ${pathDepth(p)} of ${pathLine(age.path).length + (PATHS[age.path].planned?.length ?? 0)}.${age.hemocraft || age.rite ? ` Blood drawn: ${Math.floor(p.stats.blood ?? 0)}.${age.rite ? ` Health mended at the altars: ${Math.floor(p.stats.riteMended ?? 0)}.` : ''}` : ''} ${age.path === 'steppe' ? `Tribute taken: ${Math.floor(p.stats.tribute ?? 0)} gold.${age.caravans ? ` Gold the caravans earned on the move: ${p.stats.caravan ?? 0}. Tolls taken from rival traders: ${p.stats.toll ?? 0}.` : ''}` : `Plunder taken: ${p.stats.plunder ?? 0} gold.`}</i>` : ''}${idleTechs.length ? `<br>Suspended until you climb again: ${idleTechs.join(', ')}.` : ''}${mainRoad(p) ? `<br><span class='hint'>Advance at a Town Center.</span>` : ''}">${age.name}</span>`;
    this.idleEl.textContent = `Idle ${idle}`;
    this.idleEl.classList.toggle('alert', idle > 0);
    if (idle > this.idleSeen) {
      // One bright flash each time more hands fall idle, so a dry bush or spent seam is noticed.
      this.idleEl.classList.remove('rise');
      void this.idleEl.offsetWidth;
      this.idleEl.classList.add('rise');
    }
    this.idleSeen = idle;
    document.getElementById('speed-btn')!.textContent = `${speed}×`;
  }

  private objEl = document.getElementById('objectives')!;
  private objHtml = '';

  /** A campaign scenario's goals, in the corner. */
  private objectives(s: GameState): void {
    const sc = s.scenario ? scenarioById(s.scenario.id) : undefined;
    const html = sc ? objectivesHtml(s, sc) : '';
    if (html === this.objHtml) return;
    this.objHtml = html;
    this.objEl.innerHTML = html;
    this.objEl.classList.toggle('hidden', !html);
  }

  /** Peace time and wonder countdowns under the top bar. */
  private timers(s: GameState, viewer: number): void {
    const parts: string[] = [];
    if (s.tick < s.peaceUntil) parts.push(`<div class="timer peace">🕊 Peace for ${fmtTime(s.peaceUntil - s.tick)}</div>`);
    for (const e of s.ents) {
      if (e.kind !== 'building' || e.type !== 'wonder' || e.hp <= 0) continue;
      const q = s.players[e.owner];
      const ours = q.team === s.players[viewer].team;
      // A Wonder still being built (#361): how far along, so its rivals can judge when to strike.
      if (!e.built) {
        parts.push(`<div class="timer ${ours ? 'good' : 'bad'}" data-focus="${e.x},${e.y}"><span class="swatch" style="background:${q.color}"></span>${q.id === viewer ? 'Your' : `${q.name}'s`} Wonder rising: ${Math.floor(e.progress * 100)}% built${ours ? '' : ' (stop it!)'}</div>`);
        continue;
      }
      if (e.timer < 0) continue;
      parts.push(`<div class="timer ${ours ? 'good' : 'bad'}" data-focus="${e.x},${e.y}"><span class="swatch" style="background:${q.color}"></span>${q.id === viewer ? 'Your' : `${q.name}'s`} Wonder: ${fmtTime(e.timer)}${ours ? '' : ' (destroy it!)'}</div>`);
    }
    // The heart (#452): a people with no Town Center standing has `heartless - tick` left to lay a new foundation.
    for (const q of s.players) {
      if (q.heartless === undefined || q.defeated) continue;
      const ours = q.team === s.players[viewer].team;
      const left = Math.max(0, q.heartless - s.tick);
      const urgent = left < secs(10) ? ' urgent' : '';
      parts.push(`<div class="timer ${ours ? 'bad' : 'good'}${urgent}"><span class="swatch" style="background:${q.color}"></span>${q.id === viewer ? 'Your people has' : `${q.name} has`} no Town Center: ${fmtTime(left)}${q.id === viewer ? ' (build a new Town Center!)' : ours ? ' (help them rebuild)' : ' (finish them!)'}</div>`);
    }
    if (s.relicTeam >= 0 && s.relicTimer >= 0) {
      const ours = s.relicTeam === s.players[viewer].team;
      const keepers = s.players.filter((q) => q.team === s.relicTeam);
      const who = ours ? (keepers.length > 1 ? 'Your side keeps' : 'You keep') : `${keepers.map((q) => q.name).join(' and ')} ${keepers.length > 1 ? 'keep' : 'keeps'}`;
      const shrine = s.relics[0] ? s.byId.get(s.relics[0].temple) : undefined;
      const focus = shrine ? ` data-focus="${shrine.x},${shrine.y}"` : '';
      parts.push(`<div class="timer ${ours ? 'good' : 'bad'}"${focus}>⚱ ${who} every relic: ${fmtTime(s.relicTimer)}${ours ? '' : ' (take one back!)'}</div>`);
    }
    // The Greening (the Age of the Bloom): a people holding its land green has this long left, on every screen, as a Wonder's clock.
    for (const q of s.players) {
      const left = greenLeft(s, q);
      if (left === null || q.defeated) continue;
      const ours = q.team === s.players[viewer].team;
      const heart = heartOf(s, q.id);
      const focus = heart ? ` data-focus="${heart.x},${heart.y}"` : '';
      parts.push(`<div class="timer ${ours ? 'good' : 'bad'}"${focus} data-tip="<b>The Greening</b>${q.id === viewer ? 'Your' : `${q.name}'s`} land is ${((q.green ?? 0) / 10).toFixed(1)}% green (trees, Orchards, the Heart Tree and Thornwalls grown to living oak), over the ${BLOOM.green * 100}% needed. Held for ${BLOOM.hold / 60} minutes with the Heart Tree standing, it wins the match. Fell and burn the woods in that land, or fell the Heart Tree, to stop it."><span class="swatch" style="background:${q.color}"></span>🌿 ${q.id === viewer ? 'Your' : `${q.name}'s`} Greening: ${fmtTime(secs(left))}${ours ? '' : ' (burn their woods!)'}</div>`);
    }
    if ((s.landTeam ?? -1) >= 0 && (s.landTimer ?? -1) >= 0) {
      const ours = s.landTeam === s.players[viewer].team;
      const keepers = s.players.filter((q) => q.team === s.landTeam);
      const who = ours ? (keepers.length > 1 ? 'Your side keeps' : 'You keep') : `${keepers.map((q) => q.name).join(' and ')} ${keepers.length > 1 ? 'keep' : 'keeps'}`;
      const m = s.landmarks?.[0];
      const focus = m ? ` data-focus="${m.x},${m.y}"` : '';
      parts.push(`<div class="timer ${ours ? 'good' : 'bad'}"${focus}>⛰ ${who} every landmark: ${fmtTime(s.landTimer!)}${ours ? '' : ' (take one back!)'}</div>`);
    }
    const html = parts.join('');
    if (html !== this.timerHtml) {
      this.timerHtml = html;
      this.timerEl.innerHTML = html;
    }
  }

  private selection(s: GameState, viewer: number, ents: Ent[], tile: number | null, relicId: number | null, postId: number | null, ruinSel: { id: number; dug: boolean } | null = null, markSel: { id: number; keeper: number } | null = null): void {
    let html = '';
    let sig = '';
    const relic = !ents.length && relicId !== null ? relicAt(s, relicId) : undefined;
    const post = !ents.length && postId !== null ? postAt(s, postId) : undefined;
    const ruin = !ents.length && ruinSel ? ruinAt(s, ruinSel.id) : undefined;
    const mark = !ents.length && markSel ? landmarkAt(s, markSel.id) : undefined;
    if (mark) [html, sig] = this.landmarkPanel(s, viewer, mark, markSel!.keeper);
    else if (ruin) [html, sig] = this.ruinPanel(s, viewer, ruin, ruinSel!.dug);
    else if (relic) [html, sig] = this.relicPanel(s, viewer, relic);
    else if (post) [html, sig] = this.postPanel(s, viewer, post);
    else if (!ents.length && tile !== null && s.res[tile]) {
      const kind = s.res[tile];
      const name = kind === R_COCKLE ? 'Cockle bed' : kind === R_TREE ? 'Tree' : kind === R_BERRY ? 'Berry bush' : kind === R_MEAT ? (s.amount[tile] > BOAR.meat ? 'Mammoth carcass' : s.amount[tile] > AMOUNT.meat ? 'Boar carcass' : 'Carcass') + (s.carcasses?.some((c) => c.tile === tile && s.tick - c.born >= secs(ROT.grace)) ? ' (spoiling)' : '') : kind === R_FISH ? 'Fish shoal' : kind === R_GOLD ? 'Gold mine' : kind === R_BOG ? 'Bog iron' : kind === R_SALT || kind === R_SALTPETRE || kind === R_BLOODIRON ? (s.caves?.some((c) => c.tile === tile) ? `${RARE[RARE_OF_TILE[kind]].name} cave` : `${RARE[RARE_OF_TILE[kind]].name} vein`) : 'Stone quarry';
      const res = RARE_OF_TILE[kind] ? 'stone' : kind === R_TREE ? 'wood' : kind === R_BERRY || kind === R_MEAT || kind === R_FISH || kind === R_COCKLE ? 'food' : kind === R_GOLD || kind === R_BOG ? 'gold' : 'stone';
      // A cockle bed (#767) tells its tide: bared for so long, or under water until so long.
      const bed = kind === R_COCKLE ? bedClock(s, tile) : null;
      const bedLine = !bed ? '' : bed.pond ? 'Shut in a barrage\'s pond, it stays under water: no one picks it until the barrage is breached.' : bed.bare ? `Bared by the tide for ${Math.ceil(bed.secs)}s more. Select citizens and right-click it to pick; they come ashore before the flood, and go back at the next low water.` : `Under water: the tide bares it in ${Math.ceil(bed.secs)}s. Citizens sent to it wait ashore until then.`;
      sig = `res:${tile}:${s.amount[tile]}:${bed ? Math.ceil(bed.secs) : ''}`;
      html = `<div class="sel-portrait"><span style="font-size:54px">${kind === R_COCKLE ? '🐚' : kind === R_TREE ? '🌳' : kind === R_BERRY ? '🫐' : kind === R_MEAT ? '🍖' : kind === R_FISH ? '🐟' : kind === R_GOLD ? icon('gold', 64) : kind === R_BOG ? '🟤' : RARE_OF_TILE[kind] ? RARE_ICON[RARE_OF_TILE[kind]] : icon('stone', 64)}</span></div>
        <div class="sel-info"><div class="sel-name">${name}</div><div class="stats"><span>${icon(res as 'wood')}${s.amount[tile]} left</span></div>
        <div class="blurb">${bed ? `Cockles in the wet sand of the deeper flats, picked by hand as the tide runs low. Each high water brings ${COCKLE.regrow} back, up to ${COCKLE.amount}, to a bed open to the sea. ${bedLine}` : kind === R_FISH ? 'Select fishing boats (from a Dock) and right-click it to fish.' : RARE_OF_TILE[kind] ? `${RARE[RARE_OF_TILE[kind]].blurb} Only some worlds hold it.${s.caves?.some((c) => c.tile === tile && c.den) ? ' Wolves lair here.' : ''} Select citizens and right-click it to mine; it is kept apart from your other stores.` : kind === R_BOG ? 'Rust-red ore in the wetland mud, smelted into iron bars and paid in as gold. Digging it opens the Iron Age, in the Stone Age, to a people whose Prospector\'s Lodge has found it.' : 'Select citizens and right-click it to gather.'}</div></div>`;
    } else if (!ents.length) {
      const p = s.players[viewer];
      // A Golden Age (#703) counts down here, with what it weaves.
      const ends = goldenEnds(p);
      const left = ends === undefined ? 0 : Math.max(0, Math.ceil((ends - s.tick) / TICK_HZ));
      sig = `none:${ageOf(p)}:${left}`;
      const gold = ends === undefined ? '' : `<div>✨ <b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b> of gold left. Woven together: ${threadsOf(p).map((a) => AGES[a].name).join(', ')}.</div>`;
      html = `<div class="empty-sel"><div class="sel-name">${ageDef(p).name}</div>${gold}
        <div>Left-click to select, drag to select many. Right-click to give orders.</div>
        <div><kbd>.</kbd> finds an idle citizen, <kbd>Shift</kbd> + <kbd>.</kbd> selects all idle citizens, <kbd>,</kbd> your army, <kbd>H</kbd> your Town Center; <kbd>B</kbd> and <kbd>V</kbd> build with citizens selected.</div>
        <div>Hold <kbd>Shift</kbd> while giving orders to queue them up.</div></div>`;
    } else if (ents.length === 1) {
      const e = ents[0];
      if (e.kind === 'unit') [html, sig] = this.unitPanel(s, viewer, e);
      else [html, sig] = this.buildingPanel(s, viewer, e);
    } else {
      // Many: portraits grouped by kind, each with its health.
      const groups = new Map<string, Ent[]>();
      for (const e of ents) {
        const k = `${e.owner}:${e.kind}:${e.type}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(e);
      }
      const items: string[] = [];
      for (const list of groups.values()) {
        for (const e of list.slice(0, 60)) {
          const max = e.kind === 'unit' ? statsFor(s, e.owner, e.type).hp : buildingMaxHp(s, e.owner, e.type, e.kind === 'building' ? e.level : 0);
          const pic = e.kind === 'unit' ? unitPicture(e.type, s.players[e.owner].epoch, s.players[e.owner].color) : buildingPicture(e.type, s.players[e.owner].epoch, s.players[e.owner].color);
          items.push(`<div class="mitem" data-pick="${e.id}" data-tip="<b>${nameOf(s, e)}</b>Click to pick only this one; shift-click to drop it."><img src="${pic}" alt=""><div class="mhp"><i style="width:${Math.round((e.hp / max) * 100)}%"></i></div></div>`);
        }
      }
      const counts = [...groups.values()].map((l) => `${l.length} ${l.length > 1 ? plural(nameOf(s, l[0])) : nameOf(s, l[0])}`).join(', ');
      sig = `multi:${ents.map((e) => `${e.id}:${Math.ceil(e.hp)}`).join(',')}`;
      html = `<div class="sel-info" style="flex:0 0 150px"><div class="sel-name">${ents.length} selected</div><div class="sel-sub">${counts}</div></div><div class="multi">${items.join('')}</div>`;
    }
    if (sig !== this.selSig) {
      this.selSig = sig;
      this.selEl.innerHTML = html;
    }
  }

  private relicPanel(s: GameState, viewer: number, r: NonNullable<ReturnType<typeof relicAt>>): [string, string] {
    const holder = r.carrier ? s.byId.get(r.carrier) : r.temple ? s.byId.get(r.temple) : undefined;
    const q = holder ? s.players[holder.owner] : null;
    const status = !q ? 'Lying in the open' : r.carrier ? (q.id === viewer ? 'Carried by your priest' : `Carried by ${q.name}'s priest`) : q.id === viewer ? 'Kept in your Temple' : `Kept in ${q.name}'s Temple`;
    const perMin = Math.round((60 / RELIC.every) * RELIC.gold);
    const html = `<div class="sel-portrait"><span style="font-size:54px">⚱</span></div>
      <div class="sel-info"><div class="sel-name">Relic</div><div class="sel-sub">${status}</div>
      <div class="stats"><span data-tip="<b>Gold</b>Brings in gold while kept in a Temple.">${icon('gold')}${perMin}<em>a minute</em></span><span data-tip="<b>Relics</b>How many lie on this map.">⚱<em>On the map</em> ${s.relics.length}</span></div>
      <div class="blurb">Select a priest and right-click it to carry it to your Temple, where it brings in ${perMin} gold a minute. Keep every relic on the map for ${fmtTime(s.wonderTime)} and you win.</div></div>`;
    return [html, `relic:${r.id}:${status}:${s.relics.length}`];
  }

  /** A contested landmark: who keeps it, how the claim stands (when in sight), and what it gives. */
  private landmarkPanel(s: GameState, viewer: number, m: Landmark, keeperAsSeen: number): [string, string] {
    const inSight = sees(s, viewer, m.x, m.y);
    const keeper = inSight ? m.owner : keeperAsSeen;
    const def = LANDMARK_KINDS[m.kind];
    const who = (p: number) => (p === viewer ? 'you' : s.players[p].name);
    const pct = Math.floor((100 * m.claim) / claimWork());
    let status = keeper < 0 ? 'Nobody keeps it' : `Kept by ${who(keeper)}`;
    if (inSight) {
      const there = claimants(s, m);
      if (there.size > 1) status += ' · contested!';
      else if (m.owner < 0 && m.by >= 0 && m.claim > 0) status += ` · ${m.by === viewer ? 'your' : `${s.players[m.by].name}'s`} claim ${pct}%`;
      else if (m.owner >= 0 && m.claim < claimWork()) status += ` · held ${pct}%`;
    }
    const portrait = m.kind === 'spring' ? '⛲' : m.kind === 'crag' ? '⛰' : m.kind === 'flint' ? '🔶' : m.kind === 'grove' ? '🌳' : m.kind === 'ford' ? '🌊' : '🪨';
    const html = `<div class="sel-portrait"><span style="font-size:54px">${portrait}</span></div>
      <div class="sel-info"><div class="sel-name">${def.name}</div><div class="sel-sub">${status}</div>
      <div class="stats"><span data-tip="<b>Claiming</b>How long one person standing on it alone takes to claim it. Up to ${LANDMARKS.crowd} claim faster; rivals there too stop the claim.">⚑<em>One person</em> ${LANDMARKS.claim}s</span><span data-tip="<b>Land</b>Its keeper holds the land round it: their soldiers are supplied there, and rivals can't build in it.">🗺<em>Land</em> ${LANDMARKS.border} tiles</span></div>
      <div class="blurb">${def.blurb}${favours(s, viewer, m.kind) ? ` It is your people's own: its gift is ${LANDMARKS.kinMul} times as strong for you.` : ''} Send anyone there (citizens too) and keep rivals off it to claim it; a rival standing on it alone pulls it back down to nobody's, then takes it.</div></div>`;
    return [html, `mark:${m.id}:${status}`];
  }

  /** An ancient ruin (#64): what might lie beneath (never what does, until it's dug), and how the dig goes. */
  private ruinPanel(s: GameState, viewer: number, r: Ruin, dugAsSeen: boolean): [string, string] {
    const inSight = sees(s, viewer, r.x, r.y);
    const dug = inSight ? r.by >= 0 : dugAsSeen;
    const ours = r.by >= 0 && s.players[r.by].team === s.players[viewer].team;
    const pct = Math.floor((100 * r.dug) / digWork());
    const mine = s.ents.filter((e) => e.kind === 'unit' && e.owner === viewer && e.order.k === 'dig' && e.order.target === r.id).length;
    const status = dug
      ? ours ? `Dug out by ${r.by === viewer ? 'your people' : s.players[r.by].name}: ${RUIN_FINDS[r.find].name.toLowerCase()}` : 'Dug out: whatever lay here is gone'
      : inSight && r.dug > 0 ? `${pct}% dug${mine ? ` · ${mine} of your citizens at work` : ''}` : mine ? `${mine} of your citizens on the way` : 'Undisturbed';
    const finds = (Object.keys(RUIN_FINDS) as (keyof typeof RUIN_FINDS)[]).map((k) => `<b>${RUIN_FINDS[k].name}</b>: ${RUIN_FINDS[k].blurb}`).join('<br>');
    const html = `<div class="sel-portrait"><span style="font-size:54px">${dug ? '⛏' : '🏛'}</span></div>
      <div class="sel-info"><div class="sel-name">Ancient Ruins</div><div class="sel-sub">${status}</div>
      <div class="stats"><span data-tip="<b>The dig</b>How long one citizen takes to dig it out. More dig quicker.">⛏<em>One citizen</em> ${RUINS.dig}s</span><span data-tip="<b>What may lie beneath</b>${finds}">❔<em>Beneath</em> ${dug && ours ? RUIN_FINDS[r.find].name : dug ? 'gone' : 'unknown'}</span></div>
      <div class="blurb">${dug ? 'Only an open pit and spoil heaps now.' : 'Stones of a people older than any here. Select citizens and right-click to dig: whoever strikes the last spade takes what lies beneath. It might be a hoard of gold, lost knowledge, an old map of the land, or a relic. Diggers far from home want an escort.'}</div></div>`;
    return [html, `ruin:${r.id}:${status}:${dug}`];
  }

  private postPanel(s: GameState, viewer: number, post: TradePost): [string, string] {
    const m = homeMarket(s, viewer, post.x, post.y);
    const pay = m ? tripGold(s, viewer, m, post) : 0;
    const mine = s.ents.filter((e) => e.kind === 'unit' && e.owner === viewer && (e.type === 'trader' || e.type === 'cog') && e.order.k === 'trade' && e.order.post === post.id).length;
    const flood = Math.round(glutNow(s, post) * 100);
    // A post that sells rare ore this world lacks (#573).
    const sells = (post.sells ?? []).map((r) => `${RARE[r].name} ${icon('gold', 14)}${loadPrice(s, r)} a load of ${ORE_POST.lot}`).join(', ');
    const status = (m ? `From your nearest Market: ${icon('gold', 14)}${pay} a trip${flood ? ` (${flood}% glut)` : ''}` : 'Build a Market to trade here') + (sells ? ` · Sells ${sells}` : '');
    const html = `<div class="sel-portrait"><span style="font-size:54px">🐪</span></div>
      <div class="sel-info"><div class="sel-name">Trading Post</div><div class="sel-sub">${status}</div>
      <div class="stats"><span data-tip="<b>Your traders</b>On the road to this post.">🐪<em>Your traders</em> ${mine}</span><span data-tip="<b>Most a trip</b>The farthest roads pay up to this.">${icon('gold')}<em>At most</em> ${TRADE.max}</span></div>
      <div class="blurb">Neutral ground where anyone may trade. Train traders at a Market, select them and right-click here: they carry goods out and bring back gold, the more the farther their Market stands from the post. Where water lies within ${TRADE.sea.reach} tiles it is a port too: merchant ships from a Dock sail here for ${Math.round((TRADE.sea.mul - 1) * 100)}% more. Every load floods the post: its price falls ${Math.round(TRADE.glut.each * 100)}% a trip (anyone's) and heals slowly, so spread your traders over the posts. Nothing is paid until they are home, so guard the road.</div></div>`;
    return [html, `post:${post.id}:${status}:${mine}`];
  }

  private unitPanel(s: GameState, viewer: number, u: Unit): [string, string] {
    const p = s.players[u.owner];
    const st = statsFor(s, u.owner, u.type);
    const frac = u.hp / st.hp;
    const mine = u.owner === viewer;
    const queued = mine && u.queue.length ? ` <span class="hint">(+${u.queue.length} queued)</span>` : '';
    const status = mine ? orderWords(s, u) + queued : p.name;
    const carry = mine && u.carry > 0 && u.carryRes ? `<span>${icon(u.carryRes)}${u.carry}<em>carried</em></span>` : '';
    const cargo = u.type === 'transport' ? `<span data-tip="<b>Aboard</b>Soldiers and citizens carried. Right-click a shore (or press U) to land them.">⛵<em>Aboard</em> ${u.cargo.length}/${st.capacity ?? 0}</span>` : u.type === 'skywhale' ? `<span data-tip="<b>Aboard</b>Soldiers and citizens carried. Right-click ground (or press U) to set them down, over walls and woods.">🐋<em>Aboard</em> ${u.cargo.length}/${st.capacity ?? 0}</span>` : '';
    const stance = st.attack > 0 && u.type !== 'citizen' && mine ? `<span data-tip="<b>Stance</b>Z attack and destroy, X fight if provoked, C hold, N run.">${u.stance === 'stand' ? '⚓ Hold' : u.stance === 'defensive' ? '🛡 Provoked' : u.stance === 'run' ? '🏃 Run' : '🔥 Attack'}</span>` : '';
    const aura = s.tick - u.aura < 5 && u.type !== 'hero' ? `<span data-tip="<b>Inspired</b>A hero nearby: hits harder and heals.">✨<em>Inspired</em></span>` : '';
    const rank = rankOf(u);
    const vet = rank ? `<span data-tip="<b>${VETERANCY.names[rank - 1]}</b>${u.vet} enemy soldiers defeated: blows ${Math.round((VETERANCY.attack[rank - 1] - 1) * 100)}% harder${VETERANCY.armor[rank - 1] ? `, +${VETERANCY.armor[rank - 1]} armor` : ''}.">${'▲'.repeat(rank)}<em>${VETERANCY.names[rank - 1]}</em></span>` : '';
    // The set line (#501, the Britons): a bowman who has stood still draws the longbow to the full.
    const bow = bowman(s, u);
    const isLine = bow && isSet(s, u);
    const line = bow ? `<span data-tip="<b>${isLine ? 'Set' : 'Setting'}</b>${isLine ? `Standing still: reaches ${LONGBOW.range} tiles farther and strikes ${LONGBOW.attack} harder. A step breaks it.` : `Stand still ${LONGBOW.after} seconds and the longbow is drawn to the full: ${LONGBOW.range} tiles farther, ${LONGBOW.attack} harder.`}">🏹<em>${isLine ? 'Set' : 'Unset'}</em></span>` : '';
    const o = u.order;
    const route = mine && o.k === 'trade' ? postAt(s, o.post) : undefined;
    const home = route && o.k === 'trade' ? (marketOf(s, u.owner, o.market) ?? caravanOf(s, u.owner, o.market) ?? homeMarket(s, u.owner, route.x, route.y) ?? nearestCaravan(s, u.owner, route.x, route.y)) : null;
    const trip = route && home ? `<span data-tip="<b>A trip</b>What one trip between its Market and the post pays, once home.">${icon('gold')}${tripGold(s, u.owner, home, route)}<em>a trip</em></span>` : '';
    // A caravan on the Silk Road (#326): how far its Market has moved since it set out, and what that adds.
    const road = home && o.k === 'trade' && o.from && ageDef(p).caravans ? caravanBonus(s, u.owner, 100, o.from, home).moved : -1;
    const caravan = road >= 0 ? `<span data-tip="<b>The camp moved</b>Its Market has moved ${road} tiles since this trader set out: the trip pays ${Math.round(SILK.each * Math.min(SILK.most, road) * 100)}% more when it comes home (${Math.round(SILK.each * 100)}% a tile, up to ${Math.round(SILK.each * SILK.most * 100)}%). Keep the camp moving along the road.">🐫<em>+${Math.round(SILK.each * Math.min(SILK.most, road) * 100)}%</em></span>` : '';
    const load = u.type === 'wagon' && u.packed ? `<span data-tip="<b>Packed</b>The ${BUILDINGS[u.packed].name} this wagon carries, and the health it will be pitched with. Press P to pitch it.${u.packed === 'market' ? ' Your traders still come home to it on the road, and every tile it covers while they are out pays them more.' : ''}">⛺<em>${BUILDINGS[u.packed].name}</em> ${Math.round((u.packedHp ?? 1) * 100)}%</span>` : '';
    // A horde's rider standing in a rival's land (#318): what it takes, and from whom.
    const landlord = modsOf(s, u.owner).tribute > 0 && isRider(u) ? landOwnerAt(s, Math.floor(u.x), Math.floor(u.y)) : -1;
    const taking = landlord >= 0 && exacting(s, u, landlord);
    const tribute = taking ? `<span data-tip="<b>Tribute</b>Standing in ${s.players[landlord].name}'s land, this rider takes ${modsOf(s, u.owner).tribute} gold a second from its treasury (at most ${TRIBUTE.most} riders a rival). Moving, it takes nothing.">${icon('gold')}<em>Tribute</em></span>` : '';
    // Safe passage (#334): the tolls this load has paid on its way home.
    const paidTo = mine && u.tolled ? s.players.filter((q) => (u.tolled! & (1 << q.id)) !== 0).map((q) => q.name) : [];
    const toll = paidTo.length ? `<span data-tip="<b>Toll paid</b>This load paid ${paidTo.join(' and ')} a toll for safe passage across its land. A road that keeps out of a caravan people's land pays in full.">🛂<em>Toll paid</em></span>` : '';
    // Hemocraft (#355 s3): a grafted soldier, and how long its graft holds away from the Stations.
    const hemoLeft = grafted(s, u) ? Math.ceil((u.hemo! - s.tick) / TICK_HZ) : 0;
    const graft = hemoLeft ? `<span data-tip="<b>${u.tempered ? 'Grafted, quenched in blood-iron' : 'Grafted'}</b>${u.tempered ? `Tempered: stays fed ${HEMO_IRON.last}x as long away from a Station, mends ${HEMO_IRON.mend}x as fast, and crashes ${Math.round((1 - HEMO_IRON.crash) * 100)}% softer.<br>` : ''}Hemo-engineered: blows ${Math.round((HEMO.attack - 1) * 100)}% harder, ${Math.round((HEMO.pace - 1) * 100)}% faster, mends ${HEMO.mend} a second and can't be converted. Blades, arrows and hooves land ${Math.round((1 - HEMO.flesh) * 100)}% softer, but siege, ships, aircraft and coils hit ${Math.round((HEMO.machine - 1) * 100)}% harder. Fed within ${feedReach(s.players[u.owner])} tiles of a Transfusion Station${modsOf(s, u.owner).veins ? `, and in a Watch Tower's reach (${LIGHTNING.reach} tiles: Galvanic Blood)` : ''}; away from them it runs dry in ${hemoLeft}s and the soldier loses ${Math.round(HEMO.crash * 100)}% of its health.">🩸<em>Grafted</em> ${hemoLeft >= graftLast(u) - 1 ? 'fed' : `${hemoLeft}s`}</span>` : '';
    // The Blood-rite (#355 s4): a cursed enemy takes every blow harder until the curse lifts.
    const curseLeft = cursed(s, u) ? Math.ceil((u.cursed! - s.tick) / TICK_HZ) : 0;
    const curse = curseLeft ? `<span data-tip="<b>Cursed</b>A Blood-rite priest has cursed this one: every blow on it lands ${Math.round((RITE.taken - 1) * 100)}% harder for ${curseLeft} more seconds.">☠<em>Cursed</em> ${curseLeft}s</span>` : '';
    // The Age of the Hive: venom from Blowpipe darts, or a swarm's stings, slow it, and venom burns past armour.
    const venomed = u.venom && s.tick < u.venom.end ? u.venom.n : 0;
    const stingLeft = u.stung !== undefined && s.tick < u.stung;
    const sting = venomed
      ? `<span data-tip="<b>Venom</b>${venomed} dose${venomed > 1 ? 's' : ''} of Blowpipe venom: ${HIVE.dose * venomed} hit points a second past armour, and it walks at ${Math.round(HIVE.slow * 100)}% pace, until ${HIVE.venomFor} seconds after the last dart.">🐍<em>Venom ×${venomed}</em></span>`
      : stingLeft
        ? `<span data-tip="<b>Stung</b>A Hive's bees swarm whoever walks its people's woods: ${HIVE.sting} hit points a second past armour, and a slow walk. Keep out of the trees by a Hive, or smoke it quiet with a fire.">🐝<em>Stung</em></span>`
        : '';
    // Routes that read the tide (#755): waiting on the shore for the flats to bare.
    const ebbLeft = Math.ceil(tideWaitLeft(s, u));
    // Work on the flats that reads the tide (#767): stepped ashore before the flood, back when its ground bares.
    const ashoreSecs = Math.ceil(ashoreLeft(s, u));
    const ashore = ashoreSecs && !ebbLeft ? `<span data-tip="<b>Ashore for the tide</b>${mine ? 'It' : 'This one'} was working out on the flats and came ashore before the water could cover them. It goes back to its work in ${ashoreSecs}s, when the ground bares again. A new order ends the wait.">🌊<em>Ashore</em> ${ashoreSecs}s</span>` : '';
    const ebb = ebbLeft ? `<span data-tip="<b>Waiting for the tide</b>The way ${mine ? 'you sent it' : 'it was sent'} runs over tidal flats the sea would cover before it was across, and there is no quicker way round. It waits on the shore and sets out in ${ebbLeft}s, when the flats it needs stand bare until it is over.">🌊<em>Tide</em> ${ebbLeft}s</span>` : '';
    // Military Orders (#355 s6): a soldier with one of its priests at hand is sworn.
    const isSworn = sworn(s, u);
    const oath = isSworn ? `<span data-tip="<b>Sworn</b>Military Orders: one of ${mine ? 'your' : 'its people\'s'} priests stands within ${ORDERS.reach} tiles, so no rival's priest can turn it, offer it up or curse it, and ${mine ? 'your' : 'their'} priests mend it ${Math.round((ORDERS.mend - 1) * 100)}% faster. Leave it without a priest near and the oath no longer holds it.">⚜<em>Sworn</em></span>` : '';
    // A sword for hire (the Age of Merchants): paid by the day, and gone if left unpaid.
    const sword = u.merc !== undefined ? `<span data-tip="<b>Sword for hire</b>Draws ${MERC.wage} gold every ${MERC.every} seconds from ${mine ? 'your' : 'its people\'s'} treasury${u.merc ? `, and has gone unpaid ${u.merc} payday${u.merc > 1 ? 's' : ''}: it walks off at ${MERC.patience}` : `; one left unpaid ${MERC.patience} paydays walks off`}.">💰<em>${u.merc ? 'Unpaid' : 'Hired'}</em></span>` : '';
    // The Warband hauls its plunder home (#502).
    // The Sea-Raiders (#585) bank by ship: a soldier's pack goes into a transport's hold, and a ship's hold is banked at a Dock.
    const raider = !!ageDef(s.players[u.owner]).raid;
    const ship = domainOf(u.type) === 'water';
    const pack = !u.spoils
      ? ''
      : ship
        ? `<span data-tip="<b>Hold</b>${u.spoils} gold of plunder in the hold (up to ${SEA_RAID.hold}). ${mine ? 'It is yours once the ship comes' : 'Sink it and the hold is yours; its people has it only once the ship comes'} within ${SEA_RAID.dock} tiles of a Dock. Soldiers within ${SPOILS.bank} tiles, or aboard, hand their packs in.">💰<em>Hold</em> ${u.spoils}</span>`
        : raider
          ? `<span data-tip="<b>Spoils</b>${u.spoils} gold of plunder in the pack (up to ${SPOILS.cap}). ${mine ? 'A sea-raider banks by ship: walk it within' : 'Fell it and the pack is yours; its people banks it only by ship, within'} ${SPOILS.bank} tiles of a transport of ${mine ? 'yours' : 'theirs'}, or aboard one, and the hold pays out at a Dock. A Town Center or Barracks banks nothing.">💰<em>Spoils</em> ${u.spoils}</span>`
          : `<span data-tip="<b>Spoils</b>${u.spoils} gold of plunder in the pack (up to ${SPOILS.cap}). ${mine ? 'It is yours only once the soldier walks within' : 'Fell it and the pack is yours; its people has it only once it reaches home, within'} ${SPOILS.bank} tiles of a Town Center or Barracks.">💰<em>Spoils</em> ${u.spoils}</span>`;
    // A thrall (#502): a taken citizen, bound and drab, who works but never builds.
    const bond = u.thrall ? `<span data-tip="<b>Thrall</b>A citizen taken by a Warband people: it works a field for ${mine ? 'you' : p.name} but never builds or repairs. Slay it, or guard your workers so none are taken.">⛓<em>Thrall</em></span>` : '';
    const held = u.type === 'priest' && carriedBy(s, u) ? `<span data-tip="<b>Relic</b>Carried to a Temple, it brings in gold. Hands full: no healing or converting until it is set down (D).">⚱<em>Relic</em></span>` : '';
    const sig = `u:${u.id}:${Math.ceil(u.hp)}:${status}:${u.carry}:${p.epoch}:${p.statsVersion}:${u.stance}:${s.tick - u.aura < 5}:${u.cargo.length}:${rank}:${taking}:${road}:${u.tolled ?? 0}:${hemoLeft}:${curseLeft}:${u.merc ?? -1}:${isSworn}:${!!u.thrall}:${u.spoils ?? 0}:${isLine}:${ebbLeft}`;
    const html = `<div class="sel-portrait"><img src="${unitPicture(u.type, u.type === 'wagon' && u.packed === 'market' ? p.epoch + 20 : p.epoch, p.color)}" alt=""></div>
      <div class="sel-info">
        <div class="sel-name">${s.kings.includes(u.id) ? `👑 King (${st.name})` : u.thrall ? `Thrall (${st.name})` : st.name}</div>
        <div class="sel-sub">${mine ? status : `<span class="swatch" style="background:${p.color}"></span>${p.name}`}</div>
        ${hpBar(u.hp, st.hp, frac)}
        <div class="stats">
          ${st.attack ? `<span data-tip="<b>Attack</b>Damage per blow or shot, before armor and the counter bonus.">⚔<em>Attack</em> ${st.attack}</span>` : ''}
          <span data-tip="<b>Armor</b>Melee / missile armor: taken off every blow or shot.">🛡<em>Armor</em> ${st.armor}/${st.parmor}</span>
          ${st.range ? `<span data-tip="<b>Range</b>How far it shoots, in tiles.">🏹<em>Range</em> ${st.range}</span>` : ''}
          <span data-tip="<b>Speed</b>Tiles per second.">👣<em>Speed</em> ${Math.round(st.speed * 100) / 100}</span>
          ${carry}${cargo}${load}${stance}${vet}${line}${aura}${graft}${oath}${sword}${pack}${curse}${sting}${bond}${held}${trip}${caravan}${tribute}${toll}${ebb}${ashore}
        </div>
        <div class="blurb">${st.blurb}</div>
      </div>`;
    return [html, sig];
  }

  private buildingPanel(s: GameState, viewer: number, b: Building): [string, string] {
    const p = s.players[b.owner];
    const def = BUILDINGS[b.type];
    const max = buildingMaxHp(s, b.owner, b.type, b.level);
    const mine = b.owner === viewer;
    let status = '';
    let queue = '';
    const fire = fireOn(s, b);
    if (fire) status = `🔥 Burning: ${mine ? `send citizens to beat it out (${Math.max(0, FIRE.beat - (fire.out ?? 0))} seconds of beating left)` : `${s.players[b.owner].name} must beat it out`}`;
    else if (!b.built) status = `Under construction: ${Math.floor(b.progress * 100)}%`;
    else if (b.advance >= 0 && journeyOf(p, b)) {
      const road = journeyOf(p, b)!;
      const pct = Math.floor((b.advance / secs(road.time)) * 100);
      status = `${road.back ? 'Stepping back' : 'Advancing'} to the ${AGES[road.to].name}: ${pct}%`;
      if (mine) queue = `<div class="queue"><div class="qitem" data-cancel="${b.id}:-1" data-tip="<b>${AGES[road.to].name}</b>Click to cancel (full refund)."><span class="qglyph">${road.back ? '⏬' : '⏫'}</span><div class="prog"><i style="width:${pct}%"></i></div></div></div>`;
    } else if (b.queue.length) {
      const it = b.queue[0];
      const step = TOWER_LEVELS[b.level ?? 0];
      const need = it.rise ? secs(step?.time ?? 1) : it.tech ? secs(TECHS[it.tech].time) : secs(trainTimeFor(s, b.owner, it.unit!, b.type));
      const pct = Math.min(100, Math.floor((it.done / need) * 100));
      status = it.rise ? `Raising to ${step?.name ?? 'the top'}: ${pct}%` : it.tech ? `Researching ${TECHS[it.tech].name}: ${pct}%` : it.done > need ? 'Waiting for room: build houses' : `Training ${statsFor(s, b.owner, it.unit!).name}: ${pct}%`;
      if (mine)
        queue = `<div class="queue">${b.queue
          .map((q, i) => {
            const qp = i === 0 ? pct : 0;
            const name = q.rise ? (step?.name ?? '') : q.tech ? TECHS[q.tech].name : statsFor(s, b.owner, q.unit!).name;
            const face = q.rise ? `<span class="qglyph">${step?.icon ?? ''}</span>` : q.tech ? `<span class="qglyph">${TECHS[q.tech].icon}</span>` : `<img src="${unitPicture(q.unit!, p.epoch, p.color)}" alt="">`;
            return `<div class="qitem" data-cancel="${b.id}:${i}" data-tip="<b>${name}</b>Click to cancel (full refund).">${face}<div class="prog"><i style="width:${qp}%"></i></div></div>`;
          })
          .join('')}</div>`;
    } else if (b.type === 'farm' && b.built) {
      const f = b.farmer ? s.byId.get(b.farmer) : undefined;
      status = f && f.kind === 'unit' && f.order.k === 'farm' && f.order.target === b.id ? 'Worked by a citizen' : 'Waiting for a farmer';
      // The Age of Rivers (#701): a field with water near works faster.
      if (ageDef(s.players[b.owner]).rivers) status += wateredAt(s, b.tx, b.ty, b.size) ? ` · <span data-tip="<b>Watered</b>Water lies within ${RIVERS.wet} tiles: in the Age of Rivers the field works ${Math.round((RIVERS.farm - 1) * 100)}% faster.">💧 Watered</span>` : ` · <span data-tip="<b>Dry</b>No water within ${RIVERS.wet} tiles. Dig a Channel (Q) to it and it works faster.">Dry field</span>`;
    } else if (b.type === 'channel' && b.built) {
      // A dug ditch (#701) waiting for the water: it fills once water lies beside it.
      status = ageDef(s.players[b.owner]).canals ? 'Dug, and dry: the water runs in once water lies beside it, deep enough for ships. Dig on toward the water.' : 'Dug, and dry: the water runs in once a channel or water lies beside it. Dig on toward the water.';
    } else if (b.type === 'snare' && b.built) {
      // Snares in the wood (#485): what it holds, how fast its woods fill it, and whether anyone walks the line.
      const trees = snareWoods(s, b);
      const full = snareFull(s, b);
      const perMin = Math.round(snareRate(s, b) * 60 * 10) / 10;
      const tended = s.ents.some((e) => e.kind === 'unit' && e.owner === b.owner && e.hp > 0 && e.order.k === 'snare');
      const cap = snareCap(s, b);
      status = `Caught ${catchIn(b)} / ${cap} food${catchIn(b) >= cap ? ' (full: it catches no more)' : ''} · ${trees} trees round it: ${perMin} a minute${trees < full ? ` (best with ${full})` : ''}${seasonAt(s) === 3 ? ', winter-hungry' : ''} · ${tended ? 'the line is walked' : 'nobody walks the line'}`;
    } else if (b.type === 'heart' && b.built) {
      // The Age of the Wildwood: its Ents awake and rooted, and whether a tree stands near to wake.
      const greening = b.owner === viewer && inBloom(p) ? ` · <span data-tip="<b>The Greening</b>Trees, Orchards, this Heart Tree and Thornwalls grown to living oak count green, as a share of your land's open ground (counted as at least ${BLOOM.least} tiles). At ${BLOOM.green * 100}% with the Heart Tree standing, a ${BLOOM.hold / 60} minute clock starts that every player sees; when it runs out, you win.">🌿 ${((p.green ?? 0) / 10).toFixed(1)}% of ${BLOOM.green * 100}% green</span>` : '';
      status = `<span data-tip="<b>${BUILDINGS.heart.name}</b>Train an Ent here and the old tree nearest it within ${WILDWOOD.wake} tiles wakes. While it stands, your rooted Ents wake when a rival comes within ${WILDWOOD.rouse} tiles, and ${WILDWOOD.spreadAt} seconds into each spring your woods within ${WILDWOOD.spread} tiles seed the bare ground beside them in your land. If it falls, every Ent roots where it stands and sleeps.">🌳 ${heartLine(s, b)}</span>${greening}`;
    } else if (b.type === 'spire' && b.built) {
      // The Age of the Bloom: how long until its Seed is ripe, and whether the Heart Tree feeds it.
      status = `<span data-tip="<b>${BUILDINGS.spire.name}</b>While your Heart Tree stands it ripens a Bloom Seed every ${BLOOM.ripen} seconds, one at a time. Sling it (G) at any point on the map for ${Object.entries(BLOOM.fuel).map(([r, n]) => `${n} ${r}`).join(', ')}: ${BLOOM.flight} seconds later it roots on open ground there, and ${BLOOM.grow} seconds after that every rival building within ${BLOOM.r} tiles of its heart-root cracks into forest, unless their citizens hack the root out (${BLOOM.root} strokes, one a second for each citizen beside it).">🌱 ${spireLine(s, b)}</span>`;
    } else if (b.type === 'hive' && b.built) {
      // The Age of the Hive: whether its bees are awake, what it pays, and whether it pollinates.
      status = `<span data-tip="<b>${BUILDINGS.hive.name}</b>Awake, its bees sting any rival standing in a wood within ${HIVE.reach} tiles. It pays honey (food), or mead (gold) while one of your Markets stands within ${HIVE.market} tiles, and in summer doubles your Kitchen Gardens within ${HIVE.bloom} tiles. Bees sleep in winter; a fire within ${HIVE.smoke} tiles smokes them quiet for ${HIVE.quiet} seconds.">🐝 ${hiveLine(s, b)}</span>`;
    } else if (b.type === 'shaft' && b.built) {
      // Mine Shaft (#681): the seam it digs, the ground's grade and whether a miner is down it.
      const seam = seamOf(s, b);
      const grade = seam ? groundAt(s, b)[seam] : null;
      const f = b.farmer ? s.byId.get(b.farmer) : undefined;
      const manned = !!f && f.kind === 'unit' && f.order.k === 'shaft' && f.order.target === b.id;
      const ground = { old: 'Old workings', hill: 'Mountain rock', open: 'Open ground' };
      status = seam && grade ? `<span data-tip="<b>${ground[grade]}</b>A shaft digs at ${Math.round(SHAFT.grade[grade] * 100)}% of an open deposit's pace. Old workings (a deposit worked out nearby) are best, then rock beside it, then plain ground.">${ground[grade]}: ${SHAFT.seams[seam].name.toLowerCase()} at ${Math.round(SHAFT.grade[grade] * 100)}%</span> · ${manned ? 'a miner works it' : 'waiting for a miner (right-click it with a citizen)'}` : 'Your people can dig nothing here';
    } else if (b.type === 'wonder' && b.timer >= 0) status = `Stands ${fmtTime(b.timer)} more for victory`;
    else if (b.type === 'market') {
      const traders = s.ents.filter((e) => e.kind === 'unit' && e.owner === b.owner && e.type === 'trader' && e.order.k === 'trade' && e.order.market === b.id).length;
      const fair = relicTradeShare(s, b.owner);
      const wares = ironTradeShare(s, b.owner);
      status = `Prices: ${(['food', 'wood', 'stone'] as const).map((r) => `${icon(r, 14)}${s.market[r]} ${s.market[r] < MARKET.start[r] ? '↑' : s.market[r] > MARKET.start[r] ? '↓' : '→'}`).join(' ')}${traders ? ` · 🐪 ${traders} on the road` : ''}${fair > 1 ? ` · ⚱ trade +${Math.round((fair - 1) * 100)}% for relics kept` : ''}${wares > 1 ? ` · ⛓ trade +${Math.round((wares - 1) * 100)}% for iron dug` : ''}`;
    }
    else if (b.type === 'caravanserai' && b.built) {
      // The Silk Road's waystation (#334): the posts it serves and the caravans resting in it.
      const posts = s.posts.filter((q) => seraiNear(s, b.owner, q) === b).length;
      const resting = s.ents.filter((e) => e.kind === 'unit' && restsAt(s, e, b) && e.hp < statsFor(s, e.owner, e.type).hp).length;
      status = `<span data-tip="<b>Waystation</b>Your traders' trips to a trading post within ${SERAI.near} tiles of a Caravanserai pay ${Math.round((SERAI.pay - 1) * 100)}% more. Traders and wagons within ${SERAI.rest} tiles mend ${SERAI.heal} a second.">🐫 ${posts ? `${posts} post${posts > 1 ? 's' : ''} near: trips there +${Math.round((SERAI.pay - 1) * 100)}%` : `No post within ${SERAI.near} tiles`}</span>${resting ? ` · ${resting} resting` : ''}`;
    }
    else if (b.type === 'house' && b.built && isHousehold(p)) status = `<span data-tip="<b>The household tax</b>Each house pays gold in proportion to how full your town is, and more for every house on its street (a Market counts as two): a lane apart is a street.">🏮 ${streetOf(s, b)} on its street</span>`;
    else if (b.type === 'dock') status = 'Fishing boats bring their catch here';
    else if (b.type === 'prospector' && b.built && prospected(p)) status = prospectLine(s, p);
    else if (b.type === 'temple' && keptIn(s, b)) status = `Keeps ${keptIn(s, b)} relic${keptIn(s, b) > 1 ? 's' : ''}: ${icon('gold', 14)}${Math.round((60 / RELIC.every) * Math.round(RELIC.gold * modsOf(s, b.owner).relicGold) * keptIn(s, b))} a minute`;
    else status = def.drop.length ? 'Drop-off for every resource' : def.pop ? `Room for ${def.pop}` : 'Ready';
    // A building of other ages (#555 s10): it stands idle until its people returns to them.
    const sleeping = b.built && asleep(s, b);
    // A keepsake (#555 s11): the one building that keeps its age's work after its people leaves.
    const keptBy = b.keep && b.built ? AGES[b.keep] : undefined;
    if (mine && keptBy?.keepsake) status += ageOf(p) === b.keep
      ? ` · <span data-tip="<b>Your keepsake</b>When your people leaves the ${keptBy.name}, this ${def.name} keeps ${keptBy.keepsake.does}. The others of its kind lose the age's work.">🏺 Your keepsake of the ${keptBy.short}</span>`
      : ` · <span data-tip="<b>Keepsake</b>Kept from the ${keptBy.name}: it keeps ${keptBy.keepsake.does}, on any road. Raze it and the keepsake is gone.">🏺 Keepsake of the ${keptBy.short}</span>`;
    if (sleeping) status = `<span data-tip="<b>Asleep</b>${sleepWhy(b)}. Until then it does nothing, but it stands, and wakes the moment you return.">💤 Asleep: wakes in the ${(def.ages ?? []).map((a) => AGES[a].short).join(' or ')}</span>`;
    if (!mine) status = `<span class="swatch" style="background:${p.color}"></span>${p.name}${b.type === 'wonder' && b.timer >= 0 ? `: wins in ${fmtTime(b.timer)}` : ''}${b.type === 'temple' && keptIn(s, b) ? `: keeps ${keptIn(s, b)} relic${keptIn(s, b) > 1 ? 's' : ''}` : ''}`;
    // A rival's sleeping building tells its story: that people walked an age it has since left.
    if (!mine && keptBy && ageOf(p) !== b.keep) status += ` · <span data-tip="<b>Keepsake</b>Kept from the ${keptBy.name}: it keeps that age's work. Raze it and the keepsake is gone.">🏺 keepsake of the ${keptBy.short}</span>`;
    if (!mine && sleeping) status += ` · <span data-tip="<b>Asleep</b>Its people raised it in an age they have left. It does nothing until they return.">💤 asleep</span>`;
    // Faith takes the walls (#209): how near rival priests have chanted it over.
    const faith = faithOf(b);
    if (faith > 0 && b.faithBy !== undefined) status += ` · <span data-tip="<b>Faith</b>${b.faithBy === viewer ? 'Your priests are chanting it over: keep them at it, or the faith fades.' : 'Rival priests are chanting it over. Strike them down, or shelter soldiers inside and stand your own priests beside it to slow them (pilgrim priests sing back and wear the faith down).'}">✨ ${Math.floor(faith * 100)}% ${b.faithBy === viewer ? 'won over' : `to ${s.players[b.faithBy].name}`}</span>`;
    // Standing to answer: own priests singing back by a chanted-over building (pilgrims only).
    if (mine && chantedOver(s, b) && consecrates(s, viewer)) {
      const standing = s.ents.filter((e) => e.kind === 'unit' && e.owner === viewer && e.type === 'priest' && e.hp > 0 && e.order.k === 'answer' && e.order.target === b.id && e.act === 'chant').length;
      status += standing
        ? ` · <span data-tip="<b>Standing to answer</b>Priests held beside the building sing back ${CONSECRATE.counter.stand * 100 + 100}% as strongly.">🎶 ${standing} priest${standing > 1 ? 's' : ''} answering</span>`
        : ' · <span data-tip="<b>Answer the chant</b>Select priests and right-click this building: they stand by it and sing back, wearing the rival\'s faith down.">🎶 no one answering</span>';
    }
    // The Age of Lightning (#239): is this building in a coil's field, and so how fast it works.
    if (mine && b.built && hasCoils(p) && def.trains.length > 0) {
      status += inField(s, b)
        ? ` · <span data-tip="<b>In a coil's field</b>A Coil Tower within ${LIGHTNING.reach} tiles broadcasts power here: it trains and researches ${LIGHTNING.lit - 100}% faster.">⚡ In a coil's field: works ${LIGHTNING.lit - 100}% faster</span>`
        : ` · <span data-tip="<b>Dark</b>No Coil Tower reaches this building, so it trains and researches ${100 - LIGHTNING.dark}% slower. Raise a Watch Tower within ${LIGHTNING.reach} tiles.">🌑 Dark: works ${100 - LIGHTNING.dark}% slower (raise a Coil Tower within ${LIGHTNING.reach} tiles)</span>`;
    }
    // War Camps (#303): who keeps it, and how long before an unkept one burns.
    if (mine && b.built && b.type === 'warcamp') {
      const struck = buildBarred(p, b.type);
      const grace = campGrace(b);
      status += struck
        ? ` · <span data-tip="<b>Struck</b>${struck}: off the Path of Blood a camp can't be kept, and it burns.">🔥 Struck: burning</span>`
        : b.alone === undefined
          ? ` · <span data-tip="<b>Kept</b>Your soldiers stand within ${WARCAMP.watch} tiles. Leave it without them for ${WARCAMP.grace} seconds and it catches fire.">⛺ Kept by its soldiers</span>`
          : grace > 0
            ? ` · <span data-tip="<b>Alone</b>No soldier of yours within ${WARCAMP.watch} tiles. Send some back before it catches fire.">⚠ Alone: burns in ${grace}s</span>`
            : ` · <span data-tip="<b>Burning</b>Left alone, the camp burns. Soldiers within ${WARCAMP.watch} tiles put it out; citizens can repair it.">🔥 Burning: send soldiers back</span>`;
      const wait = musterWait(s, b);
      if (!struck && ageDef(p).callUp) status += wait > 0 ? ` · <span data-tip="<b>Mustering</b>The camp is arming the last citizens it called.">📯 Mustering: ${wait}s</span>` : ` · <span data-tip="<b>Muster ground</b>Citizens within ${CALL_UP.reach} tiles can be called to arms here (C, or V for ${CALL_UP.most}).">📯 Muster ground</span>`;
    }
    // A powder mill (#577): what it grinds, or why it stands still.
    if (mine && b.built && b.type === 'workshop' && (mills(p) || b.keep === 'alchemy')) {
      const still = millProblem(s, p);
      status += ` · <span data-tip="<b>Powder mill</b>In the Age of Alchemy every Siege Workshop grinds: together they make a keg from ${KEG.ore} saltpetre every ${KEG.time} seconds a mill, up to ${KEG.most} in store. Kegs are laid in the Age of Sappers.">${still ? `⚠ ${still}` : `🧨 Grinding powder: ${kegsOf(p)} kegs`}</span>`;
    }
    // A sluice (#701 s4): open or shut, and how far its water reaches.
    if (b.built && b.type === 'sluice') {
      const under = waterLine(s, b).filter((t) => isInund(s, t)).length;
      status += ` · <span data-tip="<b>Sluice</b>Open, the water runs out over the low ground within ${INUND.reach} tiles of it: polder, and meadow no higher than a little over its banks. Soldiers wade it at a crawl, siege bogs down, and gun-barges sail it. Shut, it holds the water back as a dyke does.">${b.open ? (lets(s, b) ? `🌊 Open: ${under} tiles under water` : '⚠ Open, but no water to let out') : sleeping ? '💤 Shut' : `🚪 Shut${under ? `: ${under} tiles still draining` : ''}`}</span>`;
    }
    // A Tide Gate (#785): shut and loaded (and how far it would scour), pouring out, or open with the tide. Rivals read it too.
    if (b.built && b.type === 'tidegate') {
      const head = gateHead(s, b).length;
      const reach = gateReach(s, b).length;
      const pouring = s.scour?.some((c) => c.gate === b.id);
      const pond = pondBehind(s, b).length;
      status += ` · <span data-tip="<b>Tide Gate</b>Shut, the barrage holds its pond (${pond} tiles of flats) at every hour. The head of water is the pond held above the sea outside: with ${TIDE_GATE.least} tiles of head or more, opening the gate sends it out as a scour over up to ${TIDE_GATE.spread} tiles of bared flats a tile of head, within ${TIDE_GATE.reach} tiles of the gate: for ${TIDE_GATE.secs} seconds they are under water, and whoever stands there is swept off, ${TIDE_GATE.hurt} health lost, or drowned with no shore near. Open, the pond runs with the tide.">${!gateWorks(s, b) ? '💤 Shut: it works only in the Age of Tides' : pouring ? '🌊 Scouring: the pond is pouring out' : b.open ? '🚪 Open: the pond runs with the tide' : reach ? `⚠ Loaded: ${head} tiles of head, would scour ${reach} tiles of flats` : head ? `🚪 Shut: ${head} tiles of head, too little to scour` : '🚪 Shut: no head of water above the sea'}</span>`;
    }
    // A dam (#701 s5): whether its turbines turn, how many of its owner's buildings they drive, and the burst it holds back.
    if (b.built && b.type === 'dam') {
      const still = damIdle(s, b);
      const r2 = DAM.reach * DAM.reach;
      const driven = s.ents.filter((e) => e.kind === 'building' && e.owner === b.owner && e.built && e.hp > 0 && BUILDINGS[e.type].trains.length > 0 && (e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y) <= r2).length;
      status += ` · <span data-tip="<b>Dam</b>With still water beside it, its turbines drive every building of yours within ${DAM.reach} tiles: they train and research ${DAM.drive - 100}% faster (one dam's worth, however many stand near). If it falls with water behind it, it bursts over the low ground round it, up to ${DAM.surge} tiles, and all who stand there lose ${DAM.hurt} health.">${still ? `⚠ ${still}` : `⚙ Turning: drives ${driven} building${driven === 1 ? ' that trains' : 's that train'}`}</span>`;
    }
    // A floating district (#770): how many lie linked with it, and whether they raise citizens.
    if (mine && b.built && b.type === 'pontoon') {
      const n = districtOf(s, b).length;
      status += ` · <span data-tip="<b>Floating town</b>Pontoons moored side by side link into one town, and a town of ${FLOAT.city} or more raises citizens at each of its pontoons. Corners alone don't link. Ships hole a pontoon ${FLOAT.hull} times as fast as anything else does, and those on its deck when it sinks swim for the nearest deck or shore within ${FLOAT.swim} tiles, or drown.">${n >= FLOAT.city ? `⛵ A floating town of ${n}: raises citizens` : `⚓ ${n === 1 ? 'Alone' : `Linked to ${n - 1}`}: moor ${FLOAT.city - n} more beside it to raise citizens`}</span>`;
    }
    if (b.built && b.type === 'bridge') status += ` · <span data-tip="<b>Bridge</b>Your own people cross here at full pace; rivals can't, and swim the water round it at ${Math.round(CANAL.wade * 100)}% of their pace in a canal. Every ship and barge passes under it.">🌉 Swings for ships</span>`;
    // A windmill (#701): how much water is left behind its dykes, or why it stands still.
    if (mine && b.built && !sleeping && b.type === 'windmill') {
      const still = millIdle(s, b);
      status += ` · <span data-tip="<b>Windmill</b>Pumps the water within ${POLDER.reach} tiles of it dry, a tile every ${POLDER.every} seconds, nearest first: a lake, or a bay your dykes have shut off from the open sea (at most ${POLDER.most} tiles of water). The drained ground is polder, where a Farm yields half again as much.">${still ? `⚠ ${still}` : `💧 Pumping: ${basinOf(s, b).length} tiles of water left`}</span>`;
    }
    // A Tide Mill (#739): what it grinds at each turn of the tide, or why it stands still.
    if (mine && b.built && !sleeping && b.type === 'tidemill') {
      const still = tideMillIdle(s, b);
      const share = millShares(s).get(b.id) ?? 0;
      status += ` · <span data-tip="<b>Tide Mill</b>Its pond fills on the flood and runs out through the wheel on the ebb: at every turn of the tide it grinds ${TIDE.mill.gold} gold with ${TIDE.mill.most} tiles of tidal ground within ${TIDE.mill.reach} tiles of it, less with fewer. A tile feeds only the first mill raised by it. Causeways count as tidal ground. Flats a causeway line shuts off from the sea are a barrage's pond: ground twice, on the flood and on the ebb.">${still ? `⚠ ${still}` : `🌊 ${Math.round(share)} gold a turn of the tide (${Math.min(TIDE.mill.most, tidalNear(s, b).length)} tiles of tidal ground${tidalNear(s, b).some((t) => isPond(s, t)) ? `, ${tidalNear(s, b).filter((t) => isPond(s, t)).length} of them a barrage's pond, ground twice` : ''})${tideClock(s) ? '' : ': the tide wakes the moment it is raised'}`}</span>`;
    }
    // A Cockler's Hut (#779): the beds it tends.
    if (mine && b.built && b.type === 'cockler') {
      const n = hutBeds(s, b);
      status += ` · <span data-tip="<b>Cockler's Hut</b>Your pickers empty their baskets of cockles here (it takes nothing else) when it is nearer than a food store, and wait beside it, on dry ground, for the tide to bare their bed. Each high water brings ${COCKLER.regrow} food back to every bed within ${COCKLER.reach} tiles of it instead of ${COCKLE.regrow}.">${hutWorks(s, b) ? `🐚 Tends ${n} bed${n === 1 ? '' : 's'}` : '⚠ Idle outside the Age of Tides'}</span>`;
    }
    // The missile pool (#753): the store is the owner's alone to read.
    if (mine && b.built && b.type === 'silo') {
      const next = nextNuke(s, p);
      status += ` · <span data-tip="<b>Warhead store</b>Your people's warheads, fired from any of your silos. One more is made every ${rulesOf(p).refuel} seconds while the store and the warheads in the air number under ${SILO.cap}. Rivals can't see it.">☢ ${stockOf(p)} in store${next === null ? '' : `, next in ${next}s`}</span>`;
    }
    // A silo held in Reserve (#759 s3), read by either side as the silo is public: whether it stands ready to answer a warhead.
    if (b.built && b.type === 'silo' && inReserve(b)) {
      const left = armingOf(s, b);
      status += ` · <span data-tip="<b>Held in Reserve</b>This silo launches nothing while held. ${INTERCEPT.fire} seconds before any rival warhead lands that no Interceptor Battery answered, wherever it falls, a ready Reserve silo fires its own warhead at it and stops it ${Math.round(INTERCEPT.chance * 100)}% of the time, spending a warhead from its people's store and the fuel of a launch. It stands ready ${INTERCEPT.arm} seconds after it was held, and again ${INTERCEPT.arm} seconds after each it fires.">${left ? `⏳ Reserve: ready in ${left}s` : '🛡 Reserve: ready'}</span>`;
    }
    // An Interceptor Battery (#759 s2): its charge, read by either side, as the battery and its cover are public.
    if (b.built && b.type === 'battery') {
      const left = Math.max(0, Math.ceil(((b.reload ?? 0) - s.tick) / TICK_HZ));
      status += ` · <span data-tip="<b>Interceptor</b>It covers ${INTERCEPT.reach} tiles round it (the teal circle, shown while a warhead is in the air). ${INTERCEPT.fire} seconds before a rival warhead lands in a ring it covers, it fires by itself and stops it ${Math.round(INTERCEPT.chance * 100)}% of the time: no blast, no fallout. One attempt for each warhead, from the nearest battery; the charge is spent hit or miss and reloads in ${INTERCEPT.reload} seconds.">${left ? `⏳ Reloading: ${left}s` : '🛡 Charged'}</span>`;
    }
    // A harbour aground at low water (#739).
    if (mine && b.built && b.type === 'dock' && aground(s, b)) status += ` · <span data-tip="<b>Aground</b>The tide has bared all the water beside this Dock: it launches nothing until the water comes back.">⚓ Aground at low water</span>`;
    // A dyke (#701 s3): what it holds back, read by either side: the rival's eye for a breach, its owner's for a weak bank.
    if (b.built && b.type === 'dyke') {
      const held = heldBack(s, b);
      if (held > 0) status += ` · <span data-tip="<b>The breach</b>Should this dyke fall (to siege, or a Sapper's keg, which tears a dyke open in one blast) the sea runs back into the polder behind it, a ring of tiles every ${BREACH.every} seconds, drowning what stands there. A finished dyke in the gap stops it; a windmill pumps it out again.">🌊 Holds back ${held} tiles of polder</span>`;
    }
    // A Transfusion Station (#355 s3): who waits for a graft, and whether there is blood for it.
    if (mine && b.built && !sleeping && b.type === 'transfusion') {
      const cost = graftCost(p);
      const queued = waiting(s, b).length;
      const wait = graftWait(s, b);
      status += !queued
        ? ` · <span data-tip="<b>Transfusion</b>Send foot soldiers, archers, riders or a hero inside (right-click, or G): each is grafted for ${cost} blood, ${HEMO.work} seconds apiece, and the doors open when all are done. Grafts within ${feedReach(p)} tiles of a Station stay fed.${s.rares?.includes('bloodiron') ? ` Blood-iron in the store (${Math.floor(p.rare?.bloodiron ?? 0)}) quenches a graft: ${HEMO_IRON.cost} ore each.` : ''}">🩸 Ready: send soldiers in</span>`
        : bloodOf(p) < cost && !wait
          ? ` · <span data-tip="<b>No blood</b>Each graft costs ${cost} blood. Draw more at a Drain Rig, or let the soldiers out (U).">⚠ ${queued} waiting: needs ${cost} blood</span>`
          : ` · <span data-tip="<b>Grafting</b>One soldier at a time, ${HEMO.work} seconds and ${cost} blood each.">🩸 Grafting: ${queued} waiting${wait ? `, next in ${wait}s` : ''}</span>`;
    }
    // The fork (#355 s2): a Hemocraft rig drains the living who stand near it; a Blood-rite Temple is an altar.
    if (mine && b.built && b.type === 'drainrig' && ageDef(p).hemocraft)
      status += ` · <span data-tip="<b>Draining</b>Each second, up to ${HEMOCRAFT.most} living enemies within ${HEMOCRAFT.drain} tiles bleed ${HEMOCRAFT.bleed} health into your store, ${HEMOCRAFT.yield} blood a point, and those who die of it pay their blood again. Machines, ships and aircraft bleed nothing.">🩸 Draining the living within ${HEMOCRAFT.drain} tiles</span>`;
    // Beasts, flocks and captives (#355): what a rig (or altar) holds and bleeds. A rival is told when it holds some of their people.
    if (b.built && !sleeping && b.type === 'drainrig' && mine) {
      const flock = bledFlock(s, b).length;
      if (flock) status += ` · <span data-tip="<b>Bleeding the flock</b>Each second your sheep grazing within ${BLOOD.flockReach} tiles give up to ${BLOOD.flockMilk} of their milk to the rig, ${BLOOD.flockYield} blood for each, instead of to your milkers. Graze them farther off to milk them.">🐑 Bleeding ${flock} sheep</span>`;
    }
    const held = captivesOf(b);
    if (held && mine)
      status += ` · <span data-tip="<b>Captives</b>Enemy citizens your soldiers strike down within ${BLOOD.reach} tiles are taken here alive, up to ${BLOOD.hold}: each is bled ${BLOOD.bleed} blood a second until its ${BLOOD.captive} are spent. If this falls, they go free.">⛓ ${held}/${BLOOD.hold} captives: ${Math.round((b.captives ?? []).reduce((n, c) => n + c.left, 0))} blood left in them</span>`;
    else if (held && !mine && (b.captives ?? []).some((c) => c.p === viewer))
      status += ` · <span data-tip="<b>Your people, captive</b>Raze it and they go free and come home.">⛓ Holds ${(b.captives ?? []).filter((c) => c.p === viewer).length} of your people</span>`;
    if (mine && b.built && b.type === 'temple' && ageDef(p).rite)
      status += ` · <span data-tip="<b>Altar</b>Enemies who fall within ${BLOOD.reach} tiles give up their blood, as at a Drain Rig. Each second the altar mends up to ${RITE.most} of your hurt living within ${RITE.reach} tiles, ${RITE.mend} health each, for ${RITE.price} blood a point, while the store lasts.">${bloodOf(p) > 0 ? '🩸 Altar: mending with blood' : '⚠ Altar: no blood to mend with'}</span>`;
    const inside = def.garrison && b.built ? `<div class="stats"><span data-tip="<b>Sheltering</b>Units inside are safe, heal slowly and add arrows.">🏰<em>Inside</em> ${b.garrison.length}/${def.garrison}</span></div>` : '';
    const sig = `b:${b.id}:${Math.ceil(b.hp)}:${status}:${b.queue.length}:${p.epoch}:${queue.length}:${b.garrison.length}`;
    const html = `<div class="sel-portrait"><img src="${buildingPicture(b.type, p.epoch, p.color)}" alt=""></div>
      <div class="sel-info">
        <div class="sel-name">${def.name}</div>
        <div class="sel-sub">${status}</div>
        ${hpBar(b.hp, max, b.hp / max)}
        ${mine && b.type === 'market' && b.built ? `<div class="blurb">Prices shared by all players. ↑ recovers upward, ↓ downward, → steady. Drift: ${MARKET.recover} gold every ${MARKET.every}s toward the starting quote; trades move it immediately.</div>` : ''}
        ${mine && b.built && b.hp < max ? `<div class="blurb">Select citizens and right-click to repair (a full repair costs ${Math.round(REPAIR_SHARE * 100)}% of its price).${def.garrison ? ' Press G to shelter instead.' : ''}</div>` : ''}
        ${inside}
        ${queue || `<div class="blurb">${def.blurb}${def.guns ? ` Shoots ${gunRange(s, b.owner, b.type, b.level)} tiles, ${Math.round(gunPower(s, b.owner, b.type, b.level))} an arrow.` : ''}</div>`}
      </div>`;
    return [html, sig];
  }

  private commands(s: GameState, viewer: number, ents: Ent[]): void {
    const p = s.players[viewer];
    const mine = ents.filter((e) => e.owner === viewer);
    const units = mine.filter((e): e is Unit => e.kind === 'unit');
    const citizens = units.filter((u) => u.type === 'citizen');
    // Who may raise buildings: citizens, and a legion's foot soldiers too (#501).
    const builders = units.filter((u) => canRaise(u.type, 'house', p.civ));
    const soldiers = units.filter((u) => u.type !== 'citizen' && u.type !== 'fisher' && u.type !== 'transport' && u.type !== 'trader' && u.type !== 'cog' && u.type !== 'wagon' && u.type !== 'tow');
    const walkers = units.filter((u) => domainOf(u.type) === 'land');
    // A Skywhale (the Age of Leviathans) carries people as a transport does, and sets them down anywhere there is ground.
    const transports = units.filter((u) => isCarrier(u.type));
    const cmds: Cmd[] = [];
    if (!builders.length) this.buildMenu = null;

    if (builders.length && this.buildMenu) {
      for (const type of BUILDING_TYPES) {
        const def = BUILDINGS[type];
        if (def.menu !== this.buildMenu) continue;
        // A path's own building (the War Camp, #303) shows only to the people standing on that step.
        if (def.ages && !def.ages.includes(ageOf(p))) continue;
        if (def.only && !builders.some((u) => canRaise(u.type, type, p.civ))) continue;
        // Only a managed wood's people (#501, the Britons) plants saplings: no one else is shown the button.
        if (type === 'sapling' && !CIVS[p.civ].coppice) continue;
        // What the Grove grows shows only to a people that has walked it.
        if (GROVE_BUILDINGS.includes(type) && !grows(p)) continue;
        if (type === 'hive' && !keepsBees(p)) continue;
        if (type === 'heart' && !wakesForest(p)) continue;
        if (type === 'spire' && !hasWalked(p, 'bloom')) continue;
        const locked = def.epoch > p.epoch;
        const no = buildBarred(p, type) ?? wayBarred(s, p, type) ?? heartBarred(s, viewer, type) ?? spireBarred(s, viewer, type);
        const cost = buildingCostFor(s, viewer, type);
        const short = shortfall(p, cost) ?? bloodShort(p, type);
        const wonderUp = type === 'wonder' && s.ents.some((e) => e.kind === 'building' && e.owner === viewer && e.type === 'wonder');
        cmds.push({
          key: def.key,
          pic: buildingPicture(type, p.epoch, p.color),
          // In the Age of Locks (#701 s5) a channel is dug deep, as a canal.
          title: type === 'channel' && ageDef(p).canals ? 'Canal' : def.name,
          desc: def.blurb + (type === 'wall' || type === 'thornwall' ? ' Click and drag to lay out a line.' : '') + (def.blood ? ` Costs 🩸${def.blood} blood besides.` : ''),
          cost,
          ok: !locked && !no && !short && !wonderUp,
          why: locked ? `Needs the ${EPOCHS[def.epoch].name}` : no ? no : wonderUp ? 'You already have a wonder' : (short ?? undefined),
          run: () => this.act.place(type),
        });
      }
      cmds.push({ key: 'ESCAPE', pic: '', glyph: '↩', title: 'Back', desc: 'Back to the commands.', ok: true, run: () => (this.buildMenu = null) });
    } else if (units.length) {
      if (builders.length) {
        cmds.push({ key: 'B', pic: '', glyph: '🏠', title: 'Build (economy)', desc: 'Houses, farms, storehouses, markets, temples, walls and wonders.', ok: true, run: () => ((this.buildMenu = 'eco'), this.act.sound('open')) });
        cmds.push({ key: 'V', pic: '', glyph: '🛡', title: 'Build (military)', desc: 'Barracks, ranges, stables, forges, siege workshops and towers.', ok: true, run: () => ((this.buildMenu = 'mil'), this.act.sound('open')) });
      }
      // The Age of Iron and Blood (#303): foot soldiers pitch a War Camp where they stand.
      const pitchers = units.filter((u) => u.type !== 'citizen' && canRaise(u.type, 'warcamp'));
      if (pitchers.length && !builders.length && !buildBarred(p, 'warcamp')) {
        const cost = buildingCostFor(s, viewer, 'warcamp');
        const short = shortfall(p, cost);
        cmds.push({
          key: 'B',
          pic: buildingPicture('warcamp', p.epoch, p.color),
          title: 'Pitch a War Camp',
          desc: `${BUILDINGS.warcamp.blurb} Then click where to pitch it: in your own land, no one's, or the enemy's.`,
          cost,
          ok: !short,
          why: short ?? undefined,
          run: () => this.act.place('warcamp'),
        });
      }
      // The Age of Missions (#555 s12): priests raise a Mission on a far shore.
      const sowers = units.filter((u) => canRaise(u.type, 'mission', p.civ));
      if (sowers.length && !builders.length && !buildBarred(p, 'mission')) {
        const cost = buildingCostFor(s, viewer, 'mission');
        const short = shortfall(p, cost);
        cmds.push({
          key: 'O',
          pic: buildingPicture('mission', p.epoch, p.color),
          title: 'Raise a Mission',
          desc: `${BUILDINGS.mission.blurb} Then click a shore, in your own land or no one's: the farther from home, the bigger the tithe.`,
          cost,
          ok: !short,
          why: short ?? undefined,
          run: () => this.act.place('mission'),
        });
      }
      if (soldiers.length) cmds.push({ key: 'A', pic: '', glyph: '⚔', title: 'Attack-move', desc: 'Then click on the map: march there, fighting every enemy met on the way.', ok: true, run: () => this.act.attackMove() });
      // Patrol and explore (#454): give the intent once and they carry it out.
      const rovers = units.filter((u) => u.type !== 'citizen' && u.type !== 'wagon');
      if (rovers.length) {
        const fights = rovers.some((u) => MILITARY.includes(u.type));
        cmds.push({ key: 'Q', pic: '', glyph: '🔁', title: 'Patrol', desc: `Then click on the map: walk back and forth between here and there${fights ? ', fighting what comes by their stance and then taking up the round again' : ''}. <b>Shift-click</b> to add more waypoints to the round. Click a <b>trading post</b> or a trader to guard its road.`, ok: true, run: () => this.act.patrolMode() });
        cmds.push({ key: 'E', pic: '', glyph: '🧭', title: 'Explore', desc: `Go and see: each heads for the nearest ground your people have never seen, and on to the next, fanning out from one another${fights ? '. Aggressive soldiers fall on what they find; defensive ones fight only what comes close; those standing their ground only what is in reach' : ''}. They keep clear of enemy towers they have seen, report armies they come on, and stop when there is nothing left they can reach.`, ok: true, run: () => this.act.issue({ t: 'explore', p: viewer, ids: rovers.map((u) => u.id) }) });
      }
      // Posts that sell what the map lacks (#573): traders go to buy a load at the nearest post selling it.
      const buyers = units.filter((u) => u.type === 'trader');
      if (buyers.length) {
        const keys = ['Z', 'X', 'C'];
        RARES.filter((r) => soldAt(s, r)).forEach((r, i) => {
          const name = RARE[r].name.toLowerCase();
          const post = sellerNear(s, r, buyers[0].x, buyers[0].y)!;
          const gold = loadPrice(s, r);
          const roads = ROADS.filter((x) => x.ore?.id === r).map((x) => `${x.ore!.n} opens the road to the ${AGES[x.to].name} without its deeds`).join('; ');
          cmds.push({ key: keys[i], pic: '', glyph: PROSPECTOR.keys[r].icon, title: `Buy ${name}`, desc: `This world has no ${name}, but a trading post sells it. The traders walk there, pay ${gold} gold for each load of ${ORE_POST.lot} (dearer by ${Math.round(ORE_POST.rise * 100)}% with every load anyone buys) and carry it home to the Market, again and again until stopped. It counts as mined ore: ${roads}. A trader felled on the way drops its load for anyone to carry off: guard the road.`, ok: p.res.gold >= gold, why: p.res.gold >= gold ? undefined : `A load costs ${gold} gold`, run: () => this.act.issue({ t: 'route', p: viewer, ids: buyers.map((u) => u.id), post: post.id, buy: r }) });
        });
      }
      // The Age of Sappers (#577): citizens and foot soldiers carry a keg each to a rival building.
      const sappersHere = units.filter(carriesKegs);
      if (sappersHere.length && sappers(p)) {
        const why = kegsOf(p) < 1 ? kegProblem(s, viewer, undefined) : null;
        cmds.push({ key: 'K', pic: '', glyph: '🧨', title: 'Lay a keg', count: kegsOf(p) || undefined, desc: `Then click a rival building, or a stretch of a rival's causeway: each one carries a keg from your store to its foot and lights it. ${KEG.fuse} seconds later it blows, wrecking every rival building within ${KEG.reach} tiles (${KEG.building} each) and hurting the soldiers near it; a causeway or barrage within reach is breached. A rival who reaches a burning keg stamps it out: get there quietly, or cover it. Kegs left: ${kegsOf(p)}. More are ground only in the Age of Alchemy.`, ok: !why, why: why ?? undefined, run: () => this.act.kegMode() });
      }
      // Fire (`fire.ts`): citizens and foot soldiers carry torches, from the Bronze Age.
      if (units.some(carriesTorch)) {
        const why = p.epoch < FIRE.epoch ? `Torches are carried from the ${EPOCHS[FIRE.epoch].name}` : null;
        cmds.push({ key: 'F', pic: '', glyph: '🔥', title: 'Torch', desc: `Then click a tree, a rival's Thornwall root, or a rival's living building (a Thornwall, Kitchen Garden, Orchard or Sapling): each one walks to it and stands ${FIRE.light} seconds to set it alight. A living building burns down unless its people beat it out (${FIRE.beat} citizen-seconds standing by it); a Thornwall that burns leaves no root. Fire leaps from tree to tree and on to what grows beside: far in a dry summer (up to ${FIRE.run[1]} tiles), hardly at all in a wet spring or winter (${FIRE.run[0]}). A burnt tree is ash for ${Math.round(FIRE.ash / 60)} minutes, then grows again. Mind your own people: the flames scorch whoever stands in them.`, ok: !why, why: why ?? undefined, run: () => this.act.torchMode() });
      }
      cmds.push({ key: 'S', pic: '', glyph: '✋', title: 'Stop', desc: 'Stop what they are doing (and forget queued orders).', ok: true, run: () => this.act.issue({ t: 'stop', p: viewer, ids: units.map((u) => u.id) }) });
      if (citizens.length && !p.ai) {
        const runs = citizens.every((u) => flees(s, u));
        cmds.push({ key: '', pic: '', glyph: '🏃', title: runs ? 'Runs from danger' : 'Stands ground', desc: `${runs ? 'These citizens run from danger' : 'These citizens stand their ground'}: struck by soldiers they dash into the nearest shelter, and shot at by a tower they step out of its reach. Click to ${runs ? 'make them stand their ground' : 'let them run again'}. The Town Center turns it on or off for every citizen at once.`, ok: true, on: runs, run: () => this.act.issue({ t: 'flee', p: viewer, on: !runs, ids: citizens.map((u) => u.id) }) });
      }
      // The polis (#501): Greek citizens take up arms where they stand, and their soldiers lay them down at home.
      if (isPolis(p)) {
        if (citizens.length) {
          const why = armProblem(p, citizens[0]);
          cmds.push({ key: 'H', pic: unitPicture('infantry', p.epoch, p.color), title: citizens.length > 1 ? `Take up arms (${citizens.length})` : 'Take up arms', desc: `Each citizen becomes a hoplite where it stands, paying its own shield and spear; what it carries is dropped. A Greek city trains no foot soldiers: its citizens are its army. Lay the arms down within ${POLIS.home} tiles of a Town Center (L) to go back to work.`, cost: POLIS.arm, ok: !why, why: why ?? undefined, run: () => (this.act.issue({ t: 'arm', p: viewer, ids: citizens.map((u) => u.id) }), this.act.sound('queue')) });
        }
        const hoplites = units.filter((u) => u.type === 'infantry');
        if (hoplites.length) {
          const why = hoplites.some((u) => !disarmProblem(s, p, u)) ? null : disarmProblem(s, p, hoplites[0]);
          cmds.push({ key: 'L', pic: '', glyph: '🌾', title: 'Lay down arms', desc: `Soldiers within ${POLIS.home} tiles of a Town Center lay down shield and spear and are citizens again, ready to work. The arms are not given back.`, ok: !why, why: why ?? undefined, run: () => (this.act.issue({ t: 'disarm', p: viewer, ids: hoplites.map((u) => u.id) }), this.act.sound('queue')) });
        }
      }
      const holding = units.filter((u) => u.type === 'priest' && carriedBy(s, u));
      // The Blood-rite (#355 s4): a priest may offer an enemy up, or curse it.
      const chanters = units.filter((u) => u.type === 'priest' && !carriedBy(s, u));
      if (chanters.length && ageDef(p).rite) {
        cmds.push({ key: 'X', pic: '', glyph: '🩸', title: 'Sacrifice', desc: `Then click an enemy that bleeds (not a machine, ship, aircraft or King): the priest chants as for a conversion, and the victim dies, paying ${Math.round(RITE.offering * 100)}% of its price as blood (a Hero ${RITE.hero} times that).`, ok: true, run: () => this.act.riteMode('sacrifice') });
        const dry = bloodOf(p) < RITE.curse;
        cmds.push({ key: 'K', pic: '', glyph: '☠', title: 'Curse', desc: `Then click an enemy that bleeds: after a ${RITE.chant}-second chant it and the living within ${RITE.spread} tiles of it take ${Math.round((RITE.taken - 1) * 100)}% more from every blow for ${RITE.last} seconds. Costs ${RITE.curse} blood; the priest rests ${RITE.rest} seconds. Machines are beyond it.`, ok: !dry, why: dry ? `Needs ${RITE.curse} blood: ${Math.ceil(RITE.curse - bloodOf(p))} more` : undefined, run: () => this.act.riteMode('curse') });
      }
      if (holding.length) cmds.push({ key: 'D', pic: '', glyph: '⚱', title: 'Set down relic', desc: 'Lay the relic down where the priest stands, to have their hands free for healing and converting.', ok: true, run: () => this.act.issue({ t: 'dropRelic', p: viewer, ids: holding.map((u) => u.id) }) });
      if (walkers.length) cmds.push({ key: 'G', pic: '', glyph: '🏰', title: 'Garrison / board', desc: 'Then click a Town Center or tower to shelter inside (safe, and they add arrows), or your transport to go aboard.', ok: true, run: () => this.act.garrisonMode() });
      if (transports.length) {
        const aboard = transports.reduce((n, t) => n + t.cargo.length, 0);
        cmds.push({ key: 'U', pic: '', glyph: '⚓', title: 'Unload', desc: transports.every((u) => u.type === 'skywhale') ? 'Then click the ground: fly there and set everyone aboard down, over walls and woods. (Right-clicking ground does the same.)' : 'Then click a shore: sail there and put everyone aboard on land. (Right-clicking land does the same.)', ok: aboard > 0, why: 'Nobody is aboard', count: aboard || undefined, run: () => this.act.unloadMode() });
        cmds.push({ key: 'Y', pic: '', glyph: '🏖', title: 'Unload here', desc: 'Land everyone aboard on the nearest shore.', ok: aboard > 0, why: 'Nobody is aboard', run: () => transports.forEach((t) => this.act.issue({ t: 'unload', p: viewer, ids: [t.id], x: t.x, y: t.y })) });
      }
      // The Age of the Wildwood: Ents root where they stand.
      const ents = units.filter((u) => u.type === 'warden');
      if (ents.length) {
        const why = ents.map((u) => rootProblem(s, u)).find((w) => w) ?? null;
        cmds.push({ key: 'O', pic: '', glyph: '🌳', title: 'Root', desc: `Root where ${ents.length > 1 ? 'they stand' : 'it stands'} and be a tree again, on bare open ground: it mends ${Math.round(WILDWOOD.mend * 100)}% of its health a second, a rival sees only a tree, and it wakes when a rival comes within ${WILDWOOD.rouse} tiles or an axe bites, while your Heart Tree stands. Fell or burn the tree and the Ent is lost.`, ok: !why || ents.some((u) => !rootProblem(s, u)), why: why ?? undefined, run: () => this.act.issue({ t: 'root', p: viewer, ids: ents.map((u) => u.id) }) });
      }
      // The Age of Leviathans: Skywhales drop seed-bombs where they hover; the Behemoth kneels its Town Center.
      const whales = units.filter((u) => u.type === 'skywhale');
      if (whales.length) {
        const why = whales.map((u) => seedBombProblem(s, u)).find((w) => w) ?? null;
        const wait = Math.min(...whales.map((u) => bombIn(s, u)));
        cmds.push({ key: 'B', pic: '', glyph: '🌱', title: 'Seed-bomb', cost: LEVIATHANS.bomb, desc: `Drop a seed-bomb from ${whales.length > 1 ? 'each whale' : 'the whale'} where it hovers: ${LEVIATHANS.seeds} Thornwall seedlings of yours sprout on the open ground beneath it, in a rival's streets as well as your own, and grow as any Thornwall does. Lay them across a street to cut a town in pieces. A whale drops one every ${LEVIATHANS.every} seconds.`, ok: !why || whales.some((u) => !seedBombProblem(s, u)), why: why ?? undefined, count: wait > 0 ? wait : undefined, run: () => this.act.issue({ t: 'seedbomb', p: viewer, ids: whales.map((u) => u.id) }) });
      }
      const titan = units.find((u) => u.type === 'behemoth');
      if (titan) {
        const why = kneelProblem(s, titan);
        cmds.push({ key: 'P', pic: '', glyph: '🐢', title: 'Kneel', desc: 'Kneel here, on any ground a rival does not hold: the Town Center on its back stands at once, finished and working, with the health the Behemoth has. It trains, takes in every stock and claims the land; select it and Rise (P) to walk on.', ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'pitch', p: viewer, ids: [titan.id] }) });
      }
      const tows = units.filter((u) => u.type === 'tow');
      if (tows.length) {
        const why = tows.map((w) => pitchProblem(s, w)).find((w) => w) ?? null;
        cmds.push({ key: 'P', pic: '', glyph: '⚓', title: 'Moor', desc: `Moor the ${tows.length > 1 ? 'districts' : 'district'} here, on open water within ${FLOAT.spot} tiles that no rival holds. It raises itself in ${STEPPE.pitch} seconds with the health it had, and those aboard step out onto its deck. Moored side by side with ${FLOAT.city - 1} more of your pontoons, it raises citizens again.`, ok: !why || tows.some((w) => !pitchProblem(s, w)), why: why ?? undefined, run: () => this.act.issue({ t: 'pitch', p: viewer, ids: tows.map((w) => w.id) }) });
      }
      const wagons = units.filter((u) => u.type === 'wagon');
      if (wagons.length) {
        const why = wagons.map((w) => pitchProblem(s, w)).find((w) => w) ?? null;
        cmds.push({ key: 'P', pic: '', glyph: '⛺', title: 'Pitch camp', desc: `Set the ${wagons.length > 1 ? 'wagons\' loads' : 'wagon\'s load'} down here, on any ground a rival does not hold. It raises itself in ${STEPPE.pitch} seconds, with the health it was packed with.`, ok: !why || wagons.some((w) => !pitchProblem(s, w)), why: why ?? undefined, run: () => this.act.issue({ t: 'pitch', p: viewer, ids: wagons.map((w) => w.id) }) });
      }
      const kings = units.filter((u) => u.type === 'hero');
      if (kings.length === 1) {
        const why = rallyProblem(s, p, kings[0]);
        cmds.push({ key: 'R', pic: '', glyph: '📯', title: 'Rallying Cry', desc: `Soldiers within ${RALLY.radius} tiles strike ${Math.round((RALLY.attack - 1) * 100)}% harder, take ${RALLY.armor} less damage a blow and are mended ${RALLY.heal} for ${RALLY.duration} seconds. The hero needs ${RALLY.cooldown} seconds to draw breath. Call it when the lines meet.`, ok: !why, why: why ?? undefined, on: stirredNow(s, kings[0]), run: () => this.act.issue({ t: 'cry', p: viewer, id: kings[0].id }) });
      }
      if (soldiers.length) {
        const stances: [string, Stance, string, string][] = [
          ['Z', 'aggressive', '🔥', 'Attack and destroy: seek out and chase any enemy that comes into sight, and once the fight is won, tear down the buildings in sight.'],
          ['X', 'defensive', '🛡', 'Fight if provoked: fight what is attacking them or comes close, but return to their post.'],
          ['C', 'stand', '⚓', 'Hold: never move from the spot; strike what is in reach.'],
          ['N', 'run', '🏃', 'Run: step away from armed foes in sight and never fight back on their own (a direct attack order still goes ahead).'],
        ];
        for (const [key, stance, glyph, desc] of stances) {
          const all = soldiers.every((u) => u.stance === stance);
          cmds.push({ key, pic: '', glyph, title: STANCE_NAMES[stance], desc, ok: true, on: all, run: () => this.act.issue({ t: 'stance', p: viewer, ids: soldiers.map((u) => u.id), stance }) });
        }
      }
      cmds.push({ key: 'DELETE', pic: '', glyph: '💀', title: 'Delete', desc: 'Dismiss the selected units for good (Del).', ok: true, run: () => this.act.issue({ t: 'delete', p: viewer, ids: units.map((u) => u.id) }) });
    } else if (mine.length === 1 && mine[0].kind === 'building') {
      const b = mine[0];
      const def = BUILDINGS[b.type];
      const busy = b.advance >= 0;
      const full = b.queue.length >= MAX_QUEUE;
      if (b.built) {
        // The Market's Q W E and A S D buy and sell: its trader and technologies go on T and R F.
        // Soldiers an age hires here (the merchants' Market) go on Z X C.
        const unitKeys = b.type === 'towncenter' ? ['Q', 'E'] : b.type === 'market' ? ['T', 'Z', 'X', 'C'] : ['Q', 'W', 'E', 'R'];
        trainsAt(p, b.type).forEach((unit, i) => {
          const st = statsFor(s, viewer, unit);
          const hired = isHire(p, b.type, unit);
          const cost = trainCostFor(s, viewer, unit, b.type, b);
          const time = trainTimeFor(s, viewer, unit, b.type);
          const age = ageDef(p);
          const levied = !hired && !!age.levy && JSON.stringify(cost) !== JSON.stringify(st.cost);
          const priced = !hired && age.price?.[st.cls];
          const locked = unitEpoch(unit) > p.epoch;
          const no = barred(p, unit, b.type) ?? buildBarred(p, b.type) ?? (unit === 'citizen' ? citizenProblem(s, p) : null);
          const short = shortfall(p, cost);
          const hero = unit === 'hero' && (heroBusy(s, viewer) || b.queue.some((q) => q.unit === 'hero'));
          cmds.push({
            key: unitKeys[i] ?? '',
            pic: unitPicture(unit, Math.max(p.epoch, unitEpoch(unit)), p.color),
            title: `${hired ? 'Hire' : 'Train'} ${st.name}`,
            desc: hired
              ? `A mercenary, paid in gold alone and ready in ${Math.round(time)}s. After its first ${MERC.first}s he draws ${MERC.wage} gold every ${MERC.every}s from the treasury, and walks off if left unpaid ${MERC.patience} paydays. ${st.blurb}`
              : `${st.blurb} Takes ${Math.round(time)}s.${levied ? ` Levies cost ${Math.round((age.levy! - 1) * 100)}% more in the ${age.name}.` : ''}${priced ? ` ${Math.round(Math.abs(1 - priced) * 100)}% ${priced < 1 ? 'cheaper' : 'dearer'} in the ${age.name}.` : ''}`,
            cost,
            ok: !locked && !no && !short && !full && !busy && !hero,
            why: locked ? `Needs the ${EPOCHS[unitEpoch(unit)].name}` : no ? no : busy ? busyWhy(p, b) : hero ? 'You can lead with one hero at a time' : full ? 'The queue is full' : (short ?? undefined),
            count: b.queue.filter((q) => q.unit === unit).length || undefined,
            run: () => {
              this.act.issue({ t: 'train', p: viewer, building: b.id, unit });
              this.act.sound('queue');
            },
          });
        });
        if (b.type === 'towncenter') {
          // Every known road out of this age (#37): the main road on W, side roads on Y, X and C.
          const advancing = s.ents.some((e) => e.kind === 'building' && e.owner === viewer && e.advance >= 0);
          const main = mainRoad(p);
          const sideKeys = ['Y', 'X', 'C'];
          for (const road of roadsFrom(p)) {
            if (!roadKnown(s, p, road)) {
              // A road the Prospector's Lodge found this world can't open (#562): shown greyed, with the reason.
              const door = keyOf(road);
              if (door?.only && prospected(p) && !holds(s, door.key))
                cmds.push({ key: '', pic: '', glyph: '🚫', title: `The ${AGES[road.to].name}`, desc: `${road.blurb ?? AGES[road.to].blurb}${agePanel(s, p, road.to)}`, cost: road.cost, ok: false, why: `This world holds no ${PROSPECTOR.keys[door.key].name.toLowerCase()}`, run: () => {} });
              continue;
            }
            const to = AGES[road.to];
            const isMain = road === main;
            const problem = roadProblem(s, p, road);
            const short = shortfall(p, road.cost);
            const deeds = deedsProgress(p, road);
            const toward = to.tier > p.epoch ? 'Advance to' : to.tier < p.epoch ? 'Step back to' : 'Turn to';
            const back = suspendedTechs(p).filter((t) => TECHS[t].epoch <= to.tier);
            cmds.push({
              key: isMain ? 'W' : (sideKeys.shift() ?? ''),
              pic: '',
              glyph: isMain ? '⏫' : '🔀',
              title: `${toward} the ${to.name}${routeTag(road.to)}`,
              desc: `${road.gate === 'easy' ? '<i>An easy on-ramp: a small deed and a modest price.</i><br>' : road.gate === 'hard' ? '<i>A hard gate: a dear price and a long journey, for something special.</i><br>' : ''}${road.blurb ?? to.blurb}${isSideRoad(road) ? ` Opens only from ${windowsOf(road.to).map((a) => `the ${AGES[a].name}`).join(' or ')}.` : ''}${(oreOnly(s, road) ? [] : deeds).map((d) => `<br>${oreDone(p, road) || d.have >= d.need ? '✔' : '…'} ${d.deed.text}: ${Math.min(d.have, d.need)}/${d.need}.`).join('')}${(() => { const door = oreClue(s, p, road); return door ? `<br>${oreDone(p, road) ? '✔' : '…'} ${oreOnly(s, road) ? '' : '<i>Or</i> '}${door.text.charAt(0).toLowerCase()}${door.text.slice(1)}: ${Math.min(Math.floor(p.stats.mined?.[door.id] ?? 0), door.n)}/${door.n}.` : ''; })()}${(road.crossing ?? []).map((a) => `<br>${hasWalked(p, a) ? '✔' : '…'} A crossing: walk the ${AGES[a].name}.`).join('')}${road.lives ? `<br>${livesOf(p).length >= road.lives.n ? '✔' : '…'} Side ages walked: ${Math.min(livesOf(p).length, road.lives.n)}/${road.lives.n}${livesOf(p).length ? ` (${livesOf(p).map((a) => AGES[a].short).join(', ')})` : ''}. Each one is woven in.` : ''}${back.length ? `<br>Brings back ${back.map((t) => TECHS[t].name).join(', ')}.` : ''}${planLines(s, p, road.to, false)}<br>Takes ${road.time}s. Every unit re-arms and every building is rebuilt in the new style.${agePanel(s, p, road.to)}`,
              cost: road.cost,
              ok: !advancing && !problem && !short && b.queue.length === 0,
              on: b.advance >= 0 && !b.back && journeyOf(p, b)?.to === road.to,
              why: advancing ? 'Already advancing' : b.queue.length ? 'Finish training first' : (problem ?? short ?? undefined),
              run: () => {
                this.act.issue({ t: 'advance', p: viewer, building: b.id, to: road.to });
                this.act.sound('queue');
              },
            });
          }
          // Stepping back (#47) on Z: down to the trunk age one tier below, with what that reopens.
          const down = backTo(p);
          if (down) {
            const cost = stepBackCost(p.epoch);
            const problem = backProblem(s, p);
            const short = shortfall(p, cost);
            const opens = roadsFrom({ ...p, age: down, epoch: AGES[down].tier }).filter((r) => isSideRoad(r) && roadKnown(s, p, r));
            cmds.push({
              key: 'Z',
              pic: '',
              glyph: '⏬',
              title: `Step back to the ${AGES[down].name}`,
              desc:
                `Return to the older ways. Every unit falls back to its ${AGES[down].name} form and every building to its style.` +
                ' Technologies above it are suspended, not lost, until you climb again.' +
                planLines(s, p, down, true) +
                (opens.length ? `<br>Reopens the road to the ${opens.map((r) => AGES[r.to].name).join(' and the ')}.` : '') +
                `<br>Takes ${STEP_BACK.time}s; climbing again costs the full price. Then ${Math.round(STEP_BACK.cooldown / 60)} minutes before you may step back again.`,
              cost,
              ok: !advancing && !problem && !short && b.queue.length === 0,
              on: b.advance >= 0 && !!b.back,
              why: advancing ? 'Already advancing' : b.queue.length ? 'Finish training first' : (problem ?? short ?? undefined),
              run: () => {
                this.act.issue({ t: 'stepBack', p: viewer, building: b.id });
                this.act.sound('queue');
              },
            });
          }
          // Side roads whose window this age is outside of (#47): shown shut, with the way to them.
          for (const road of shutRoads(s, p)) {
            const from = AGES[road.from];
            const windows = windowsOf(road.to).map((a) => `the ${AGES[a].name}`).join(' or ');
            cmds.push({
              key: '',
              pic: '',
              glyph: '🔒',
              title: `The ${AGES[road.to].name}`,
              desc: `${road.blurb ?? AGES[road.to].blurb}<br>This road opens only from ${windows}.${agePanel(s, p, road.to)}`,
              cost: road.cost,
              ok: false,
              why: from.tier < p.epoch ? `Shut: step back to the ${from.name} to take it` : `Shut: it opens only from ${windows}`,
              run: () => {},
            });
          }
        }
        // Technologies: the next step of each line this building teaches.
        const techKeys = b.type === 'market' ? ['R', 'F'] : def.trains.length ? ['A', 'S', 'D', 'F', 'G'] : ['Q', 'W', 'E', 'R', 'T'];
        let ti = 0;
        for (const tech of nextTechs(p, b.type)) {
          const t = TECHS[tech];
          const cost = techCostFor(s, viewer, tech);
          const problem = techProblem(s, viewer, tech);
          const queued = b.queue.some((q) => q.tech === tech);
          const short = shortfall(p, cost);
          cmds.push({
            key: techKeys[ti++] ?? '',
            pic: '',
            glyph: t.icon,
            title: `Research ${t.name}`,
            desc: `${t.blurb} Takes ${Math.round(t.time)}s.`,
            cost,
            ok: !problem && !short && !full && !busy,
            on: queued,
            why: queued ? 'Being researched' : (problem ?? (busy ? busyWhy(p, b) : full ? 'The queue is full' : (short ?? undefined))),
            run: () => {
              this.act.issue({ t: 'research', p: viewer, building: b.id, tech });
              this.act.sound('queue');
            },
          });
        }
        if (b.type === 'market') {
          const goods: ['food' | 'wood' | 'stone', string, string][] = [['food', 'Q', 'A'], ['wood', 'W', 'S'], ['stone', 'E', 'D']];
          for (const [res, buyKey] of goods) {
            const price = s.market[res];
            cmds.push({
              key: buyKey,
              pic: '',
              glyph: `<span class="trade">${icon(res, 22)}<b>+</b></span>`,
              title: `Buy ${MARKET.lot} ${RES_LABEL[res].toLowerCase()}`,
              desc: `Pay ${price} gold. Shared price: ${marketTrend(price, res)}. Each purchase raises it. Recovery is ${MARKET.recover} gold every ${MARKET.every}s; other players’ trades can change it.`,
              cost: { gold: price },
              ok: p.res.gold >= price,
              why: `Need ${Math.ceil(price - p.res.gold)} more gold`,
              run: () => (this.act.issue({ t: 'trade', p: viewer, res, buy: true }), this.act.sound('click')),
            });
          }
          for (const [res, , sellKey] of goods) {
            const gets = Math.floor(s.market[res] * MARKET.sellRate);
            cmds.push({
              key: sellKey,
              pic: '',
              glyph: `<span class="trade">${icon(res, 22)}<b>−</b></span>`,
              title: `Sell ${MARKET.lot} ${RES_LABEL[res].toLowerCase()}`,
              desc: `Get ${gets} gold. Shared price: ${marketTrend(s.market[res], res)}. Each sale lowers it. Recovery is ${MARKET.recover} gold every ${MARKET.every}s; other players’ trades can change it.`,
              cost: { [res]: MARKET.lot },
              ok: p.res[res] >= MARKET.lot,
              why: `Need ${MARKET.lot} ${RES_LABEL[res].toLowerCase()} to sell`,
              run: () => (this.act.issue({ t: 'trade', p: viewer, res, buy: false }), this.act.sound('click')),
            });
          }
          // Rare ore in hand sells at a flat price; the buttons show once some has been mined (#356).
          for (const ore of RARES.filter((r) => (p.rare?.[r] ?? 0) > 0)) {
            const have = Math.floor(p.rare![ore]!);
            cmds.push({
              key: '',
              pic: '',
              glyph: `<span class="trade">${RARE_ICON[ore]}<b>−</b></span>`,
              title: `Sell ${ORE_TRADE.lot} ${RARE[ore].name.toLowerCase()}`,
              desc: `Get ${ORE_TRADE.gold[ore]} gold, a flat price. You hold ${have}. Ore sold still counts toward the doors it opens.`,
              ok: have >= ORE_TRADE.lot,
              why: `Need ${ORE_TRADE.lot} ${RARE[ore].name.toLowerCase()} to sell`,
              run: () => (this.act.issue({ t: 'trade', p: viewer, res: ore, buy: false }), this.act.sound('click')),
            });
          }
        }
        if (b.type === 'towncenter') {
          const bold = p.way && WAYS[p.way].noBell;
          cmds.push({ key: 'R', pic: '', glyph: '🔔', title: 'Ring the town bell', desc: 'Every citizen runs to shelter in the nearest Town Center or tower, which shoot more arrows for each one inside.', ok: !bold, why: bold ? `${WAYS[p.way!].name} does not hide: the bell does not ring` : undefined, run: () => this.act.issue({ t: 'bell', p: viewer, ring: true }) });
          // The Hearth Way's own verb (#463 s1).
          if (p.way === 'hearth') {
            const why = kinProblem(p, b);
            const n = kinCount(s);
            cmds.push({ key: 'K', pic: '', glyph: '🔥', title: `Call the Kin (${n})`, cost: KIN.cost, desc: `${n} citizens come to the hearth together after ${KIN.time} seconds in this Town Center's queue${n > KIN.n ? ': it is winter, and the winter call draws more' : `; in winter, ${KIN.winter}`}. They need room under your cap.`, ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'kin', p: viewer, building: b.id }) });
          }
          cmds.push({ key: '', pic: '', glyph: '🏃', title: p.noFlee ? 'Citizens stand ground' : 'Citizens run from danger', desc: `${p.noFlee ? 'Your citizens stand their ground when attacked, unless one is told to run.' : 'Your citizens run from danger on their own: struck by soldiers they dash into the nearest shelter, and shot at by a tower they step out of its reach. They come out when it has passed.'} Click to ${p.noFlee ? 'let them run' : 'make them stand'}. Only your own citizens; select one to set it alone.`, ok: true, on: !p.noFlee, run: () => this.act.issue({ t: 'flee', p: viewer, on: !!p.noFlee }) });
          const sheltering = s.ents.some((e) => e.kind === 'unit' && e.owner === viewer && e.type === 'citizen' && (e.inside || e.order.k === 'garrison'));
          cmds.push({ key: 'T', pic: '', glyph: '🕊', title: 'All clear', desc: 'Citizens come out of shelter and go back to work.', ok: sheltering, why: 'Nobody is sheltering', run: () => this.act.issue({ t: 'bell', p: viewer, ring: false }) });
        }
        if (b.type === 'towncenter' && p.epoch <= WAY.until && !p.way) {
          for (const id of WAY_IDS) {
            const w = WAYS[id];
            const why = wayProblem(s, p, id);
            cmds.push({ key: '', pic: '', glyph: w.icon, title: w.name, desc: `${w.blurb} Free, once, kept the whole match. The choice is lost when you leave the Stone Age. Your rivals will see which Way you take.${verbLine(w)}`, ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'way', p: viewer, way: id }) });
          }
        }
        if (b.type === 'towncenter' && p.way && !p.vowed && p.epoch === WAY.vow) {
          const mine = WAYS[p.way];
          const price = (c: typeof WAY.deepenCost) => Object.entries(c).map(([r, n]) => `${n} ${r}`).join(' + ');
          const dWhy = vowProblem(s, p);
          cmds.push({ key: '', pic: '', glyph: '⛰', title: `Deepen ${mine.name}`, desc: `${mine.deep.blurb} Costs ${price(WAY.deepenCost)}. One vow in the Bronze Age, deepening or turning.`, ok: !dWhy, why: dWhy ?? undefined, run: () => this.act.issue({ t: 'vow', p: viewer }) });
          for (const id of WAY_IDS) {
            if (id === p.way) continue;
            const w = WAYS[id];
            const why = vowProblem(s, p, id);
            cmds.push({ key: '', pic: '', glyph: '↪' + w.icon, title: `Turn to ${w.name}`, desc: `${w.blurb} Costs ${price(WAY.turnCost)}; ${mine.name} is dropped. One vow in the Bronze Age.`, ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'vow', p: viewer, way: id }) });
          }
        }
        if (b.type === 'towncenter') {
          const w = WORKS[p.civ];
          const why = workProblem(s, p);
          cmds.push({ key: 'V', pic: '', glyph: w.icon, title: w.name, desc: `${w.blurb} Free; lasts ${WORK.duration} seconds, once in each epoch.`, ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'greatWork', p: viewer }) });
        }
        // The Water Line (#701 s4): open the sluice, or shut it.
        if (b.type === 'sluice') {
          const why = sluiceProblem(s, b);
          const reach = waterLine(s, b).length;
          cmds.push({ key: 'O', pic: '', glyph: b.open ? '⛔' : '🌊', title: b.open ? 'Shut the sluice' : 'Open the sluice', desc: b.open ? `Let the gate down: the flood drains away from its edges in, a ring every ${INUND.every} second${INUND.every === 1 ? '' : 's'}, and the fields under it work again. A boat left on the last wet tile runs aground and is lost.` : `Wind the gate up: the water runs out over the low ground round it, a ring every ${INUND.every} second${INUND.every === 1 ? '' : 's'}, up to ${INUND.reach} tiles (${reach} tiles here). Soldiers wade the flood at ${Math.round(INUND.wade * 100)}% of their pace and siege at ${Math.round(INUND.siege * 100)}%; your gun-barges sail it. Fields under it yield nothing while it lies.${sluiceFed(s, b) ? '' : ' <b>No still water lies beside it</b>: set it on a channel, a lake or the shallows.'}`, ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'pack', p: viewer, building: b.id }) });
        }
        // A Town Center knelt from a Behemoth (the Age of Leviathans) rises onto its back again, in any age.
        if (b.behemoth) {
          const why = riseProblem(b);
          cmds.push({ key: 'P', pic: '', glyph: '🐢', title: 'Rise', desc: 'The Behemoth rises with this Town Center on its back, and everyone sheltering inside steps out. It walks and tramples, and counts as a Town Center while it walks; kneel it (P) where you want your capital next. While it walks it trains no one and takes in nothing.', ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'pack', p: viewer, building: b.id }) });
        }
        // A Tide Gate (#785): open it, a scour on a loaded pond, or shut it to fill on the next flood.
        if (b.type === 'tidegate') {
          const why = tideGateProblem(s, b);
          const reach = gateReach(s, b).length;
          cmds.push({ key: 'O', pic: '', glyph: b.open ? '⛔' : '🌊', title: b.open ? 'Shut the gate' : 'Open the gate', desc: b.open ? 'Let the leaves swing to: the pond holds again what the next flood brings in, and its mills grind it twice once it is full.' : reach ? `Let the pond out: it scours ${reach} tiles of flats below the gate for ${TIDE_GATE.secs} seconds, sweeping off whoever stands there (your own people too), ${TIDE_GATE.hurt} health lost or drowned. Then the pond runs with the tide until you shut the gate and the flood fills it.` : `No head of water to scour with (${TIDE_GATE.least} tiles held above the sea at least: open it at low water). Opened, the pond runs with the tide: its flats bare at low water and its cockle beds grow back, and the mills grind it once.`, ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'pack', p: viewer, building: b.id }) });
        }
        // The Age of Floating Cities (#770): cast the district off into a tow.
        if (b.type === 'pontoon' && (ageDef(p).floats || b.keep === 'floating')) {
          const why = castProblem(s, p, b);
          cmds.push({ key: 'O', pic: '', glyph: '⛵', title: 'Cast off', desc: `Slip this district's moorings and take it in tow, with those sheltering in it and then those of your people on its deck aboard, up to ${FLOAT.hold}; anyone else on the deck swims for the nearest deck or shore within ${FLOAT.swim} tiles. Tow it over open water and moor it again (P) wherever you like, out of any builder's reach too. While it is towed it gives no room, takes in nothing and raises no one, and ships sink it fast. A floating town split up raises no citizens until ${FLOAT.city} pontoons lie side by side again.`, ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'pack', p: viewer, building: b.id }) });
        }
        if (isMobile(p) && packsOf(p).includes(b.type)) {
          const why = packProblem(s, p, b);
          // Flocks (#308): the Town Center raises lambs.
          if (b.type === 'towncenter') {
            const no = lambProblem(s, p, b);
            const herd = s.animals.filter((a) => a.kind === 'sheep' && a.owner === viewer);
            const hungry = herd.filter((a) => a.hungry).length;
            cmds.push({ key: 'L', pic: '', glyph: '🐑', title: `Raise a lamb (${flockOf(s, viewer)}/${flockCap(s, viewer)})`, cost: FLOCK.cost, desc: `A lamb for the flock, grown in ${FLOCK.lamb} seconds. Sheep graze within ${grazeRange(s, viewer)} tiles of the nearest Town Center and follow it when camp is struck. Right-click one with citizens to <b>milk</b> it (slow food that comes back); a sheep left unmilked fattens and bears lambs; attack-move (A) onto one to <b>slaughter</b> it for meat. Each bite crops the grass bare for a while, so a flock grazes its ground out and must move on.${hungry ? ` <b>${hungry} of your sheep are hungry:</b> the grass here is gone.` : ''} Wolves take sheep near their dens (Hounds keep them off near camp), and rivals drive off sheep left with no one by them. Up to ${FLOCK.cap} sheep for each Town Center${isNomad(p) ? ` and ${NOMAD.house} for each House` : ''}.`, ok: !no, why: no ?? undefined, run: () => this.act.issue({ t: 'lamb', p: viewer, building: b.id }) });
            cmds.push({ key: '', pic: '', glyph: '🧑‍🌾', title: p.shepherd ? 'Flock tends itself' : 'Flock tended by hand', desc: `${!p.shepherd ? 'Nothing is done for you: raise lambs, send citizens to milk and slaughter by hand.' : `Lambs are raised on their own while there is room and ${SHEPHERD.reserve} food to spare, idle citizens within ${SHEPHERD.reach} tiles of camp take to milking, and a sheep fattened past breeding is slaughtered once the flock is full.`} Click to ${p.shepherd ? 'tend it by hand' : 'let the flock tend itself'}.`, ok: true, on: !!p.shepherd, run: () => this.act.issue({ t: 'shepherd', p: viewer, on: !p.shepherd }) });
          }
          cmds.push({ key: 'J', pic: '', glyph: '🛞', title: 'Strike camp', desc: b.type === 'market' ? `Pack this Market onto a wagon and take it along the road. Your traders come home to it wherever it rolls, and every tile it covers while they are out pays their trip ${Math.round(SILK.each * 100)}% more (up to ${Math.round(SILK.each * SILK.most * 100)}%). While it rolls nobody buys or sells and no trader is trained, and riders run it down.` : `Pack this ${def.name} onto a wagon, with everyone sheltering inside stepping out. Drive it to new ground and pitch it there (P). While it rolls it gives no room, takes in nothing and trains no one, and riders run it down.`, ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'pack', p: viewer, building: b.id }) });
        }
        // The call to arms (the Age of Total War, #313): a War Camp turns the citizens near it into foot soldiers.
        if (b.type === 'warcamp' && ageDef(p).callUp) {
          const why = callUpProblem(s, p, b);
          const near = callUpReach(s, b).length;
          const soldier = statsFor(s, viewer, 'infantry').name;
          const desc = (n: number) => `${n === 1 ? 'The nearest citizen' : `Up to the ${n} nearest citizens`} within ${CALL_UP.reach} tiles of this camp ${n === 1 ? 'takes' : 'take'} up arms: each becomes a ${soldier} where it stands, with the health it had, and drops what it carried. The camp then rests ${CALL_UP.rest} seconds for each one called. Every citizen called is one less at work.`;
          cmds.push({ key: 'C', pic: unitPicture('infantry', p.epoch, p.color), title: 'Call to arms', desc: desc(1), cost: CALL_UP.cost, ok: !why, why: why ?? undefined, count: near || undefined, run: () => (this.act.issue({ t: 'callUp', p: viewer, building: b.id, n: 1 }), this.act.sound('queue')) });
          const five: Cost = {};
          for (const [r, v] of Object.entries(CALL_UP.cost) as [keyof Cost, number][]) five[r] = v * CALL_UP.most;
          cmds.push({ key: 'V', pic: '', glyph: '📯', title: `Call ${CALL_UP.most} to arms`, desc: `${desc(CALL_UP.most)} Each costs its own arms.`, cost: five, ok: !why, why: why ?? undefined, run: () => (this.act.issue({ t: 'callUp', p: viewer, building: b.id, n: CALL_UP.most }), this.act.sound('queue')) });
        }
        // The levy (the Path of Blood, #355): a Drain Rig turns the citizens near it into blood.
        if (b.type === 'drainrig') {
          const why = levyProblem(s, p, b);
          const near = levyReach(s, b).length;
          cmds.push({ key: 'C', pic: '', glyph: '🩸', title: 'Levy', desc: `The nearest ${BLOOD.levyMost === 1 ? 'citizen' : `up to ${BLOOD.levyMost} citizens`} within ${BLOOD.levyReach} tiles of this rig are given to the rig: each is gone for good and pays ${BLOOD.levy} blood. The rig then rests ${BLOOD.rest} seconds for each. Every citizen levied is one less at work.`, ok: !why, why: why ?? undefined, count: near || undefined, run: () => (this.act.issue({ t: 'callUp', p: viewer, building: b.id, n: BLOOD.levyMost }), this.act.sound('queue')) });
        }
        // The Atomic Age (#605): a Missile Silo names a point and the whole map watches the clock.
        if (b.type === 'silo') {
          // The warhead is chosen at launch (#753): the branch's own on M, and past the fork an Atomic one on N. One clock either way.
          const r = rulesOf(p);
          const kinds = warheadsOf(p);
          for (const w of [...kinds].reverse()) {
            const why = launchProblem(s, viewer, b, b.x, b.y, w);
            const own = w === r.w;
            const { peak, r: R } = WARHEADS[w];
            const poison = w === 'fusion' ? '; nothing it strikes is poisoned' : `; the ground within ${SILO.reach} tiles of the point stays poisoned after, hurting every land unit in it`;
            const leak = r.leak > 0 ? ` Every launch of your people's poisons ${FISSION.reach} tiles round the silo for ${FISSION.ownFallout} seconds.` : '';
            const pool = ` Warheads come from your people's store, fired from any of your silos: ${stockOf(p)} now, one more every ${r.refuel ? `${r.refuel} seconds` : 'moment a slot frees'} while store and flight number under ${SILO.cap}. A silo that falls takes no stored warhead with it; only the one it is counting down is lost.`;
            cmds.push({ key: own ? 'M' : 'N', pic: '', glyph: w === 'fission' ? '⚛' : w === 'fusion' ? '☀' : '☢', title: kinds.length > 1 ? `Launch ${WARHEAD_NAMES[w]}` : 'Launch', desc: `Then click anywhere on the map: ${r.fuse} seconds later the ${WARHEAD_NAMES[w]} warhead lands, blasting every rival building and soldier within ${R} tiles: ${peak.toLocaleString('en')} damage at the centre, falling off with distance to nothing at the edge (distance is measured to a building's nearest edge)${poison}. Every player sees the clock and the blast, but not which warhead it is: your clock is ${r.fuse} seconds whatever you fire. The fog lifts over the blast for ${SILO.lift} seconds, and a silo destroyed before the clock runs out scrubs the launch.${leak}${pool}`, cost: fuelOf(w), ok: !why, why: why ?? undefined, on: !loaded(s, b), run: () => this.act.launchMode(b.id, w) });
          }
          // Missile defence (#759 s3): hold the silo back to answer rival warheads with the store's own, or stand it down to launch.
          const on = inReserve(b);
          const no = reserveProblem(s, viewer, b, !on);
          const fuel = Object.entries(fuelOf(r.w)).map(([k, n]) => `${n} ${k}`).join(' and ');
          cmds.push({ key: 'R', pic: '', glyph: '🛡', title: on ? 'Stand down' : 'Hold in Reserve', desc: on ? `Stand this silo down: it may launch again at once, and answers no warhead. Holding it again takes ${INTERCEPT.arm} seconds to stand ready.` : `Hold this silo back to defend: it launches nothing while held, and ${INTERCEPT.arm} seconds from now it stands ready. ${INTERCEPT.fire} seconds before a rival warhead lands that no Interceptor Battery answered, anywhere on the map, it fires a warhead of your store at it and stops it ${Math.round(INTERCEPT.chance * 100)}% of the time: no blast, no fallout. Each answer spends a warhead and ${fuel} of fuel, hit or miss, and the silo stands ready again ${INTERCEPT.arm} seconds later. Batteries answer first, as they are cheaper; one attempt for each warhead. Every player sees which silos you hold, so a rival may wait, or fire a salvo, or strike the silo.`, ok: !no, why: no ?? undefined, on, run: () => (this.act.issue({ t: 'reserve', p: viewer, silo: b.id, on: !on }), this.act.sound('queue')) });
          // The salvo (#765): three silos, three Atomic warheads, three points, one clock. Launch Control opens it.
          const why = salvoProblem(s, viewer);
          const plain = r.w === 'atomic' ? ` A plain Atomic people pays ${Math.round(SALVO.surcharge * 100)}% more fuel on each; past the fork the silos share a clock for the plain price.` : '';
          cmds.push({ key: 'B', pic: '', glyph: '☄', title: 'Salvo', desc: `Then click ${SALVO.trio} points on the map, at least ${SILO.apart} tiles apart: this silo and your next ${SALVO.trio - 1} standing silos fire one Atomic warhead each, ${SALVO.trio} from your store, on your ${r.fuse} second clock. Each point takes the Atomic blast (${WARHEADS.atomic.peak.toLocaleString('en')} at the centre, ${WARHEADS.atomic.r} tiles out) and its fallout. Rivals see three rings, as for one warhead and two decoys, and learn all three are real only in the last ${SILO.reveal} seconds. Each silo destroyed before then scrubs its own warhead and its ring; the others fly on. Needs Launch Control and ${SALVO.trio} standing silos.${plain}`, cost: salvoFuel(p), ok: !why, why: why ?? undefined, run: () => this.act.launchMode(b.id, 'salvo') });
        }
        // The Age of the Bloom: a Seed Spire slings its ripe Seed at a point, and the whole map watches it root.
        if (b.type === 'spire') {
          const why = slingProblem(s, viewer, b, b.x, b.y);
          cmds.push({ key: 'G', pic: '', glyph: '🌱', title: 'Sling Seed', desc: `Then click anywhere on the map: the Bloom Seed flies ${BLOOM.flight} seconds, every player seeing where it falls, and roots on the open ground nearest that point. ${BLOOM.grow} seconds later every rival building within ${BLOOM.r} tiles of its heart-root cracks, and forest grows where they stood, unless rival citizens beside the root hack it out first (${BLOOM.root} strokes, one a second for each). Guard it. The next Seed ripens ${BLOOM.ripen} seconds after, while your Heart Tree stands.`, cost: BLOOM.fuel, ok: !why, why: why ?? undefined, run: () => this.act.slingMode(b.id) });
        }
        // The seam a Mine Shaft digs (#681).
        if (b.type === 'shaft') {
          const now = seamOf(s, b);
          const can = seamsAt(s, b);
          SEAMS.forEach((m, i) => {
            if (!can.includes(m)) return;
            const why = seamProblem(s, b, m);
            const name = SHAFT.seams[m].name;
            cmds.push({ key: 'QWERT'[i], pic: '', glyph: m === 'gold' ? '🪙' : m === 'stone' ? '🪨' : '💎', title: `Dig ${name.toLowerCase()}`, desc: `Set this shaft to dig ${name.toLowerCase()} at ${Math.round(shaftShare(s, b, m) * 100)}% of an open deposit's pace${m === 'gold' || m === 'stone' ? '' : ', over the old workings of that vein'}. Its miner switches at the next trip.`, ok: !why, why: why ?? undefined, on: now === m, run: () => (this.act.issue({ t: 'seam', p: viewer, building: b.id, seam: m }), this.act.sound('queue')) });
          });
        }
        if (b.type === 'tower') {
          // The tower line: this tower alone climbs a step.
          const step = TOWER_LEVELS[b.level ?? 0];
          if (step) {
            const problem = raiseProblem(s, viewer, b);
            const short = shortfall(p, step.cost);
            const raising = b.queue.some((q) => q.rise);
            cmds.push({
              key: 'Q', pic: '', glyph: step.icon, title: `Raise to ${step.name}`,
              desc: `${step.blurb} Takes ${step.time}s; the tower keeps shooting while it is raised.`,
              cost: step.cost, ok: !problem && !short && !full && !busy, on: raising,
              why: raising ? 'Being raised' : (problem ?? (full ? 'The queue is full' : (short ?? undefined))),
              run: () => {
                this.act.issue({ t: 'raiseTower', p: viewer, building: b.id });
                this.act.sound('queue');
              },
            });
          }
          const why = beaconProblem(s, p, b);
          cmds.push({ key: 'F', pic: '', glyph: '🔥', title: 'Light the beacon', desc: `A fire on the roof: this tower sees ${BEACON.sight} tiles farther for ${BEACON.duration} seconds, but every rival sees the ground around it. Costs ${BEACON.cost.wood} wood; it can be lit again after ${BEACON.cooldown} seconds.`, ok: !why, why: why ?? undefined, on: lit(s, b), run: () => this.act.issue({ t: 'beacon', p: viewer, building: b.id }) });
        }
        // Choosing the keepsake (#555 s11): which of this age's buildings keeps its work once the people leaves.
        const k = ageDef(p).keepsake;
        if (k && k.building === b.type) {
          const why = keepsakeProblem(p, b);
          cmds.push({ key: 'J', pic: '', glyph: '🏺', title: 'Keep this one', desc: `Make this ${def.name} the ${ageDef(p).name}'s keepsake: when your people leaves the age, it keeps ${k.does}, on any road. Only one is kept; unchosen, the oldest is. Raze it and the keepsake is gone.`, ok: !why && b.keep !== ageOf(p), on: b.keep === ageOf(p), why: why ?? 'Already your keepsake', run: () => this.act.issue({ t: 'keepsake', p: viewer, building: b.id }) });
        }
        if (def.garrison) {
          cmds.push({ key: 'U', pic: '', glyph: '🚪', title: 'Let them out', desc: `Everyone sheltering here comes out (${b.garrison.length}/${def.garrison}).`, ok: b.garrison.length > 0, why: 'Nobody is inside', count: b.garrison.length || undefined, run: () => this.act.issue({ t: 'ungarrison', p: viewer, building: b.id }) });
        }
      }
      cmds.push({ key: 'DELETE', pic: '', glyph: '💀', title: b.built ? 'Delete' : 'Cancel', desc: b.built ? 'Tear this building down (Del).' : 'Give up this building site (Del). Refunded if no work was done.', ok: true, run: () => this.act.issue({ t: 'delete', p: viewer, ids: [b.id] }) });
    } else if (mine.length > 1 && mine.every((e) => e.kind === 'building')) {
      cmds.push({ key: 'DELETE', pic: '', glyph: '💀', title: 'Delete', desc: 'Tear these buildings down (Del).', ok: true, run: () => this.act.issue({ t: 'delete', p: viewer, ids: mine.map((e) => e.id) }) });
    }
    this.cmds = cmds;
    const sig = cmds.map((c) => `${c.key}${c.ok ? 1 : 0}${c.count ?? ''}${c.on ? 1 : 0}${c.pic.length}${c.title}${c.desc}${JSON.stringify(c.cost)}${c.why}`).join('|');
    if (sig === this.cmdSig) return;
    this.cmdSig = sig;
    this.cmdEl.innerHTML = cmds
      .map((c, i) => {
        const key = c.key === 'ESCAPE' ? 'Esc' : c.key === 'DELETE' ? 'Del' : c.key;
        const tip = `<b>${c.title}</b>${c.cost ? `<div class='cost'>${costHtml(c.cost, s.players[viewer].res).replace(/"/g, "'")}</div>` : ''}${c.desc}${!c.ok && c.why ? `<br><span style='color:#ff9a8a'>${c.why}</span>` : ''}${key ? `<br><span class='hint'>Hotkey: ${key}</span>` : ''}`;
        return `<button class="cmd ${c.ok ? '' : 'off'} ${c.on ? 'on' : ''}" data-i="${i}" data-tip="${tip.replace(/"/g, '&quot;')}">${c.pic ? `<img src="${c.pic}" alt="">` : `<span class="glyph">${c.glyph ?? ''}</span>`}<span class="key">${key}</span>${c.count ? `<span class="count">${c.count}</span>` : ''}</button>`;
      })
      .join('');
  }

  private hover(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (!el) {
      this.hideTip();
      return;
    }
    if (el !== this.tipFor) {
      this.tipFor = el;
      this.tipEl.innerHTML = el.dataset.tip!;
      this.tipEl.classList.remove('hidden');
    }
    const r = this.tipEl.getBoundingClientRect();
    let x = e.clientX + 14;
    let y = e.clientY - r.height - 12;
    if (y < 46) y = e.clientY + 18;
    // Keep the whole tip on screen: smaller windows and zoomed pages push it past an edge.
    y = Math.max(6, Math.min(y, window.innerHeight - r.height - 6));
    x = Math.max(6, Math.min(x, window.innerWidth - r.width - 6));
    this.tipEl.style.left = `${x}px`;
    this.tipEl.style.top = `${y}px`;
  }

  hideTip(): void {
    this.tipFor = null;
    this.tipEl.classList.add('hidden');
  }

  /** Forget cached panels (after a new match starts). */
  reset(): void {
    this.selSig = '';
    this.cmdSig = '';
    this.topSig = '';
    this.timerHtml = '';
    this.timerEl.innerHTML = '';
    this.buildMenu = null;
    this.noticeEl.innerHTML = '';
  }
}

function hpBar(hp: number, max: number, frac: number): string {
  return `<div class="hp ${frac < 0.3 ? 'low' : frac < 0.6 ? 'mid' : ''}"><i style="width:${Math.max(0, Math.min(100, frac * 100))}%"></i><span>${Math.ceil(hp)} / ${max}</span></div>`;
}


const RARE_ICON = { salt: '🧂', saltpetre: '💎', bloodiron: '🩸' } as const;

function householdHint(s: GameState, viewer: number): string {
  const rate = Math.round(taxRate(s, viewer) * 60);
  return `Nobody mines it here: your houses pay it, <b>${rate} a minute</b> now, more for each house on a street and the fuller your town. Cavalry, later soldiers and the later epochs.`;
}

// Born on the move (#501): a Mongol camp quarries no stone and tills no field.
const NOMAD_STONE = 'Nobody quarries it here: buy it at a Market, or take it as tribute, for riders who stand still in a rival\'s land take stone with the gold. Town Centers, towers and the later epochs.';
const NOMAD_FOOD = 'From your flock (milk it, and slaughter the fat), the hunt, berries and fishing; never fields. Each Town Center keeps a flock, each House a little more: move camp when the grass is grazed out.';

function resHint(r: string): string {
  return {
    food: 'From berry bushes, hunting, farms and fishing. Feeds new citizens and soldiers and pays for the epochs.',
    wood: 'From trees. Buildings, bows and spears.',
    stone: 'From stone quarries. Town Centers, towers and the later epochs.',
    gold: 'From gold mines. Cavalry, later soldiers and the later epochs.',
  }[r]!;
}

export function nameOf(s: GameState, e: Ent): string {
  if (e.kind === 'unit' && s.kings.includes(e.id)) return 'King';
  if (e.kind === 'building' && e.type === 'tower' && e.level) return TOWER_LEVELS[e.level - 1].name;
  return e.kind === 'unit' ? statsFor(s, e.owner, e.type).name : BUILDINGS[e.type].name;
}

/** Chains of technologies: each building offers the next unresearched step of each. */
const TECH_LINES: TechId[][] = (() => {
  const lines: TechId[][] = [];
  for (const id of TECH_IDS) {
    const t = TECHS[id];
    const line = t.needs ? lines.find((l) => l[l.length - 1] === t.needs) : undefined;
    if (line) line.push(id);
    else lines.push([id]);
  }
  return lines;
})();

function nextTechs(p: Player, at: BuildingType): TechId[] {
  const out: TechId[] = [];
  for (const line of TECH_LINES) {
    if (TECHS[line[0]].at !== at) continue;
    // An heirloom (#224) shows only once one of its two ages is walked: the clue that it is there.
    const pair = TECHS[line[0]].walked;
    if (pair && !pair.some((a) => hasWalked(p, a))) continue;
    // A suspended step (#47) shows greyed, with when it returns. A retired one (Survey the Land, #562) isn't offered.
    const next = line.find((t) => !p.techs.includes(t));
    if (next && !TECHS[next].legacy) out.push(next);
  }
  return out;
}

function plural(name: string): string {
  return name.endsWith('man') ? `${name.slice(0, -3)}men` : name.endsWith('olf') ? `${name.slice(0, -1)}ves` : name.endsWith('ry') ? `${name.slice(0, -1)}ies` : `${name}s`;
}

/** Why a Town Center's other buttons wait while it is busy changing age. */
function busyWhy(p: Player, b: Building): string {
  return journeyOf(p, b)?.back ? 'Busy stepping back an age' : 'Busy advancing to the next epoch';
}
