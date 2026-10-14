import type { BuildingType, CivId, Cost, Difficulty, Domain, MapSize, MapType, Res, TechId, UnitType } from './types';

/** Every number in the game lives here. */

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;
export const secs = (s: number) => Math.round(s * TICK_HZ);

export interface Epoch {
  name: string;
  short: string;
  /** What it costs to advance into this epoch, and how long it takes at the Town Center. */
  cost: Cost;
  time: number;
  blurb: string;
}

export const EPOCHS: Epoch[] = [
  { name: 'Stone Age', short: 'Stone', cost: {}, time: 0, blurb: 'Clubs, slings and thatch.' },
  { name: 'Bronze Age', short: 'Bronze', cost: { food: 400, wood: 200 }, time: 35, blurb: 'Spears, bows, the horse, priests, rams and mudbrick towns.' },
  { name: 'Middle Ages', short: 'Medieval', cost: { food: 700, gold: 250, stone: 100 }, time: 50, blurb: 'Pikes, crossbows, knights, catapults and stone keeps.' },
  { name: 'Gunpowder Age', short: 'Gunpowder', cost: { food: 1000, gold: 600, stone: 250 }, time: 65, blurb: 'Muskets, cuirassiers, galleons, cannon and brick and tile.' },
  { name: 'Industrial Age', short: 'Industrial', cost: { food: 1400, gold: 900, stone: 400 }, time: 80, blurb: 'Rifles, field guns, ironclads, and the first aeroplanes.' },
];
export const LAST_EPOCH = EPOCHS.length - 1;

export type UnitClass = 'citizen' | 'infantry' | 'ranged' | 'cavalry' | 'siege' | 'priest' | 'hero' | 'ship' | 'fighter' | 'bomber' | 'trader';

export interface UnitStats {
  name: string;
  cls: UnitClass;
  hp: number;
  attack: number;
  /** Melee and missile armor. */
  armor: number;
  parmor: number;
  /** Reach beyond touching, in tiles (0 for melee). */
  range: number;
  /** Too close to shoot (catapults and cannon). */
  minRange?: number;
  /** Seconds between blows or shots. */
  reload: number;
  /** Tiles per second. */
  speed: number;
  sight: number;
  cost: Cost;
  /** Seconds to train. */
  time: number;
  radius: number;
  shot?: 'stone' | 'arrow' | 'bolt' | 'bullet' | 'boulder' | 'ball' | 'bomb';
  /** Damage spread over this radius where a shot lands. */
  splash?: number;
  /** Only attacks buildings (and other siege), like a ram. */
  buildingsOnly?: boolean;
  /** Rides a horse (for the model and the walk). */
  mounted?: boolean;
  /** Ships: how many passengers it carries (transports). */
  capacity?: number;
  blurb: string;
}

/** Each line has one version per epoch (null where it isn't available yet). Units re-arm when their owner advances. */
export const UNITS: Record<UnitType, (UnitStats | null)[]> = {
  citizen: [0, 1, 2, 3, 4].map((e) => ({
    name: 'Citizen',
    cls: 'citizen' as const,
    hp: 40 + e * 5,
    attack: 3 + e,
    armor: 0,
    parmor: 0,
    range: 0,
    reload: 1.5,
    speed: 1.55,
    sight: 5,
    cost: { food: 50 },
    time: 11,
    radius: 0.24,
    blurb: 'Gathers food, wood, stone and gold, hunts, and builds.',
  })),
  infantry: [
    { name: 'Clubman', cls: 'infantry', hp: 55, attack: 4, armor: 1, parmor: 0, range: 0, reload: 1.5, speed: 1.6, sight: 5, cost: { food: 50, wood: 15 }, time: 13, radius: 0.26, blurb: 'Tough foot soldier. Strong against cavalry and siege.' },
    { name: 'Spearman', cls: 'infantry', hp: 70, attack: 5, armor: 1, parmor: 1, range: 0, reload: 1.5, speed: 1.6, sight: 5, cost: { food: 50, wood: 25 }, time: 13, radius: 0.26, blurb: 'Spears hold off horsemen: triple damage to cavalry.' },
    { name: 'Pikeman', cls: 'infantry', hp: 85, attack: 6, armor: 2, parmor: 1, range: 0, reload: 1.5, speed: 1.6, sight: 5, cost: { food: 55, wood: 25, gold: 10 }, time: 13, radius: 0.27, blurb: 'Long pikes break knights. Weak to crossbows.' },
    { name: 'Halberdier', cls: 'infantry', hp: 100, attack: 8, armor: 3, parmor: 2, range: 0, reload: 1.5, speed: 1.65, sight: 5, cost: { food: 60, wood: 25, gold: 15 }, time: 13, radius: 0.27, blurb: 'Heavy polearms. The bane of cuirassiers.' },
    { name: 'Fusilier', cls: 'infantry', hp: 120, attack: 10, armor: 3, parmor: 3, range: 0, reload: 1.4, speed: 1.7, sight: 6, cost: { food: 60, wood: 20, gold: 20 }, time: 13, radius: 0.27, blurb: 'Bayonets fixed: stops hussars cold.' },
  ],
  ranged: [
    { name: 'Slinger', cls: 'ranged', hp: 35, attack: 4, armor: 0, parmor: 0, range: 4.5, reload: 2, speed: 1.5, sight: 7, cost: { food: 30, wood: 30 }, time: 14, radius: 0.24, shot: 'stone', blurb: 'Hurls stones from afar. Strong against infantry.' },
    { name: 'Archer', cls: 'ranged', hp: 45, attack: 5, armor: 0, parmor: 0, range: 5.5, reload: 2, speed: 1.5, sight: 7, cost: { food: 25, wood: 45 }, time: 14, radius: 0.24, shot: 'arrow', blurb: 'Bow and arrow. Beats infantry, fears cavalry.' },
    { name: 'Crossbowman', cls: 'ranged', hp: 55, attack: 7, armor: 0, parmor: 1, range: 6, reload: 2.2, speed: 1.5, sight: 7, cost: { wood: 45, gold: 25 }, time: 14, radius: 0.25, shot: 'bolt', blurb: 'Bolts that punch through mail.' },
    { name: 'Musketeer', cls: 'ranged', hp: 60, attack: 12, armor: 1, parmor: 1, range: 6.5, reload: 3, speed: 1.5, sight: 7, cost: { food: 40, gold: 45 }, time: 15, radius: 0.25, shot: 'bullet', blurb: 'Smoke and thunder. Shreds infantry, and fires on aircraft.' },
    { name: 'Rifleman', cls: 'ranged', hp: 70, attack: 15, armor: 1, parmor: 2, range: 7.5, reload: 2.6, speed: 1.6, sight: 8, cost: { food: 45, gold: 50 }, time: 15, radius: 0.25, shot: 'bullet', blurb: 'Rifles that reach far. Shreds infantry and shoots down aircraft.' },
  ],
  cavalry: [
    null,
    { name: 'Horseman', cls: 'cavalry', hp: 100, attack: 7, armor: 0, parmor: 1, range: 0, reload: 1.6, speed: 2.6, sight: 7, cost: { food: 70, gold: 40 }, time: 18, radius: 0.38, mounted: true, blurb: 'Fast rider. Runs down archers, priests and siege.' },
    { name: 'Knight', cls: 'cavalry', hp: 140, attack: 10, armor: 2, parmor: 2, range: 0, reload: 1.6, speed: 2.5, sight: 7, cost: { food: 70, gold: 70 }, time: 19, radius: 0.4, mounted: true, blurb: 'Armored lance. Crushes crossbowmen.' },
    { name: 'Cuirassier', cls: 'cavalry', hp: 170, attack: 12, armor: 3, parmor: 2, range: 0, reload: 1.5, speed: 2.7, sight: 7, cost: { food: 80, gold: 80 }, time: 19, radius: 0.4, mounted: true, blurb: 'Breastplate and saber. Rides down musketeers.' },
    { name: 'Hussar', cls: 'cavalry', hp: 190, attack: 14, armor: 3, parmor: 3, range: 0, reload: 1.4, speed: 2.9, sight: 8, cost: { food: 85, gold: 85 }, time: 19, radius: 0.4, mounted: true, blurb: 'Dashing light horse with sabers. Rides down riflemen and field guns.' },
  ],
  siege: [
    null,
    { name: 'Battering Ram', cls: 'siege', hp: 175, attack: 14, armor: 0, parmor: 10, range: 0, reload: 3, speed: 1.0, sight: 4, cost: { wood: 160, gold: 40 }, time: 25, radius: 0.45, buildingsOnly: true, blurb: 'Smashes buildings and walls. Shrugs off arrows; helpless against swords.' },
    { name: 'Catapult', cls: 'siege', hp: 110, attack: 16, armor: 0, parmor: 5, range: 8.5, minRange: 3, reload: 5, speed: 0.9, sight: 9, cost: { wood: 160, gold: 120 }, time: 30, radius: 0.45, shot: 'boulder', splash: 1.2, blurb: 'Hurls boulders that crush groups and buildings. Keep it guarded.' },
    { name: 'Bombard', cls: 'siege', hp: 150, attack: 30, armor: 1, parmor: 6, range: 10, minRange: 3, reload: 6, speed: 0.9, sight: 10, cost: { wood: 200, gold: 200 }, time: 32, radius: 0.45, shot: 'ball', splash: 0.7, blurb: 'Cannon fire that brings down walls and towers from far away.' },
    { name: 'Field Gun', cls: 'siege', hp: 170, attack: 36, armor: 1, parmor: 6, range: 11, minRange: 3, reload: 5.5, speed: 1.0, sight: 11, cost: { wood: 180, gold: 220 }, time: 32, radius: 0.45, shot: 'ball', splash: 0.9, blurb: 'Shells that level buildings and scatter crowds. Keep it guarded.' },
  ],
  priest: [
    null,
    { name: 'Priest', cls: 'priest', hp: 30, attack: 0, armor: 0, parmor: 0, range: 6, reload: 1, speed: 1.15, sight: 8, cost: { gold: 100 }, time: 25, radius: 0.24, blurb: 'Heals the wounded and turns enemies to your side.' },
    { name: 'Monk', cls: 'priest', hp: 35, attack: 0, armor: 0, parmor: 0, range: 7, reload: 1, speed: 1.15, sight: 9, cost: { gold: 100 }, time: 25, radius: 0.24, blurb: 'Heals the wounded and turns enemies to your side.' },
    { name: 'Bishop', cls: 'priest', hp: 40, attack: 0, armor: 0, parmor: 1, range: 8, reload: 1, speed: 1.2, sight: 10, cost: { gold: 100 }, time: 25, radius: 0.24, blurb: 'Heals the wounded and turns enemies to your side.' },
    { name: 'Missionary', cls: 'priest', hp: 45, attack: 0, armor: 0, parmor: 1, range: 8.5, reload: 1, speed: 1.25, sight: 10, cost: { gold: 100 }, time: 25, radius: 0.24, blurb: 'Heals the wounded and turns enemies to your side.' },
  ],
  hero: [
    { name: 'Chieftain', cls: 'hero', hp: 260, attack: 12, armor: 2, parmor: 2, range: 0, reload: 1.5, speed: 1.75, sight: 9, cost: { food: 150, gold: 100 }, time: 30, radius: 0.28, blurb: 'A great leader: nearby soldiers strike harder and heal. Only one at a time.' },
    { name: 'Warlord', cls: 'hero', hp: 340, attack: 15, armor: 3, parmor: 3, range: 0, reload: 1.5, speed: 1.8, sight: 9, cost: { food: 200, gold: 150 }, time: 30, radius: 0.28, blurb: 'A great leader: nearby soldiers strike harder and heal. Only one at a time.' },
    { name: 'Paladin', cls: 'hero', hp: 430, attack: 18, armor: 4, parmor: 4, range: 0, reload: 1.5, speed: 2.4, sight: 10, cost: { food: 250, gold: 200 }, time: 30, radius: 0.4, mounted: true, blurb: 'A great leader: nearby soldiers strike harder and heal. Only one at a time.' },
    { name: 'General', cls: 'hero', hp: 500, attack: 22, armor: 4, parmor: 5, range: 0, reload: 1.4, speed: 2.5, sight: 11, cost: { food: 300, gold: 250 }, time: 30, radius: 0.4, mounted: true, blurb: 'A great leader: nearby soldiers strike harder and heal. Only one at a time.' },
    { name: 'Field Marshal', cls: 'hero', hp: 560, attack: 25, armor: 5, parmor: 6, range: 0, reload: 1.4, speed: 2.6, sight: 12, cost: { food: 350, gold: 300 }, time: 30, radius: 0.4, mounted: true, blurb: 'A great leader: nearby soldiers strike harder and heal. Only one at a time.' },
  ],
  // ---- On the water ----
  fisher: [
    { name: 'Fishing Canoe', cls: 'ship', hp: 50, attack: 0, armor: 0, parmor: 2, range: 0, reload: 1, speed: 1.8, sight: 6, cost: { wood: 50 }, time: 14, radius: 0.36, blurb: 'Catches fish from the shoals and brings it to a Dock. Fish never run out quickly.' },
    { name: 'Fishing Boat', cls: 'ship', hp: 70, attack: 0, armor: 0, parmor: 2, range: 0, reload: 1, speed: 1.9, sight: 6, cost: { wood: 55 }, time: 14, radius: 0.38, blurb: 'Catches fish from the shoals and brings it to a Dock.' },
    { name: 'Fishing Cog', cls: 'ship', hp: 90, attack: 0, armor: 1, parmor: 3, range: 0, reload: 1, speed: 2.0, sight: 6, cost: { wood: 60 }, time: 14, radius: 0.4, blurb: 'Catches fish from the shoals and brings it to a Dock.' },
    { name: 'Fishing Sloop', cls: 'ship', hp: 110, attack: 0, armor: 1, parmor: 3, range: 0, reload: 1, speed: 2.1, sight: 7, cost: { wood: 65 }, time: 14, radius: 0.4, blurb: 'Catches fish from the shoals and brings it to a Dock.' },
    { name: 'Steam Trawler', cls: 'ship', hp: 140, attack: 0, armor: 2, parmor: 4, range: 0, reload: 1, speed: 2.4, sight: 7, cost: { wood: 50, gold: 20 }, time: 14, radius: 0.42, blurb: 'A steam-driven trawler: catches fish fast and brings it to a Dock.' },
  ],
  warship: [
    null,
    { name: 'Trireme', cls: 'ship', hp: 220, attack: 7, armor: 1, parmor: 2, range: 5.5, reload: 2, speed: 2.1, sight: 8, cost: { wood: 140, gold: 30 }, time: 24, radius: 0.5, shot: 'arrow', blurb: 'Archers on deck: rules the water and raids the shore.' },
    { name: 'War Cog', cls: 'ship', hp: 300, attack: 9, armor: 1, parmor: 3, range: 6.5, reload: 2.2, speed: 2.0, sight: 8, cost: { wood: 150, gold: 50 }, time: 25, radius: 0.5, shot: 'bolt', blurb: 'A castle afloat, bristling with crossbows.' },
    { name: 'Galleon', cls: 'ship', hp: 380, attack: 22, armor: 2, parmor: 4, range: 8, reload: 4, speed: 2.1, sight: 9, cost: { wood: 180, gold: 90 }, time: 28, radius: 0.52, shot: 'ball', splash: 0.6, blurb: 'Broadsides of cannon: sinks ships and pounds the coast.' },
    { name: 'Ironclad', cls: 'ship', hp: 560, attack: 30, armor: 3, parmor: 5, range: 9, reload: 4, speed: 2.3, sight: 10, cost: { wood: 120, gold: 160 }, time: 30, radius: 0.55, shot: 'ball', splash: 0.7, blurb: 'Armored steam and great guns: masters the sea and shells the shore. Fires at aircraft too.' },
  ],
  transport: [
    null,
    { name: 'Transport Galley', cls: 'ship', hp: 200, attack: 0, armor: 1, parmor: 3, range: 0, reload: 1, speed: 2.0, sight: 7, cost: { wood: 125 }, time: 20, radius: 0.5, capacity: 8, blurb: 'Carries soldiers and citizens across the water. Right-click a shore to land them.' },
    { name: 'Transport Cog', cls: 'ship', hp: 260, attack: 0, armor: 1, parmor: 3, range: 0, reload: 1, speed: 2.1, sight: 7, cost: { wood: 125 }, time: 20, radius: 0.5, capacity: 10, blurb: 'Carries soldiers and citizens across the water. Right-click a shore to land them.' },
    { name: 'Fluyt', cls: 'ship', hp: 320, attack: 0, armor: 1, parmor: 4, range: 0, reload: 1, speed: 2.2, sight: 8, cost: { wood: 130 }, time: 20, radius: 0.52, capacity: 10, blurb: 'Carries soldiers and citizens across the water. Right-click a shore to land them.' },
    { name: 'Steam Transport', cls: 'ship', hp: 420, attack: 0, armor: 2, parmor: 5, range: 0, reload: 1, speed: 2.6, sight: 8, cost: { wood: 100, gold: 40 }, time: 20, radius: 0.55, capacity: 12, blurb: 'Carries soldiers and citizens across the water. Right-click a shore to land them.' },
  ],
  // ---- In the air ----
  fighter: [
    null,
    null,
    null,
    null,
    { name: 'Biplane Fighter', cls: 'fighter', hp: 140, attack: 9, armor: 1, parmor: 1, range: 3.5, reload: 0.8, speed: 5.5, sight: 11, cost: { food: 60, gold: 160 }, time: 24, radius: 0.45, shot: 'bullet', blurb: 'Fast and nimble: shoots down bombers and other fighters. Weak against the ground.' },
  ],
  bomber: [
    null,
    null,
    null,
    null,
    { name: 'Bomber', cls: 'bomber', hp: 240, attack: 40, armor: 1, parmor: 2, range: 0.6, reload: 6, speed: 3.8, sight: 9, cost: { wood: 120, gold: 260 }, time: 30, radius: 0.55, shot: 'bomb', splash: 1.6, blurb: 'Drops bombs that wreck buildings, ships and crowds. Easy prey for fighters and rifles.' },
  ],
  // ---- On the road ----
  trader: [
    null,
    { name: 'Pack Donkey', cls: 'trader', hp: 80, attack: 0, armor: 0, parmor: 1, range: 0, reload: 1, speed: 1.3, sight: 6, cost: { wood: 60, gold: 40 }, time: 20, radius: 0.32, blurb: 'Carries goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
    { name: 'Ox Cart', cls: 'trader', hp: 110, attack: 0, armor: 0, parmor: 2, range: 0, reload: 1, speed: 1.3, sight: 6, cost: { wood: 70, gold: 40 }, time: 20, radius: 0.4, blurb: 'Carries goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
    { name: 'Covered Wagon', cls: 'trader', hp: 140, attack: 0, armor: 1, parmor: 2, range: 0, reload: 1, speed: 1.45, sight: 7, cost: { wood: 80, gold: 50 }, time: 20, radius: 0.42, blurb: 'Carries goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
    { name: 'Traction Engine', cls: 'trader', hp: 180, attack: 0, armor: 2, parmor: 3, range: 0, reload: 1, speed: 1.65, sight: 7, cost: { wood: 60, gold: 60 }, time: 20, radius: 0.45, blurb: 'Steams goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
  ],
};

const DOMAINS: Partial<Record<UnitType, Domain>> = { fisher: 'water', warship: 'water', transport: 'water', fighter: 'air', bomber: 'air' };
/** Where a unit line goes: on foot, on the water or in the air. */
export const domainOf = (type: UnitType): Domain => DOMAINS[type] ?? 'land';

export const UNIT_TYPES: UnitType[] = ['citizen', 'infantry', 'ranged', 'cavalry', 'siege', 'priest', 'hero', 'fisher', 'warship', 'transport', 'fighter', 'bomber', 'trader'];
export const MILITARY: UnitType[] = ['infantry', 'ranged', 'cavalry', 'siege', 'hero', 'warship', 'fighter', 'bomber'];

type Target = UnitClass | 'building';
/** The counter triangle (and its friends): damage multiplier by attacker class against target class. */
export const BONUS: Record<UnitClass, Record<Target, number>> = {
  citizen: { citizen: 1, infantry: 1, ranged: 1, cavalry: 1, siege: 1.5, priest: 1, hero: 1, ship: 1, fighter: 0, bomber: 0, building: 0.6, trader: 1 },
  infantry: { citizen: 1, infantry: 1, ranged: 1, cavalry: 3, siege: 2.5, priest: 1, hero: 1, ship: 1, fighter: 0, bomber: 0, building: 1.8, trader: 1.2 },
  ranged: { citizen: 1, infantry: 2, ranged: 1, cavalry: 0.7, siege: 0.4, priest: 1.5, hero: 1, ship: 0.8, fighter: 1.5, bomber: 1.8, building: 0.25, trader: 1 },
  cavalry: { citizen: 1.3, infantry: 0.7, ranged: 2.2, cavalry: 1, siege: 2, priest: 2, hero: 1, ship: 1, fighter: 0, bomber: 0, building: 0.8, trader: 2.5 },
  siege: { citizen: 1, infantry: 1, ranged: 1, cavalry: 1, siege: 1.5, priest: 1, hero: 1, ship: 2, fighter: 0, bomber: 0, building: 4, trader: 1.5 },
  priest: { citizen: 0, infantry: 0, ranged: 0, cavalry: 0, siege: 0, priest: 0, hero: 0, ship: 0, fighter: 0, bomber: 0, building: 0, trader: 0 },
  hero: { citizen: 1.2, infantry: 1.2, ranged: 1.2, cavalry: 1.5, siege: 2, priest: 1.2, hero: 1, ship: 1, fighter: 0, bomber: 0, building: 1.5, trader: 1.5 },
  ship: { citizen: 1, infantry: 1, ranged: 1, cavalry: 1, siege: 1.5, priest: 1, hero: 1, ship: 1.5, fighter: 1, bomber: 1.2, building: 1.6, trader: 1 },
  fighter: { citizen: 0.6, infantry: 0.5, ranged: 0.5, cavalry: 0.5, siege: 0.6, priest: 0.6, hero: 0.4, ship: 0.5, fighter: 1.5, bomber: 3, building: 0.2, trader: 0.6 },
  bomber: { citizen: 1.5, infantry: 1.2, ranged: 1.2, cavalry: 1, siege: 2, priest: 1, hero: 0.8, ship: 2.5, fighter: 0, bomber: 0, building: 3, trader: 1.5 },
  trader: { citizen: 0, infantry: 0, ranged: 0, cavalry: 0, siege: 0, priest: 0, hero: 0, ship: 0, fighter: 0, bomber: 0, building: 0, trader: 0 },
};

/** The best counter to each class, for the computer opponent and the tips. */
export const COUNTER: Record<'infantry' | 'ranged' | 'cavalry', UnitType> = { infantry: 'ranged', ranged: 'cavalry', cavalry: 'infantry' };

/** A hero's presence: soldiers within this many tiles strike harder and heal. */
export const AURA = { radius: 6, attack: 1.2, heal: 1.5 };
/**
 * Veterancy: a soldier who defeats enemy soldiers earns ranks (Veteran, Elite, Champion). `kills` is how
 * many it takes for each rank; a rank adds to its blows (`attack`, a multiplier) and its armor.
 */
export const VETERANCY = {
  names: ['Veteran', 'Elite', 'Champion'],
  kills: [3, 8, 15],
  attack: [1.1, 1.2, 1.3],
  armor: [0, 1, 2],
};
/** Priests: healing per second, and how long a conversion takes (seconds, before the target's toughness). */
export const PRIEST = { heal: 3, convert: 7, rest: 8 };
/**
 * Relics: one lies out for each player, `home` tiles from their town, and `extra` more (by map size) where
 * the land is within `fair` tiles of as far from the two nearest towns, at least `spacing` apart. A
 * relic kept in a Temple brings its owner `gold` every `every` seconds, and `score` to their score.
 */
export const RELIC = { home: 20, fair: 3, spacing: 12, extra: { small: 1, medium: 2, large: 3 } as Record<MapSize, number>, gold: 1, every: 2, score: 60 };
/**
 * Trade: `posts` trading posts (by map size) stand within `edge` tiles of the map's edge (at least 3),
 * about as far from their two nearest towns (within `fair` tiles), at least `far` of the map's width
 * from every town and `spacing` of it from each other. A post's plaza runs `plaza` tiles each way from
 * its center; a trader trades once within `reach` tiles of the center. A trip pays `gold` × the
 * squared distance (in tiles) from the trader's Market to the post, `epoch` more for each epoch after
 * the Bronze Age, at most `max`: so a long road pays more per minute, and has more road to guard.
 */
/** Repairs: restoring a building's whole health costs this share of its price, paid as the hammers work. */
export const REPAIR_SHARE = 0.4;
export const TRADE = { posts: { small: 2, medium: 2, large: 3 } as Record<MapSize, number>, edge: 9, fair: 4, far: 0.3, spacing: 0.4, plaza: 1, reach: 1.8, gold: 0.012, epoch: 0.08, max: 180 };

export interface BuildingStats {
  name: string;
  size: number;
  hp: number;
  cost: Cost;
  /** Walls cost differently by epoch (a palisade of logs first, then stone). */
  costByEpoch?: Cost[];
  /** Seconds for one citizen to build it. */
  time: number;
  /** Population room it gives. */
  pop: number;
  sight: number;
  trains: UnitType[];
  /** Resources citizens can drop off here. */
  drop: Res[];
  /** The first epoch it can be built in. */
  epoch: number;
  /** Shoots arrows at enemies in range (one more arrow for each unit sheltering inside). */
  guns?: { damage: number; range: number; reload: number };
  /** How many units can shelter inside. */
  garrison?: number;
  /** Units can walk over it (farms). */
  open?: boolean;
  /** Must stand on the shore, with water beside it (docks). */
  shore?: boolean;
  /** Which build menu it is in, and its key there. */
  menu: 'eco' | 'mil';
  key: string;
  blurb: string;
}

export const BUILDINGS: Record<BuildingType, BuildingStats> = {
  towncenter: { name: 'Town Center', size: 4, hp: 2400, cost: { wood: 275, stone: 150 }, time: 110, pop: 10, sight: 8, trains: ['citizen', 'hero'], drop: ['food', 'wood', 'stone', 'gold'], epoch: 0, guns: { damage: 6, range: 7, reload: 2 }, garrison: 15, menu: 'eco', key: 'T', blurb: 'Trains citizens and heroes, takes in every resource and leads your people into the next epoch. Citizens shelter here when the bell rings.' },
  house: { name: 'House', size: 2, hp: 600, cost: { wood: 35 }, time: 18, pop: 5, sight: 3, trains: [], drop: [], epoch: 0, menu: 'eco', key: 'E', blurb: 'Room for 5 more people.' },
  storehouse: { name: 'Storehouse', size: 2, hp: 800, cost: { wood: 75 }, time: 22, pop: 0, sight: 4, trains: [], drop: ['food', 'wood', 'stone', 'gold'], epoch: 0, menu: 'eco', key: 'S', blurb: 'A drop-off for every resource, and better tools for gatherers. Build it by woods and mines.' },
  farm: { name: 'Farm', size: 3, hp: 300, cost: { wood: 55 }, time: 12, pop: 0, sight: 2, trains: [], drop: [], epoch: 0, open: true, menu: 'eco', key: 'F', blurb: 'Food that never runs out, worked by one citizen.' },
  market: { name: 'Market', size: 3, hp: 1600, cost: { wood: 175 }, time: 40, pop: 0, sight: 5, trains: ['trader'], drop: [], epoch: 1, menu: 'eco', key: 'M', blurb: 'Buy and sell food, wood and stone for gold (prices move as people trade), and train traders, who bring back gold from the trading posts.' },
  temple: { name: 'Temple', size: 3, hp: 1600, cost: { wood: 120, stone: 100 }, time: 40, pop: 0, sight: 6, trains: ['priest'], drop: [], epoch: 1, menu: 'eco', key: 'Y', blurb: 'Trains priests, who heal and convert.' },
  wonder: { name: 'Wonder', size: 5, hp: 4000, cost: { wood: 1000, stone: 1000, gold: 1000 }, time: 400, pop: 0, sight: 8, trains: [], drop: [], epoch: 1, menu: 'eco', key: 'X', blurb: 'The glory of your people. If it stands long enough once finished, you win.' },
  wall: { name: 'Wall', size: 1, hp: 500, cost: { wood: 3 }, costByEpoch: [{ wood: 3 }, { stone: 4 }, { stone: 4 }, { stone: 5 }, { stone: 5 }], time: 5, pop: 0, sight: 2, trains: [], drop: [], epoch: 0, menu: 'eco', key: 'L', blurb: 'Drag to raise a line of wall: a palisade of logs in the Stone Age, stone after.' },
  gate: { name: 'Gate', size: 2, hp: 1200, cost: { stone: 30 }, costByEpoch: [{ wood: 30 }, { stone: 30 }, { stone: 30 }, { stone: 40 }, { stone: 40 }], time: 20, pop: 0, sight: 3, trains: [], drop: [], epoch: 0, menu: 'eco', key: 'G', blurb: 'Opens for your people and allies only. Put it in a wall.' },
  barracks: { name: 'Barracks', size: 3, hp: 1400, cost: { wood: 150 }, time: 35, pop: 0, sight: 5, trains: ['infantry'], drop: [], epoch: 0, menu: 'mil', key: 'B', blurb: 'Trains foot soldiers, who beat cavalry and siege.' },
  range: { name: 'Archery Range', size: 3, hp: 1400, cost: { wood: 150 }, time: 35, pop: 0, sight: 5, trains: ['ranged'], drop: [], epoch: 0, menu: 'mil', key: 'A', blurb: 'Trains slingers, archers and their heirs, who beat infantry.' },
  stable: { name: 'Stable', size: 3, hp: 1400, cost: { wood: 150, gold: 50 }, time: 40, pop: 0, sight: 5, trains: ['cavalry'], drop: [], epoch: 1, menu: 'mil', key: 'C', blurb: 'Trains cavalry, who beat archers, priests and siege.' },
  forge: { name: 'Forge', size: 3, hp: 1600, cost: { wood: 175 }, time: 40, pop: 0, sight: 5, trains: [], drop: [], epoch: 1, menu: 'mil', key: 'R', blurb: 'Better weapons and armor for every soldier.' },
  workshop: { name: 'Siege Workshop', size: 3, hp: 1400, cost: { wood: 200 }, time: 40, pop: 0, sight: 5, trains: ['siege'], drop: [], epoch: 1, menu: 'mil', key: 'K', blurb: 'Builds rams, catapults and cannon to break towns.' },
  tower: { name: 'Watch Tower', size: 2, hp: 1000, cost: { wood: 50, stone: 125 }, time: 45, pop: 0, sight: 9, trains: [], drop: [], epoch: 1, guns: { damage: 8, range: 8, reload: 1.8 }, garrison: 5, menu: 'mil', key: 'W', blurb: 'Sees far and shoots at enemies nearby, aircraft too. Shelter soldiers inside for more arrows.' },
  dock: { name: 'Dock', size: 3, hp: 1800, cost: { wood: 150 }, time: 35, pop: 0, sight: 6, trains: ['fisher', 'transport', 'warship'], drop: ['food'], epoch: 0, shore: true, menu: 'eco', key: 'D', blurb: 'Builds fishing boats, transports and warships, and takes in fish. Build it on the shore.' },
  airfield: { name: 'Airfield', size: 4, hp: 2200, cost: { wood: 250, stone: 100, gold: 150 }, time: 60, pop: 0, sight: 8, trains: ['fighter', 'bomber'], drop: [], epoch: 4, menu: 'mil', key: 'F', blurb: 'Builds fighters and bombers. Fighters hunt aircraft; bombers wreck towns.' },
};

export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];

/** Buildings grow sturdier with each epoch. */
export const buildingHp = (type: BuildingType, epoch: number) => Math.round(BUILDINGS[type].hp * (1 + epoch * 0.25));

/** What a building costs in an epoch (walls change material). */
export function buildingCost(type: BuildingType, epoch: number): Cost {
  const b = BUILDINGS[type];
  return b.costByEpoch ? b.costByEpoch[Math.min(epoch, b.costByEpoch.length - 1)] : b.cost;
}

// ---- Technologies ----------------------------------------------------------------------------------

/** What a technology or a civilization changes. Multipliers start at 1, additions at 0. */
export interface Mods {
  meleeAttack: number;
  rangedAttack: number;
  armor: number;
  parmor: number;
  range: number;
  carry: number;
  citizenSpeed: number;
  wood: number;
  mine: number;
  farm: number;
  forage: number;
  hunt: number;
  buildingHp: number;
  buildSpeed: number;
  militaryTrain: number;
  rangedTrain: number;
  cavalrySpeed: number;
  infantryHp: number;
  infantryArmor: number;
  priest: number;
  siegeAttack: number;
  siegeRange: number;
  techCost: number;
  wonderCost: number;
  extraCitizens: number;
  fish: number;
  shipHp: number;
  shipRange: number;
  airSpeed: number;
  airHp: number;
  traderSpeed: number;
  tradeGold: number;
  relicGold: number;
}

export const NO_MODS: Mods = {
  meleeAttack: 0, rangedAttack: 0, armor: 0, parmor: 0, range: 0, carry: 0, citizenSpeed: 1, wood: 1, mine: 1, farm: 1, forage: 1, hunt: 1,
  buildingHp: 1, buildSpeed: 1, militaryTrain: 1, rangedTrain: 1, cavalrySpeed: 1, infantryHp: 1, infantryArmor: 0, priest: 1,
  siegeAttack: 1, siegeRange: 0, techCost: 1, wonderCost: 1, extraCitizens: 0, fish: 1, shipHp: 1, shipRange: 0, airSpeed: 1, airHp: 1,
  traderSpeed: 1, tradeGold: 1, relicGold: 1,
};

export interface Tech {
  name: string;
  at: BuildingType;
  epoch: number;
  cost: Cost;
  time: number;
  needs?: TechId;
  /** Additions (for attack, armor, range, carry) or multipliers (for rates and speeds). */
  add?: Partial<Mods>;
  mul?: Partial<Mods>;
  blurb: string;
  icon: string;
}

export const TECHS: Record<TechId, Tech> = {
  forging: { name: 'Forging', at: 'forge', epoch: 1, cost: { food: 150 }, time: 30, add: { meleeAttack: 1 }, blurb: '+1 attack for foot soldiers, riders and heroes.', icon: '⚔' },
  ironCasting: { name: 'Iron Casting', at: 'forge', epoch: 2, cost: { food: 220, gold: 120 }, time: 40, needs: 'forging', add: { meleeAttack: 2 }, blurb: '+2 more melee attack.', icon: '⚔' },
  blastFurnace: { name: 'Blast Furnace', at: 'forge', epoch: 3, cost: { food: 275, gold: 225 }, time: 50, needs: 'ironCasting', add: { meleeAttack: 2 }, blurb: '+2 more melee attack.', icon: '⚔' },
  fletching: { name: 'Fletching', at: 'forge', epoch: 1, cost: { food: 100, wood: 50 }, time: 30, add: { rangedAttack: 1, range: 1 }, blurb: '+1 attack and +1 range for archers and their heirs, and for towers.', icon: '🏹' },
  bodkin: { name: 'Bodkin Points', at: 'forge', epoch: 2, cost: { food: 200, wood: 100 }, time: 40, needs: 'fletching', add: { rangedAttack: 1, range: 1 }, blurb: '+1 more ranged attack and range.', icon: '🏹' },
  scaleArmor: { name: 'Scale Armor', at: 'forge', epoch: 1, cost: { food: 150 }, time: 30, add: { armor: 1, parmor: 1 }, blurb: '+1 melee and missile armor for every soldier.', icon: '🛡' },
  chainMail: { name: 'Chain Mail', at: 'forge', epoch: 2, cost: { food: 200, gold: 100 }, time: 40, needs: 'scaleArmor', add: { armor: 1, parmor: 1 }, blurb: '+1 more armor of each kind.', icon: '🛡' },
  plateArmor: { name: 'Plate Armor', at: 'forge', epoch: 3, cost: { food: 300, gold: 150 }, time: 50, needs: 'chainMail', add: { armor: 2, parmor: 2 }, blurb: '+2 more armor of each kind.', icon: '🛡' },
  wheelbarrow: { name: 'Wheelbarrow', at: 'towncenter', epoch: 1, cost: { food: 175, wood: 50 }, time: 35, add: { carry: 3 }, mul: { citizenSpeed: 1.1 }, blurb: 'Citizens carry 3 more and walk 10% faster.', icon: '🛒' },
  handcart: { name: 'Handcart', at: 'towncenter', epoch: 2, cost: { food: 300, wood: 200 }, time: 45, needs: 'wheelbarrow', add: { carry: 4 }, mul: { citizenSpeed: 1.1 }, blurb: 'Citizens carry 4 more and walk 10% faster again.', icon: '🛒' },
  plow: { name: 'Plow', at: 'towncenter', epoch: 0, cost: { food: 75, wood: 75 }, time: 25, mul: { farm: 1.2, forage: 1.15, hunt: 1.15 }, blurb: 'Farms work 20% faster; berries and game 15%.', icon: '🌾' },
  irrigation: { name: 'Irrigation', at: 'towncenter', epoch: 2, cost: { food: 250, wood: 150 }, time: 40, needs: 'plow', mul: { farm: 1.25 }, blurb: 'Farms work 25% faster again.', icon: '🌾' },
  masonry: { name: 'Masonry', at: 'towncenter', epoch: 2, cost: { wood: 175, stone: 150 }, time: 40, mul: { buildingHp: 1.2 }, blurb: 'Every building is 20% sturdier.', icon: '🧱' },
  axes: { name: 'Double-Bit Axe', at: 'storehouse', epoch: 0, cost: { food: 100, wood: 50 }, time: 25, mul: { wood: 1.2 }, blurb: 'Citizens cut wood 20% faster.', icon: '🪓' },
  saws: { name: 'Two-Man Saw', at: 'storehouse', epoch: 2, cost: { food: 300, wood: 200 }, time: 40, needs: 'axes', mul: { wood: 1.2 }, blurb: 'Wood 20% faster again.', icon: '🪓' },
  picks: { name: 'Mining Picks', at: 'storehouse', epoch: 1, cost: { food: 100, wood: 75 }, time: 30, mul: { mine: 1.2 }, blurb: 'Stone and gold come 20% faster.', icon: '⛏' },
  shafts: { name: 'Shaft Mining', at: 'storehouse', epoch: 2, cost: { food: 200, wood: 150 }, time: 40, needs: 'picks', mul: { mine: 1.2 }, blurb: 'Stone and gold 20% faster again.', icon: '⛏' },
  conscription: { name: 'Conscription', at: 'barracks', epoch: 3, cost: { food: 400, gold: 200 }, time: 50, mul: { militaryTrain: 0.75 }, blurb: 'Soldiers train 25% faster everywhere.', icon: '📯' },
  husbandry: { name: 'Husbandry', at: 'stable', epoch: 2, cost: { food: 150 }, time: 35, mul: { cavalrySpeed: 1.1 }, blurb: 'Cavalry ride 10% faster.', icon: '🐎' },
  theology: { name: 'Theology', at: 'temple', epoch: 2, cost: { gold: 200 }, time: 40, mul: { priest: 1.5 }, blurb: 'Priests convert and heal half again as fast.', icon: '✨' },
  chemistry: { name: 'Chemistry', at: 'workshop', epoch: 3, cost: { food: 300, gold: 200 }, time: 45, add: { siegeRange: 1 }, mul: { siegeAttack: 1.2 }, blurb: 'Siege hits 20% harder and reaches 1 tile farther.', icon: '🧪' },
  gillnets: { name: 'Gillnets', at: 'dock', epoch: 1, cost: { food: 100, wood: 100 }, time: 30, mul: { fish: 1.25 }, blurb: 'Fishing boats fish 25% faster.', icon: '🐟' },
  shipwright: { name: 'Shipwright', at: 'dock', epoch: 2, cost: { wood: 250, gold: 150 }, time: 40, add: { shipRange: 1 }, mul: { shipHp: 1.2 }, blurb: 'Ships are 20% sturdier, and warships shoot 1 tile farther.', icon: '⚓' },
  rifling: { name: 'Rifling', at: 'forge', epoch: 4, cost: { food: 300, gold: 250 }, time: 45, needs: 'bodkin', add: { rangedAttack: 2, range: 1 }, blurb: '+2 attack and +1 range for riflemen and towers.', icon: '🎯' },
  steamEngine: { name: 'Steam Engine', at: 'towncenter', epoch: 4, cost: { food: 400, wood: 300 }, time: 50, add: { carry: 4 }, mul: { citizenSpeed: 1.15, wood: 1.1, mine: 1.1 }, blurb: 'Citizens carry 4 more, walk 15% faster, and cut and mine 10% faster.', icon: '🚂' },
  aviation: { name: 'Aviation', at: 'airfield', epoch: 4, cost: { food: 300, gold: 300 }, time: 45, mul: { airSpeed: 1.15, airHp: 1.2 }, blurb: 'Aircraft fly 15% faster and are 20% sturdier.', icon: '✈' },
  caravan: { name: 'Caravans', at: 'market', epoch: 2, cost: { food: 200, gold: 100 }, time: 40, mul: { traderSpeed: 1.2 }, blurb: 'Traders travel 20% faster.', icon: '🐪' },
  banking: { name: 'Banking', at: 'market', epoch: 3, cost: { food: 300, gold: 200 }, time: 45, needs: 'caravan', mul: { tradeGold: 1.2 }, blurb: 'Every trade trip pays 20% more gold.', icon: '🏦' },
  pilgrimage: { name: 'Pilgrimage', at: 'temple', epoch: 2, cost: { food: 200, gold: 150 }, time: 40, mul: { relicGold: 2 }, blurb: 'Every relic kept in a Temple pays double gold.', icon: '🕯' },
};

export const TECH_IDS = Object.keys(TECHS) as TechId[];

// ---- Civilizations ---------------------------------------------------------------------------------

export interface Civ {
  name: string;
  blurb: string;
  add?: Partial<Mods>;
  mul?: Partial<Mods>;
}

export const CIVS: Record<CivId, Civ> = {
  egyptians: { name: 'Egyptians', blurb: 'Farmers of the great river: farms work 15% faster and wonders cost a quarter less.', mul: { farm: 1.15, wonderCost: 0.75 } },
  greeks: { name: 'Greeks', blurb: 'Hoplites: foot soldiers have 15% more health and +1 melee armor.', add: { infantryArmor: 1 }, mul: { infantryHp: 1.15 } },
  romans: { name: 'Romans', blurb: 'Builders of roads and forts: buildings are 20% sturdier and go up 25% faster.', mul: { buildingHp: 1.2, buildSpeed: 1.25 } },
  mongols: { name: 'Mongols', blurb: 'Riders of the steppe: cavalry ride 15% faster and hunters work 40% faster.', mul: { cavalrySpeed: 1.15, hunt: 1.4 } },
  chinese: { name: 'Chinese', blurb: 'A great people: start with 2 more citizens, and technologies cost 15% less.', add: { extraCitizens: 2 }, mul: { techCost: 0.85 } },
  britons: { name: 'Britons', blurb: 'Longbowmen: archers and their heirs reach 1 tile farther, and archery ranges train 25% faster.', add: { range: 1 }, mul: { rangedTrain: 0.75 } },
};

export const CIV_IDS = Object.keys(CIVS) as CivId[];

/**
 * A people's signature soldiers: one unit line that carries their own names (one per epoch) and a
 * trade-off in numbers. Same model and counters as the line it replaces; only the stats and names change.
 * Cost is left alone on purpose, so training and the computer's budgeting price every line the same.
 */
export interface Signature {
  type: UnitType;
  /** One name per epoch, in place of the line's own. */
  names: string[];
  add?: Partial<Pick<UnitStats, 'hp' | 'attack' | 'armor' | 'parmor' | 'range' | 'sight' | 'speed'>>;
  mul?: Partial<Pick<UnitStats, 'hp' | 'attack' | 'speed' | 'time' | 'reload'>>;
  blurb: string;
}

export const SIGNATURES: Record<CivId, Signature> = {
  egyptians: { type: 'priest', names: ['Priest', 'Temple Priest', 'High Priest', 'Hierophant', 'Hierophant'], add: { range: 1 }, mul: { time: 0.8 }, blurb: 'Egyptian priests chant from 1 tile farther and are trained 20% faster.' },
  greeks: { type: 'infantry', names: ['Hoplite', 'Hoplite', 'Phalangite', 'Phalangite', 'Evzone'], add: { parmor: 1 }, mul: { speed: 0.95 }, blurb: 'Shield wall: +1 pierce armor, but 5% slower on the march.' },
  romans: { type: 'infantry', names: ['Triarius', 'Legionary', 'Legionary', 'Centurion', 'Centurion'], add: { attack: 1, armor: 1 }, mul: { time: 1.15 }, blurb: 'Legions hit harder (+1 attack, +1 armor) but take 15% longer to train.' },
  mongols: { type: 'cavalry', names: ['Rider', 'Horse Archer', 'Mangudai', 'Keshig', 'Keshig'], add: { attack: 2 }, mul: { hp: 0.9 }, blurb: 'Steppe riders strike hard (+2 attack) but have 10% less health.' },
  chinese: { type: 'siege', names: ['Ram', 'Great Ram', 'Trebuchet', 'Fire Bombard', 'Rocket Gun'], mul: { attack: 1.15, reload: 0.9 }, blurb: 'Chinese engineers: siege hits 15% harder and reloads 10% faster.' },
  britons: { type: 'ranged', names: ['Slinger', 'Yeoman', 'Longbowman', 'Longbowman', 'Redcoat'], add: { attack: 1, sight: 1 }, mul: { speed: 0.95 }, blurb: 'Yeomen of the longbow: +1 attack and sight, 5% slower afoot.' },
};

// ---- Economy ---------------------------------------------------------------------------------------

export const POP_MAX = 150;
export const CARRY = [10, 12, 14, 16, 18];
/** What a fishing boat holds, by epoch. */
export const FISH_CARRY = [15, 18, 21, 24, 30];
/** Gathering per second, before the epoch bonus. */
export const GATHER: Record<'tree' | 'berry' | 'stone' | 'gold' | 'farm' | 'meat' | 'fish', number> = { tree: 0.65, berry: 0.8, stone: 0.55, gold: 0.55, farm: 0.6, meat: 1.0, fish: 0.75 };
export const EPOCH_GATHER_BONUS = 0.1;
export const AMOUNT = { tree: 80, berry: 125, stone: 300, gold: 400, meat: 140, fish: 250 };
/** Deer: health, speeds, and how far a hunter throws a spear. */
export const DEER = { hp: 8, walk: 0.8, flee: 2.3, spear: 3.5, spearDamage: 4 };

/** Market: gold per 100 of a resource to start, how much each trade moves it, and the cut when selling. */
export const MARKET = { start: { food: 100, wood: 100, stone: 130 }, step: 4, min: 20, max: 600, sellRate: 0.75, lot: 100,
  /** Every `every` seconds each price moves this far back toward where it started, so a glut or a shortage fades. */
  recover: 1, every: 10 };

export const START_RES = { food: 300, wood: 250, stone: 150, gold: 100 };
/** Extra to start with when starting in a later epoch. */
export const EPOCH_START_RES = [
  { food: 0, wood: 0, stone: 0, gold: 0 },
  { food: 300, wood: 300, stone: 150, gold: 200 },
  { food: 600, wood: 500, stone: 300, gold: 450 },
  { food: 900, wood: 700, stone: 500, gold: 700 },
  { food: 1200, wood: 900, stone: 650, gold: 950 },
];
export const START_CITIZENS = 5;
/** Deathmatch: everyone starts rich. */
export const DEATHMATCH_RES = { food: 20000, wood: 20000, stone: 5000, gold: 20000 };

/** A finished wonder wins if it stands this long (seconds). */
export const WONDER_SECONDS = 300;

export const MAP_SIZES: Record<MapSize, { label: string; n: number }> = {
  small: { label: 'Small', n: 96 },
  medium: { label: 'Medium', n: 120 },
  large: { label: 'Large', n: 144 },
};

export const MAP_TYPES: Record<MapType, { label: string; blurb: string }> = {
  continental: { label: 'Continental', blurb: 'Rolling land with lakes, ridges and woods.' },
  highlands: { label: 'Highlands', blurb: 'Hills and rocky ridges with passes between.' },
  lakes: { label: 'Great Lakes', blurb: 'Wide lakes split the land; go round.' },
  forest: { label: 'Black Forest', blurb: 'Deep woods everywhere: cut your way through.' },
  plains: { label: 'Plains', blurb: 'Open grassland, few trees, nowhere to hide.' },
  sea: { label: 'Inland Sea', blurb: 'A great sea in the middle, full of fish: rule the water, land round the shore.' },
};

export interface AiLevel {
  label: string;
  /** Gathering multiplier (a small edge on Hard). */
  gather: number;
  citizens: number;
  /** Seconds before the first attack, and its size; later waves grow. */
  firstAttack: number;
  wave: number;
  waveGrowth: number;
  /** Seconds between decisions. */
  think: number;
  towers: number;
  /** Uses priests, heroes, siege and the market. */
  clever: boolean;
  /** Traders it keeps on the road from the Middle Ages (half as many in the Bronze Age). */
  traders: number;
}

export const AI_LEVELS: Record<Difficulty, AiLevel> = {
  easy: { label: 'Easy', gather: 0.8, citizens: 16, firstAttack: 720, wave: 6, waveGrowth: 3, think: 1.5, towers: 0, clever: false, traders: 2 },
  normal: { label: 'Normal', gather: 1, citizens: 24, firstAttack: 480, wave: 8, waveGrowth: 4, think: 1, towers: 1, clever: true, traders: 5 },
  hard: { label: 'Hard', gather: 1.15, citizens: 32, firstAttack: 330, wave: 9, waveGrowth: 5, think: 0.5, towers: 2, clever: true, traders: 8 },
};

export const PLAYER_COLORS = ['#2f7fe0', '#e0473a', '#e8b630', '#3aa35a', '#9b59d0', '#e07a2f'];
export const PLAYER_NAMES = ['You', 'Rival'];

export const RES_LABEL: Record<Res, string> = { food: 'Food', wood: 'Wood', stone: 'Stone', gold: 'Gold' };

/** A unit line's base numbers in an epoch (before technologies and civilization). */
export function unitStats(type: UnitType, epoch: number): UnitStats {
  const line = UNITS[type];
  for (let e = Math.min(epoch, line.length - 1); e >= 0; e--) {
    const s = line[e];
    if (s) return s;
  }
  return line.find((s) => s)!;
}

/** The first epoch a unit line can be trained in. */
export function unitEpoch(type: UnitType): number {
  return UNITS[type].findIndex((s) => s !== null);
}
