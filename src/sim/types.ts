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
  | 'fisher' | 'warship' | 'transport' | 'fighter' | 'bomber' | 'trader';
/** How a unit gets about: on foot, on the water, or in the air. */
export type Domain = 'land' | 'water' | 'air';
export type BuildingType =
  | 'towncenter' | 'house' | 'storehouse' | 'farm' | 'barracks' | 'range' | 'stable' | 'tower'
  | 'forge' | 'workshop' | 'temple' | 'market' | 'wonder' | 'wall' | 'gate' | 'dock' | 'airfield';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type MapSize = 'small' | 'medium' | 'large';
export type MapType = 'continental' | 'highlands' | 'lakes' | 'forest' | 'plains' | 'sea';
/** Conquest: destroy every rival town. Regicide: each people has a King; lose them and you lose. Deathmatch: start rich. */
export type GameMode = 'conquest' | 'regicide' | 'deathmatch';
export type Stance = 'aggressive' | 'defensive' | 'stand';
export type CivId = 'egyptians' | 'greeks' | 'romans' | 'mongols' | 'chinese' | 'britons';
export type TechId =
  | 'forging' | 'ironCasting' | 'blastFurnace' | 'fletching' | 'bodkin' | 'scaleArmor' | 'chainMail' | 'plateArmor'
  | 'wheelbarrow' | 'handcart' | 'axes' | 'saws' | 'picks' | 'shafts' | 'plow' | 'irrigation' | 'masonry'
  | 'conscription' | 'husbandry' | 'theology' | 'chemistry'
  | 'gillnets' | 'shipwright' | 'rifling' | 'steamEngine' | 'aviation' | 'caravan' | 'banking' | 'pilgrimage';

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
  | { k: 'gather'; tile: number; res: Res; phase: 'go' | 'work' | 'drop' }
  | { k: 'build'; target: number }
  | { k: 'farm'; target: number; phase: 'go' | 'work' | 'drop' }
  /** Carry what is held to a drop site, then go idle. */
  | { k: 'deliver' }
  /** Walk into a building to shelter (and add arrows to its volleys). */
  | { k: 'garrison'; target: number }
  /** Hunt an animal; once it falls, butcher it. */
  | { k: 'hunt'; target: number }
  /** A priest turning an enemy to your side: `done` ticks of chanting so far. */
  | { k: 'convert'; target: number; done: number }
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
  | { k: 'trade'; post: number; market: number; phase: 'go' | 'back' };

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
  /** Enemy soldiers it has defeated (older saves lack it). */
  vet?: number;
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
  rally: { x: number; y: number; tile: number } | null;
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

export interface Animal {
  id: number;
  kind: 'deer';
  x: number;
  y: number;
  px: number;
  py: number;
  fx: number;
  fy: number;
  hp: number;
  /** Grazing, wandering a little, or running away. */
  state: 'graze' | 'walk' | 'flee';
  /** Ticks left in this state. */
  t: number;
  tx: number;
  ty: number;
  homeX: number;
  homeY: number;
  hurt: number;
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

export interface Player {
  id: number;
  name: string;
  color: string;
  civ: CivId;
  /** Controlled by the computer, at this level; null for a person. */
  ai: Difficulty | null;
  team: number;
  res: Stock;
  epoch: number;
  techs: TechId[];
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
}

export type GameEvent =
  | { k: 'swing'; id: number; target: number; x: number; y: number; owner: number; ranged: boolean; type: UnitType | BuildingType }
  | { k: 'hit'; target: number; x: number; y: number; damage: number; owner: number; building: boolean }
  | { k: 'splash'; x: number; y: number; owner: number; kind: Shot['kind'] }
  | { k: 'die'; id: number; owner: number; type: UnitType | BuildingType; x: number; y: number; building: boolean; size: number; epoch: number; fx: number; fy: number }
  | { k: 'animalDie'; id: number; x: number; y: number; fx: number; fy: number }
  | { k: 'trained'; id: number; owner: number; type: UnitType }
  | { k: 'researched'; owner: number; tech: TechId }
  | { k: 'placed'; id: number; owner: number; type: BuildingType }
  | { k: 'built'; id: number; owner: number; type: BuildingType }
  | { k: 'epoch'; owner: number; epoch: number }
  | { k: 'deliver'; owner: number; res: Res; amount: number; x: number; y: number }
  | { k: 'work'; id: number; owner: number; act: Act; x: number; y: number }
  | { k: 'depleted'; tile: number }
  | { k: 'rank'; id: number; owner: number; x: number; y: number; rank: number }
  | { k: 'alert'; owner: number; x: number; y: number; building: boolean }
  | { k: 'converted'; id: number; from: number; to: number; x: number; y: number }
  | { k: 'healed'; id: number; x: number; y: number }
  | { k: 'garrison'; owner: number; building: number; inside: boolean }
  | { k: 'bell'; owner: number; ring: boolean }
  | { k: 'wonder'; owner: number; id: number; x: number; y: number; ticks: number }
  | { k: 'trade'; owner: number; res: Res; buy: boolean }
  | { k: 'defeated'; owner: number }
  | { k: 'over'; winner: number; how: 'conquest' | 'wonder' | 'relics' | 'resign' | 'time' | 'scenario' }
  /** A relic picked up, kept in a Temple, or let go where it lies. */
  | { k: 'relic'; id: number; owner: number; what: 'taken' | 'kept' | 'dropped'; x: number; y: number }
  /** One side now keeps every relic (its countdown starts), or no longer does (`team` -1). */
  | { k: 'relicHold'; team: number; ticks: number }
  /** A trader took on its gold at a trading post (`loaded`), or paid it in at its Market (`paid`). */
  | { k: 'caravan'; id: number; owner: number; what: 'loaded' | 'paid'; amount: number; x: number; y: number }
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
  relics: Relic[];
  /** The team keeping every relic in its temples, or -1; and ticks left before it wins (-1 when none). */
  relicTeam: number;
  relicTimer: number;
  /** The trading posts out on the map. */
  posts: TradePost[];
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
  /** Its traders on the road last turn: trader id → post id (to notice the ones lost on the way). */
  caravans?: Record<number, number>;
  /** Post id → the tick a trader was last lost on the road to it, so it keeps off that road a while. */
  roadLost?: Record<number, number>;
}

/** Orders that can be given with Shift held to queue them after the current one. */
type Queued = { queue?: boolean };

export type Command =
  | ({ t: 'move'; p: number; ids: number[]; x: number; y: number; amove?: boolean } & Queued)
  | ({ t: 'attack'; p: number; ids: number[]; target: number } & Queued)
  | ({ t: 'gather'; p: number; ids: number[]; tile: number } & Queued)
  /** Right-click on your own building: help build it, farm it, drop off resources there or shelter in it. */
  | ({ t: 'work'; p: number; ids: number[]; target: number } & Queued)
  | ({ t: 'build'; p: number; ids: number[]; type: BuildingType; tx: number; ty: number } & Queued)
  /** A line of wall from one tile to another (gates go in with `type: 'gate'` one at a time). */
  | ({ t: 'wall'; p: number; ids: number[]; x0: number; y0: number; x1: number; y1: number } & Queued)
  | ({ t: 'hunt'; p: number; ids: number[]; target: number } & Queued)
  | ({ t: 'convert'; p: number; ids: number[]; target: number } & Queued)
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
  | { t: 'stance'; p: number; ids: number[]; stance: Stance }
  | { t: 'train'; p: number; building: number; unit: UnitType }
  | { t: 'research'; p: number; building: number; tech: TechId }
  | { t: 'cancel'; p: number; building: number; index: number }
  | { t: 'advance'; p: number; building: number }
  | { t: 'rally'; p: number; building: number; x: number; y: number }
  | { t: 'trade'; p: number; res: 'food' | 'wood' | 'stone'; buy: boolean }
  | { t: 'stop'; p: number; ids: number[] }
  | { t: 'delete'; p: number; ids: number[] }
  | { t: 'resign'; p: number }
  /** Priests set down the relics they carry, where they stand. */
  | { t: 'dropRelic'; p: number; ids: number[] }
  /** A player left an online match: the computer takes over their people. */
  | { t: 'leave'; p: number };
