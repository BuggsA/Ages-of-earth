/**
 * The shapes of the simulation. Everything here is plain data advanced by `step` in fixed ticks, so the
 * same commands on the same seed always give the same match (the basis for lockstep online play later).
 */

export type Res = 'food' | 'wood' | 'stone' | 'gold';
export const RES: readonly Res[] = ['food', 'wood', 'stone', 'gold'];
export type Cost = Partial<Record<Res, number>>;
export type Stock = Record<Res, number>;

export type UnitType = 'citizen' | 'infantry' | 'ranged' | 'cavalry';
export type BuildingType = 'towncenter' | 'house' | 'storehouse' | 'farm' | 'barracks' | 'range' | 'stable' | 'tower';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type MapSize = 'small' | 'medium' | 'large';

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

/** Why a tile can't be walked: bits of `block`. */
export const B_TERRAIN = 1;
export const B_RES = 2;
export const B_BUILDING = 4;

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
  | { k: 'move'; x: number; y: number; amove: boolean }
  /** Fight a unit or building. `auto` when picked by the unit itself (it gives up sooner); `then` resumes an attack-move. */
  | { k: 'attack'; target: number; auto: boolean; then: { x: number; y: number } | null }
  /** Gather a resource tile: walk there, work it, carry the load to a drop site, and back. */
  | { k: 'gather'; tile: number; res: Res; phase: 'go' | 'work' | 'drop' }
  | { k: 'build'; target: number }
  | { k: 'farm'; target: number; phase: 'go' | 'work' | 'drop' }
  /** Carry what is held to a drop site, then go idle. */
  | { k: 'deliver' };

/** What a unit is visibly doing, for the renderer's animation. */
export type Act = 'idle' | 'walk' | 'attack' | 'chop' | 'mine' | 'forage' | 'farm' | 'build';

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
  /** The gathering or farming a citizen was pulled off to build, to go back to afterward. */
  resume: Order | null;
  act: Act;
  /** Tick of the last swing or shot (for the strike animation). */
  swing: number;
  /** Tick it last took damage. */
  hurt: number;
  /** Tick it was made (for the renderer's entrance). */
  born: number;
}

export interface TrainItem {
  unit: UnitType;
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
  hurt: number;
  born: number;
}

export type Ent = Unit | Building;

export interface Shot {
  id: number;
  owner: number;
  kind: 'stone' | 'arrow' | 'bolt' | 'bullet';
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
}

export interface PlayerStats {
  gathered: number;
  trained: number;
  kills: number;
  losses: number;
  built: number;
  razed: number;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  /** Controlled by the computer, at this level; null for a person. */
  ai: Difficulty | null;
  team: number;
  res: Stock;
  epoch: number;
  pop: number;
  cap: number;
  /** How many of this player's eyes see each tile now. */
  vis: Uint8Array;
  /** Tiles this player has ever seen. */
  seen: Uint8Array;
  defeated: boolean;
  stats: PlayerStats;
  startX: number;
  startY: number;
  /** Tick of the last "under attack" alert, so they come at most every few seconds. */
  alert: number;
}

export type GameEvent =
  | { k: 'swing'; id: number; target: number; x: number; y: number; owner: number; ranged: boolean; type: UnitType | BuildingType }
  | { k: 'hit'; target: number; x: number; y: number; damage: number; owner: number; building: boolean }
  | { k: 'die'; id: number; owner: number; type: UnitType | BuildingType; x: number; y: number; building: boolean; size: number; epoch: number; fx: number; fy: number }
  | { k: 'trained'; id: number; owner: number; type: UnitType }
  | { k: 'placed'; id: number; owner: number; type: BuildingType }
  | { k: 'built'; id: number; owner: number; type: BuildingType }
  | { k: 'epoch'; owner: number; epoch: number }
  | { k: 'deliver'; owner: number; res: Res; amount: number; x: number; y: number }
  | { k: 'work'; id: number; owner: number; act: Act; x: number; y: number }
  | { k: 'depleted'; tile: number }
  | { k: 'alert'; owner: number; x: number; y: number; building: boolean }
  | { k: 'defeated'; owner: number }
  | { k: 'over'; winner: number }
  | { k: 'refused'; owner: number; why: string }
  | { k: 'shot'; owner: number; kind: Shot['kind']; x: number; y: number };

export interface GameState {
  tick: number;
  seed: number;
  size: MapSize;
  w: number;
  h: number;
  /** Per tile: T_GRASS, T_SAND, T_WATER or T_ROCK. */
  terrain: Uint8Array;
  /** Height at each tile corner, (w + 1) × (h + 1). */
  height: Float32Array;
  /** Per tile: R_* resource and how much is left. */
  res: Uint8Array;
  amount: Int32Array;
  /** Per tile: B_* bits; any bit means it can't be walked. */
  block: Uint8Array;
  /** Per tile: the building standing there (farms included), or 0. */
  bldAt: Int32Array;
  /** Bumped whenever a tile's walkability changes, so cached distance fields know to refresh. */
  blockVersion: number;
  players: Player[];
  /** Every unit and building, in the order they were made (ids rise). */
  ents: Ent[];
  byId: Map<number, Ent>;
  nextId: number;
  shots: Shot[];
  rng: number;
  /** What happened this tick, for sound and effects. Cleared at the start of every tick. */
  events: GameEvent[];
  /** -1 while the match goes on; the winning team after. */
  winner: number;
  over: boolean;
}

export type Command =
  | { t: 'move'; p: number; ids: number[]; x: number; y: number; amove?: boolean }
  | { t: 'attack'; p: number; ids: number[]; target: number }
  | { t: 'gather'; p: number; ids: number[]; tile: number }
  /** Right-click on your own building: help build it, farm it, or drop off resources there. */
  | { t: 'work'; p: number; ids: number[]; target: number }
  | { t: 'build'; p: number; ids: number[]; type: BuildingType; tx: number; ty: number }
  | { t: 'train'; p: number; building: number; unit: UnitType }
  | { t: 'cancel'; p: number; building: number; index: number }
  | { t: 'advance'; p: number; building: number }
  | { t: 'rally'; p: number; building: number; x: number; y: number }
  | { t: 'stop'; p: number; ids: number[] }
  | { t: 'delete'; p: number; ids: number[] }
  | { t: 'resign'; p: number };
