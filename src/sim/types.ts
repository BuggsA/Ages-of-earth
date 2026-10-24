/**
 * The shapes of the simulation. Everything here is plain data advanced by `step` in fixed ticks, so the
 * same commands on the same seed always give the same match (the basis for lockstep online play).
 */

import type { ScenarioRun } from './campaign';
import type { ChannelPlan, DykePlan } from './water';
import type { RouteId } from './data';

export type Res = 'food' | 'wood' | 'stone' | 'gold';
export const RES: readonly Res[] = ['food', 'wood', 'stone', 'gold'];
export type Cost = Partial<Record<Res, number>>;
export type Stock = Record<Res, number>;

export type UnitType =
  | 'citizen' | 'infantry' | 'ranged' | 'cavalry' | 'siege' | 'priest' | 'hero'
  | 'fisher' | 'warship' | 'transport' | 'cog' | 'fighter' | 'bomber' | 'trader'
  /** A packed Town Center or House on the move (the Age of the Steppe, #297). */
  | 'wagon'
  /** Beasts of the Age of the Wild (`docs/wild-road.md`): tamed from the wild, or bred at a Beast Den once a kind is tamed. */
  | 'warwolf' | 'tusker' | 'warmammoth'
  /** The Age of the Water Line (#701 s4): a flat boat with a gun in its bow, that sails the flood and the channels as well as the sea. */
  | 'barge'
  /** The Age of the Hive (`docs/wild-road.md` §3, `hive.ts`): venom darts at the Archery Range, and the Den's Cave Bear. */
  | 'blowpipe' | 'cavebear'
  /** The Age of the Wildwood (`docs/wild-road.md` §4, `wildwood.ts`): an Ent, an old tree woken at the Heart Tree, that roots again. */
  | 'warden'
  /** The Age of Floating Cities (#770): a pontoon district cast off and under tow, its people aboard, until it moors again. */
  | 'tow'
  /**
   * The Age of Leviathans (`docs/wild-road.md` §5a, `leviathans.ts`): bred at a Great Den. A Skywhale, a living airship that carries
   * soldiers over walls and drops seed-bombs; a Behemoth, one titan turtle a people with a Town Center on its back.
   */
  | 'skywhale' | 'behemoth';
/** How a unit gets about: on foot, on the water, or in the air. */
export type Domain = 'land' | 'water' | 'air';
export type BuildingType =
  | 'towncenter' | 'house' | 'storehouse' | 'farm' | 'barracks' | 'range' | 'stable' | 'tower'
  | 'forge' | 'workshop' | 'temple' | 'market' | 'wonder' | 'wall' | 'gate' | 'dock' | 'airfield' | 'huntcamp' | 'warcamp' | 'caravanserai' | 'drainrig' | 'transfusion' | 'bloodtower' | 'snare' | 'prospector' | 'mission' | 'silo' | 'sapling' | 'shaft' | 'dyke' | 'windmill' | 'den'
  /** The Age of the Grove (`docs/wild-road.md`, `grove.ts`): a wall that grows, a one-tile garden, fruit trees. */
  | 'thornwall' | 'garden' | 'orchard'
  /** The Age of the Hive (`docs/wild-road.md` §3, `hive.ts`): a skep of bees set among the trees. */
  | 'hive'
  /** The Age of the Wildwood (`docs/wild-road.md` §4, `wildwood.ts`): the town's soul, one to a people, where Ents are woken. */
  | 'heart'
  /** The Age of the Bloom (`docs/wild-road.md` §5b, `bloom.ts`): a living tower, one to a people, that ripens and slings Bloom Seeds. */
  | 'spire'
  /** The Age of Leviathans (`docs/wild-road.md` §5a, `leviathans.ts`): a great earthen den where Skywhales and the Behemoth are bred. */
  | 'greatden'
  /** The Age of Rivers (#701): a ditch dug from the water, which fills and is gone. */
  | 'channel'
  /** The Age of the Water Line (#701 s4): a gate in a dyke that lets the water out over the low ground, and back. */
  | 'sluice'
  /** The Age of Tides (#739): a raised road over the flats, which becomes tidal ground and is gone; a mill that grinds on the running tide. */
  | 'causeway' | 'tidemill'
  /** The Age of Locks (#701 s5): a swing bridge its own people cross a canal by and ships pass under, and a dam whose turbines drive the workshops by it. */
  | 'bridge' | 'dam'
  /** The Age of Floating Cities (#770): a district on pontoons, moored on open water, that is cast off, towed and moored again. */
  | 'pontoon'
  /** Missile defence (#759 s2): a battery that fires one interceptor at a warhead falling in its cover. */
  | 'battery';
/** Ids keep their behaviour; the names the player sees moved down a step when `gentle` came in (#258): see `AI_LEVELS`. */
export type Difficulty = 'gentle' | 'easy' | 'normal' | 'hard';
export type MapSize = 'small' | 'medium' | 'large';
export type MapType = 'continental' | 'highlands' | 'lakes' | 'forest' | 'plains' | 'sea';
/** Conquest: destroy every rival town. Regicide: each people has a King; lose them and you lose. Deathmatch: start rich. */
export type GameMode = 'conquest' | 'regicide' | 'deathmatch' | 'lords';
export type Stance = 'aggressive' | 'defensive' | 'stand' | 'run';
/** A custom the people live by, chosen in the Stone Age (#336). */
export type WayId = 'hunt' | 'hearth' | 'warband';
/** Homelands (#473): what lies round every town at the start, rolled once per seed. */
export type HomelandId = 'glade' | 'shore' | 'herds' | 'wood';
export type CivId = 'egyptians' | 'greeks' | 'romans' | 'mongols' | 'chinese' | 'britons';
export type TechId =
  | 'forging' | 'ironCasting' | 'blastFurnace' | 'fletching' | 'bodkin' | 'scaleArmor' | 'chainMail' | 'plateArmor'
  | 'wheelbarrow' | 'handcart' | 'axes' | 'saws' | 'picks' | 'shafts' | 'plow' | 'irrigation' | 'masonry'
  | 'conscription' | 'husbandry' | 'theology' | 'chemistry'
  | 'gillnets' | 'shipwright' | 'lighthouse' | 'rifling' | 'steamEngine' | 'aviation' | 'caravan' | 'banking' | 'pilgrimage' | 'drying' | 'hounds' | 'survey' | 'chart' | 'assay' | 'bloomery' | 'ropewalk' | 'credit' | 'litany'
  | 'bellFoundry' | 'ironHulls' | 'jointStock' | 'masonsLodge' | 'stElmo' | 'telegraphy' | 'galvanic' | 'galvanicBlood' | 'militaryOrders' | 'blackPowder' | 'saltCuring' | 'bloodForged' | 'launchControl' | 'interceptors';
/** Where a people stands in the web of ages (#37): the five trunk epochs, and the side ages beside them. */
export type AgeId = 'stone' | 'bronze' | 'middle' | 'gunpowder' | 'industrial' | 'atomic' | 'merchant' | 'iron' | 'pilgrim' | 'fair' | 'reclaimer' | 'sail' | 'aeronaut' | 'lightning' | 'warband' | 'steppe' | 'ironblood' | 'totalwar' | 'horde' | 'silk' | 'hemocraft' | 'bloodrite' | 'fission' | 'fusion' | 'alchemy' | 'sapper' | 'searaider' | 'missions' | 'chariots' | 'golden' | 'dykes' | 'wild' | 'grove' | 'rivers' | 'hive' | 'waterline' | 'tides' | 'wildwood' | 'locks' | 'floating' | 'leviathans' | 'bloom';

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
/** A cockle bed (#767) on the deeper tidal flats: food picked by citizens only while the tide has bared it, back each high water. */
export const R_COCKLE = 11;
export type RareId = 'salt' | 'saltpetre' | 'bloodiron';
export const RARES: readonly RareId[] = ['salt', 'saltpetre', 'bloodiron'];
/** What a Mine Shaft can dig (#681): stone or gold anywhere, a rare ore only over its old workings. */
export type SeamId = 'stone' | 'gold' | RareId;
/** A key resource (#555 spine §3): something only some worlds place that opens an age or a technology. The Prospector's Lodge answers for each. */
export type KeyId = 'bogIron' | RareId | 'ruin';
export const KEYS: readonly KeyId[] = ['bogIron', ...RARES, 'ruin'];
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
  | { k: 'attack'; target: number; auto: boolean; then: { x: number; y: number } | null; back?: Order }
  /**
   * Walk the points in turn, round and round (#454). Soldiers fight what they meet by their stance and come
   * back to the round (`back` on the attack). `miss` counts legs that ended short of their point.
   */
  | { k: 'patrol'; pts: { x: number; y: number }[]; i: number; started: boolean; miss: number }
  /**
   * Go and see (#454): head for the nearest ground its people have never seen, and on to the next when it
   * comes into sight. `x`, `y` is the tile it heads for (-1 before the first); `fails` holds tiles it could
   * not reach, so it doesn't try them again.
   */
  | { k: 'explore'; x: number; y: number; started: boolean; fails: number[]; told?: number }
  /** Gather a resource tile: walk there, work it, carry the load to a drop site, and back. */
  | { k: 'gather'; tile: number; res: Res; phase: 'go' | 'work' | 'drop'; bog?: boolean; rare?: RareId; meat?: boolean; cockle?: boolean }
  | { k: 'build'; target: number }
  | { k: 'farm'; target: number; phase: 'go' | 'work' | 'drop' }
  /** Carry what is held to a drop site, then go idle. */
  | { k: 'deliver' }
  /** Walk into a building to shelter (and add arrows to its volleys). */
  /** `flee` when a citizen ran for shelter on its own: it comes out again once the danger has passed. */
  | { k: 'garrison'; target: number; flee?: true }
  /** Hunt an animal; once it falls, butcher it. With `fight`, a wolf fought off: nothing to butcher. */
  | { k: 'hunt'; target: number; fight?: boolean }
  /** Milk a sheep of the people's flock (#308), carry the milk to a drop site, and back. */
  | { k: 'milk'; target: number; phase: 'go' | 'work' | 'drop' }
  /** Tame a wild beast (the Age of the Wild, `TAME`): walk to it and sing it calm; `t` counts the ticks sung so far. */
  | { k: 'tame'; target: number; t: number }
  /** Walk the trap line (#485): empty a snare of its people's, on to the next with game in it, and the catch home. */
  | { k: 'snare'; target: number; phase: 'go' | 'work' | 'drop' }
  /** Work a Mine Shaft (#681): dig its seam, carry the load to a drop site, and back. `res` is the stock the seam pays into, kept in step with it. */
  | { k: 'shaft'; target: number; res: Res; phase: 'go' | 'work' | 'drop' }
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
  | { k: 'trade'; post: number; market: number; phase: 'go' | 'back'; from?: { x: number; y: number }; /** Loaded this step: the post floods on the next (#493). */ flood?: true; /** Buying this rare ore at the post instead of trading for gold (#573). */ buy?: RareId }
  /** A citizen digging at an ancient ruin (#64). */
  | { k: 'dig'; target: number }
  /** A citizen stripping the rubble of a fallen building (#503). */
  | { k: 'salvage'; target: number }
  /** A citizen lifting key ore from a cache (#570) and carrying it to the nearest Town Center or Storehouse. */
  | { k: 'cache'; target: number }
  /** A sapper carrying a powder keg to a rival building to lay it at its foot (#577, `powder.ts`). */
  | { k: 'keg'; target: number }
  /** A torchbearer setting a rival's living building (`target`) or a tree or root (`tile`) alight (`fire.ts`); `t` ticks stood lighting it. */
  | { k: 'torch'; target?: number; tile?: number; t?: number }
  /** A sapper carrying a powder keg to a rival's causeway or barrage (#748, `tides.ts`) to lay it on the tile, its fuse lit. */
  | { k: 'kegTile'; tile: number };

/** What a unit is visibly doing, for the renderer's animation. */
export type Act = 'idle' | 'walk' | 'attack' | 'chop' | 'mine' | 'forage' | 'farm' | 'build' | 'chant' | 'fish';

export interface Unit {
  /** A citizen of a polis who took up arms (#501): its people's computer sends only these home to lay arms down. */
  levy?: boolean;
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
  /** Whether this citizen runs from danger, overriding its player's setting; absent follows the player. */
  flee?: boolean;
  /** Tick this citizen last ran from danger, or took shelter from it; absent if it is not one that fled. */
  fled?: number;
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
  /**
   * Plunder (gold) a Warband soldier has taken but not yet carried home (#502): banked at a Town Center or Barracks, lost to whoever fells it.
   * On a Sea-Raider ship (#585), its hold: soldiers' packs handed in, banked at a Dock, lost to whoever sinks it.
   */
  spoils?: number;
  /** Key ore a citizen has lifted from a cache (#570) and is carrying home: banked at its people's Town Center or Storehouse, dropped where it falls. */
  ore?: { id: RareId; n: number; from: number };
  /** Enemy soldiers it has defeated (older saves lack it). */
  vet?: number;
  /** The set line (#501): where a longbow people's bowman last stood, and the tick it came to rest there. */
  rest?: { x: number; y: number; at: number };
  /** A citizen taken captive in the Age of the Warband (#502): it gathers and farms but never builds. */
  thrall?: boolean;
  /** A wagon (#297): the building it carries, and that building's health as a share of its full health. */
  packed?: BuildingType;
  packedHp?: number;
  /** A Skywhale (the Age of Leviathans): the tick its next seed-bomb is ready. Absent: ready now. */
  bombAt?: number;
  /** A hemo-engineered soldier (#355 s3): the tick its graft runs dry unless a Transfusion Station tops it up; absent when ungrafted. */
  hemo?: number;
  /** Quenched in blood-iron (#356): the graft lasts longer, mends faster and crashes softer; cleared when it runs dry. */
  tempered?: boolean;
  /** A hired sword (the Age of Merchants): how many paydays it has gone unpaid; absent for a soldier trained the usual way. */
  merc?: number;
  /** Cursed by a Blood-rite priest (#355 s4): the tick the curse lifts. Until then every blow on it lands harder (`RITE.taken`). */
  cursed?: number;
  /**
   * The Age of the Hive (`hive.ts`): venom in it from Blowpipe darts, `n` doses deep (each one a sting a second, past armour),
   * until tick `end`, set by player `by`. Absent: none.
   */
  venom?: { n: number; end: number; by: number };
  /** Stung by a Hive's swarm (`hive.ts`): the tick the stings wear off, until when it walks slow. Absent: never stung. */
  stung?: number;
  /** Waiting on the shore for the tide (#755): the tick its route is worked out again. Absent: not waiting. */
  tideWait?: number;
  /** Stepped ashore off the flats for the tide (#767): the tick it goes back to its work. Absent: not ashore. */
  ashore?: number;
}

export interface TrainItem {
  unit?: UnitType;
  tech?: TechId;
  /** The Hearth's kin (#463 s1): this many citizens come out together when the work is done. */
  kin?: number;
  /** A Watch Tower raised one step (the tower line, `TOWER_LEVELS`): true while this item is that work. */
  rise?: true;
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
  /**
   * The side age whose keepsake this is (#555 s11, `AGES[].keepsake`): chosen while its people stands there (or the oldest, marked as
   * it leaves), it keeps that age's work on any road after. Absent: no keepsake (and older saves).
   */
  keep?: AgeId;
  /** A Watch Tower's step on the tower line (`TOWER_LEVELS`): 1 Guard Tower, 2 Keep, 3 Bastion. Absent: a plain Watch Tower (and older saves). */
  level?: number;
  /** The Age of the Grove (`grove.ts`): seconds a Thornwall or Orchard has grown since it was planted (spring counts double for a Thornwall). Absent: none yet. */
  grown?: number;
  /** A Kitchen Garden (`grove.ts`): what feeds it, refreshed each second: 1 a Den's dung, 2 water beside it. Absent: neither. */
  fed?: number;
  /** A Thornwall its own people grubbed out (deleted): it leaves no root to regrow. */
  grub?: boolean;
  /** Burnt down (`fire.ts`): a Thornwall that burns leaves no root. */
  burnt?: boolean;
  /** A Hive smoked quiet by a fire near it (`hive.ts`): the tick its bees wake again. Absent: never smoked. */
  smoked?: number;
  /** A Windmill (#701): the tick it last pumped a tile dry, so its sails show it at work. Absent: it never has. */
  pumped?: number;
  /** A Tide Mill (#739): the tick it last ground on the running tide, so its wheel shows it at work. Absent: it never has. */
  milled?: number;
  /** An Interceptor Battery (#759 s2): the tick its charge is ready again after firing. Absent: charged. */
  reload?: number;
  /**
   * A Missile Silo held in Reserve (#759 s3): the tick it stands ready to answer a rival warhead (`INTERCEPT.arm` seconds after it was set,
   * and again after each interceptor it fires). While set it launches nothing. Absent: not in Reserve.
   */
  reserve?: number;
  /** A Seed Spire (the Age of the Bloom, `bloom.ts`): the tick its Bloom Seed is ripe (pushed on while no Heart Tree stands). Absent: not yet begun. */
  ripe?: number;
  /** A Town Center knelt from a Behemoth (the Age of Leviathans, `leviathans.ts`): it rises onto the titan's back again. */
  behemoth?: boolean;
  /** A Sluice (#701 s4): standing open, letting the water out over the low ground behind it. Absent: shut. */
  open?: boolean;
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
  /** A Hunters' kill camp (#463 s1): raised for nothing and quickly, so a cancelled site refunds nothing. */
  kill?: boolean;
  /** A Snare (#485): the food caught in it so far, waiting for a tender. Absent: none. */
  snared?: number;
  /** A Mine Shaft (#681): the seam its miner digs (`SHAFT.seams`). Absent: the best its ground holds (`shafts.ts`). */
  seam?: SeamId;
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
  /** How flooded its market was at `glutAt` (#493): trips there pay `1 − glut`; healed lazily by `glutNow`. Absent until a trader loads. */
  glut?: number;
  glutAt?: number;
  /** Rare ores this world lacks that the post sells (#573); absent where it sells none. */
  sells?: RareId[];
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

/** Rubble of a fallen building, there to be stripped by a salvaging people (`SALVAGE`, `salvage.ts`). */
export interface Rubble {
  id: number;
  x: number;
  y: number;
  /** Whose building fell. */
  owner: number;
  type: BuildingType;
  tx: number;
  ty: number;
  /** What stripping it yields. */
  worth: Cost;
  /** Stripping done so far, in ticks of one citizen's work. */
  done: number;
  /** The tick it is cleared away. */
  until: number;
}

/** A tree growing on a tile (#501, the managed wood): from the tick it was cut or planted to the tick it stands full again. */
export interface Stool {
  tile: number;
  from: number;
  at: number;
  /** Ash of a burnt tree (`fire.ts`): it grows back slowly. */
  ash?: boolean;
}

/** A fire burning on a tile (`fire.ts`): a tree, or a living building (`b`, its id; `tile` its corner). */
export interface Fire {
  tile: number;
  b?: number;
  /** Tiles from where the torch set it: it runs no further than `FIRE.run`. */
  gen: number;
  /** Who set the first flame. */
  by: number;
  /** A tree: the tick it falls to ash. */
  end?: number;
  /** A building: seconds of fire beaten out so far. */
  out?: number;
}

/**
 * A Bloom Seed (the Age of the Bloom, `bloom.ts`), slung from `spire`: in the air until tick `lands` (aimed at `x`, `y`), then rooted on
 * the open tile nearest that point (`x`, `y` move there), cracking its ring on tick `at` unless `cut` strokes reach `BLOOM.root`.
 */
export interface BloomSeed {
  id: number;
  owner: number;
  spire: number;
  x: number;
  y: number;
  lands: number;
  at: number;
  cut: number;
}

/** A warhead in the air (#605, `silo.ts`): launched from `silo`, it lands at (`x`, `y`) on tick `at`. */
export interface Launch {
  id: number;
  /** Which warhead (`WARHEADS`); absent in older saves (atomic). */
  w?: 'atomic' | 'fission' | 'fusion';
  /** The warhead leaves no fallout where it lands (the Age of Fusion, #605 s3). */
  clean?: boolean;
  owner: number;
  silo: number;
  x: number;
  y: number;
  at: number;
  /**
   * What each rival team is shown (#762), drawn at launch and frozen: three ring centres (the real zone and two decoys, in a shuffled
   * order), each blurred off its point, and which of them is real. Absent in older saves (the rivals see the true point).
   */
  warn?: Warning[];
  /**
   * A salvo (#765): its three warheads, each with its own silo and true point (the first is `silo`, `x`, `y` above). A fallen silo scrubs
   * its own (`gone`) and the rest fly on. Absent for a single strike.
   */
  salvo?: SalvoShot[];
  /** The missile's flight (#772, `flightOf`), drawn at launch and frozen. Absent in older saves (no missile is drawn). */
  arc?: Arc;
  /** The interceptors fired at it (#759 s2), one at most for each warhead, in the order they fired; each roll drawn once, when it fired. */
  icpt?: Intercept[];
}

/**
 * One interceptor (#759 s2): fired by a battery (`battery`, of `owner`, standing at `x`, `y`) at a launch's warhead `shot` (0 for a single
 * strike, else its place in `Launch.salvo`), `INTERCEPT.fire` seconds before it lands. `hit` is the roll, drawn as it fired and never again.
 */
export interface Intercept {
  shot: number;
  battery: number;
  owner: number;
  x: number;
  y: number;
  hit: boolean;
  /** Fired by a Missile Silo held in Reserve (#759 s3), spending a warhead from its people's store; `battery` is then the silo's id. */
  silo?: true;
}

/**
 * The course a missile flies (#772, `silo.ts`): from the silo (`x`, `y`), launched on tick `t0`, it climbs toward the lure (`lx`, `ly`, the
 * middle of a rival's rings, moved a little by the seed) on a gentle sideways bow (`bow`, a fraction of the climb's length), then bends onto
 * its true point. Every player sees the same course.
 */
export interface Arc {
  x: number;
  y: number;
  t0: number;
  lx: number;
  ly: number;
  bow: number;
}

/** One warhead of a salvo (#765). */
export interface SalvoShot {
  silo: number;
  x: number;
  y: number;
  gone?: true;
}

/** One rival team's warning of a launch (#762, `silo.ts`): the rings it sees, and the index of the real one. */
export interface Warning {
  team: number;
  rings: { x: number; y: number }[];
  real: number;
  /** A salvo's rings (#765): which of its warheads (`Launch.salvo`) each ring stands for. All are real. Absent for a single strike. */
  of?: number[];
}

/** A blast that lifts the fog for every player over `r` tiles of (`x`, `y`) until tick `until` (#752, `silo.ts`, `vision.ts`). */
export interface Blast {
  id: number;
  x: number;
  y: number;
  r: number;
  until: number;
}

/** Ground poisoned by a warhead that struck at (`x`, `y`) for `owner`, until tick `until` (#605 s2, `silo.ts`). */
export interface Fallout {
  id: number;
  /** The radius, when it is not `SILO.reach` (the Age of Fission poisons ground round its own silo). */
  r?: number;
  owner: number;
  x: number;
  y: number;
  until: number;
}

/** A powder keg laid at the foot of a building, its fuse burning (#577, the Age of Sappers, `powder.ts`). */
export interface Keg {
  id: number;
  x: number;
  y: number;
  owner: number;
  /** The tick it blows. */
  at: number;
}

/** Key ore knocked loose (#570): spilled from a fallen ore store or a fallen digger, there for any people's citizens to carry home (`caches.ts`). */
export interface OreCache {
  id: number;
  x: number;
  y: number;
  ore: RareId;
  /** How much is left in it. */
  n: number;
  /** Whose store or basket it spilled from. */
  from: number;
}

/** What a find is (#588): a mark of the land near home that names one key resource this world holds. */
export type FindKind = 'wreck' | 'cairn' | 'lick' | 'meteor' | 'shrine' | 'stash';

/**
 * A find (#588): one stands near each town, the same distance out for every town. The first people to put a unit on it
 * takes a small reward and learns of a key resource this world holds, with a mark on the minimap toward it.
 */
export interface Find {
  id: number;
  /** The center of its tile. */
  x: number;
  y: number;
  kind: FindKind;
  /** The key resource it speaks of; null for a stash, on a world that holds none. */
  key: KeyId | null;
  /** The town it stands near (it belongs to no one, but this is whose scout the computer sends). */
  near: number;
  /** The player who found it, or -1 while it lies. */
  by: number;
}

/** What a people's find taught it (#588): a key resource this world holds, and the nearest of it to the find (null once none is left). */
export interface Lead {
  key: KeyId;
  at: { x: number; y: number } | null;
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
  /**
   * The town whose year this herd keeps (#479, `YEAR`): a Herd Plains home herd treks out from it each autumn
   * and home each spring; a Deep Wood herd yards by it each winter. Drift leaves such a herd alone.
   */
  town?: number;
  /** Tiles still to walk through on the way to new ground, nearest first (#479): a herd on the move goes round woods. */
  way?: number[];
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
  /** The citizen singing it tame (the Age of the Wild): it stands calm for them, and a wound breaks the song. */
  tamer?: number;
}

export interface Shot {
  id: number;
  owner: number;
  kind: 'stone' | 'arrow' | 'bolt' | 'bullet' | 'spear' | 'boulder' | 'ball' | 'bomb' | 'dart';
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
  /** Gold paid in tithes by Missions (#555 s12). */
  tithe?: number;
  /** Tiles of water pumped out into polder (#701). */
  drained?: number;
  /** Tiles of land dug out into channels, filled with water (#701, the Age of Rivers). */
  dug?: number;
  /** Gold ground by Tide Mills on the running tide (#739, the Age of Tides). */
  milled?: number;
  /** Causeway tiles raised over the flats (#739, the Age of Tides). */
  causeways?: number;
  /** Rival causeway tiles breached by this people's kegs and warheads (#748). */
  breached?: number;
  /** Fish landed by boats (the Age of Sail's deed); absent in older saves. */
  fished?: number;
  /** Beacons lit on the people's towers, relays included (the Age of Lightning's deed, #231); absent in older saves. */
  beacons?: number;
  /** Meat butchered by hunters (the Age of the Steppe's deed, #297); absent in older saves. */
  hunted?: number;
  /** Milk drawn from the flock by citizens (the Age of the Horde's deed, #318); absent in older saves. */
  milked?: number;
  /** Food foraged from wild berry bushes (the Age of the Wild's deed); absent in older saves. */
  foraged?: number;
  /** Wild beasts tamed (the Age of the Wild); absent in older saves. */
  tamed?: number;
  /** Beasts reared at a Beast Den (the Age of the Grove's deed); absent in older saves. */
  bred?: number;
  /** Food brought in from Kitchen Gardens (the Age of the Hive's deed); absent in older saves. */
  gardened?: number;
  /** Honey and mead a people's Hives paid in, as food and gold (the Age of the Hive); absent in older saves. */
  honey?: number;
  /** Seedlings its woods put out round its Heart Tree in the Spreading (the Age of the Wildwood, the Bloom's deed); absent in older saves. */
  spread?: number;
  /** Food taken from snares (#485); absent in older saves. */
  snared?: number;
  /** Gold taken as tribute by riders standing in rivals' land (#318); absent in older saves. */
  tribute?: number;
  /** Stone taken as tribute by a nomad people's riders (#501); absent in older saves. */
  tributeStone?: number;
  /** Gold a household people's houses paid it (#501). */
  taxed?: number;
  /** Gold the Silk Road's caravans earned for the ground the camp covered while they were out (#326); absent in older saves. */
  caravan?: number;
  /** Gold taken in tolls from rival traders crossing the people's land (#334); absent in older saves. */
  toll?: number;
  /** Enemy units (not buildings) the people's forces have slain: the Path of Blood's deeds (#299); absent in older saves. */
  slain?: number;
  /** Gold taken as plunder from the enemy dead (#299); absent in older saves. */
  plunder?: number;
  /** Key ore carried home from rivals' caches (#570); absent in older saves. */
  seized?: number;
  /** Powder kegs ground at the mills in the Age of Alchemy (#577): the Age of Sappers' deed; absent in older saves. */
  ground?: number;
  /** Kegs that blew at a rival's building (#577); absent in older saves. */
  blown?: number;
  /** Fires this player's torches set (`fire.ts`); absent in older saves. */
  torched?: number;
  /** Rare ore bought at the trading posts (#573); absent in older saves. */
  bought?: number;
  /** Food a Warband's soldiers carried off from rivals (#463 s1); absent in older saves. */
  raided?: number;
  /** Gold paid in wages to hired swords (the Age of Merchants); absent in older saves. */
  wages?: number;
  /** Foot soldiers trained at War Camps: the deed of the Age of Total War (#313); absent in older saves. */
  campTrained?: number;
  /** Citizens called to arms at War Camps in the Age of Total War (#313); absent in older saves. */
  calledUp?: number;
  /** Citizens of a polis who took up arms (#501). */
  armed?: number;
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

/** One change of age (#743). `lost` counts what the people lost inside the weak window after a step back (`STEP_BACK.time`). */
export interface JourneyLeg {
  tick: number;
  from: AgeId;
  to: AgeId;
  back?: true;
  lost?: number;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  civ: CivId;
  /** Controlled by the computer, at this level; null for a person. */
  ai: Difficulty | null;
  /** A person who left an online match, whose people the computer leads until they come back; absent otherwise. */
  left?: true;
  /** Citizens stand their ground instead of running from danger (see `FLEE`); absent means they run. */
  noFlee?: true;
  /** The flock tends itself (see `SHEPHERD`); set at the start of a game for a person's people, absent means by hand. */
  shepherd?: true;
  team: number;
  res: Stock;
  /** Blood in store (#355): drawn at Drain Rigs from the enemy dead and by the levy; absent until the first drop. */
  blood?: number;
  /** Rare ores mined (#356); absent until the first is brought home. */
  rare?: Partial<Record<RareId, number>>;
  /** Powder kegs in store (#577): ground in the Age of Alchemy, laid in the Age of Sappers; absent until the first is ground. */
  kegs?: number;
  /** Seconds of milling toward the next keg (#577); absent when none is under way. */
  grind?: number;
  /**
   * The people's missile pool (#753, `silo.ts`): `n` warheads in store, fired from any silo of theirs; `next` is the tick the next one is
   * ready while store and flight together are under the cap. Absent until their first silo stands (then `SILO.stock`). Hidden from rivals.
   */
  nukes?: { n: number; next?: number };
  epoch: number;
  /** The age within the web (#37); its tier is `epoch`. Absent, or out of step with `epoch`, means the trunk age of `epoch` (see `ageOf`). */
  age?: AgeId;
  /** Side ages this people has stood in, in the order first entered (heirlooms, #224); absent if none. The age it stands in counts too (see `hasWalked`). */
  walked?: AgeId[];
  /** Kinds of beast this people has tamed (the Age of the Wild): a Beast Den breeds only these. Absent if none. */
  tamed?: ('wolf' | 'boar' | 'mammoth')[];
  /**
   * The Prospector's Lodge's chart (#565): every key-resource tile in the world as it was when charted, which the
   * minimap marks under fog. A picture of that moment, not sight: a vein dug out since still shows. Absent until charted.
   */
  chart?: { tile: number; key: KeyId }[];
  /** What the finds this people has claimed taught it (#588); absent until one is. */
  leads?: Lead[];
  /** Epochs whose great work this player has called (seed #133); absent if none. */
  works?: number[];
  /** The Way this people chose in the Stone Age (#336); absent if none. */
  way?: WayId;
  /** The Way was deepened in the Bronze Age (#338). */
  deep?: boolean;
  /** The Bronze Age vow has been made, deepening or turning (#338). */
  vowed?: boolean;
  /** Tick this people was last told that raiders carried off its food (#463 s1); absent if never. */
  raidTold?: number;
  /** Tick the great work now at hand ends; absent when none is. */
  workEnd?: number;
  /** A card of tidings at the fire waiting on an answer (#443): which, which draw, and the tick it passes unanswered. Absent when none waits. */
  tiding?: { card: TidingId; draw: number; until: number };
  /** The cards of tidings that have come to this people, in order (#443); absent before the first. */
  told?: TidingId[];
  /** Tick its last step back (#47) landed, for the cooldown; absent if it never stepped back. */
  backAt?: number;
  /** Every change of age, in order (#743): the end screen draws the road walked from it. Absent before the first (and in older saves). */
  journey?: JourneyLeg[];
  /** The tick the people's Golden Age began (#703); gone once it ends. */
  goldenAt?: number;
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
  /**
   * The Greening (the Age of the Bloom, `bloom.ts`): the share of its land that is green, in thousandths, measured once a second while it
   * stands in the Bloom; and the tick its hold began, while it has its Heart Tree and that share is at least `BLOOM.green`. Absent: not in the Bloom.
   */
  green?: number;
  greenSince?: number;
}

export type GameEvent =
  | { k: 'swing'; id: number; target: number; x: number; y: number; owner: number; ranged: boolean; type: UnitType | BuildingType }
  | { k: 'hit'; target: number; x: number; y: number; damage: number; owner: number; building: boolean }
  | { k: 'splash'; x: number; y: number; owner: number; kind: Shot['kind'] }
  | { k: 'die'; id: number; owner: number; type: UnitType | BuildingType; x: number; y: number; building: boolean; size: number; epoch: number; fx: number; fy: number }
  | { k: 'animalDie'; id: number; x: number; y: number; fx: number; fy: number; kind?: Animal['kind'] }
  /** A mammoth or wolf turns to fight (#171): its cry. */
  | { k: 'wildCry'; id: number; kind: Animal['kind']; x: number; y: number }
  /** A wild beast tamed (the Age of the Wild). */
  | { k: 'tamed'; owner: number; kind: Animal['kind']; x: number; y: number }
  /** A fallen Thornwall sprouts again from its root (the Age of the Grove). */
  | { k: 'sprout'; owner: number; x: number; y: number }
  /**
   * The Age of the Hive (`hive.ts`): a Hive's bees `what`: `swarm` on a rival unit in its woods (the unit `target`), `smoked` quiet by
   * a fire, `wake` again after smoke or winter.
   */
  | { k: 'hive'; what: 'swarm' | 'smoked' | 'wake'; id: number; owner: number; x: number; y: number; target?: number }
  /**
   * The Age of the Wildwood (`wildwood.ts`): an Ent `what`: `wake` from its tree (the unit `id`), `root` back into one, `felled` while
   * rooted (its tree cut or burnt); or a people's woods `spread` in spring (`n` seedlings round its Heart Tree).
   */
  | { k: 'wildwood'; what: 'wake' | 'root' | 'felled' | 'spread'; owner: number; x: number; y: number; id?: number; n?: number }
  /**
   * The Age of the Bloom (`bloom.ts`): a Seed `slung` (aimed at x, y), `rooted` where it came down, `withered` with no open ground, `hacked`
   * out by rival citizens, or `cracked` (`n` buildings turned to forest); a people's `storm` of pollen, its Greening `held` or `faded`.
   */
  | { k: 'bloom'; what: 'slung' | 'rooted' | 'withered' | 'hacked' | 'cracked' | 'storm' | 'held' | 'faded'; owner: number; x: number; y: number; id?: number; n?: number }
  /**
   * The Age of Leviathans (`leviathans.ts`): a Skywhale's seed-bomb (`n` Thornwall seedlings sprouting under it), or a Behemoth that
   * `kneel`s (its Town Center set down) or `rise`s (taken up again); `id` is what it became.
   */
  | { k: 'leviathan'; what: 'bomb' | 'kneel' | 'rise'; owner: number; x: number; y: number; id: number; n?: number }
  /** A mammoth gores, or a wolf bites, someone. */
  | { k: 'wildStrike'; id: number; kind: Animal['kind']; target: number; x: number; y: number }
  /** A raider camp (own pitch) stands empty: whose people cleared it, and the plunder they took. */
  | { k: 'campCleared'; owner: number; x: number; y: number; gold: number; food: number; wood: number }
  | { k: 'trained'; id: number; owner: number; type: UnitType }
  | { k: 'researched'; owner: number; tech: TechId }
  /** A Watch Tower finished a step on the tower line (`TOWER_LEVELS`). */
  | { k: 'raised'; owner: number; id: number; level: number; x: number; y: number }
  /** A Prospector's Lodge finished (#562): the key resources this world holds, for the people who raised it. */
  | { k: 'prospect'; owner: number; finds: KeyId[] }
  /** A find claimed (#588): by whom, what it was, the key resource it speaks of, and its reward. */
  | { k: 'find'; id: number; owner: number; kind: FindKind; key: KeyId | null; x: number; y: number; reward: Cost }
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
  | { k: 'salvage'; owner: number; x: number; y: number; type: BuildingType; what: 'left' | 'stripped'; gain?: Cost }
  /** Key ore (#570): `spilled` from `from`'s store or basket, `taken` up by `owner`'s citizen, `kept` (banked) by `owner`. */
  | { k: 'cache'; owner: number; from: number; ore: RareId; n: number; x: number; y: number; what: 'spilled' | 'taken' | 'kept' }
  /** A powder keg (#577): `ground` at the mills, `laid` at a building's foot, `blown`, or `doused` by a rival who reached it. */
  | { k: 'keg'; owner: number; x: number; y: number; what: 'ground' | 'laid' | 'blown' | 'doused' | 'drowned'; by?: number }
  /** Fire (`fire.ts`): `lit` by a torch or spreading (`tree` when a tree; `owner` the building's), `out` (beaten out), `ash` (a tree burnt down), `root` (a Thornwall root burnt). `by` set the first flame. */
  | { k: 'fire'; what: 'lit' | 'out' | 'ash' | 'root'; x: number; y: number; by: number; owner?: number; torch?: boolean; tree?: boolean }
  /**
   * A Missile Silo's warhead (#605): `launched` (the clock starts), `revealed` (3 s left: the decoys vanish, #762), `scrubbed` (the silo
   * fell) or `struck`. Before it strikes, (`x`, `y`) is the attacker's own aim: a rival's screen reads its rings from launch `id` (`ringsFor`).
   */
  | { k: 'silo'; owner: number; x: number; y: number; what: 'launched' | 'revealed' | 'scrubbed' | 'struck'; id?: number; fuse?: number; w?: 'atomic' | 'fission' | 'fusion'; ring?: number }
  /**
   * Missile defence (#759 s2): a battery of `owner`'s `fired` at launch `id` of `by`'s (at the battery, `x`, `y`), then the interceptor met
   * the warhead (`hit`: it is gone; `missed`: it flies on) where the missile is, `z` tiles up.
   */
  | { k: 'intercept'; owner: number; by: number; id: number; shot: number; what: 'fired' | 'hit' | 'missed'; x: number; y: number; z?: number; silo?: true }
  /** A trader bought a load of rare ore at a post (#573). */
  | { k: 'oreBuy'; owner: number; ore: RareId; n: number; gold: number; x: number; y: number }
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
  /** A coppice stool or a planted sapling (#501) grew into a full tree on `tile`. */
  | { k: 'regrown'; tile: number }
  /** The Shore's spring (#482): the shoals left grew by `grew` fish in all, and `seeded` new shoals were laid. */
  | { k: 'spawned'; grew: number; seeded: number }
  /** A windmill pumped a tile of water out into polder (#701): `mill` is the windmill, `tile` the new land. */
  | { k: 'drained'; owner: number; mill: number; tile: number; x: number; y: number }
  /** Water ran into a dug ditch (#701, the Age of Rivers): `tile` is the new channel. */
  | { k: 'dug'; owner: number; tile: number; x: number; y: number }
  /** The Water Line (#701 s4): an open sluice of `owner`'s let the water over a tile of low ground (`wet`), or the water left it again. */
  | { k: 'inundated'; owner: number; tile: number; x: number; y: number; wet: boolean }
  /** A sluice was opened or shut (#701 s4). */
  | { k: 'sluice'; owner: number; id: number; open: boolean; x: number; y: number }
  /** The sea ran back into a tile of polder (#701 s3, the breach): `owner` holds the land there (-1: no one), `drowned` the buildings it took. */
  | { k: 'flooded'; owner: number; tile: number; x: number; y: number; drowned: number }
  /** The tide turned to a new level (#739): `level` 0 is low water, `TIDE.flats.length` high; `rising` while it floods. `bared` tiles came out, `covered` went under. */
  | { k: 'tide'; level: number; rising: boolean; bared: number; covered: number }
  /** A unit caught on the flats by the rising tide (#739) was swept ashore and hurt (`drowned`: no shore near, it was lost). */
  | { k: 'tideSwept'; id: number; owner: number; x: number; y: number; drowned: boolean }
  /** A land unit stops on the shore to wait for the tide (#755), until tick `until`. */
  | { k: 'tideHold'; id: number; owner: number; x: number; y: number; until: number }
  /** A worker on the flats steps ashore before the flood (#767), until tick `until` (-1: home with its basket first). */
  | { k: 'tideAshore'; id: number; owner: number; x: number; y: number; until: number }
  /** The high water brought `food` back to the cockle beds (#767), over `beds` beds. */
  | { k: 'cockles'; beds: number; food: number }
  /** A Tide Mill ground `gold` on the running tide (#739). */
  | { k: 'milled'; id: number; owner: number; gold: number; x: number; y: number }
  /** A causeway was finished (#739): `tile` is tidal ground now, raised. */
  | { k: 'causeway'; owner: number; tile: number; x: number; y: number }
  /** A causeway tile was breached (#748) by `by`'s keg or warhead: it is plain tidal ground again (or open sea), `owner`'s road cut. */
  | { k: 'breached'; owner: number; by: number; tile: number; x: number; y: number; pond: boolean }
  /** A barrage shut a pond off from the sea (#748), or a breach let it drain: `tiles` of tidal ground now behind it. */
  | { k: 'pond'; owner: number; tiles: number; x: number; y: number }
  /** A dam fell with water behind it (#701 s5): its surge ran over `tiles` tiles of low ground at once. */
  | { k: 'burst'; owner: number; id: number; x: number; y: number; tiles: number }
  | { k: 'season'; i: number }
  /** A payday for hired swords (the Age of Merchants): how many went unpaid, and how many of those walked off. */
  | { k: 'wages'; owner: number; late: number; gone: number }
  | { k: 'rank'; id: number; owner: number; x: number; y: number; rank: number }
  /** Gold taken from an enemy unit slain by a people with a plunder share (the Path of Blood, #299). */
  | { k: 'plunder'; owner: number; x: number; y: number; gold: number }
  /** A Sea-Raider soldier's pack handed into a ship's hold (#585): `gold` moved into transport `ship`, at the soldier's spot. */
  | { k: 'stow'; owner: number; x: number; y: number; gold: number; ship: number }
  /** A rival citizen taken captive by a Warband people (#502): a thrall of `owner` rises at the spot, taken from `from`. */
  | { k: 'thrall'; owner: number; from: number; x: number; y: number }
  /**
   * Blood drawn at a Drain Rig (#355): from an enemy who fell near it, or from citizens given to the levy; in Hemocraft (s2) also
   * bled from a living enemy standing by a rig (`drain`, at the bled), and in the Blood-rite from the fallen near a Temple.
   */
  | { k: 'blood'; owner: number; x: number; y: number; n: number; how: 'slain' | 'levy' | 'drain' | 'sacrifice' | 'beast' | 'flock' | 'captive' }
  /** A captive (#355): an enemy citizen `taken` alive into a rig or altar at `x, y`, `freed` when it fell, or `spent`. `from` is its people. */
  | { k: 'captive'; owner: number; from: number; x: number; y: number; what: 'taken' | 'freed' | 'spent' }
  /** A soldier grafted at a Transfusion Station (#355 s3), or a graft run dry far from every Station (`crash`). */
  | { k: 'graft'; owner: number; id: number; x: number; y: number; how: 'made' | 'crash' }
  /** A people left an age (#555 s11): this building, its keepsake, keeps that age's work. */
  | { k: 'keepsake'; owner: number; id: number; age: AgeId; x: number; y: number }
  /** A Golden Age begins (#703), told to every people: the ages it weaves, and the tick it ends. Or it ends (`over`). */
  | { k: 'golden'; owner: number; threads: AgeId[]; ends: number; over?: boolean }
  /** A War Camp left without its soldiers (#303): it burns after a grace, or at once if its people left the path (`struck`). */
  /** Citizens called up at a War Camp (#313): each became the foot soldier `id` where it stood. */
  | { k: 'callUp'; owner: number; camp: number; ids: number[]; x: number; y: number }
  /** Riders of a horde (#318) took `gold` in tribute from `from`, standing in its land: `ids` are the riders counted. */
  /** A household people's payday (#501): `gold` came in from the houses `ids`. */
  | { k: 'tax'; owner: number; gold: number; ids: number[] }
  | { k: 'tribute'; owner: number; from: number; gold: number; stone?: number; ids: number[]; x: number; y: number }
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
   * A floating district (#770): cast off into a tow (`id` the tow), moored again (`id` the pontoon), or sunk. `aboard` went with it (or,
   * sinking, swam clear); `swum` were left to swim (or, sinking, drowned).
   */
  | { k: 'pontoon'; owner: number; id: number; x: number; y: number; act: 'cast' | 'moor' | 'sink'; aboard: number; swum: number }
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
  /** The Hearth's kin came to a Town Center (#463 s1). */
  | { k: 'kin'; owner: number; n: number; x: number; y: number }
  /** A Warband's soldiers carried `food` off from `owner`'s store (#463 s1); `tell` when the victim should hear of it. */
  | { k: 'raided'; owner: number; by: number; food: number; x: number; y: number; tell: boolean }
  | { k: 'wonder'; owner: number; id: number; x: number; y: number; ticks: number }
  /** A Wonder's foundation was laid (#361): every player hears of it, so the whole build can be contested. */
  | { k: 'wonderRising'; owner: number; id: number; x: number; y: number }
  | { k: 'trade'; owner: number; res: Res; buy: boolean }
  /** An explorer of `owner` came on a rival army of `n` soldiers at (x, y) (#454 s3). */
  | { k: 'sighted'; owner: number; x: number; y: number; n: number }
  | { k: 'defeated'; owner: number }
  | { k: 'heartless'; owner: number; left: number }
  | { k: 'over'; winner: number; how: 'conquest' | 'wonder' | 'relics' | 'lands' | 'greening' | 'resign' | 'time' | 'scenario' }
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
  /** The land every town wakes in (#473); a save from before it is a Glade. */
  homeland?: HomelandId;
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
  /**
   * The water layer (#701, the Water Road): per tile, 1 where water was pumped out into polder (now land, `T_GRASS`). Absent until the
   * first tile drains (and in older saves); `water.ts` reads and writes it.
   */
  polder?: Uint8Array;
  /**
   * The Age of Rivers' channels (#701): per tile, 1 where land was dug out and the water ran in (now `T_WATER`, but wadeable: no
   * `B_TERRAIN`), 2 where it was dug deep into a canal in the Age of Locks (#701 s5: ships sail it too, and soldiers swim it slower).
   * Absent until the first ditch fills (and in older saves); `water.ts` reads and writes it.
   */
  channel?: Uint8Array;
  /**
   * Spring heads (#701 s1): tiles by the towns that had no water near, laid by mapgen. Nothing is built on one; a channel dug beside
   * it fills from it, and it opens into the channel (leaving this list); it waters the fields round it. Absent where there are none.
   */
  springs?: number[];
  /** Tiles of polder the sea has taken back (#701 s3, the breach), by any breach: a cheap test for the renderer that the shore moved. Absent until the first. */
  flooded?: number;
  /**
   * The tidal ground (#739, the Age of Tides; `tides.ts`): per tile, the level below which the falling tide bares it (1 to
   * `TIDE.flats.length`; `TIDE_CAUSEWAY` for a causeway), 0 where the tide never reaches. Laid out when the first people enters the age,
   * and absent until then (and in older saves): the sea stands at high water.
   */
  tidal?: Uint8Array;
  /** The corner heights as they were when the tide woke (#739), so ground the tide bares sinks back to its own bed. */
  tideBed?: Float32Array;
  /** The tick the tide woke (#739): the public tide clock runs from it, starting at high water. */
  tideFrom?: number;
  /** Tiles the tide has bared or covered, all told (#739): a cheap test for the renderer that the shore moved. */
  tideTurns?: number;
  /** Who raised each causeway tile (#748): the owner + 1, 0 where none stands. Absent until the first is raised. */
  causewayBy?: Uint8Array;
  /**
   * Barrage ponds (#748): 1 on each tile of tidal ground a causeway line has shut off from the open sea (`pondsOf`, `tides.ts`). Its flats
   * stay wet, and a Tide Mill grinds them twice. Recounted at each turn of the tide and whenever a causeway is raised or breached.
   */
  pond?: Uint8Array;
  /** Cockle beds (#767): 1 on each tile laid as a bed when the tide woke, picked out or not, so a bed grows back where it was. Absent where none were laid. */
  cockles?: Uint8Array;
  /**
   * The Water Line (#701 s4): per tile, where an open sluice let the water out over low ground (now `T_WATER`, waded and not walked dry,
   * no `B_TERRAIN`): 1 + the terrain it had, to give back when the water goes. Absent until the first sluice opens (and in older saves).
   */
  inund?: Uint8Array;
  /** Tiles the sluices have flooded or given back, all told (#701 s4): a cheap test for the renderer that the water moved. */
  inundated?: number;
  players: Player[];
  /** Every unit and building, in the order they were made (ids rise). */
  ents: Ent[];
  byId: Map<number, Ent>;
  animals: Animal[];
  /** Carcasses that are spoiling: the tile, the tick it fell, what it held (old saves have none). */
  carcasses?: { tile: number; born: number; full: number }[];
  /** Coppice stools and planted saplings growing into trees (#501, `coppice.ts`), in the order they were cut or planted; absent until the first. */
  stools?: Stool[];
  /** Roots of fallen Thornwalls (the Age of the Grove, `grove.ts`) waiting to sprout again at tick `at`; absent until the first. */
  roots?: { tile: number; owner: number; at: number }[];
  /**
   * Ents rooted as trees (the Age of the Wildwood, `wildwood.ts`), in the order they rooted: the tile of the tree each stands as,
   * whose it is, and its hit points (they mend while it stands). Each still takes room in its people's town. Absent: none.
   */
  wardens?: { tile: number; owner: number; hp: number }[];
  /** Per tile: the R_* kind of a stone, gold or rare-ore deposit worked out there, or 0 (#681, old workings for a Mine Shaft); absent until the first. */
  spent?: Uint8Array;
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
  /** Finds near the towns (#588); absent in older saves and in campaign chapters (none). */
  finds?: Find[];
  /** Foundations of fallen buildings a reclaiming people may raise again (`reclaim.ts`); absent until one falls. */
  fallen?: Fallen[];
  /** Rubble of fallen buildings a salvaging people may strip (`salvage.ts`); absent until one falls. */
  rubble?: Rubble[];
  /** Loads of each rare ore bought at the trading posts, by anyone (#573): each makes the next dearer. Absent until one is bought. */
  oreSold?: Partial<Record<RareId, number>>;
  /** Key ore knocked loose and lying on the ground (#570, `caches.ts`); absent until some spills. */
  caches?: OreCache[];
  /** Powder kegs laid with their fuses burning (#577, `powder.ts`); absent until one is laid. */
  kegs?: Keg[];
  /** Fires burning, in the order they were lit (`fire.ts`); absent while nothing burns. */
  fires?: Fire[];
  /** Bloom Seeds in the air or rooted (the Age of the Bloom, `bloom.ts`), in the order they were slung; absent: none. */
  blooms?: BloomSeed[];
  /** Warheads in the air (#605, `silo.ts`); absent until one is launched. */
  launches?: Launch[];
  /** Ground poisoned by warheads that have struck (#605 s2); absent until one does. */
  fallout?: Fallout[];
  /** Blasts whose fog stays lifted for everyone (#752); absent until a warhead strikes. */
  blasts?: Blast[];
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

/** A barrage the computer means to lay (#748, `barragePlan`): the drag's two ends on the shore, its tiles, and the tidal ground it shuts off. */
export interface BarragePlan {
  from: { x: number; y: number };
  to: { x: number; y: number };
  line: number[];
  pond: number;
}

export interface AiMemory {
  next: number;
  /** The tick a polis computer last armed its citizens (#501). */
  polisAt?: number;
  wave: number;
  attacking: boolean;
  /** Where the army gathers between attacks. */
  muster: { x: number; y: number } | null;
  /** Last tick a building of each kind was ordered, so it waits for the first to go up. */
  ordered: Partial<Record<BuildingType, number>>;
  unitTurn: number;
  /** Tick the town bell was rung, or -1. */
  bell: number;
  /** While the bell is rung (#487): the nearest foe's distance seen, and the tick it last came closer. */
  bellNear?: number;
  bellMoved?: number;
  /** Tick it last looked for a dock site and found none (so it doesn't look every turn). */
  dockless?: number;
  /** Tick it last looked whether the deposits near home are gone, for a Mine Shaft (#681). */
  shaftLook?: number;
  /** Its scout (#454 s4): the rider sent exploring, the tick it was last sent, and the pair that patrol its border or trade road. */
  scout?: { id: number; sent: number };
  /** The route this seat favours (#749): its side ages chosen from the start; 'none' for a seat that keeps an open mind. Settled on its first turn. */
  lean?: RouteId | 'none';
  guards?: number[];
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
  /** The citizen walking out to its town's find (#588), and the tick it set out. */
  findWalker?: { unit: number; since: number };
  /** The tick a Stone Age climb began to wait on the Prospector's Lodge (#540). */
  lodgeHold?: number;
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
  /** When it began holding the Middle Ages to dig saltpetre for Alchemy (#577). */
  powder?: number;
  /**
   * The Water Road (#701): the dyke it means to raise by home (null: none worth it), found once; when it began holding the Middle
   * Ages for the road's Dock, and since when it has stood in the Age of Dykes.
   */
  dyke?: { plan: DykePlan | null; looked?: boolean; hold?: number; since?: number; /** Its line once stood whole (#701 s3): from then on a gap in it is a breach to mend, in any age. */ raised?: boolean };
  /**
   * The Water Line (#701 s4): since when it has stood in the age, where it means its sluice to go (null: nowhere, once looked), and the
   * tick an enemy army last stood by the sluice.
   */
  line?: { since: number; spot?: { tx: number; ty: number } | null; alarm?: number };
  /** The Age of Locks (#701 s5): since when it has stood in the age, and where it means its dam to go (null: nowhere, once looked). */
  locks?: { since: number; dam?: { tx: number; ty: number } | null };
  /** The Age of Floating Cities (#770): when it entered, and the tows it has under way, by id, to where (the water it moors on). */
  float?: { since: number; tides?: number; tows?: Record<number, { x: number; y: number }>; looked?: number; fished?: number };
  /** The Age of Rivers (#701): the channel it means to dig from water past home (null: none), found when deciding and again on arrival (`fresh`). */
  river?: { plan: ChannelPlan | null; looked?: boolean; fresh?: boolean };
  /** The first crossing (#585): the age it stands in on the way to the Sea-Raiders, and since when (each sibling, and the age itself). */
  sea?: { at: AgeId; since: number };
  /** Tick it last tried to raise a Mission (#555 s12). */
  mission?: number;
  /** When it last sent sappers with kegs (#577). */
  kegAt?: number;
  /** When it last sent torchbearers (`fire.ts`). */
  torchAt?: number;
  /** When an Industrial computer bound for a side future began to hold off the Atomic Age (#605). */
  sideHold?: number;
  /** Where a loaded silo means to strike, chosen once a second (#605). */
  siloAim?: { x: number; y: number; at: number; w?: 'atomic' | 'fission' | 'fusion'; salvo?: { x: number; y: number }[] };
  /** Whether three rival targets, far enough apart, are each worth a warhead (#765): the town raises silos and Launch Control for a salvo. */
  salvoPays?: boolean;
  /** The tick the computer last weighed where to send a warhead (`fireSilo`, once a second). */
  siloAt?: number;
  /** The tick it last weighed holding a silo in Reserve (#759 s3, `reserveSilo`, once every `INTERCEPT.think` seconds). */
  reserveAt?: number;
  /** Tick it began holding its Town Center for a side road's last deeds, so it holds only so long. */
  waiting?: number;
  /**
   * Since when, and in which epoch, its army has been short of the next wave after a first wave went out
   * (#113): army-first holds an advance back only `armyWait` seconds of it.
   */
  short?: { since: number; epoch: number };
  /** A band out after rival citizens working far from home (#260): its soldiers, their quarry and since when. */
  /** With `look`, the band is walking to a rival Hunting Camp it has seen, to find who works there (`target` -1 until it does). */
  /** With `raid`, a Warband's band out for a rival's food buildings (#463 s1), given longer for the walk. */
  prowl?: { ids: number[]; target: number; since: number; look?: number; burn?: number; raid?: boolean };
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
  /** The tick it entered the Age of the Wild, kept while it tames and breeds there (`TAME.aiStay`). */
  wild?: number;
  /** The tick it entered the Age of the Grove, kept while it plants there (`GROVE.aiStay`). */
  grove?: number;
  /** The tick it entered the Age of the Hive, kept while it sets its Hives there (`HIVE.aiStay`). */
  hive?: number;
  /** The tick it entered the Age of the Wildwood, kept while it wakes its forest there (`WILDWOOD.aiStay`). */
  wildwood?: number;
  /** The tick it entered the Age of the Bloom, kept while it slings its Seeds there (`BLOOM.aiStay`); and when it last planted an Orchard for the Greening. */
  bloom?: number;
  orchardAt?: number;
  /** The tick it entered the Age of Leviathans, kept while it breeds and flies its giants there (`LEVIATHANS.aiStay`). */
  leviathans?: number;
  steppe?: { band?: number[]; at?: { x: number; y: number }; out?: number; recalled?: number; horde?: number; since?: number; struck?: number; /** When a nomad flock (#501) was first seen grazed out, this time. */ starved?: number; pack?: { x: number; y: number; at: number }; to?: { x: number; y: number; at: number }; from?: { x: number; y: number } };
  /**
   * The tide (#748): the barrage it means to lay by its mills (null: none worth it, by any of the mills in `seen`); once it stood whole,
   * a gap in it is mended. `wait` is when a wave across the flats began waiting for low water; `cross` the crossing the wave on the
   * march took at low water (its far shore, the level that covers it, and the wave's goal), to turn back short of before the flood.
   */
  tide?: { plan?: BarragePlan | null; seen?: number[]; raised?: boolean; wait?: number; cross?: { x: number; y: number; level: number; to: { x: number; y: number } }; cockle?: number };
}

/** Orders that can be given with Shift held to queue them after the current one. */
/** What a citizen is doing, by the order they follow (the Workers panel and `reassign`). */
export type Job = 'food' | 'wood' | 'stone' | 'gold' | 'build' | 'idle' | 'shelter' | 'other';

type Queued = { queue?: boolean };

export type Command =
  | ({ t: 'move'; p: number; ids: number[]; x: number; y: number; amove?: boolean } & Queued)
  | ({ t: 'attack'; p: number; ids: number[]; target: number; spread?: boolean } & Queued)
  | ({ t: 'gather'; p: number; ids: number[]; tile: number; spread?: boolean } & Queued)
  /** Right-click on your own building: help build it, farm it, drop off resources there or shelter in it. */
  | ({ t: 'work'; p: number; ids: number[]; target: number } & Queued)
  | ({ t: 'build'; p: number; ids: number[]; type: BuildingType; tx: number; ty: number } & Queued)
  /** A line of wall from one tile to another (gates go in with `type: 'gate'` one at a time). */
  | ({ t: 'wall'; p: number; ids: number[]; x0: number; y0: number; x1: number; y1: number; /** A line of dykes (#701) rather than wall. */ dyke?: boolean; /** A line of Thornwall (the Age of the Grove) rather than wall. */ thorn?: boolean; /** A channel dug (#701, the Age of Rivers) rather than wall. */ channel?: boolean; /** A causeway raised over the flats (#739, the Age of Tides) rather than wall. */ causeway?: boolean } & Queued)
  | ({ t: 'hunt'; p: number; ids: number[]; target: number } & Queued)
  | ({ t: 'convert'; p: number; ids: number[]; target: number; rite?: 'sacrifice' | 'curse' } & Queued)
  | ({ t: 'garrison'; p: number; ids: number[]; target: number } & Queued)
  /** Priests: fetch a relic and take it to the nearest Temple. */
  | ({ t: 'relic'; p: number; ids: number[]; target: number } & Queued)
  /** Traders: run the road between their Market and a trading post. */
  | ({ t: 'route'; p: number; ids: number[]; post: number; /** Buy this rare ore there instead of trading for gold (#573). */ buy?: RareId } & Queued)
  /** Go aboard a transport ship. */
  | ({ t: 'board'; p: number; ids: number[]; target: number } & Queued)
  /** Transports: sail to the shore nearest a point and put everyone ashore. */
  | ({ t: 'unload'; p: number; ids: number[]; x: number; y: number } & Queued)
  | { t: 'ungarrison'; p: number; building: number }
  | { t: 'bell'; p: number; ring: boolean }
  /** Citizens run from danger (or not): the named citizens, or all of this player's when `ids` is absent. */
  | { t: 'flee'; p: number; on: boolean; ids?: number[] }
  /** A person's flock is tended on its own (or not). */
  | { t: 'shepherd'; p: number; on: boolean }
  | { t: 'beacon'; p: number; building: number }
  /** Choose the seam a Mine Shaft digs (#681). */
  | { t: 'seam'; p: number; building: number; seam: SeamId }
  /** Call citizens to arms at a War Camp in the Age of Total War (#313): up to `n`, the nearest first. */
  | { t: 'callUp'; p: number; building: number; n?: number }
  /** Strike camp (#297): pack a Town Center or House onto a wagon. At a Sluice (#701 s4) it opens or shuts the gate instead. */
  | { t: 'pack'; p: number; building: number }
  /** Pitch camp (#297): wagons set down the building they carry where they stand. */
  | { t: 'pitch'; p: number; ids: number[] }
  /** Ents root where they stand and become trees again (the Age of the Wildwood). */
  | { t: 'root'; p: number; ids: number[] }
  /** A Seed Spire slings its ripe Bloom Seed at a point (the Age of the Bloom). */
  | { t: 'sling'; p: number; spire: number; x: number; y: number }
  /** Skywhales drop a seed-bomb each where they hover: Thornwall that sprouts on the ground below (the Age of Leviathans). */
  | { t: 'seedbomb'; p: number; ids: number[] }
  /** Citizens milk a sheep of their flock (#308). */
  | ({ t: 'milk'; p: number; ids: number[]; target: number } & Queued)
  /** Citizens tame a wild wolf, boar or mammoth (the Age of the Wild). */
  | ({ t: 'tame'; p: number; ids: number[]; target: number } & Queued)
  /** A Town Center raises a lamb for the flock (#308). */
  | { t: 'lamb'; p: number; building: number }
  /** A hero's Rallying Cry. */
  | { t: 'cry'; p: number; id: number }
  /** Call the people's great work (seed #133), once in each epoch. */
  | { t: 'greatWork'; p: number }
  | { t: 'way'; p: number; way: WayId }
  /** The Hearth Way's call (#463 s1): kin come to a Town Center. */
  | { t: 'kin'; p: number; building: number }
  /** A vow (#338): deepen the Way (no `way`), or turn to `way`. */
  | { t: 'vow'; p: number; way?: WayId }
  | { t: 'stance'; p: number; ids: number[]; stance: Stance }
  | { t: 'train'; p: number; building: number; unit: UnitType }
  | { t: 'research'; p: number; building: number; tech: TechId }
  /** Raise this Watch Tower one step on the tower line (`TOWER_LEVELS`). */
  | { t: 'raiseTower'; p: number; building: number }
  | { t: 'cancel'; p: number; building: number; index: number }
  /** Into the next age: `to` picks a road (#37); without it, the trunk's next epoch. */
  | { t: 'advance'; p: number; building: number; to?: AgeId }
  /** Step back an age (#47), to the trunk age one tier down. */
  | { t: 'stepBack'; p: number; building: number }
  /** Choose this building as the keepsake of the age its people stands in (#555 s11): the one that keeps working after they leave. */
  | { t: 'keepsake'; p: number; building: number }
  | { t: 'rally'; p: number; building: number; x: number; y: number }
  /** Move `n` citizens from one job to another without picking them: idle first, then those carrying nothing, in id order. */
  | { t: 'reassign'; p: number; from: Job; to: Job; n: number }
  /** A rare ore (#356) can only be sold, a lot of it for gold at a flat price. */
  | { t: 'trade'; p: number; res: 'food' | 'wood' | 'stone' | RareId; buy: boolean }
  | { t: 'stop'; p: number; ids: number[] }
  /** The polis (#501): citizens take up arms where they stand, or soldiers lay them down near home. */
  | { t: 'arm'; p: number; ids: number[] }
  | { t: 'disarm'; p: number; ids: number[] }
  /**
   * Patrol between where each unit stands and the point (#454); with `queue`, add the point to a patrol under way.
   * With `post`, guard that trading post's road instead: back and forth between the nearest Market and the post (s3).
   */
  | ({ t: 'patrol'; p: number; ids: number[]; x: number; y: number; post?: number } & Queued)
  /** Explore on their own (#454). */
  | ({ t: 'explore'; p: number; ids: number[] } & Queued)
  | { t: 'delete'; p: number; ids: number[] }
  | { t: 'resign'; p: number }
  /** Priests set down the relics they carry, where they stand. */
  | { t: 'dropRelic'; p: number; ids: number[] }
  /** Citizens dig at an ancient ruin (#64). */
  | ({ t: 'dig'; p: number; ids: number[]; target: number } & Queued)
  /** Citizens strip the rubble of a fallen building (#503); the target is a rubble id. */
  | ({ t: 'salvage'; p: number; ids: number[]; target: number } & Queued)
  /** Citizens carry key ore home from a cache (#570); the target is a cache id. */
  | ({ t: 'cache'; p: number; ids: number[]; target: number } & Queued)
  /** Citizens or foot soldiers carry a powder keg to a rival building and lay it there (#577, the Age of Sappers); the target is a building id. */
  | ({ t: 'keg'; p: number; ids: number[]; target: number } & Queued)
  /** Citizens or foot soldiers carry torches to a rival's living building (`target`) or to a tree or root (`tile`) and set it alight (`fire.ts`). */
  | ({ t: 'torch'; p: number; ids: number[]; target?: number; tile?: number } & Queued)
  /** Citizens or foot soldiers carry a powder keg to a rival's causeway tile and lay it there (#748, the Age of Sappers): it breaches the road. */
  | ({ t: 'kegTile'; p: number; ids: number[]; tile: number } & Queued)
  /** A Missile Silo launches at a point (#605, the Atomic Age); `w` picks the warhead (#753), absent for the people's own branch's. */
  /** With `more` (#765, Launch Control), a salvo: this silo and the two in `more` fire one Atomic warhead each, each at its own point. */
  | { t: 'launch'; p: number; silo: number; x: number; y: number; w?: 'atomic' | 'fission' | 'fusion'; more?: { silo: number; x: number; y: number }[] }
  /** Hold a Missile Silo in Reserve (#759 s3), to answer rival warheads with its people's own, or stand it down to launch again. */
  | { t: 'reserve'; p: number; silo: number; on: boolean }
  /** Answer the card of tidings waiting at the fire (#443): `take` pays its price, otherwise it is passed by. */
  | { t: 'tiding'; p: number; card: TidingId; take: boolean }
  /** A player left an online match: the computer takes over their people. With `back` (sent only by the room, never a browser),
   * a player who left is back in the room, and takes their people back from the computer. */
  | { t: 'leave'; p: number; back?: true };

