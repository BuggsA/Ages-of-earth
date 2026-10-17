/**
 * The shapes of the simulation. Everything here is plain data advanced by `step` in fixed ticks, so the
 * same commands on the same seed always give the same match (the basis for lockstep online play).
 */

import type { ScenarioRun } from './campaign';

export type Res = 'food' | 'wood' | 'stone' | 'gold';
export const RES: readonly Res[] = ['food', 'wood', 'stone', 'gold'];
export type Cost = Partial<Record<Res, number>>;
export type Stock = Record<Res, number>;

export type UnitType =
  | 'citizen' | 'infantry' | 'ranged' | 'cavalry' | 'siege' | 'priest' | 'hero'
  | 'fisher' | 'warship' | 'transport' | 'cog' | 'fighter' | 'bomber' | 'trader'
  /** A packed Town Center or House on the move (the Age of the Steppe, #297). */
  | 'wagon';
/** How a unit gets about: on foot, on the water, or in the air. */
export type Domain = 'land' | 'water' | 'air';
export type BuildingType =
  | 'towncenter' | 'house' | 'storehouse' | 'farm' | 'barracks' | 'range' | 'stable' | 'tower'
  | 'forge' | 'workshop' | 'temple' | 'market' | 'wonder' | 'wall' | 'gate' | 'dock' | 'airfield' | 'huntcamp' | 'warcamp' | 'caravanserai' | 'drainrig' | 'transfusion' | 'bloodtower';
/** Ids keep their behaviour; the names the player sees moved down a step when `gentle` came in (#258): see `AI_LEVELS`. */
export type Difficulty = 'gentle' | 'easy' | 'normal' | 'hard';
export type MapSize = 'small' | 'medium' | 'large';
export type MapType = 'continental' | 'highlands' | 'lakes' | 'forest' | 'plains' | 'sea';
/** Conquest: destroy every rival town. Regicide: each people has a King; lose them and you lose. Deathmatch: start rich. */
export type GameMode = 'conquest' | 'regicide' | 'deathmatch' | 'lords';
export type Stance = 'aggressive' | 'defensive' | 'stand';
/** A custom the people live by, chosen in the Stone Age (#336). */
export type WayId = 'hunt' | 'hearth' | 'warband';
export type CivId = 'egyptians' | 'greeks' | 'romans' | 'mongols' | 'chinese' | 'britons';
export type TechId =
  | 'forging' | 'ironCasting' | 'blastFurnace' | 'fletching' | 'bodkin' | 'scaleArmor' | 'chainMail' | 'plateArmor'
  | 'wheelbarrow' | 'handcart' | 'axes' | 'saws' | 'picks' | 'shafts' | 'plow' | 'irrigation' | 'masonry'
  | 'conscription' | 'husbandry' | 'theology' | 'chemistry'
  | 'gillnets' | 'shipwright' | 'lighthouse' | 'rifling' | 'steamEngine' | 'aviation' | 'caravan' | 'banking' | 'pilgrimage' | 'drying' | 'hounds' | 'survey' | 'bloomery' | 'ropewalk' | 'credit' | 'litany'
  | 'bellFoundry' | 'ironHulls' | 'jointStock' | 'masonsLodge' | 'stElmo' | 'telegraphy' | 'galvanic' | 'galvanicBlood' | 'militaryOrders' | 'blackPowder' | 'saltCuring' | 'bloodForged';
/** Where a people stands in the web of ages (#37): the five trunk epochs, and the side ages beside them. */
export type AgeId = 'stone' | 'bronze' | 'middle' | 'gunpowder' | 'industrial' | 'merchant' | 'iron' | 'pilgrim' | 'fair' | 'reclaimer' | 'sail' | 'aeronaut' | 'lightning' | 'warband' | 'steppe' | 'ironblood' | 'totalwar' | 'horde' | 'silk' | 'hemocraft' | 'bloodrite';

/** A path (#299): side ages chained one per tier, walked as one road across several epochs. */
export type PathId = 'blood' | 'steppe' | 'hemocraft' | 'rite';

/** Tile ground. Water and rock can't be walked or built on. */
export const T_GRASS = 0;
export const T_SAND = 1;
export const T_WATER = 2;
export const T_ROCK = 3;

/** What grows or lies on a tile, to be gathered. */
export const R_NONE = 0;
export const R_TREE = 1;
export const R_BERRY = 2;
export const R_STONE = 3;
export const R_GOLD = 4;
/** A hunted animal, to be butchered for food. */
export const R_MEAT = 5;
/** A shoal of fish in the water, for fishing boats. */
export const R_FISH = 6;
/** Bog iron (#39): ore in the wetland mud, found on some worlds and not others. Mined like gold, and paid in as gold (iron bars). */
export const R_BOG = 7;
/** Deep veins (#356): rare ores that only some seeds hold, mined like stone and kept apart from the four stocks. */
export const R_SALT = 8;
export const R_SALTPETRE = 9;
export const R_BLOODIRON = 10;
export type RareId = 'salt' | 'saltpetre' | 'bloodiron';
export const RARES: readonly RareId[] = ['salt', 'saltpetre', 'bloodiron'];
/** A cave mouth (#356): one rich tile of a rare ore, sometimes with a wolf pack in it. The ore is mined like any vein. */
export interface Cave {
  tile: number;
  ore: RareId;
  /** Wolves lair here. */
  den: boolean;
}

/** Why a tile can't be walked: bits of `block`. */
export const B_TERRAIN = 1;
export const B_RES = 2;
export const B_BUILDING = 4;
/** A gate: shut to everyone but its owner's team (the tile's gate owner is in `gateOwner`). */
export const B_GATE = 8;

/** A rectangle of tiles that count as arrived, and the spot to end on in the last one. */
export interface Goal {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  px: number;
  py: number;
}

export type Order =
  | { k: 'idle' }
  /** Walk to a point. With `amove`, fight anything met on the way. */
  | { k: 'move'; x: number; y: number; amove: boolean; started: boolean }
  /** Fight a unit or building. `auto` when picked by the unit itself (it gives up sooner); `then` resumes an attack-move. */
  | { k: 'attack'; target: number; auto: boolean; then: { x: number; y: number } | null }
  /** Gather a resource tile: walk there, work it, carry the load to a drop site, and back. */
  | { k: 'gather'; tile: number; res: Res; phase: 'go' | 'work' | 'drop'; bog?: boolean; rare?: RareId; meat?: boolean }
  | { k: 'build'; target: number }
  | { k: 'farm'; target: number; phase: 'go' | 'work' | 'drop' }
  /** Carry what is held to a drop site, then go idle. */
  | { k: 'deliver' }
  /** Walk into a building to shelter (and add arrows to its volleys). */
  | { k: 'garrison'; target: number }
  /** Hunt an animal; once it falls, butcher it. With `fight`, a wolf fought off: nothing to butcher. */
  | { k: 'hunt'; target: number; fight?: boolean }
  /** Milk a sheep of the people's flock (#308), carry the milk to a drop site, and back. */
  | { k: 'milk'; target: number; phase: 'go' | 'work' | 'drop' }
  /**
   * A priest turning an enemy to your side: `done` ticks of chanting so far. A Blood-rite priest (#355 s4) may instead chant a `rite`
   * over a living enemy: to `sacrifice` it for its blood, or to `curse` it.
   */
  | { k: 'convert'; target: number; done: number; rite?: 'sacrifice' | 'curse' }
  /** A pilgrim priest standing by a friendly building a rival is chanting over, singing back (#219). */
  | { k: 'answer'; target: number }
  /** A priest tending a wounded friend. */
  | { k: 'heal'; target: number }
  /** Walk to the shore by a transport ship and go aboard. */
  | { k: 'board'; target: number; meet?: { lx: number; ly: number; wx: number; wy: number } }
  /** A transport sailing to a shore to put its passengers ashore there. */
  | { k: 'unload'; x: number; y: number }
  /** A priest fetching a relic and carrying it to a Temple (that one, or the nearest when 0). */
  | { k: 'relic'; target: number; temple: number }
  /**
   * A trader running the road between a Market and a trading post: out to the post (`go`), where it
   * loads gold worth the distance from the Market, and back to the Market to pay it in (`back`).
   */
  | { k: 'trade'; post: number; market: number; phase: 'go' | 'back'; from?: { x: number; y: number } }
  /** A citizen digging at an ancient ruin (#64). */
  | { k: 'dig'; target: number };

/** What a unit is visibly doing, for the renderer's animation. */
export type Act = 'idle' | 'walk' | 'attack' | 'chop' | 'mine' | 'forage' | 'farm' | 'build' | 'chant' | 'fish';

export interface Unit {
  id: number;
  owner: number;
  kind: 'unit';
  type: UnitType;
  x: number;
  y: number;
  /** Position at the start of this tick, for smooth drawing between ticks. */
  px: number;
  py: number;
  /** Facing direction, a unit vector. */
  fx: number;
  fy: number;
  hp: number;
  order: Order;
  /** Orders given with Shift, carried out in turn once the current one is done. */
  queue: Order[];
  stance: Stance;
  /** Where it stood when it last came to rest (defensive units return here). */
  guardX: number;
  guardY: number;
  /** The building it is sheltering in (or the transport it rides), or 0. */
  inside: number;
  /** A transport's passengers. */
  cargo: number[];
  /** Waypoints as [x0, y0, x1, y1, ...], or null when not walking a route. */
  path: number[] | null;
  pathI: number;
  /** Where the current route leads, and whether one is still to be worked out (a few are each tick). */
  goal: Goal | null;
  wantPath: boolean;
  /** Tick the route was last worked out, so a chase doesn't recompute it every tick. */
  pathTick: number;
  /** Ticks until the next swing or shot. */
  cool: number;
  carry: number;
  carryRes: Res | null;
  /** A rare ore in the basket (#356): its paid into `Player.rare`, not the four stocks. */
  carryRare?: RareId | null;
  /** A trader's load: a bit for each player whose toll it has paid since it was loaded (safe passage, #334). */
  tolled?: number;
  /** Fraction of the next carried unit gathered so far. */
  frac: number;
  /** Ticks spent barely moving while trying to walk. */
  stuck: number;
  /** Walks that ended without reaching what the order needed; the order is given up after a few. */
  miss: number;
  /** The work a citizen was pulled off (to build, or by the town bell), to go back to afterward. */
  resume: Order | null;
  act: Act;
  /** Tick of the last swing or shot (for the strike animation). */
  swing: number;
  /** Tick it last took damage. */
  hurt: number;
  /** Tick it was made (for the renderer's entrance). */
  born: number;
  /** Last tick a hero's presence inspired it. */
  aura: number;
  /** Tick a Rallying Cry stirring it ends; on a hero, the tick it may cry again. */
  cry?: number;
  cryReady?: number;
  /** Enemy soldiers it has defeated (older saves lack it). */
  vet?: number;
  /** A wagon (#297): the building it carries, and that building's health as a share of its full health. */
  packed?: BuildingType;
  packedHp?: number;
  /** A hemo-engineered soldier (#355 s3): the tick its graft runs dry unless a Transfusion Station tops it up; absent when ungrafted. */
  hemo?: number;
  /** Quenched in blood-iron (#356): the graft lasts longer, mends faster and crashes softer; cleared when it runs dry. */
  tempered?: boolean;
  /** A hired sword (the Age of Merchants): how many paydays it has gone unpaid; absent for a soldier trained the usual way. */
  merc?: number;
  /** Cursed by a Blood-rite priest (#355 s4): the tick the curse lifts. Until then every blow on it lands harder (`RITE.taken`). */
  cursed?: number;
}

export interface TrainItem {
  unit?: UnitType;
  tech?: TechId;
  /** Ticks of work done. */
  done: number;
  /** What was paid, refunded if it is cancelled. */
  paid: Cost;
}

export interface Building {
  id: number;
  owner: number;
  kind: 'building';
  type: BuildingType;
  /** Top-left tile of the footprint. */
  tx: number;
  ty: number;
  size: number;
  /** Center in tile coordinates. */
  x: number;
  y: number;
  hp: number;
  built: boolean;
  /** Construction progress, 0 to 1. */
  progress: number;
  queue: TrainItem[];
  /** Ticks into advancing to the next epoch (Town Center), or -1. */
  advance: number;
  /** The age it is advancing into; absent means the trunk's next epoch (and older saves). */
  advanceTo?: AgeId;
  /** Set while the advance is a step back (#47) to the trunk age one tier down; absent otherwise. */
  back?: boolean;
  /** Where new units go. `kind` is the resource the flag was set on (absent on bare ground), so it outlives its tile (#344). */
  rally: { x: number; y: number; tile: number; kind?: number } | null;
  cool: number;
  /** The citizen working this farm, or 0. */
  farmer: number;
  /** Units sheltering inside. */
  garrison: number[];
  /** A finished wonder: ticks left before its owner wins (-1 otherwise). */
  timer: number;
  /** Walls run along x or y: which way this piece faces (for the model). */
  dir: number;
  hurt: number;
  born: number;
  /** Work carried over between ticks, in hundredths of a step, while the owner's age speeds or slows it (the Age of Lightning, #231). */
  spark?: number;
  /** Tower beacon: tick it burns out (while lit), and tick it may be lit again (#beacon). */
  beacon?: number;
  beaconReady?: number;
  /**
   * Faith takes the walls (#209): how far a rival's priests have chanted this building over (0 to 1),
   * whose they are, and the tick of the last chant (the faith fades after a pause). Absent: none.
   */
  faith?: number;
  faithBy?: number;
  chant?: number;
  /**
   * Being pitched from a wagon (#297): it raises itself, with no builders, and is finished when `progress`
   * reaches 1. The share of its full health it was packed with, which it climbs back to as it goes up.
   */
  pitch?: number;
  /** A War Camp (#303): whole seconds it has stood with none of its people's soldiers near; absent while they are. */
  alone?: number;
  /**
   * A War Camp in the Age of Total War (#313): the tick from which it may call up citizens again (`CALL_UP.rest`). Absent: at once.
   * A Drain Rig (#355) rests the same way after a levy; a Transfusion Station holds here the tick its graft in hand is done.
   */
  muster?: number;
  /**
   * Captives held at a Drain Rig, or a Blood-rite altar (#355): each the people it was taken from and the blood still in it. Bled
   * `BLOOD.bleed` a second until spent; freed as citizens of their own people if the building falls. Absent: none.
   */
  captives?: { p: number; left: number }[];
}

export type Ent = Unit | Building;

/**
 * A relic: it lies on the ground, rides with the priest carrying it, or is kept in a Temple, where it
 * brings in gold. It can't be destroyed: whoever falls carrying it, or the Temple keeping it, lets it go.
 */
export interface Relic {
  id: number;
  /** Where it is: on the ground, or where its carrier or Temple stands. */
  x: number;
  y: number;
  /** The priest carrying it, or 0. */
  carrier: number;
  /** The Temple keeping it, or 0. */
  temple: number;
}

/**
 * A trading post: neutral ground out on the map where traders from any Market come to trade. It
 * belongs to nobody and can't be harmed; nothing can be built on its plaza (`TRADE.plaza` tiles each
 * way from its center tile), but anyone may walk across it.
 */
export interface TradePost {
  id: number;
  /** The center of its middle tile. */
  x: number;
  y: number;
}

/** What lies under a ruin (#64): gold, a technology, a map of the whole land, or a relic. */
export type RuinFind = 'hoard' | 'lore' | 'map' | 'relic';

/**
 * Ancient ruins (#64): a site out in the wilds that citizens dig, once. It belongs to nobody and can't
 * be harmed; nothing is built right beside it, but anyone may walk across it.
 */
/** Foundations of a fallen building a reclaiming people may raise again cheaply (`RECLAIM`, `reclaim.ts`). */
export interface Fallen {
  owner: number;
  type: BuildingType;
  tx: number;
  ty: number;
  /** The tick the memory fades. */
  until: number;
}

export interface Ruin {
  id: number;
  /** The center of its tile. */
  x: number;
  y: number;
  /** What lies beneath, decided by the seed. */
  find: RuinFind;
  /** Digging done so far, in ticks of one citizen's work. */
  dug: number;
  /** The player who dug it out, or -1 while it stands. */
  by: number;
}

/** A landmark's kind (contested landmarks): what its keeper gets besides the land round it. */
export type LandmarkKind = 'spring' | 'crag' | 'cairn' | 'flint' | 'grove' | 'ford';

/**
 * A contested landmark: a place out between the towns that belongs to whoever's people hold the ground
 * round it, alone, long enough. It can't be harmed or built on, only held, lost and taken back.
 */
export interface Landmark {
  id: number;
  /** The center of its tile. */
  x: number;
  y: number;
  kind: LandmarkKind;
  /** The player who keeps it, or -1. */
  owner: number;
  /** How firmly it is held (or, while nobody keeps it, how far `by` has got), in ticks of claiming. */
  claim: number;
  /** The player whose people are claiming it while nobody keeps it, or -1. */
  by: number;
}

export interface Animal {
  id: number;
  /** Deer bolt; mammoths and wolves (#171) fight; sheep (#308) belong to a people and graze by its camp. */
  kind: 'deer' | 'mammoth' | 'wolf' | 'boar' | 'sheep' | 'raider';
  x: number;
  y: number;
  px: number;
  py: number;
  fx: number;
  fy: number;
  hp: number;
  /** Grazing, wandering a little, running away, or (mammoths and wolves) fighting `foe`. */
  state: 'graze' | 'walk' | 'flee' | 'fight';
  /** Ticks left in this state. */
  t: number;
  tx: number;
  ty: number;
  homeX: number;
  homeY: number;
  hurt: number;
  /** The unit a fighting beast is after (#171). */
  foe?: number;
  /** Ticks until a fighting beast can strike again. */
  cool?: number;
  /** Deer that graze together drift together: the herd's id, and where it began (old saves have neither). */
  herd?: number;
  origX?: number;
  origY?: number;
  /** The deer a hunting wolf is running down. */
  prey?: number;
  /** The carcass tile a wolf has scented and is eating (carrion). */
  scav?: number;
  /**
   * A sheep (#308): the people it belongs to; milk in its udder and fat on its bones; the tick a lamb grows
   * up (absent once grown); the rival unit leading it home after rustling it; ticks to its next bite; and
   * whether it went hungry at its last bite (no grass left in reach of its camp). Its camp is `homeX`, `homeY`.
   */
  owner?: number;
  milk?: number;
  fat?: number;
  lamb?: number;
  lead?: number;
  bite?: number;
  hungry?: boolean;
  /** The tick a citizen last milked it: it stands still for them. */
  held?: number;
}

export interface Shot {
  id: number;
  owner: number;
  kind: 'stone' | 'arrow' | 'bolt' | 'bullet' | 'spear' | 'boulder' | 'ball' | 'bomb';
  /** Where it was loosed from, and the target it flies at. */
  x0: number;
  y0: number;
  target: number;
  /** Where the target was when last seen (if it dies, the shot lands there). */
  tx: number;
  ty: number;
  t: number;
  dur: number;
  damage: number;
  /** Damage spreads to enemies within this radius where it lands (catapults, cannons). */
  splash: number;
  /** For splash: what the shooter is (for the counter bonus on others hit). */
  from: UnitType | null;
  /** Shot at an animal (a hunter's spear). */
  animal: boolean;
  /** Fired from an aircraft (for drawing it from the sky). */
  fromAir?: boolean;
  /** The unit that loosed it, to credit a kill (a missing or fallen shooter earns none). */
  src?: number;
}

export interface PlayerStats {
  gathered: number;
  trained: number;
  kills: number;
  losses: number;
  built: number;
  razed: number;
  converted: number;
  techs: number;
  /** Gold brought home by traders. */
  traded: number;
  /** Bog iron dug (#39); absent in older saves. */
  iron?: number;
  /** Rare ore mined and paid in, by kind (#356 s3); absent in older saves. A road's ore door counts it. */
  mined?: Partial<Record<RareId, number>>;
  /** Gold brought in by relics kept in Temples (#49); absent in older saves. */
  relicGold?: number;
  /** Fish landed by boats (the Age of Sail's deed); absent in older saves. */
  fished?: number;
  /** Beacons lit on the people's towers, relays included (the Age of Lightning's deed, #231); absent in older saves. */
  beacons?: number;
  /** Meat butchered by hunters (the Age of the Steppe's deed, #297); absent in older saves. */
  hunted?: number;
  /** Milk drawn from the flock by citizens (the Age of the Horde's deed, #318); absent in older saves. */
  milked?: number;
  /** Gold taken as tribute by riders standing in rivals' land (#318); absent in older saves. */
  tribute?: number;
  /** Gold the Silk Road's caravans earned for the ground the camp covered while they were out (#326); absent in older saves. */
  caravan?: number;
  /** Gold taken in tolls from rival traders crossing the people's land (#334); absent in older saves. */
  toll?: number;
  /** Enemy units (not buildings) the people's forces have slain: the Path of Blood's deeds (#299); absent in older saves. */
  slain?: number;
  /** Gold taken as plunder from the enemy dead (#299); absent in older saves. */
  plunder?: number;
  /** Gold paid in wages to hired swords (the Age of Merchants); absent in older saves. */
  wages?: number;
  /** Foot soldiers trained at War Camps: the deed of the Age of Total War (#313); absent in older saves. */
  campTrained?: number;
  /** Citizens called to arms at War Camps in the Age of Total War (#313); absent in older saves. */
  calledUp?: number;
  /** Blood drawn at Drain Rigs, from the slain and by the levy (#355); absent in older saves. */
  blood?: number;
  /** Citizens given to the levy at Drain Rigs (#355); absent in older saves. */
  levied?: number;
  /** Enemy citizens taken captive at Drain Rigs and altars (#355); absent in older saves. */
  captives?: number;
  /** Soldiers grafted at Transfusion Stations (#355 s3); absent in older saves. */
  grafted?: number;
  /** Of those, the grafts quenched in blood-iron (#356); absent in older saves. */
  quenched?: number;
  /** Health the Blood-rite's altars mended with blood (#355 s2); absent in older saves. */
  riteMended?: number;
  /** Enemies sacrificed by the Blood-rite's priests (#355 s4); absent in older saves. */
  sacrificed?: number;
  /** Curses the Blood-rite's priests have laid (#355 s4); absent in older saves. */
  cursed?: number;
}

/** One sample of a player's state for the post-game timeline. */
export interface HistoryPoint {
  tick: number;
  pop: number;
  military: number;
  gathered: number;
  score: number;
  epoch: number;
}

/** The cards of tidings that come to the fire in the Stone Age (#443). */
export type TidingId = 'traveller' | 'hunter' | 'tale' | 'storm' | 'fever';

export interface Player {
  id: number;
  name: string;
  color: string;
  civ: CivId;
  /** Controlled by the computer, at this level; null for a person. */
  ai: Difficulty | null;
  team: number;
  res: Stock;
  /** Blood in store (#355): drawn at Drain Rigs from the enemy dead and by the levy; absent until the first drop. */
  blood?: number;
  /** Rare ores mined (#356); absent until the first is brought home. */
  rare?: Partial<Record<RareId, number>>;
  epoch: number;
  /** The age within the web (#37); its tier is `epoch`. Absent, or out of step with `epoch`, means the trunk age of `epoch` (see `ageOf`). */
  age?: AgeId;
  /** Side ages this people has stood in, in the order first entered (heirlooms, #224); absent if none. The age it stands in counts too (see `hasWalked`). */
  walked?: AgeId[];
  /** Epochs whose great work this player has called (seed #133); absent if none. */
  works?: number[];
  /** The Way this people chose in the Stone Age (#336); absent if none. */
  way?: WayId;
  /** The Way was deepened in the Bronze Age (#338). */
  deep?: boolean;
  /** The Bronze Age vow has been made, deepening or turning (#338). */
  vowed?: boolean;
  /** Tick the great work now at hand ends; absent when none is. */
  workEnd?: number;
  /** A card of tidings at the fire waiting on an answer (#443): which, which draw, and the tick it passes unanswered. Absent when none waits. */
  tiding?: { card: TidingId; draw: number; until: number };
  /** The cards of tidings that have come to this people, in order (#443); absent before the first. */
  told?: TidingId[];
  /** Tick its last step back (#47) landed, for the cooldown; absent if it never stepped back. */
  backAt?: number;
  techs: TechId[];
  /**
   * Researched, but above the tier a step back (#47) took the people down to: idle until they climb
   * again, when they return to `techs` without being paid for twice. Absent when there are none.
   */
  suspended?: TechId[];
  /** Bumped when techs or the epoch change, so cached unit stats are worked out again. */
  statsVersion: number;
  pop: number;
  cap: number;
  /** How many of this player's eyes see each tile now. */
  vis: Uint8Array;
  /** Tiles this player has ever seen. */
  seen: Uint8Array;
  defeated: boolean;
  stats: PlayerStats;
  history: HistoryPoint[];
  startX: number;
  startY: number;
  /** Tick of the last "under attack" alert, so they come at most every few seconds. */
  alert: number;
  /** Tick of the last Town Center alert (#452). */
  tcAlert?: number;
  /** The tick by which a people with no Town Center must have a new one under way, or be lost (#452). */
  heartless?: number;
}

export type GameEvent =
  | { k: 'swing'; id: number; target: number; x: number; y: number; owner: number; ranged: boolean; type: UnitType | BuildingType }
  | { k: 'hit'; target: number; x: number; y: number; damage: number; owner: number; building: boolean }
  | { k: 'splash'; x: number; y: number; owner: number; kind: Shot['kind'] }
  | { k: 'die'; id: number; owner: number; type: UnitType | BuildingType; x: number; y: number; building: boolean; size: number; epoch: number; fx: number; fy: number }
  | { k: 'animalDie'; id: number; x: number; y: number; fx: number; fy: number; kind?: Animal['kind'] }
  /** A mammoth or wolf turns to fight (#171): its cry. */
  | { k: 'wildCry'; id: number; kind: Animal['kind']; x: number; y: number }
  /** A mammoth gores, or a wolf bites, someone. */
  | { k: 'wildStrike'; id: number; kind: Animal['kind']; target: number; x: number; y: number }
  /** A raider camp (own pitch) stands empty: whose people cleared it, and the plunder they took. */
  | { k: 'campCleared'; owner: number; x: number; y: number; gold: number; food: number; wood: number }
  | { k: 'trained'; id: number; owner: number; type: UnitType }
  | { k: 'researched'; owner: number; tech: TechId }
  /** A survey's answer (#39): whether what it looks for lies anywhere in this world. */
  | { k: 'survey'; owner: number; tech: TechId; found: boolean }
  /**
   * Tidings at the fire (#443): a card came (`come`), was answered by paying (`took`), was passed by (`passed`,
   * answered or faded), or a passed storm or fever struck (`struck`, `n` houses or citizens hit) or spared them (`spared`).
   */
  | { k: 'tiding'; owner: number; card: TidingId; how: 'come' | 'took' | 'passed' | 'struck' | 'spared'; n?: number; x?: number; y?: number }
  /** A ruin dug out (#64): what came up, and for lore, which technology. */
  | { k: 'sortie'; owner: number; id: number; x: number; y: number; what: 'home' | 'lost' }
  | { k: 'fair'; owner: number }
  | { k: 'joust'; owner: number; x: number; y: number; gold: number }
  | { k: 'convoy'; owner: number; x: number; y: number }
  | { k: 'vigil'; owner: number; x: number; y: number; priests: number }
  | { k: 'foundation'; owner: number; type: BuildingType; x: number; y: number; what: 'kept' | 'raised' }
  | { k: 'ruin'; id: number; owner: number; find: RuinFind; tech?: TechId; x: number; y: number }
  /** A landmark changed hands: `owner` keeps it now (-1: nobody, after `from` was driven off). */
  | { k: 'landmark'; id: number; kind: LandmarkKind; owner: number; from: number; x: number; y: number }
  /** Rivals began to pull a held landmark away from its keeper. */
  | { k: 'landmarkThreat'; id: number; kind: LandmarkKind; owner: number; x: number; y: number }
  | { k: 'placed'; id: number; owner: number; type: BuildingType }
  | { k: 'built'; id: number; owner: number; type: BuildingType }
  | { k: 'epoch'; owner: number; epoch: number; age?: AgeId; back?: boolean }
  | { k: 'deliver'; owner: number; res: Res; amount: number; x: number; y: number; rare?: RareId }
  | { k: 'work'; id: number; owner: number; act: Act; x: number; y: number }
  | { k: 'depleted'; tile: number }
  | { k: 'season'; i: number }
  /** A payday for hired swords (the Age of Merchants): how many went unpaid, and how many of those walked off. */
  | { k: 'wages'; owner: number; late: number; gone: number }
  | { k: 'rank'; id: number; owner: number; x: number; y: number; rank: number }
  /** Gold taken from an enemy unit slain by a people with a plunder share (the Path of Blood, #299). */
  | { k: 'plunder'; owner: number; x: number; y: number; gold: number }
  /**
   * Blood drawn at a Drain Rig (#355): from an enemy who fell near it, or from citizens given to the levy; in Hemocraft (s2) also
   * bled from a living enemy standing by a rig (`drain`, at the bled), and in the Blood-rite from the fallen near a Temple.
   */
  | { k: 'blood'; owner: number; x: number; y: number; n: number; how: 'slain' | 'levy' | 'drain' | 'sacrifice' | 'beast' | 'flock' | 'captive' }
  /** A captive (#355): an enemy citizen `taken` alive into a rig or altar at `x, y`, `freed` when it fell, or `spent`. `from` is its people. */
  | { k: 'captive'; owner: number; from: number; x: number; y: number; what: 'taken' | 'freed' | 'spent' }
  /** A soldier grafted at a Transfusion Station (#355 s3), or a graft run dry far from every Station (`crash`). */
  | { k: 'graft'; owner: number; id: number; x: number; y: number; how: 'made' | 'crash' }
  /** A War Camp left without its soldiers (#303): it burns after a grace, or at once if its people left the path (`struck`). */
  /** Citizens called up at a War Camp (#313): each became the foot soldier `id` where it stood. */
  | { k: 'callUp'; owner: number; camp: number; ids: number[]; x: number; y: number }
  /** Riders of a horde (#318) took `gold` in tribute from `from`, standing in its land: `ids` are the riders counted. */
  | { k: 'tribute'; owner: number; from: number; gold: number; ids: number[]; x: number; y: number }
  /** A rival trader of `from`'s paid `owner` a toll of `gold` for safe passage across its land (#334). */
  | { k: 'toll'; owner: number; from: number; gold: number; id: number; x: number; y: number }
  | { k: 'campAlone'; owner: number; id: number; x: number; y: number; struck: boolean }
  | { k: 'alert'; owner: number; x: number; y: number; building: boolean; /** The Town Center is struck. */ heart?: boolean; wild?: Animal['kind']; /** A rival's soldiers fell on a citizen out hunting. */ hunter?: boolean }
  | { k: 'converted'; id: number; from: number; to: number; x: number; y: number }
  /** A building chanted over to a pilgrim people (#209). */
  | { k: 'consecrated'; id: number; from: number; to: number; x: number; y: number; type: BuildingType; size: number }
  /** Rival priests have begun chanting at one of `owner`'s buildings (#209). */
  | { k: 'chanting'; owner: number; by: number; id: number; type: BuildingType; x: number; y: number }
  | { k: 'healed'; id: number; x: number; y: number }
  /** A Blood-rite priest's rite finished (#355 s4): the victim `id` sacrificed where it stood (`n` blood), or a curse laid on the ground at x, y (`n` souls under it). */
  | { k: 'rite'; how: 'sacrifice' | 'curse'; owner: number; against: number; id: number; x: number; y: number; n: number }
  | { k: 'garrison'; owner: number; building: number; inside: boolean }
  | { k: 'bell'; owner: number; ring: boolean }
  | { k: 'cry'; owner: number; id: number; x: number; y: number; n: number }
  | { k: 'beacon'; owner: number; building: number; x: number; y: number; on: boolean }
  /** A steppe people struck camp (#297): a building packed onto a wagon, or a wagon pitched as a building. */
  | { k: 'camp'; owner: number; id: number; type: BuildingType; x: number; y: number; pitched: boolean }
  /**
   * The flock (#308): a lamb born or raised, a sheep taken by wolves, rustled away (`owner` lost it to `by`),
   * or a flock gone hungry on bare ground.
   */
  | { k: 'flock'; owner: number; what: 'born' | 'raised' | 'wolf' | 'rustled' | 'hungry'; x: number; y: number; by?: number }
  /** A Coil Tower's bolt (the Age of Lightning, #231): from the tower through each enemy it struck, as x, y pairs. */
  | { k: 'arc'; owner: number; building: number; pts: number[] }
  /** A great work was called (`on`) or ran out (seed #133). */
  | { k: 'greatWork'; owner: number; on: boolean }
  | { k: 'way'; owner: number; way: WayId; deep?: boolean; turned?: boolean }
  | { k: 'wonder'; owner: number; id: number; x: number; y: number; ticks: number }
  /** A Wonder's foundation was laid (#361): every player hears of it, so the whole build can be contested. */
  | { k: 'wonderRising'; owner: number; id: number; x: number; y: number }
  | { k: 'trade'; owner: number; res: Res; buy: boolean }
  | { k: 'defeated'; owner: number }
  | { k: 'heartless'; owner: number; left: number }
  | { k: 'over'; winner: number; how: 'conquest' | 'wonder' | 'relics' | 'lands' | 'resign' | 'time' | 'scenario' }
  /** A relic picked up, kept in a Temple, or let go where it lies. */
  | { k: 'relic'; id: number; owner: number; what: 'taken' | 'kept' | 'dropped'; x: number; y: number }
  /** One side now keeps every relic (its countdown starts), or no longer does (`team` -1). */
  | { k: 'relicHold'; team: number; ticks: number }
  | { k: 'landHold'; team: number; ticks: number }
  /** A trader took on its gold at a trading post (`loaded`), or paid it in at its Market (`paid`). */
  | { k: 'caravan'; id: number; owner: number; what: 'loaded' | 'paid'; share?: boolean; amount: number; x: number; y: number; moved?: number; bonus?: number }
  /** A scenario's story beat (a raid, a gift) and an objective completed. */
  | { k: 'story'; title: string; text: string; bad: boolean }
  | { k: 'objective'; index: number }
  | { k: 'refused'; owner: number; why: string }
  | { k: 'left'; owner: number }
  | { k: 'shot'; owner: number; kind: Shot['kind']; x: number; y: number; air?: boolean };

export interface GameState {
  tick: number;
  seed: number;
  size: MapSize;
  mapType: MapType;
  mode: GameMode;
  /** Regicide: each player's King (a unit id), or 0. */
  kings: number[];
  w: number;
  h: number;
  /** Per tile: T_GRASS, T_SAND, T_WATER or T_ROCK. */
  terrain: Uint8Array;
  /** Height at each tile corner, (w + 1) × (h + 1). */
  height: Float32Array;
  /** Per tile: R_* resource and how much is left. */
  res: Uint8Array;
  amount: Int32Array;
  /** Per tile: B_* bits; any bit but B_GATE means it can't be walked; a gate lets its owner's team through. */
  block: Uint8Array;
  /** Per tile: the building standing there (farms included), or 0. */
  bldAt: Int32Array;
  /** Per tile: the team whose gate stands there, or -1. */
  gateTeam: Int8Array;
  /** Bumped whenever a tile's walkability changes, so cached distance fields know to refresh. */
  blockVersion: number;
  players: Player[];
  /** Every unit and building, in the order they were made (ids rise). */
  ents: Ent[];
  byId: Map<number, Ent>;
  animals: Animal[];
  /** Carcasses that are spoiling: the tile, the tick it fell, what it held (old saves have none). */
  carcasses?: { tile: number; born: number; full: number }[];
  /** Per tile: the tick cropped grass grows back (#308), made when the first sheep is; absent until then. */
  grazed?: Int32Array;
  relics: Relic[];
  /** The team keeping every relic in its temples, or -1; and ticks left before it wins (-1 when none). */
  relicTeam: number;
  relicTimer: number;
  /** The team keeping every landmark, or -1; and ticks left before it wins (-1 when none). Old saves have neither. */
  landTeam?: number;
  landTimer?: number;
  /** The trading posts out on the map. */
  posts: TradePost[];
  /** Ancient ruins (#64); absent in older saves and in campaign chapters (none). */
  ruins?: Ruin[];
  /** Foundations of fallen buildings a reclaiming people may raise again (`reclaim.ts`); absent until one falls. */
  fallen?: Fallen[];
  /** Contested landmarks; absent in older saves and in campaign chapters (none). */
  landmarks?: Landmark[];
  /** Whether this world holds bog iron (#39), decided by the seed; absent in older saves (none). */
  bogIron?: boolean;
  /** Which rare ores this world holds (#356), decided by the seed; absent in older saves (none). */
  rares?: RareId[];
  /** Cave mouths (#356); absent in older saves and campaigns (none). */
  caves?: Cave[];
  nextId: number;
  shots: Shot[];
  rng: number;
  /** Gold for 100 of each resource at the market; it rises as people buy and falls as they sell. */
  market: Record<'food' | 'wood' | 'stone', number>;
  /** No fighting between players until this tick (a peace treaty set before the match). */
  peaceUntil: number;
  /** Ticks a finished wonder must stand to win. */
  wonderTime: number;
  /** The computer opponents' memories, kept in the state so a saved match plays on the same. */
  ai: Record<number, AiMemory>;
  /** What happened this tick, for sound and effects. Cleared at the start of every tick. */
  events: GameEvent[];
  /** The campaign scenario being played, or null/absent in an ordinary match. */
  scenario?: ScenarioRun | null;
  /** -1 while the match goes on; the winning team after. */
  winner: number;
  over: boolean;
}

export interface AiMemory {
  next: number;
  wave: number;
  attacking: boolean;
  /** Where the army gathers between attacks. */
  muster: { x: number; y: number } | null;
  /** Last tick a building of each kind was ordered, so it waits for the first to go up. */
  ordered: Partial<Record<BuildingType, number>>;
  unitTurn: number;
  /** Tick the town bell was rung, or -1. */
  bell: number;
  /** Tick it last looked for a dock site and found none (so it doesn't look every turn). */
  dockless?: number;
  /** Tick its bombers last set out. */
  sortie?: number;
  /** A sea landing under way: the transport, the soldiers aboard (or boarding) and how far along it is. */
  landing?: { ship: number; ids: number[]; since: number; phase: 'load' | 'sail' };
  /** Tick its last landing set out. */
  landed?: number;
  /** Tick a Blood-rite priest began holding a curse for the army to pin the pack (#439); cleared when it casts or nothing is held. */
  riteWait?: number;
  /** Its traders on the road last turn: trader id → post id (to notice the ones lost on the way). */
  caravans?: Record<number, number>;
  /** Post id → the tick a trader was last lost on the road to it, so it keeps off that road a while. */
  roadLost?: Record<number, number>;
  /** Ruin id → the tick its diggers last fled rival soldiers there (#64). */
  ruinFled?: Record<number, number>;
  /** A citizen sent to claim a landmark nobody keeps: which landmark, which citizen, since when. */
  markWalker?: { id: number; unit: number; since: number };
  /** Soldiers sent to take (or take back) a landmark, held there until it is the computer's. */
  markGuard?: { id: number; ids: number[]; since: number };
  /** Soldiers sent along on a far mammoth hunt; once idle (the beast down) they walk home. */
  huntEscort?: number[];
  /** Soldiers sent along with the landmark walker to a far landmark, until the walk is over. */
  markEscort?: { unit: number; mark: number; ids: number[]; until?: number };
  /**
   * The side ages it has made up its mind about (#50): true to walk the road there once it opens,
   * false to pass it by. Decided once each, so it doesn't waver from one turn to the next.
   */
  roads?: Partial<Record<AgeId, boolean>>;
  /** Tick it last lit a beacon toward the Age of Lightning's deed (#231). */
  zap?: number;
  /** Tick it began holding its Town Center for a side road's last deeds, so it holds only so long. */
  waiting?: number;
  /**
   * Since when, and in which epoch, its army has been short of the next wave after a first wave went out
   * (#113): army-first holds an advance back only `armyWait` seconds of it.
   */
  short?: { since: number; epoch: number };
  /** A band out after rival citizens working far from home (#260): its soldiers, their quarry and since when. */
  /** With `look`, the band is walking to a rival Hunting Camp it has seen, to find who works there (`target` -1 until it does). */
  prowl?: { ids: number[]; target: number; since: number; look?: number; burn?: number };
  /**
   * The Path of Blood (#307): since when it holds the Warband for plunder (-1 once done), when it entered Iron and Blood, and when it last pitched a War Camp.
   * Hemocraft (#355 s5): where rival living soldiers last came near home (`foe`), and when it last sent citizens to the levy (`levy`).
   */
  blood?: { hold?: number; since?: number; camp?: number; muster?: number; foe?: { x: number; y: number }; levy?: number; war?: number; fork?: number };
  /** Tick its last band came home from prowling. */
  prowled?: number;
  /**
   * The steppe (#320): when it entered the Age of the Steppe, when it last struck camp, the pasture it means to
   * move to while its Town Center's queue empties (`pack`), and, while the wagon is on the road, where it is
   * driving (with the tick it set out) and the camp it left.
   */
  steppe?: { band?: number[]; at?: { x: number; y: number }; out?: number; recalled?: number; horde?: number; since?: number; struck?: number; pack?: { x: number; y: number; at: number }; to?: { x: number; y: number; at: number }; from?: { x: number; y: number } };
}

/** Orders that can be given with Shift held to queue them after the current one. */
type Queued = { queue?: boolean };

export type Command =
  | ({ t: 'move'; p: number; ids: number[]; x: number; y: number; amove?: boolean } & Queued)
  | ({ t: 'attack'; p: number; ids: number[]; target: number; spread?: boolean } & Queued)
  | ({ t: 'gather'; p: number; ids: number[]; tile: number; spread?: boolean } & Queued)
  /** Right-click on your own building: help build it, farm it, drop off resources there or shelter in it. */
  | ({ t: 'work'; p: number; ids: number[]; target: number } & Queued)
  | ({ t: 'build'; p: number; ids: number[]; type: BuildingType; tx: number; ty: number } & Queued)
  /** A line of wall from one tile to another (gates go in with `type: 'gate'` one at a time). */
  | ({ t: 'wall'; p: number; ids: number[]; x0: number; y0: number; x1: number; y1: number } & Queued)
  | ({ t: 'hunt'; p: number; ids: number[]; target: number } & Queued)
  | ({ t: 'convert'; p: number; ids: number[]; target: number; rite?: 'sacrifice' | 'curse' } & Queued)
  | ({ t: 'garrison'; p: number; ids: number[]; target: number } & Queued)
  /** Priests: fetch a relic and take it to the nearest Temple. */
  | ({ t: 'relic'; p: number; ids: number[]; target: number } & Queued)
  /** Traders: run the road between their Market and a trading post. */
  | ({ t: 'route'; p: number; ids: number[]; post: number } & Queued)
  /** Go aboard a transport ship. */
  | ({ t: 'board'; p: number; ids: number[]; target: number } & Queued)
  /** Transports: sail to the shore nearest a point and put everyone ashore. */
  | ({ t: 'unload'; p: number; ids: number[]; x: number; y: number } & Queued)
  | { t: 'ungarrison'; p: number; building: number }
  | { t: 'bell'; p: number; ring: boolean }
  | { t: 'beacon'; p: number; building: number }
  /** Call citizens to arms at a War Camp in the Age of Total War (#313): up to `n`, the nearest first. */
  | { t: 'callUp'; p: number; building: number; n?: number }
  /** Strike camp (#297): pack a Town Center or House onto a wagon. */
  | { t: 'pack'; p: number; building: number }
  /** Pitch camp (#297): wagons set down the building they carry where they stand. */
  | { t: 'pitch'; p: number; ids: number[] }
  /** Citizens milk a sheep of their flock (#308). */
  | ({ t: 'milk'; p: number; ids: number[]; target: number } & Queued)
  /** A Town Center raises a lamb for the flock (#308). */
  | { t: 'lamb'; p: number; building: number }
  /** A hero's Rallying Cry. */
  | { t: 'cry'; p: number; id: number }
  /** Call the people's great work (seed #133), once in each epoch. */
  | { t: 'greatWork'; p: number }
  | { t: 'way'; p: number; way: WayId }
  /** A vow (#338): deepen the Way (no `way`), or turn to `way`. */
  | { t: 'vow'; p: number; way?: WayId }
  | { t: 'stance'; p: number; ids: number[]; stance: Stance }
  | { t: 'train'; p: number; building: number; unit: UnitType }
  | { t: 'research'; p: number; building: number; tech: TechId }
  | { t: 'cancel'; p: number; building: number; index: number }
  /** Into the next age: `to` picks a road (#37); without it, the trunk's next epoch. */
  | { t: 'advance'; p: number; building: number; to?: AgeId }
  /** Step back an age (#47), to the trunk age one tier down. */
  | { t: 'stepBack'; p: number; building: number }
  | { t: 'rally'; p: number; building: number; x: number; y: number }
  /** A rare ore (#356) can only be sold, a lot of it for gold at a flat price. */
  | { t: 'trade'; p: number; res: 'food' | 'wood' | 'stone' | RareId; buy: boolean }
  | { t: 'stop'; p: number; ids: number[] }
  | { t: 'delete'; p: number; ids: number[] }
  | { t: 'resign'; p: number }
  /** Priests set down the relics they carry, where they stand. */
  | { t: 'dropRelic'; p: number; ids: number[] }
  /** Citizens dig at an ancient ruin (#64). */
  | ({ t: 'dig'; p: number; ids: number[]; target: number } & Queued)
  /** Answer the card of tidings waiting at the fire (#443): `take` pays its price, otherwise it is passed by. */
  | { t: 'tiding'; p: number; card: TidingId; take: boolean }
  /** A player left an online match: the computer takes over their people. */
  | { t: 'leave'; p: number };

