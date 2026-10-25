import type { AgeId, PathId, FindKind, LandmarkKind, BuildingType, CivId, Cost, Difficulty, Domain, MapSize, MapType, Res, TechId, UnitType, PlayerStats, RareId, KeyId, WayId, HomelandId } from './types';

/** Every number in the game lives here. */

// ---- Time and epochs ------------------------------------------------------------------------------

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
  { name: 'Atomic Age', short: 'Atomic', cost: { food: 1800, gold: 1500, stone: 700 }, time: 95, blurb: 'The Missile Silo: one warhead (12,000 at the centre, 8 tiles of blast), a public countdown, and a town that guards it.' },
];
export const LAST_EPOCH = EPOCHS.length - 1;
/** The Age of the Hive's reach and woods (`HIVE`), named here so the age's and the Hive's words can say them. */
const HIVE_REACH = 6;
const HIVE_TREES = 8;
/** How far round the Heart Tree an old tree can be woken (`WILDWOOD.wake`), named here so the age's and the tree's words can say it. */
const HEART_WAKE = 8;
/** The Bloom's clocks and ring (`BLOOM`), named here so the age's and the Spire's words can say them. */
const BLOOM_RIPEN = 150;
const BLOOM_GROW = 60;
const BLOOM_RING = 6;
const BLOOM_GREEN = 35;
const BLOOM_LEAST = 1000;
const BLOOM_HOLD = 180;
/** The Age of Leviathans' giants (`LEVIATHANS`), named here so the age's, the Den's and the giants' words can say them. */
const WHALE_HOLD = 10;
const WHALE_BOMB = 30;
const WHALE_SEEDS = 3;
/** The Kraken's and the Reef Ship's numbers (#789, `LEVIATHANS`), named here so their words can say them. */
const KRAKEN_SEA = 5;
const KRAKEN_GRIP = 2;
const KRAKEN_MOST = 2;
const REEF_BORN = 40;
const REEF_MEND = 3;
const LEVIATHANS_CALM = 8;
/** The Age of the Mycelium's web, spores and rot (#800, `MYCELIUM`), named here so the age's words can say them. */
const WEB_REACH = 5;
const WEB_GROW = 100;
const SPORE_REVEAL = 2;
const WEB_DEED = 3000;

// ---- Ages and paths -------------------------------------------------------------------------------

/**
 * Ages as a web (#37). An age is where a people stands; its tier is the epoch that every
 * epoch-based number reads (unit versions, building styles and toughness, technologies, walls), so
 * a side age's armies keep pace. The trunk is the five epochs above, the dependable road on every
 * map; side ages branch off it, change how a people works while it stays there, and rejoin it.
 */
export interface Age {
  name: string;
  /** The verbs rubric (`docs/verbs.md`, #506): what the player now does, in words and never a number, and the door it shuts. */
  verb?: string;
  door?: string;
  /** The age panel (#555 s4, `docs/age-roads.md` spine §2): what this age is good at, in one line, the reason to pick it. */
  good?: string;
  /** The basic routes (#555 s0, spine §1) this age stands on; empty for a rare age, one that only a rare find opens. */
  routes?: RouteId[];
  /** A gateway age (rule 3): weak on its own, taken for the road on. Its panel says so. */
  gateway?: boolean;
  /**
   * The age's keepsake (#555 s11, `docs/age-roads.md` §5): one building of this kind (the one chosen while here, else the oldest)
   * keeps this age's work after the people leaves; `does` says what, after "keeps". The rest sleep or lose the age's work.
   */
  keepsake?: { building: BuildingType; does: string };
  short: string;
  tier: number;
  blurb: string;
  /** What changes while a people is in this age, as civilizations and technologies change things. */
  add?: Partial<Mods>;
  mul?: Partial<Mods>;
  /**
   * Soldiers hired for gold alone at a building: which lines, gold per point of their usual
   * price (rounded to 5), and the share of their usual training time.
   */
  hire?: { at: BuildingType; units: UnitType[]; gold: number; time: number };
  /** Foot, bow and horse trained the usual way cost this much more. */
  levy?: number;
  /** What each class of unit costs here, as a share of its usual price (after any levy). */
  price?: Partial<Record<UnitClass, number>>;
  /** Training time by class, multiplied after civilization and technology modifiers. */
  training?: Partial<Record<UnitClass, number>>;
  /** Lines this age can't train, and why (shown on the greyed button). */
  no?: { units: UnitType[]; why: string };
  /** Buildings this age can't raise, and why (the Age of the Steppe tills no fields and builds no walls, #297). */
  noBuild?: { buildings: BuildingType[]; why: string };
  /** A town on wheels (#297): Town Centers and Houses can be packed onto wagons and pitched again elsewhere (`STEPPE`). */
  mobile?: boolean;
  /**
   * The Age of the Wild Hunt (#801): every rider trained at a Stable comes with a War Wolf running beside it, the people's wolves follow
   * its wagons when the camp moves, and its Hunting Camps send hawks aloft. See `HUNT` (`hunt.ts`).
   */
  heel?: boolean;
  /** Buildings a mobile age packs onto wagons besides `STEPPE.packs` (the Silk Road's Market, #326). */
  packs?: BuildingType[];
  /**
   * Caravans that travel with the camp (the Silk Road, #326): a trader comes home to its Market even while
   * it rolls on a wagon, and is paid more for the ground the Market covered while it was out (`SILK`).
   */
  caravans?: boolean;
  /**
   * Trade fed by faith (#49): every relic the people keeps in its Temples makes each trade trip pay
   * `each` more of its usual gold, counting at most `most` relics.
   */
  relicTrade?: { each: number; most: number };
  /**
   * Trade fed by iron: every `per` bars of bog iron the people has ever dug make each trade trip pay `each`
   * more, counting at most `most` such steps. Iron dug on the way here still counts (the web's link).
   */
  ironTrade?: { per: number; each: number; most: number };
  /** Blades forged from bog iron (the Iron Age): foot soldiers strike `attack` harder for every `per` bars dug, up to `most` steps. */
  forge?: { base: number; per: number; attack: number; most: number; riders?: boolean };
  /**
   * Power broadcast from coils (the Age of Lightning, #231): Watch Towers become Coil Towers, whose field
   * speeds the work of buildings near them and slows every building outside, and whose shot is a leaping
   * arc. The numbers are `LIGHTNING`.
   */
  coils?: boolean;
  /** The path (#299) this age is a step of: a chain of side ages, one per tier, that carries its own way of life across epochs. */
  path?: PathId;
  /** The whole people at war (the Age of Total War, #313): War Camps call citizens near them to arms (`CALL_UP`). */
  callUp?: boolean;
  /** Plunder is hauled (#502, the Age of the Warband): the soldier who makes a kill carries the gold (`SPOILS`) and banks it only at home. */
  haul?: boolean;
  /** Drain Rigs draw blood from the enemy dead near them (#355). */
  blood?: boolean;
  /**
   * The Age of Hemocraft (#355 s2), blood run through machines: a Drain Rig bleeds the living enemy who stand near it, and grafts
   * come cheaper and are fed from farther off. The numbers are `HEMOCRAFT` (`fork.ts`).
   */
  hemocraft?: boolean;
  /**
   * The Age of the Blood-rite (#355 s2), blood as a sacrament: every Temple is an altar that draws blood from the enemy who fall near
   * it, and pays it out to mend the people's own living near it. The numbers are `RITE` (`fork.ts`).
   */
  rite?: boolean;
  /** The fork past the Atomic Age (#605 s3): fission, raw power now (`FISSION`), or fusion, clean and limitless but slow (`FUSION`), in `silo.ts`. */
  fission?: boolean;
  fusion?: boolean;
  /** A people that raises again on the foundations of what fell (the Age of Reclaimers): see `RECLAIM` (`reclaim.ts`). */
  reclaim?: boolean;
  /** Citizens strip the rubble of fallen buildings into stock (the Age of Reclaimers, #503): see `SALVAGE` (`salvage.ts`). */
  salvage?: boolean;
  /** Aircraft fly on fuel from the Airfield (the Age of Aeronauts): see `SORTIE` (`sortie.ts`). */
  sortie?: boolean;
  /** Feast days (the Age of Fairs): see `FAIR` (`fair.ts`). */
  fairs?: boolean;
  /** Escorted merchant ships carry more (the Age of Sail): see `CONVOY` (`convoy.ts`). */
  convoys?: boolean;
  /** A merchant ship this people sinks gives up part of its cargo as prize money (the Age of Sail): see `PRIZE` (`convoy.ts`). */
  prizes?: boolean;
  /** Priests keeping vigil at a relic Temple add to its gold (the Age of Pilgrims): see `VIGIL` (`vigil.ts`). */
  vigils?: boolean;
  /** Rival citizens slain by this people's forces are taken captive and work its fields (the Age of the Warband): see `THRALL` (`thralls.ts`). */
  thralls?: boolean;
  /** Siege Workshops are powder mills that grind saltpetre into kegs (the Age of Alchemy, #577): see `KEG` (`powder.ts`). */
  mills?: boolean;
  /** Citizens and foot soldiers lay powder kegs at rival buildings (the Age of Sappers, #577): see `KEG` (`powder.ts`). */
  sappers?: boolean;
  /**
   * Plunder hauled to the ships (#585, the Age of Sea-Raiders): packs are carried as the Warband's are (`SPOILS`), but banked only by
   * handing them into a transport's hold, which pays out at a Dock (`SEA_RAID`, `spoils.ts`). Town Centers and Barracks bank nothing.
   */
  raid?: boolean;
  /** Priests raise Missions on far shores, and each pays a tithe that grows with its distance from home (the Age of Missions, #555 s12): see `MISSION` (`missions.ts`). */
  missions?: boolean;
  /** Citizens tame wild wolves, boars and mammoths into beasts of war (the Age of the Wild, `TAME`, `src/sim/tame.ts`). */
  tames?: boolean;
  /** What a line of soldiers is called here (the Age of Chariots' riders are chariots, #555 s12). */
  names?: Partial<Record<UnitType, string>>;
  /** Windmills pump the water out from behind the dykes, tile by tile, into polder (the Age of Dykes, #701): see `POLDER` (`water.ts`). */
  pumps?: boolean;
  /**
   * The Age of Rivers (#701): citizens dig channels from any water, the water running in behind them; Farms by water thrive, and
   * none is laid away from it. See `RIVERS` (`water.ts`).
   */
  rivers?: boolean;
  /**
   * The Age of Tides (#739): Tide Mills grind on the running tide and causeways are raised over the flats. The tide itself runs for
   * everyone once the first people enters the age. See `TIDE` (`tides.ts`).
   */
  tides?: boolean;
  /**
   * The Age of the Water Line (#701 s4): sluices open and shut, letting the water out over the low ground behind them (`INUND`,
   * `water.ts`), and Sluices launch gun-barges that sail the flood.
   */
  sluices?: boolean;
  /**
   * The Age of Locks (#701 s5): a Channel dug in it is a canal (`CANAL`, `water.ts`), deep water every ship sails and soldiers swim
   * slowly; a channel already dug may be dug deep. Bridges carry its own people over.
   */
  canals?: boolean;
  /** The Age of Locks (#701 s5): a Dam with water beside it turns turbines that drive its people's buildings within `DAM.reach` (`damDrives`). */
  turbines?: boolean;
  /**
   * The Age of Floating Cities (#770): Pontoons moored on open water are cast off into a tow and moored again elsewhere (the `pack` and
   * `pitch` orders, the Steppe's wagons on the water), and three or more linked side by side raise citizens. See `FLOAT` (`floating.ts`).
   */
  floats?: boolean;
  /**
   * The Age of the Sea Beggars (#783): a rival ship this people's ships beat down is boarded and taken rather than sunk, and its ships
   * strike dykes, sluices, dams and causeways as siege does. See `BEGGARS` (`beggars.ts`).
   */
  boards?: boolean;
  /**
   * The Golden Age (#703): every side age the people has walked wakes at once, its verbs and the best of its gifts with none of its
   * doors (`weave` in `ages.ts`), until `GOLDEN.span` runs out and the people wakes in the Gunpowder Age, for good.
   */
  golden?: boolean;
}

/**
 * A path (#299): side ages chained one per tier, so a people can leave the trunk and stay off it for
 * several epochs, each step's door a deeper deed of the same kind. A path remembers how far it has been
 * walked: `carry` is added to the people's modifiers once for every earlier age of the path they have
 * stood in, so the path's own strength grows the longer it is kept. Its ages are the ones naming it
 * (`Age.path`); `planned` names the steps still to be built, for the docs and the HUD.
 */
export interface Path {
  name: string;
  blurb: string;
  carry?: Partial<Mods>;
  planned?: string[];
  /**
   * The path this one branches from (#355 s2): where a path forks, each fork is a path of its own (one age to a tier), and the
   * ages of the path it left count toward how far it has been walked (`pathLine`), so the carry keeps growing past the fork.
   */
  branch?: PathId;
}

export const PATHS: Record<PathId, Path> = {
  blood: {
    name: 'Path of Blood',
    blurb: 'A people that lives by war: it trades with no one, and feeds its towns on what its soldiers take from the enemy dead. Each age of the path opens with a deeper deed of blood, and the plunder grows with every age of it walked.',
    carry: { plunder: 0.1 },
    planned: ['more Blood heirlooms, shared with other roads'],
  },
  // The fork at the end of the Path of Blood (#355 s2): two branches past Total War, each its own path, both carrying the plunder on.
  hemocraft: {
    name: 'Hemocraft',
    branch: 'blood',
    blurb: 'The Path of Blood past Total War, where blood is run through machines: pumps, needles and steel. Every age of the Path of Blood walked before it still adds to the plunder.',
    carry: { plunder: 0.1 },
  },
  rite: {
    name: 'Blood-rite',
    branch: 'blood',
    blurb: 'The Path of Blood past Total War, where blood is a sacrament: altars, offerings, curses and priests. Every age of the Path of Blood walked before it still adds to the plunder.',
    carry: { plunder: 0.1 },
  },
  // The Steppe (#297, #318): the second main path, a people whose town moves. The riders grow quicker with every age of it walked.
  steppe: {
    name: 'Steppe Road',
    blurb: 'A people of herders and riders whose town goes where the grass and the fight are: no fields, no walls, Town Centers and Houses on wagons, flocks that walk with the camp. Each age of the road opens with a deeper deed of the hunt and the herd, and every age of it walked makes its riders 5% quicker.',
    carry: { cavalrySpeed: 0.05 },
  },
};

export const TRUNK: AgeId[] = ['stone', 'bronze', 'middle', 'gunpowder', 'industrial', 'atomic'];

/**
 * The basic routes (#555 s0, `docs/age-roads.md` spine §1): a plain style a player can pick and follow to a win on any
 * map, with no prospecting and no rare find. Each age names the routes it stands on (`Age.routes`); the age-up button
 * says which route a road is on. A route may cross the plain road between its own ages.
 */
export type RouteId = 'plain' | 'army' | 'navy' | 'economy' | 'horse' | 'faith' | 'wild' | 'water';
export const ROUTES: Record<RouteId, { name: string; blurb: string }> = {
  plain: { name: 'Plain road', blurb: 'the classic climb, open on every map; every route can fall back to it' },
  army: { name: 'Army route', blurb: 'plunder carried home, camps at the front, a whole people at war' },
  navy: { name: 'Navy route', blurb: 'convoys and prize money at sea, then reach from the air; it wants water' },
  economy: { name: 'Economy route', blurb: 'gold that hires swords, feast-day trade, a town laid out round its coils' },
  horse: { name: 'Horse route', blurb: 'a town on wagons, tribute from a rival\'s land, tolls on the trade road' },
  faith: { name: 'Faith route', blurb: 'priests who win a rival\'s towers and Temples over' },
  wild: { name: 'Wild route', blurb: 'beasts tamed and bred, walls that grow, and one day the forest itself' },
  water: { name: 'Water road', blurb: 'channels dug from the springs, dykes and polder, then sluices that drown your own fields to stop an army, then canals that carry ships inland and dams that turn turbines, then the tide\'s hours, and at last a town afloat that tows itself where it likes: a people that moves the water' },
};

const trunkAge = (e: number, good: string): Age => ({ name: EPOCHS[e].name, short: EPOCHS[e].short, tier: e, blurb: EPOCHS[e].blurb, good, routes: ['plain'] });

/** Iron wares: bog iron dug (any age) raises trade in the trading ages (Merchants, Fairs, Sail): +8% a 75 bars, to +40%. */
export const IRON_TRADE = { per: 75, each: 0.08, most: 5 };

/**
 * The Iron Age's forge: every `per` bars of bog iron dug past the `base` that opened the road (the Iron Age's deed)
 * sharpen foot soldiers' edges by `attack`, up to `most` steps. The marsh is the armoury.
 */
export const IRON_FORGE = { base: 150, per: 50, attack: 1, most: 3 };
/** The Age of Chariots' forge (#555 s12): the same bars, edging riders. */
export const CHARIOT_FORGE = { ...IRON_FORGE, riders: true };

export const AGES: Record<AgeId, Age> = {
  stone: trunkAge(0, 'Where every road begins: gather, settle and choose your way'),
  bronze: trunkAge(1, 'The dependable step: Markets and Temples, stronger arms, and nothing shut'),
  middle: trunkAge(2, 'The crossroads: most side roads turn off here, and nothing is shut'),
  gunpowder: trunkAge(3, 'Guns and cannon that break any wall, and every road comes back to it'),
  industrial: trunkAge(4, 'The strongest plain arms and the deepest economy, with nothing shut'),
  atomic: trunkAge(5, 'One warhead the whole map watches fall: a Missile Silo, dear to raise and seen by all, and a store of warheads slow to fill'),
  aeronaut: {
    verb: 'Fight from forward Airfields: aircraft fly sorties on fuel, so where you build an Airfield is how far you reach',
    door: 'Foot, ranged, cavalry and siege cost more',
    good: 'Air power: cheap fighters and bombers that strike far from a forward Airfield',
    routes: ['navy'],
    name: 'Age of Aeronauts', short: 'Aeronauts', tier: 4,
    blurb: 'A future built around the airfield: fighters and bombers cost 25% less and train in 25% less time. Foot, ranged, cavalry and siege units cost 20% more. But aircraft fly on fuel: they turn for home 30 tiles from an Airfield of yours and burn out beyond 36, and they are rearmed and mended while they sit at one. A long reach means a forward Airfield. Aircraft keep Industrial combat strength; riflemen, towers, ironclads and enemy fighters still answer them.',
    price: { fighter: 0.75, bomber: 0.75, infantry: 1.2, ranged: 1.2, cavalry: 1.2, siege: 1.2 },
    training: { fighter: 0.75, bomber: 0.75 },
    sortie: true,
  },
  reclaimer: {
    verb: 'Strip the rubble of fallen buildings, a rival\'s or your own, into stock, or leave your own to raise again',
    door: 'Soldiers take longer to train',
    good: 'A town that rises from ruin: rubble becomes stock, and what fell can be raised again',
    routes: [],
    name: 'Age of Reclaimers',
    short: 'Reclaimers',
    tier: 3,
    blurb: 'Build tomorrow from yesterday: excavating an ancient ruin teaches a people to rebuild, and to strip what others leave: citizens ordered onto the rubble of any fallen building (a rival\'s, or your own) carry off half its price in stock. Construction and repairs work 25% faster, technologies cost 20% less, but military units take 25% longer to train. And what falls can be raised again: a building of yours that is destroyed leaves its foundations for 5 minutes, and the same building raised on the same spot costs 40% of the price and starts half built. The same armies and technologies as the Gunpowder Age.',
    mul: { buildSpeed: 1.25, techCost: 0.8, militaryTrain: 1.25 },
    reclaim: true,
    salvage: true,
  },
  merchant: {
    keepsake: { building: 'hirehall', does: 'its muster: swords signed there are paid once, up front, and draw no wages, on any road' },
    verb: 'Hire swords at the Market for gold, and keep paying them by the day or lose them',
    door: 'No Stables: cavalry is for hire or not at all',
    good: 'Gold becomes an army at once: swords hired at the Market',
    routes: ['economy'],
    name: 'Age of Merchants',
    short: 'Merchant',
    tier: 2,
    blurb: 'Guilds, banks and hired swords: the Market hires soldiers for gold, trade pays more (more still for every bar of bog iron your people ever dug), and levies cost dear. A merchant people stables no horses: cavalry is only for hire, never raised at a Stable. And a hired sword is paid by the day: 2 gold every 15 seconds once its first 45 are served, and one left unpaid twice walks off the field.',
    mul: { tradeGold: 1.25 },
    ironTrade: IRON_TRADE,
    hire: { at: 'market', units: ['infantry', 'ranged', 'cavalry'], gold: 1.2, time: 0.5 },
    levy: 1.2,
    noBuild: { buildings: ['stable'], why: 'A merchant people stables no horses: cavalry is for hire at the Market. They wait until they settle in the Middle Ages or the Gunpowder Age' },
  },
  iron: {
    verb: 'Dig the marsh: bog iron sharpens every spearman, so the bog is worth holding',
    keepsake: { building: 'bloomery', does: 'its hearth: spearmen trained there keep the Iron Age\'s price, on any road' },
    door: 'No cavalry until the Middle Ages',
    good: 'The hardest early foot soldiers, sharpened by the marsh\'s iron',
    routes: [],
    name: 'Iron Age',
    short: 'Iron',
    tier: 1,
    blurb: 'Iron spears, iron hoes and iron axes, but no horse: cheap, hard-hitting foot soldiers and quicker farms and woodcutters, and every scrap of bog iron dug pays twice its gold and, every 50 bars past the first 150 sharpen every spearman\'s edge by 1 (up to 3), so the marsh is worth holding and an army is only as keen as the iron behind it; cavalry waits for the Middle Ages.',
    add: { infantryAttack: 1 },
    mul: { farm: 1.1, wood: 1.1, bogGold: 2 },
    price: { infantry: 0.75 },
    forge: IRON_FORGE,
    no: { units: ['cavalry'], why: 'No horses in the Iron Age: cavalry waits for the Middle Ages' },
  },
  pilgrim: {
    verb: 'Send chanting priests to win a rival\'s towers, gates and Temples over, and keep vigils by your relics',
    door: 'No siege engines',
    good: 'Winning a rival over without a fight: priests take towers, gates and Temples',
    routes: ['faith'],
    keepsake: { building: 'temple', does: 'its vigils: priests beside it swell its relics\' gold' },
    name: 'Age of Pilgrims',
    short: 'Pilgrim',
    tier: 2,
    blurb: 'The faithful walk from far away to see the relics in your Temples: relics pay double, and priests come at half price and work a quarter faster. A pilgrim people builds no siege engines, but its priests, chanting together, win a rival\'s towers, gates and Temples over.',
    add: { consecrate: 1 },
    mul: { relicGold: 2, priest: 1.25 },
    price: { priest: 0.5 },
    vigils: true,
    no: { units: ['siege'], why: 'A pilgrim people builds no siege engines: rams and catapults wait until it leaves the pilgrims\' road' },
  },
  fair: {
    verb: 'Time your traders to come home on the feast day, to a Market built by a Temple that keeps a relic',
    door: 'Towns grown open round the fairground stand weaker',
    good: 'The richest trade: caravans home on the feast day pay the most',
    routes: ['economy', 'faith'],
    keepsake: { building: 'market', does: 'its feast day: on a fairground, its trips home on the feast pay the fair\'s share' },
    name: 'Age of Fairs',
    short: 'Fairs',
    tier: 3,
    blurb: 'Where pilgrims gather, merchants follow: feast days become great fairs. Trade pays more for every relic your Temples keep, and traders travel faster, but towns grown open round the fairground stand 15% weaker. And the fair keeps a calendar: a feast day opens every 4 minutes and lasts one, and a trip paid at a Market within 12 tiles of a Temple that keeps a relic pays half again as much. Build the Market by the shrine, and send the traders so they come home on the feast.',
    mul: { tradeGold: 1.25, traderSpeed: 1.15, buildingHp: 0.85 },
    relicTrade: { each: 0.1, most: 5 },
    ironTrade: IRON_TRADE,
    fairs: true,
  },
  sail: {
    verb: 'Send warships with the merchant cogs in convoy, and sink a rival\'s cogs for prize money',
    door: 'No walls or gates: the fleet is the wall',
    good: 'Sea power: convoys carry more, and a rival\'s sunk cogs pay you',
    routes: ['navy'],
    keepsake: { building: 'dock', does: 'its convoy yard: merchant ships trading from it sail escorted by warships on any road' },
    name: 'Age of Sail',
    short: 'Sail',
    tier: 2,
    blurb: 'A people that has turned to the sea: boats fish half again as fast, ships come a quarter cheaper and a quarter sturdier, but a sea people raises no walls or gates: its fleet is the wall, and a town on the shore must keep ships and towers to hold what palisades once did. A Market within a dozen tiles of a Dock ships its goods by water: its trade trips pay 30% more. And a merchant ship that loads at a port with a warship beside it sails in convoy and carries 40% more: send the fleet with the cogs.',
    mul: { fish: 1.5, shipHp: 1.25 },
    price: { ship: 0.75 },
    noBuild: { buildings: ['wall', 'gate'], why: 'A sea people raises no walls or gates: the fleet is the wall. They wait until it comes ashore or moves on to Gunpowder' },
    ironTrade: IRON_TRADE,
    convoys: true,
    prizes: true,
  },
  lightning: {
    verb: 'Lay the town out round Coil Towers: inside a coil\'s field everything works faster, outside it slower',
    door: 'No aircraft',
    good: 'The quickest town: inside a coil\'s field every building works faster',
    routes: ['economy'],
    keepsake: { building: 'tower', does: 'its coil: it looses bolts, and buildings in its field work faster' },
    name: 'Age of Lightning',
    short: 'Lightning',
    tier: 4,
    blurb: 'The future that almost was: power is broadcast through the air from Coil Towers, not carried by coal and belts. Buildings in a coil\'s field train and research 35% faster; buildings outside every field run 25% slower. A coil\'s bolt leaps from one enemy to the next nearby. The air hums with current: no aeroplane flies.',
    coils: true,
    no: { units: ['fighter', 'bomber'], why: 'The air hums with current in the Age of Lightning: no aeroplane flies until you return to the Industrial Age' },
  },
  // The first step of the Path of Blood (#299): a turn off the Middle Ages, at its tier.
  warband: {
    name: 'Age of the Warband',
    short: 'Warband',
    tier: 2,
    path: 'blood',
    blurb: 'The war-host is the people: soldiers train 15% faster, and every enemy unit your forces slay earns a sixth of its price in plunder, carried in the killer\'s pack (up to 90 gold) until it walks within 5 tiles of a Town Center or Barracks to bank it. A rival who fells a laden soldier takes its pack. A rival citizen who falls to your forces is taken instead of lost: a thrall rises where it fell, your own, to work your fields (up to 8 at a time, and if there is room). A thrall never builds. But a warband trades with no one: no traders leave its Markets, and with the young away at war the fields yield 10% less.',
    thralls: true,
    add: { plunder: 0.15 },
    haul: true,
    keepsake: { building: 'stockade', does: 'its palisade: foot soldiers trained there cost a tenth less, on any road' },
    verb: 'Carry the plunder home: the soldier who makes a kill packs the gold and must walk it back to a Town Center or Barracks to bank it, so raids are timed, convoys guarded, and the war-host comes home between blows',
    door: 'A laden soldier felled in the field hands its pack to the rival, and no pack holds more than a few kills: a host that never turns home banks nothing, and a host that hurries home gives up the front',
    good: 'Raids that pay: plunder carried home, and captives to work your fields',
    routes: ['army'],
    mul: { militaryTrain: 0.85, farm: 0.9 },
    no: { units: ['trader'], why: 'A warband trades with no one: traders wait until your people leave the Path of Blood' },
  },
  // The second step of the Path of Blood (#303): a turn off the Gunpowder Age, open only to a people that walked the Warband.
  ironblood: {
    verb: 'Pitch War Camps where the army stands, even in enemy land, and train foot soldiers at the front',
    door: 'No traders, and a camp left without soldiers burns',
    good: 'Fighting far from home: foot soldiers trained where the army stands',
    routes: ['army'],
    keepsake: { building: 'bloodtower', does: 'loosing its barbed bolts' },
    name: 'Age of Iron and Blood',
    short: 'Iron & Blood',
    tier: 3,
    path: 'blood',
    blurb: 'War is the state. Foot soldiers pitch War Camps where the army stands, even in enemy land, and the camps train foot soldiers at the front and hold a little land, so the army is fed and the march home is gone. Soldiers train 15% faster and the enemy dead pay plunder, more than in the Warband. But a camp left without soldiers burns, no traders leave the Markets, the fields yield 15% less and scholars cost a fifth more: a people at war has no patience for them.',
    add: { plunder: 0.25 },
    blood: true,
    mul: { militaryTrain: 0.85, farm: 0.85, techCost: 1.2 },
    no: { units: ['trader'], why: 'A people of iron and blood trades with no one: traders wait until your people leave the Path of Blood' },
  },
  // The third step of the Path of Blood (#313): a turn off the Industrial Age, open only to a people that walked Iron and Blood.
  totalwar: {
    verb: 'Call citizens to arms at a War Camp: each becomes a foot soldier where it stands',
    door: 'No traders, and the fields and learning suffer',
    good: 'The biggest army in a moment: every citizen by a War Camp can take up arms',
    routes: ['army'],
    keepsake: { building: 'transfusion', does: 'grafting soldiers and feeding grafts' },
    name: 'Age of Total War',
    short: 'Total War',
    tier: 4,
    path: 'blood',
    blurb: 'The whole people goes to war. War Camps return and become muster grounds: citizens within 8 tiles of one are called to arms (C), each a foot soldier where it stands for 15 wood and 25 gold, up to five at once, then the camp rests. Soldiers train 15% faster and the enemy dead pay the deepest plunder of the path (every age of it walked adds more). But a people at total war trades with no one, its fields yield a fifth less with the young at the front, and learning costs a quarter more.',
    add: { plunder: 0.25 },
    mul: { militaryTrain: 0.85, farm: 0.8, techCost: 1.25 },
    no: { units: ['trader'], why: 'A people at total war trades with no one: traders wait until your people leave the Path of Blood' },
    callUp: true,
    blood: true,
  },
  // The fork at the end of the Path of Blood (#355 s2): two turns off the Industrial Age for a people that walked Total War, each its
  // own branch path. Hemocraft is blood and machinery as one craft; the Blood-rite is blood as a sacrament. Each shuns the other.
  hemocraft: {
    verb: 'Bleed living enemies near your Drain Rigs into a blood store, and spend it on grafts',
    door: 'No priests and no traders; machines bleed nothing, so a rival answers with steel; the Blood-rite is closed for good',
    good: 'Grafted soldiers fed on blood: hard to kill, quick, and self-mending',
    routes: ['army'],
    keepsake: { building: 'drainrig', does: 'drawing blood from the fallen, the flock, captives and the levy' },
    name: 'Age of Hemocraft',
    short: 'Hemocraft',
    tier: 4,
    path: 'hemocraft',
    blurb: 'Blood run through machines. Every Drain Rig becomes a drain: a living enemy standing within 6 tiles of a finished rig is bled 2 health a second into your store, up to 8 at once for each rig, and what dies there pays its blood as well. Machines, ships and aircraft bleed nothing, so a rival\'s answer is steel. Grafts at the Transfusion Station cost a quarter less blood and stay fed 16 tiles from one. The plunder goes on growing. But a people of pumps and needles keeps no priests and sends no traders, its fields yield 15% less, and learning costs a tenth more.',
    add: { plunder: 0.25 },
    mul: { farm: 0.85, techCost: 1.1 },
    no: { units: ['trader', 'priest'], why: 'A people of pumps and needles keeps no priests and sends no traders: they wait until it leaves Hemocraft' },
    blood: true,
    hemocraft: true,
  },
  bloodrite: {
    verb: 'Make every Temple an altar: sacrifice or curse bleeding enemies with priests, and mend your own with the blood',
    door: 'No Transfusion Station and no traders; Hemocraft is closed for good',
    good: 'Your own mend at every altar while your enemies bleed there',
    routes: ['army'],
    keepsake: { building: 'temple', does: 'its altar: it draws blood from the fallen and takes captives as a rig does, and mends the soldiers by it' },
    name: 'Age of the Blood-rite',
    short: 'Blood-rite',
    tier: 4,
    path: 'rite',
    blurb: 'Blood as a sacrament. Every finished Temple is an altar: a living enemy who falls within 14 tiles of one gives up its blood as at a Drain Rig, and the altar pays blood out to mend your own living within 8 tiles, 2 health a second each and up to 10 at once, a quarter of a blood for every point, while the store lasts. Priests cost a quarter less and heal and convert a quarter faster, and they have two rites over any enemy that bleeds: to sacrifice it (it dies, and 60% of its price comes into your store as blood), or to curse it (20 blood: it and the living within 3 tiles take 35% more from every blow for 20 seconds). The plunder goes on growing. But the rite scorns the pumps: no Transfusion Station is raised, siege engines cost a quarter more, no traders leave the Markets, and the fields yield 15% less.',
    add: { plunder: 0.25 },
    mul: { priest: 1.25, farm: 0.85 },
    price: { priest: 0.75, siege: 1.25 },
    no: { units: ['trader'], why: 'A people of the Blood-rite trades with no one: traders wait until it leaves the rite' },
    blood: true,
    rite: true,
  },
  // The fork past the Atomic Age (#605 s3, seed #533): two turns off it, each shunning the other, each changing how a silo is worked.
  fission: {
    verb: 'Strike in half the time and make warheads again soon, choosing a cheap Atomic or your own heavy Fission at each launch, and lay your silos far from home: each launch poisons the ground round your own',
    door: 'Every launch poisons the ground round your own silo for a minute; Fusion is closed for good',
    good: 'The quickest strike: a short clock and warheads made quickly, at a price in your own ground',
    routes: ['army'],
    name: 'Age of Fission',
    short: 'Fission',
    tier: 5,
    blurb: 'Raw power now. Every launch\'s clock is 25 seconds, not 45, your people makes a warhead every 100 seconds, not 240, and at each launch you choose an Atomic warhead (600 gold, 200 stone) or your own Fission one, dearer (800 gold, 250 stone) but harder and farther (20,000 at the centre, 10 tiles of blast). But the reactor leaks: each launch poisons 3 tiles round your own silo for 60 seconds, as fallout does (4 health a second to every land unit in it, yours too). Lay your silos away from your town and your fields. Take it, and the Age of Fusion is closed for good.',
    fission: true,
  },
  fusion: {
    verb: 'Keep three warheads in the air at once, clean: nothing a Fusion warhead strikes is poisoned, and a new one is made the moment one lands; or send an Atomic one to poison the ground',
    door: 'A road that costs the earth and takes two and a half minutes, leaving the town exposed; a long 70 second clock; Fission is closed for good',
    good: 'Limitless, clean strikes: up to three warheads aloft, made again at once, and your armies may follow them in',
    routes: ['economy'],
    name: 'Age of Fusion',
    short: 'Fusion',
    tier: 5,
    blurb: 'Clean and limitless, and ruinously dear. Your people keeps up to three warheads in the air at once and makes a new one the moment one lands, each the biggest there is (40,000 at the centre, 12 tiles of blast), a Fusion launch costs 450 gold and 120 stone, and nothing it strikes is poisoned (an Atomic one may still be sent, for 600 gold and 200 stone, to poison the ground), so your army can follow the blast in. But the clock is 70 seconds, long enough for a rival to scatter or to find the silo, and the road here costs a fortune and takes 150 seconds in which the town is exposed. Take it, and the Age of Fission is closed for good.',
    fusion: true,
  },
  steppe: {
    verb: 'Pack your Town Centers and Houses onto wagons and pitch them where the herds and the fight are',
    door: 'No fields and no walls',
    good: 'Speed and reach: a town on wagons goes where the herds and the fight are',
    routes: ['horse'],
    name: 'Age of the Steppe',
    short: 'Steppe',
    tier: 1,
    path: 'steppe',
    blurb: 'A people of herders and riders, whose town goes where the herds go: Town Centers and Houses pack onto wagons and are pitched again wherever the land is not a rival\'s. Riders cost a fifth less and train a quarter faster, and hunters work 15% faster. No fields are tilled and no walls raised until the Middle Ages.',
    mul: { hunt: 1.15 },
    price: { cavalry: 0.8 },
    training: { cavalry: 0.75 },
    mobile: true,
    noBuild: { buildings: ['farm', 'wall', 'gate'], why: 'A steppe people tills no fields and raises no walls: they wait for the Middle Ages' },
  },
  // The second step of the Steppe Road (#318): the moving town grows into a horde, at the Middle Ages' tier.
  horde: {
    verb: 'Stand riders in a rival\'s land to take tribute from their treasury',
    door: 'No fields and no walls',
    good: 'Riders standing in a rival\'s land drain its treasury into yours',
    routes: ['horse'],
    name: 'Age of the Horde',
    short: 'Horde',
    tier: 2,
    path: 'steppe',
    blurb: 'The camp has become a horde, and its neighbours pay it to go away. Riders who stand their ground in a rival\'s land exact tribute: each takes 0.3 gold a second from that rival\'s treasury, up to eight riders a rival (deep in their land, past your own supply, they wear down). The town still rolls on wagons and the flocks still walk with it; riders cost a fifth less and train a quarter faster, and hunters work 15% faster. No fields are tilled and no walls raised.',
    add: { tribute: 0.3 },
    mul: { hunt: 1.15 },
    price: { cavalry: 0.8 },
    training: { cavalry: 0.75 },
    keepsake: { building: 'standard', does: 'its horsetail pole: riders standing within 5 tiles of it take tribute from a rival whose land lies within 8, on any road' },
    mobile: true,
    noBuild: { buildings: ['farm', 'wall', 'gate'], why: 'A horde tills no fields and raises no walls: they wait until it settles in the Middle Ages' },
  },
  // The third step of the Steppe Road (#326), a crossing: where the horde meets the merchants, at the Gunpowder Age's tier.
  silk: {
    verb: 'Roll the Market on a wagon with the town, raise Caravanserais, and toll rival traders who cross your land',
    door: 'No tribute, no fields and no walls',
    good: 'Trade that rolls with the town, and a toll on every rival trader in your land',
    routes: ['horse'],
    keepsake: { building: 'caravanserai', does: 'its waystation: trips to the posts near it pay more, and caravans rest there' },
    name: 'Age of the Silk Road',
    short: 'Silk Road',
    tier: 3,
    path: 'steppe',
    blurb: 'The camp has become a moving trade post. The Market packs onto a wagon too (J) and rolls with the town, and traders come home to it wherever it has gone: every tile the Market covered while a trader was out pays that trip 2% more, up to 80%. Trade pays a fifth more and traders travel 15% faster; riders stay cheap and quick. No tribute is taken (a people that lives by the caravans keeps the roads open): instead, rival traders crossing your land with gold pay a toll of 15% for safe passage, once a trip, and Caravanserais (C) raised by the road rest your traders and make a near post pay more. Still no fields are tilled or walls raised.',
    add: { toll: 0.15 },
    mul: { tradeGold: 1.2, traderSpeed: 1.15, hunt: 1.15 },
    price: { cavalry: 0.8 },
    training: { cavalry: 0.75 },
    mobile: true,
    packs: ['market'],
    caravans: true,
    noBuild: { buildings: ['farm', 'wall', 'gate'], why: 'A caravan people tills no fields and raises no walls: they wait until it settles in the Gunpowder Age' },
  },
  // The first gateway age (#577, the age road s5, `docs/age-roads.md` rule 3): saltpetre's only door, weak on its own, and the
  // only road to the Age of Sappers. A turn off the Middle Ages, at its tier.
  alchemy: {
    verb: 'Grind mined saltpetre into powder kegs at your Siege Workshops, which turn mills instead of building engines',
    door: 'No siege engines, and soldiers train slower: the town is busy with its mills',
    good: 'The only road to the Age of Sappers: the powder its mills grind is what the sappers carry',
    routes: [],
    keepsake: { building: 'workshop', does: 'grinding powder, one mill\'s worth, from the saltpetre in store' },
    gateway: true,
    name: 'Age of Alchemy',
    short: 'Alchemy',
    tier: 2,
    blurb: 'As the alchemists of Tang China found while seeking an elixir of long life: saltpetre, sulphur and charcoal ground together burn like nothing else. Every Siege Workshop becomes a powder mill: each grinds a keg from 20 saltpetre in your store every 30 seconds, up to 20 kegs. The mills build no rams or catapults, and soldiers train 15% slower while the town learns its new craft. Weak on its own: what it is for is the Age of Sappers, the one age where kegs are laid, and only here are they ground.',
    mul: { militaryTrain: 1.15 },
    no: { units: ['siege'], why: 'The Siege Workshops turn powder mills in the Age of Alchemy: rams and catapults wait until your people leaves it' },
    mills: true,
  },
  // The strong age behind the gateway (#577): open only from the Age of Alchemy, at the Gunpowder Age's tier.
  sapper: {
    verb: 'Carry powder kegs to the foot of a rival\'s walls, towers and halls, and blow them open when the fuse burns down',
    door: 'No new kegs are ground here: the powder you bring is all there is, and siege engines cost dear',
    good: 'Breaking any town: a keg laid at a wall, a tower or a Town Center blows it open',
    routes: [],
    name: 'Age of Sappers',
    short: 'Sappers',
    tier: 3,
    blurb: 'As the sappers of the great sieges of the 1500s, from Vienna to Chittor, dug under walls and laid powder beneath them: citizens and foot soldiers carry a keg from your store to the foot of a rival building and light it. Eight seconds later it blows, wrecking every rival building within two tiles and hurting the soldiers near it, but any rival who reaches a burning fuse stamps it out. Ranged soldiers hit 1 harder for the powder in their pouches; siege engines cost 30% more. No new kegs are ground: to grind more, go back to the Middle Ages and turn into Alchemy again.',
    add: { rangedAttack: 1 },
    price: { siege: 1.3 },
    keepsake: { building: 'gallery', does: 'its listening shaft: a rival keg laid within 6 tiles is countermined and lost, on any road' },
    sappers: true,
  },
  // The first crossing age (#585, the age road s12, `docs/age-roads.md` §5): a turn off the Middle Ages open only to a people that
  // walked both the Warband and the Sail, its two sibling branches, so it must turn, come back and turn again. At the Middle Ages' tier.
  searaider: {
    verb: 'Carry the plunder to your ships, not home: a soldier\'s pack goes into the hold of a transport it reaches, and the ship banks its hold at a Dock',
    door: 'No Town Center or Barracks banks plunder, and no traders or merchant cogs: a raid far from the sea pays nothing until it walks back to a ship, and a laden ship sunk pays its hold to the rival',
    good: 'Raids from the sea: the war-host lands where it likes and leaves with the gold by ship',
    routes: [],
    keepsake: { building: 'dock', does: 'its longship yard: ships launched there cost a fifth less' },
    name: 'Age of Sea-Raiders',
    short: 'Sea-Raiders',
    tier: 2,
    blurb: 'As the Norse of the 800s came out of the fjords: the Warband\'s plunder and the Sail\'s ships made one trade. Every enemy unit your forces slay earns a fifth of its price in plunder, carried in the killer\'s pack (up to 90 gold), and a pack is banked only by ship: a soldier who comes within 5 tiles of one of your transports, or rides in one, hands its pack into the hold (up to 400 gold a ship), and a ship banks its hold when it comes within 6 tiles of a Dock of yours. A rival who sinks a laden ship takes its hold; the packs of those aboard go down with it. Ships cost a fifth less and soldiers train 10% faster. But Town Centers and Barracks bank nothing, and a raiding people sends out no traders and no merchant cogs.',
    add: { plunder: 0.2 },
    mul: { militaryTrain: 0.9 },
    price: { ship: 0.8 },
    raid: true,
    no: { units: ['trader', 'cog'], why: 'A people of sea-raiders trades with no one: traders and merchant cogs wait until it comes ashore in the Middle Ages or climbs on' },
  },
  // The third crossing (#555 s12): the Iron Age's marsh and the Steppe's herds made one road. Open only to a people that walked both.
  chariots: {
    verb: 'Dig bog iron to edge your chariots: the marsh and the herd together make riders that strike harder with every bar of iron dug',
    door: 'No archers, walls or gates: the charioteer rides open ground, and a rival\'s spearmen are what you fear',
    good: 'The hardest early riders: fast, cheap, sharpened by the marsh, and strongest against bows and men on foot who have no spears',
    routes: [],
    name: 'Age of Chariots',
    short: 'Chariots',
    tier: 1,
    blurb: 'The Iron Age\'s marsh and the Steppe\'s herds made one road: iron-tyred chariots. Riders (the Stable\'s cavalry, here chariots) cost a tenth less and train a fifth faster, and every 50 bars of bog iron dug past the first 150 sharpens every chariot\'s strike by 1 (up to 3), so the marsh is worth holding. What it gives up: archers, walls and gates, and a chariot is beaten by any spearman who stands firm.',
    price: { cavalry: 0.9 },
    training: { cavalry: 0.8 },
    forge: CHARIOT_FORGE,
    names: { cavalry: 'Chariot' },
    noBuild: { buildings: ['wall', 'gate'], why: 'A chariot people raises no walls or gates: it rides open ground. They wait until it settles in the Bronze Age or climbs on' },
    no: { units: ['ranged'], why: 'No archers behind a chariot\'s dust: bows wait until the people settles in the Bronze Age or climbs on' },
  },
  // The fifth crossing (#801, step 8b of the Wild route, `docs/wild-road.md` §X): the Wild's beasts and the Steppe's camp on wheels made one
  // hunt. Open only to a people that walked both, off the Stone Age they share. Raids that see everything and outrun everything.
  hunt: {
    verb: 'Ride with a War Wolf running at every rider\'s heel, and let the pack follow the wagons when the camp moves; loose hawks over the map to see what the pack will run down',
    door: 'No fields, walls or gates, the steppe\'s door, and every rider a fifth dearer: the wolf at its heel is fed from your stores',
    good: 'Raids that see everything and outrun everything: a rider and a wolf for the price of a rider, hawks for eyes, and a camp that moves',
    routes: [],
    name: 'Age of the Wild Hunt',
    short: 'Wild Hunt',
    tier: 1,
    blurb: 'As the Scythian and the Mongol hunted with dogs and hawks and drove the game before them: the Wild\'s beasts met the Steppe\'s camp on wheels. Every rider trained at a Stable comes out with a War Wolf running beside it, tamed or not, and the wolves follow your wagons when the camp moves, so a pack is always at the wagon\'s heel. A Hunting Camp trains Hawks, cheap birds that fly over walls, woods and water and see farther than any scout, but cannot fight (an archer or a tower can still shoot one down). Town Centers and Houses pack onto wagons as on the Steppe. What it gives up: fields, walls and gates, and every rider costs a fifth more, for the wolf.',
    price: { cavalry: 1.2 },
    mobile: true,
    heel: true,
    noBuild: { buildings: ['farm', 'wall', 'gate'], why: 'A people of the Wild Hunt tills no fields and raises no walls: they wait for the Middle Ages, or until it settles in the Bronze Age' },
  },
  // The Wild route (`docs/wild-road.md`), first step: the wild beasts of the map become an army, and the Den breeds more.
  wild: {
    verb: 'Tame wolves, boars and mammoths with your citizens, then breed the kinds you tamed at a Beast Den',
    door: 'No Stables and no Siege Workshop: your beasts are your riders and your rams',
    good: 'An early army of beasts that costs food rather than gold, and a race for the wild ground',
    routes: ['wild'],
    name: 'Age of the Wild',
    short: 'Wild',
    tier: 1,
    blurb: 'Instead of the Bronze Age: a people that keeps company with the wild. Citizens sent at a wolf, a boar or a mammoth sing it calm and lead it home as a beast of war: a War Wolf that runs down archers, a Tusker that breaks riders, a War Mammoth that tramples walls. The beast being tamed stands still for its tamer, but its pack does not, and a wound breaks the song. Once a kind is tamed, a Beast Den breeds more of it for food. No horses are stabled and no rams are built: the beasts are both.',
    tames: true,
    noBuild: { buildings: ['stable', 'workshop'], why: 'A people of the Wild keeps no horses and builds no rams: its beasts are both. They wait until it climbs to the Middle Ages or settles in the Bronze Age' },
  },
  // The Wild route's second age (`docs/wild-road.md` §2): the town is shut in what it grew, and fed from a ninth of the ground.
  grove: {
    verb: 'Plant Thornwalls that grow into living oak, feed one-tile Kitchen Gardens on Den dung or water, and set Orchards that bear each summer',
    door: 'No stone walls, gates or Watch Towers: the town is defended by what it grew',
    good: 'A town shut in green on a small footprint: the cheapest wall that heals, and food dense where beasts and water are',
    routes: ['wild'],
    name: 'Age of the Grove',
    short: 'Grove',
    tier: 2,
    blurb: 'Instead of the Middle Ages: a people that grows what others build. A Thornwall is planted for a little wood and grows over two minutes from seedling to living oak, tougher than stone and mending itself; it parts for your own people, and a piece cut down sprouts again from its root unless the ground is built on. Kitchen Gardens grow maize, beans and squash together on one tile: fed by a Beast Den\'s dung or a stream beside them, a gardener brings in two or three times a farmer\'s food. Orchards bear fruit in summer and autumn, slow to start, then free for years. No stone walls, gates or towers: what guards the town must grow.',
    noBuild: { buildings: ['wall', 'gate', 'tower'], why: 'A Grove people raises no stone walls, gates or towers: it plants Thornwalls. They wait until it climbs to the Gunpowder Age or settles in the Middle Ages' },
  },
  // The Wild route's third age (`docs/wild-road.md` §3, `hive.ts`): woods a rival can't walk through, and Gardens the bees double.
  hive: {
    verb: 'Set Hives among your trees, so that any rival who walks your woods is swarmed; take their honey as food, or as mead by a Market for gold; and tip your darts in venom',
    door: 'No guns or cannon: no Musketeers and no Bombards, so your ranged line is the Blowpipe Hunter, short of reach, and your walls are broken by beasts',
    good: 'Woods a rival cannot walk through, Gardens that double in summer, and venom that cuts down heavy riders and beasts',
    routes: ['wild'],
    name: 'Age of the Hive',
    short: 'Hive',
    tier: 3,
    blurb: `Instead of the Gunpowder Age: a people that keeps bees. A Hive is set among standing trees, and its bees swarm any rival who walks the woods within ${HIVE_REACH} tiles of it, stinging past armour and slowing them; bees sleep in winter, and smoke from any fire near a Hive quiets it a while. A Hive pays honey into your stores, or mead for gold when a Market of yours stands near, and in summer it doubles the yield of the Kitchen Gardens beside it. Your ranged soldiers are Blowpipe Hunters, whose darts stack venom that ignores armour and slows; your Den breeds the Cave Bear, and your War Wolves grow dire. No guns and no cannon.`,
    names: { warwolf: 'Dire Wolf' },
    no: { units: ['ranged', 'siege'], why: 'A Hive people carries no guns and casts no cannon: its bowmen are Blowpipe Hunters, and its beasts break walls. Muskets and cannon wait until it climbs to the Industrial Age or settles in the Gunpowder Age' },
  },
  // The Wild route's fourth age (`docs/wild-road.md` §4, `wildwood.ts`): an army that is also the forest, and green against iron.
  wildwood: {
    verb: 'Plant a Heart Tree and wake the old trees round it as Ents that walk, crush and root again; let your woods spread each spring',
    door: 'No factories or machines: no rifles, field guns or aircraft, so your Ents are your siege; and fire hits your living things twice as hard',
    good: 'A forest that fights: Ents that break towns and hide as trees, woods that grow back each spring, and an army that runs through its own trees',
    routes: ['wild'],
    name: 'Age of the Wildwood',
    short: 'Wildwood',
    tier: 4,
    blurb: `Instead of the Industrial Age: the forest wakes. Plant one Heart Tree, your town's soul; at it, an old tree within ${HEART_WAKE} tiles is woken as an Ent that walks slowly, flings boulders and breaks buildings. An Ent can root where it stands and be a tree again: it mends, it looks like any other tree, and it wakes when a rival comes near. Each spring your woods seed outward round the Heart Tree into your own land, and your Thornwalls thicken. Your people run through the woods round the Heart Tree, and a rival's are slowed there. No rifles, field guns or aircraft; and fire hits your living things twice as hard. If the Heart Tree falls, every Ent roots where it stands and sleeps.`,
    no: { units: ['ranged', 'siege', 'fighter', 'bomber'], why: 'A Wildwood people builds no machines: no rifles, field guns or aircraft. Its Ents break walls and its Blowpipe Hunters shoot. They wait until it climbs to the Atomic Age or settles in the Industrial Age' },
    noBuild: { buildings: ['airfield'], why: 'A Wildwood people builds no machines: no Airfield until it climbs to the Atomic Age or settles in the Industrial Age' },
  },
  // The Wild route's plants' end (`docs/wild-road.md` §5b, `bloom.ts`): the green answer to the warhead, and a second way to win.
  bloom: {
    verb: 'Raise a Seed Spire and sling Bloom Seeds that crack a rival\'s town into forest unless their citizens hack the root out; win by the Greening, your land kept green',
    door: 'The Dens go quiet: no new beasts; and no Missile Silo, for the Seed is your warhead',
    good: 'Outgrowing a rival instead of razing them: a warhead that grows, a forest that wins, and pollen that blinds their towers in your woods',
    routes: ['wild'],
    name: 'Age of the Bloom',
    short: 'Bloom',
    tier: 5,
    blurb: `Instead of the Atomic Age: the plants' end. Raise one Seed Spire (G); while your Heart Tree stands it ripens a Bloom Seed every ${BLOOM_RIPEN} seconds. Sling it at any point on the map: everyone sees where it falls, and once it roots, ${BLOOM_GROW} seconds later every rival building within ${BLOOM_RING} tiles of its heart-root cracks into forest, unless their citizens reach the root and hack it out first. The Greening: keep your Heart Tree while trees, Orchards and grown Thornwalls cover ${BLOOM_GREEN}% of your land (counted as at least ${BLOOM_LEAST} tiles) for ${BLOOM_HOLD / 60} minutes, and you win. Your woods spread at the start of every season, not only in spring, and each season opens with a pollen storm that halves the sight of every rival soldier and tower near your Heart Tree. Your Dens go quiet, and you raise no Missile Silo.`,
    no: { units: ['warwolf', 'tusker', 'warmammoth', 'cavebear'], why: 'A Bloom people breeds no new beasts: its Dens are quiet. They wake if it goes back to the Wildwood or rejoins the Atomic Age' },
    noBuild: { buildings: ['silo'], why: 'A Bloom people raises no Missile Silo: its warhead is the Bloom Seed. Silos wait until it rejoins the Atomic Age' },
  },
  // The Wild route's beasts' end (`docs/wild-road.md` §5a, `leviathans.ts`): the Bloom's sibling at the fork, and reach over walls.
  leviathans: {
    verb: 'Breed giants at a Great Den: Skywhales that carry soldiers over walls and drop seed-bombs of Thornwall in a rival\'s streets, and one Behemoth with a Town Center on its back, a capital that walks and kneels where you need it',
    door: 'The Heart Tree sleeps: no new Ents, no Spreading, and your Ents root; and still no machines: no rifles, field guns, aircraft or Missile Silo',
    good: 'Reach: soldiers dropped behind a rival\'s walls, a rival\'s town cut into pieces by thorn, and a capital that walks to the wood, the gold or the front',
    routes: ['wild'],
    name: 'Age of Leviathans',
    short: 'Leviathans',
    tier: 5,
    blurb: `Instead of the Atomic Age: the beasts' end. Raise a Great Den (J) and breed giants there; raise it within ${KRAKEN_SEA} tiles of the sea and it breeds the Kraken too, up to ${KRAKEN_MOST} to a people, which grips ships so they can't move and shoves your own along. Your Docks grow Reef Ships in the warships' place: living coral, launched at ${REEF_BORN}% of its strength, that grows to full on the water and mends itself after. A Skywhale is a living airship: it drifts over walls, woods and water carrying ${WHALE_HOLD} soldiers or citizens, sets them down wherever there is ground, and every ${WHALE_BOMB} seconds drops a seed-bomb (B) that sprouts ${WHALE_SEEDS} Thornwall seedlings on the ground beneath it, in a rival's streets as well as your own. Fighters, riflemen and towers bring it down. The Behemoth is one titan turtle to a people, with a Town Center on its back: it walks, tramples walls, and kneels (P) wherever the land is not a rival's, a working Town Center at once, then rises (P) and walks on. Lose it and you lose a Town Center. The Heart Tree sleeps while you stay: no new Ents, no Spreading, and every Ent roots. No rifles, field guns, aircraft or Missile Silo.`,
    no: { units: ['warden', 'ranged', 'siege', 'fighter', 'bomber', 'warship'], why: 'A Leviathan people wakes no Ents while its Heart Tree sleeps, and builds no machines: no rifles, field guns, ironclads or aircraft. Its giants are its air and its siege, and its Docks grow Reef Ships. They wait until it goes back to the Wildwood or rejoins the Atomic Age' },
    noBuild: { buildings: ['airfield', 'silo'], why: 'A Leviathan people builds no machines: no Airfield or Missile Silo until it rejoins the Atomic Age' },
  },
  // The Wild route's rare gateway (#800, `docs/wild-road.md` §R, `mycelium.ts`): a web under the town, and the short road to the Bloom.
  mycelium: {
    verb: 'Grow a fungus web under your town: every hall on it takes in every stock, stock is banked the moment it is carried onto it, your people on it are hidden by spores, and a rival building touching it rots',
    door: 'Soldiers cost a quarter more, and fire burns the web back',
    good: 'A town that cannot be starved or cut off, unseen people in its streets, and the only short road to the Bloom',
    routes: ['wild'],
    gateway: true,
    name: 'Age of the Mycelium',
    short: 'Mycelium',
    tier: 2,
    blurb: `Instead of the Middle Ages, and only where a Glowcap hollow lies or a post sells its caps: a people that lives on the fungus under its feet. Pale threads spread from each of your halls, ${WEB_REACH} tiles out over ${WEB_GROW} seconds. Every hall on the web takes in every stock, and a load carried onto the web is banked at once, so no one walks home. Your people standing on the web are hidden by spores: no rival sees them or aims at them unless it stands within ${SPORE_REVEAL} tiles, or they have just struck. A rival building touching your web slowly rots, timber twice as fast as stone. What it costs: soldiers cost a quarter more, and any fire on or near the web burns it back to that point, to grow again. Weak in a fight; but it holds the only road from the second tier straight to the Age of the Bloom.`,
    price: { infantry: 1.25, ranged: 1.25, cavalry: 1.25, siege: 1.25 },
  },
  // The second crossing (#555 s12): the Pilgrims' priests and the Sail's ships made one trade. Open only to a people that walked both.
  missions: {
    verb: 'Sail priests to far shores and raise Missions there: each claims land, trains priests, and pays a tithe that grows with its distance from home',
    door: 'No walls or gates, and no siege engines: the faith goes out unarmed, and what it raises far away stands on its own',
    good: 'Reaching: a foothold on any shore, claimed land beside a rival, and gold from places no road crosses',
    routes: [],
    keepsake: { building: 'mission', does: 'its tithe, and its claim on the shore' },
    name: 'Age of Missions',
    short: 'Missions',
    tier: 2,
    blurb: 'As the Jesuits and the Franciscans went out in the 1500s: the Pilgrims\' priests and the Sail\'s ships made one trade. Priests raise Missions (O) on any shore no rival holds, however far from home: each holds the land round it, trains priests, and every five seconds pays a tithe of 1 gold and 0.12 more for every tile it stands from your nearest Town Center (up to 8, for the three farthest Missions). A Mission is only a chapel, though: nothing in it shoots, and a rival who reaches it razes it. Priests come a third cheaper; ships a tenth. No walls, gates or siege engines are raised.',
    price: { priest: 0.67, ship: 0.9 },
    missions: true,
    noBuild: { buildings: ['wall', 'gate'], why: 'A missionary people raises no walls or gates: its faith goes out unarmed. They wait until it comes home to the Middle Ages or climbs on' },
    no: { units: ['siege'], why: 'A missionary people builds no siege engines: rams and catapults wait until it leaves the missions\' road' },
  },
  // The Water Road's first age (#701 s1): a turn off the Middle Ages for a people with shallow water by its town. It moves the
  // coastline: dykes across the shallows, windmills that pump the water out behind them, polder fields where the sea was.
  dykes: {
    verb: 'Wall off the shallows with dykes and set windmills behind them to pump the water out, tile by tile, into polder: rich low fields where the sea was, and a march where a strait was',
    door: 'No stone walls or gates: the dykes are your walls, and only on the water\'s edge. Your best fields lie below the sea, behind banks a rival can break',
    good: 'Moving the coast: new land for the best fields in the game, and a land bridge across a strait',
    routes: ['water'],
    keepsake: { building: 'windmill', does: 'pumping: it drains the water behind its dykes on any road' },
    name: 'Age of Dykes',
    short: 'Dykes',
    tier: 2,
    blurb: 'As the Frisians and the Hollanders did from the 1100s: banks of earth crowned with stone across the shallows, and windmills to lift the water out behind them. Dykes (K) are raised on shallow water or on the shore beside it, dragged out in a line like a wall; your own people walk along their crowns, and no rival or ship gets past. A Windmill (W) by water a dyke has shut off from the open sea pumps it dry, a tile every few seconds, nearest first: the bay becomes polder, low black ground where a Farm yields half again as much. Drain a strait and you have made a land bridge, for everyone. Only small water can be pumped: a lake or a dyked-off bay, never the open sea. No stone walls or gates are raised: the dykes are the walls. And a wall here guards more than a gate: breach a dyke and the sea pours back into the polder behind it, drowning fields and all, until the gap is closed and the mills pump it out again.',
    noBuild: { buildings: ['wall', 'gate'], why: 'A people of dykes raises no stone walls or gates: the dykes are its walls. They wait until it returns to the Middle Ages or climbs on' },
    pumps: true,
  },
  // The Water Road's first age (#701 s1): instead of the Bronze Age, on every map (a spring lies by every town). Its people digs the
  // water to where it wants it: channels run from any water across the land, and the town grows along them.
  rivers: {
    verb: 'Dig channels from any water across the land and lay your fields along them, so the water goes where you want your town; a channel is a moat that soldiers must wade',
    door: 'No new Farm away from water: the town grows along its channels, so its shape is plain to see and a raid knows where to cut',
    good: 'Fields where you choose: dig the water to them, and ring the town with a moat',
    routes: ['water'],
    keepsake: { building: 'farm', does: 'its watering: by water, it works 30% faster on any road' },
    name: 'Age of Rivers',
    short: 'Rivers',
    tier: 1,
    blurb: 'As the first towns of Sumer and the Indus did: a people that leads the river where it wants it. Citizens dig Channels (Q) out from any water, a spring, a stream, a lake or the shore, dragged out in a line like a wall; when a stretch is dug the water runs in, a tile at a time, and stays. A Farm within 2 tiles of water works 30% faster, and in this age no Farm is laid away from water, so the fields follow the channels. A channel is a moat: soldiers and citizens wade it at well under half their pace, and no ship sails it. Markets, Temples and the Bronze Age\'s arms are all here. What is dug stays dug on any road.',
    rivers: true,
  },
  // The Water Road's sixth age (#739, s6 of #701): instead of the Atomic Age, a people that keeps the sea's hours. Reached for now by a
  // turn off the Atomic Age (the Age of Locks, s5, will lead here too). The tide wakes for the whole world when the first people enters.
  tides: {
    verb: 'Time the sea: the tide clock runs for everyone, the flats bare at low water so armies and traders walk where ships sailed, Tide Mills grind gold on the running tide, and causeways carry a road over the sea that only high water drowns',
    door: 'No Missile Silo, and your town keeps the sea\'s hours: at high water your causeways drown, at low water your harbours ground',
    good: 'Ground that comes and goes: a march across the bay at low water, and mills that grind on every turn of the tide',
    routes: ['water'],
    keepsake: { building: 'tidemill', does: 'grinding gold on the running tide, on any road' },
    name: 'Age of Tides',
    short: 'Tides',
    tier: 5,
    blurb: 'As the monks of Mont-Saint-Michel and Lindisfarne lived, and the millers of the Rance and the Wash: a people that keeps the sea\'s hours. When the first people enters this age the tide wakes for the whole world, and its clock is on every screen: every three minutes the sea falls through three steps to low water and rises back. Shallow sea bares as it falls, the shallowest first: wet flats that anyone may walk, where ships sat a minute ago and now sit aground. Whoever is on the flats when the water comes back is swept ashore and hurt, or drowned far out. Tide Mills (A), raised on the shore, grind gold every time the tide turns, more the more tidal ground lies near them. Causeways (V), dragged out like a wall over the flats or the shallow sea, raise a road that only high water covers; laid across a bay\'s mouth, a barrage that holds its flats wet as a pond the mills grind twice, until a rival\'s powder breaches it. At low water a Dock with no water beside it launches nothing. No Missile Silo is raised.',
    noBuild: { buildings: ['silo'], why: 'A people that keeps the sea\'s hours raises no Missile Silo. It waits until it returns to the Atomic Age' },
    tides: true,
  },
  // The Water Road's third age (#701 s4): instead of the Gunpowder Age. The Dutch Water Line (1672, the Rampjaar): when an army
  // came, the sluices were opened and the low land between the towns went under knee-deep water, too deep to march, too shallow to
  // sail, and the towns stood as islands. The water is the wall; the guns go on flat boats.
  waterline: {
    verb: 'Set sluices in your dykes and channels and open them when an army comes: your low ground goes under knee-deep water that soldiers wade at a crawl and siege can hardly cross, while your gun-barges sail it; shut them and the water goes',
    door: 'No stone walls or gates: the water is your wall, and only low ground floods. Fields under the flood yield nothing, and a rival\'s gun-barges sail it and pass your sluices as well as yours',
    good: 'Turning your own fields into a moat at the moment an army walks onto them, and shelling it from the water',
    routes: ['water'],
    keepsake: { building: 'sluice', does: 'opening and shutting: it lets the water out over its low ground on any road' },
    name: 'Age of the Water Line',
    short: 'Water Line',
    tier: 3,
    blurb: 'As the Dutch did in 1672, the year of disaster, when three armies marched on Holland: they opened the sluices, and the low land between the towns went under knee-deep water, too deep to march through and too shallow to sail, and the towns stood as islands until the armies went home. A Sluice (S) is raised like a dyke, on shallow water, on a channel, or in your own dyke line in place of a piece of it; while it is shut it holds the water back as a dyke does. Open it and the water runs out over the low ground round it, a ring a second, up to 7 tiles: polder, and any meadow that lies low. Soldiers and citizens wade the flood at under a third of their pace, and siege engines bog down to a crawl. Buildings stand in it as islands; fields under it yield nothing. Shut the sluice and the water drains back, a ring a second. A Sluice also launches Gun-barges: flat boats with a cannon in the bow that sail the sea, the channels and the flood alike, and shell what stands round it. No stone walls or gates are raised: the water is the wall.',
    noBuild: { buildings: ['wall', 'gate'], why: 'A people of the Water Line raises no stone walls or gates: the water is its wall. They wait until it returns to the Middle Ages or climbs on' },
    sluices: true,
  },
  // The Water Road's fifth age (#701 s5): instead of the Industrial Age. The canal age, from the Bridgewater Canal (1761) to the locks of
  // the Erie and the Göta: water dug deep enough for ships, carried inland and over the hills, and dams whose turbines drove the mills.
  locks: {
    verb: 'Dig canals deep enough for ships, so your Docks and fleets go inland; carry your people over them on swing bridges; and dam the water to turn turbines that drive every workshop beside it',
    door: 'No stone walls or gates: the canals are your moat and the bridges your gates. A canal cuts your own roads as well as a rival\'s, and a dam that falls bursts over the low ground below it',
    good: 'A fleet in the heart of your land, and a town that trains and researches fastest along its water',
    routes: ['water'],
    keepsake: { building: 'dam', does: 'turning: its turbines drive the buildings beside it on any road' },
    name: 'Age of Locks',
    short: 'Locks',
    tier: 4,
    blurb: 'As the canal age did, from the Bridgewater Canal of 1761 to the Erie and the Göta: water dug deep enough for barges and ships, stepped up the hills through locks, and the first dams whose turbines drove the mills. In this age a Channel (Q) is dug as a canal: when the water runs in, every ship sails it, so a Dock on a canal launches a fleet in the heart of your land, and soldiers swim it at a quarter of their pace. A channel already dug may be dug deep the same way. A Bridge (Z) over a canal or channel carries your own people across at full pace while ships pass under it; rivals must swim. A Dam (N) raised on a channel, a canal, the shallows or the shore, with still water beside it, turns turbines: your buildings within 8 tiles of it train and research two fifths faster. A dam stops ships, and if it falls with water behind it, it bursts: the water runs over the low ground below it all at once, hurting all who stand there. No stone walls or gates are raised.',
    noBuild: { buildings: ['wall', 'gate'], why: 'A people of the locks raises no stone walls or gates: its canals are the moat and its bridges the gates. They wait until it returns to the Industrial Age or climbs on' },
    canals: true,
    turbines: true,
  },
  // The Water Road's seventh age (#770, s7 of #701): past the Age of Tides, the trunk's last tier, a town that floats. Its tier is the
  // Atomic's (every epoch-based number reads it); it lies a row past the Atomic on the web map only (the reason is on #770).
  floating: {
    verb: 'Build your town on the water: moor pontoon districts off the shore, link three or more into a floating town that raises its own citizens, and cast them off to tow a district, people and all, to new water',
    door: 'Solid ground: no House is raised on land and no Missile Silo, and ships hole a pontoon three times as fast as anything else; those on its deck when it sinks swim for it, or drown',
    good: 'A town that moves: tow your districts to the fish, to the fight, or out of a warhead\'s reach',
    routes: ['water'],
    keepsake: { building: 'pontoon', does: 'casting off and mooring again: one district you can still tow on any road' },
    name: 'Age of Floating Cities',
    short: 'Floating',
    tier: 5,
    blurb: 'As the Uros have lived for centuries on their reed islands in Lake Titicaca, and the Tanka in their boat towns on the Pearl River: a people whose town floats. Pontoons (E) are moored on open water, beside the shore or beside another of your pontoons: each is a district with room for 10, where every kind of goods is taken in and fishing boats are launched, and your people walk its deck. Moor three or more side by side and they link into a floating town, whose every pontoon raises citizens. Cast a pontoon off (O) and it is taken in tow with up to 10 of those on its deck aboard; moor it again (P) on any open water and it raises itself in a few seconds. A town that floats can leave: for the fishing grounds, for a rival\'s shore, or out of a warhead\'s reach. But no House is raised on land and no Missile Silo at all, and ships hole a pontoon three times as fast as anything else does: those on its deck when it sinks swim for the nearest deck or shore, and drown if it lies too far.',
    noBuild: { buildings: ['house', 'silo'], why: 'A floating people raises no House on land and no Missile Silo: its homes are its pontoons. It waits until it returns to the Age of Tides or the Atomic Age' },
    floats: true,
  },
  // The fourth crossing (#783, s8 of the Water Road #701): the Dykes' banks and the Sail's ships made one war. Open only to a people
  // that walked both, off the Middle Ages they share. The Water Road's predator: polder towns and merchant fleets are its prey.
  beggars: {
    verb: 'Board a rival\'s ships instead of sinking them: a ship your warships beat down strikes its colours and sails for you, hold and all; and cut a rival\'s dykes from the sea, so the water takes back its polder',
    door: 'No walls or gates, no fishing boats launched, and every ship a fifth dearer: the fleet grows by what it takes, and a people at war on the sea lands no herring',
    good: 'Hunting a rival\'s fleet and its polder: its cogs, barges and warships become yours, and its dykes are your road in',
    routes: [],
    keepsake: { building: 'dock', does: 'its haven: rival ships beaten down within 12 tiles of it are boarded and taken, on any road' },
    name: 'Age of the Sea Beggars',
    short: 'Sea Beggars',
    tier: 2,
    blurb: 'As the Watergeuzen did, the Dutch rebels who sailed under letters of marque from 1568: they took Brielle from the sea in 1572, and in 1574 they cut the dykes round besieged Leiden and sailed their flat boats over the drowned fields to its walls. A rival ship your warships beat down is boarded instead of sunk: it strikes its colours and sails for you with a third of its timbers whole, with whatever it carries, gold, catch or plunder (a transport with soldiers aboard fights to the last and goes down). Your ships strike dykes, sluices, dams and causeways as hard as siege does, so a polder town\'s banks are a fleet\'s to cut, and the sea does the rest. What it gives up: walls and gates, every ship costs a fifth more, and no fishing boats are launched while the people is at war on the sea.',
    price: { ship: 1.2 },
    boards: true,
    noBuild: { buildings: ['wall', 'gate'], why: 'A people of sea beggars raises no walls or gates: its fleet is its wall. They wait until it comes home to the Middle Ages or climbs on' },
    no: { units: ['fisher'], why: 'A people at war on the sea lands no herring: fishing boats wait until it comes home to the Middle Ages or climbs on' },
  },
  // The Golden Age (#703): the age that feels almost too good. A turn off the Gunpowder Age for a people that has lived many lives.
  golden: {
    verb: 'Live every life your people has walked at once: every side age it stood in wakes together, its ways and the best of its gifts, with none of its doors',
    door: 'It ends: after its span the people wakes in the Gunpowder Age, every thread asleep, and the road never opens again; and every rival is told, with the hour it ends',
    good: 'Everything at once, for a while: the richer the road you walked, the richer the age',
    routes: [],
    name: 'Golden Age',
    short: 'Golden',
    tier: 3,
    blurb: 'Every people tells of one: Pericles\' Athens, the House of Wisdom in Baghdad, the Tang, Mali under Mansa Musa. A people that has lived many lives draws them together: every side age it has walked wakes at once. Hired swords and hauled plunder, chanting priests and a town on wagons, convoys and coils, whatever it learned on the road, all of it, and none of the prices those ages asked. Buildings that slept wake. It burns for 6 minutes, a minute more for every age walked past the third (up to 10), and every rival is told when it began and when it ends. Then it is over for good: the people wakes in the Gunpowder Age with every thread asleep.',
    mul: { buildSpeed: 1.2 },
    golden: true,
  },
};

// ---- What the side ages give ----------------------------------------------------------------------

/**
 * The Age of the Steppe (#297): a town on wheels. A Town Center or House that stands finished, with nothing
 * in training, can be packed onto a wagon in an instant (its sheltering people step out). A wagon pitches
 * where it stands, on any ground a rival does not hold, within `spot` tiles of it, and the building raises
 * itself in `pitch` seconds with the health it was packed with. While packed it gives no room, takes in
 * nothing and trains no one: the price of moving.
 */
export const STEPPE = { pitch: 10, spot: 3, packs: ['towncenter', 'house'] as BuildingType[] };

/**
 * Tribute (the Age of the Horde, #318): every `every` seconds outside the peace, each of a people's mounted
 * soldiers that stands still (not walking; fighting where it stands counts) on land a rival holds takes the
 * people's `tribute` mod in gold a second from that rival's treasury, counting at most `most` riders a rival.
 * A rival with no gold pays nothing. Attrition (`ATTRITION`) still wears down riders past their own supply.
 */
export const TRIBUTE = { every: 1, most: 8 };

/**
 * The Silk Road (#326): caravans travel with the camp. When a trader pays in, every tile between where its
 * Market stood when it set out and where it stands now adds `each` to the trip's gold, counting at most
 * `most` tiles, so a camp that keeps moving along the road earns more from the same posts. Only in an age
 * with `caravans`; the Market that rolls on a wagon (or is being pitched) still takes its traders home.
 */
export const SILK = { each: 0.02, most: 40 };

/**
 * Caravanserais (#334): a Silk Road waystation. A player's land trips to a post within `near` tiles of the
 * middle of one of their finished Caravanserais pay `pay` times as much (once, however many stand near).
 * Every `every` seconds, the player's and allies' traders and wagons within `rest` tiles of one mend `heal`
 * health a second. It holds land like a camp (`BORDERS.caravanserai`), so the toll is taken there too.
 */
export const SERAI = { near: 8, pay: 1.25, rest: 4, heal: 2, every: 1 };

/**
 * Safe passage (#334): what tribute becomes for a caravan people. Every `every` seconds outside the peace, a
 * rival's trader heading home with gold, standing on the land of a people whose `toll` mod is above 0, gives
 * that people the mod's share of its load (whole gold, floored), once a trip for each people it crosses.
 */
export const TOLL = { every: 1 };

/**
 * Flocks (#308): the steppe's answer to the Farm it can't build, food that walks. A Town Center in the Age of
 * the Steppe raises a lamb for `cost` (each brings `start` grown sheep into the age), up to `cap` sheep a Town
 * Center (packed ones count). A sheep keeps within `range` tiles of its camp, the nearest Town Center of its
 * people (or wagon carrying one) within `follow` tiles, and trots after it when camp is struck. Every `bite`
 * seconds it crops the grass tile it stands on, which grows back in `regrow` seconds (slower out of season,
 * `SEASONS[].grass`); a cropped tile is bare, so it walks to fresh grass, and when none is left in reach it
 * goes hungry: time to move. Each bite fills its udder by `milk`, up to `udder`; citizens milk it at
 * `milkRate` a second (slow, renewable). Once the udder is full, bites go to fat instead, `fat` each: at
 * `breed` fat it bears a lamb (while its people walks the steppe and the flock is under `cap`), and twice its fat
 * adds to the `meat` it falls as when slaughtered (fast, once). A lamb (`lambHp`, `lambMeat`) grows up in `lamb`
 * seconds and gives no milk.
 * Wolves run down sheep grazing within `wolf` tiles of their den (further in winter); with Hounds, sheep within
 * `guard` tiles of their camp are watched and the wolves pass them by. Rustling: a sheep with no one of its
 * people (or its camp) within `guard` tiles, and a rival on foot or horse within `steal`, goes over to the
 * rival and follows them home.
 */
export const FLOCK = {
  cost: { food: 60 } as Cost,
  start: 2,
  cap: 8,
  hp: 24,
  lambHp: 10,
  walk: 0.9,
  flee: 1.5,
  range: 6,
  follow: 40,
  bite: 4,
  regrow: 75,
  milk: 1,
  udder: 25,
  fat: 1,
  breed: 18,
  milkRate: 0.7,
  meat: 90,
  lambMeat: 40,
  lamb: 80,
  wolf: 11,
  guard: 6,
  steal: 2,
};

/**
 * The self-managed flock: for a person's steppe people, once every `every` seconds the camp raises a lamb while
 * the flock has room and the larder holds `reserve` food beyond its cost, idle citizens within `reach` tiles of
 * a camp take to milking, and one slaughters a sheep fattened past breeding once the flock is full.
 */
export const SHEPHERD = { every: 2, reserve: 80, reach: 14 };

// ---- Roads between ages ---------------------------------------------------------------------------

/** Something a people must have done before a road opens: a tally from its stats reaching `n`. */
export interface Deed {
  stat: Exclude<keyof PlayerStats, 'mined'>;
  n: number;
  text: string;
}

/** A road from one age to another, taken at a Town Center. */
export interface Road {
  from: AgeId;
  to: AgeId;
  cost: Cost;
  time: number;
  /** Shown at the Town Center only once the player has one of these, the clue that the road is there. */
  clue?: BuildingType;
  /** A second building that shows the road as well as `clue` (#794): for a people that raises no Farm, a Dock at the water. */
  clueAlt?: BuildingType;
  /** Revealed only to the people who completed an ancient ruin's excavation. */
  ruin?: boolean;
  /**
   * Shown only once this survey (a technology) has been researched and found what it looks for in this
   * world (#39). A survey that finds nothing keeps the road hidden for good.
   */
  found?: TechId;
  /**
   * Shown only to a people that has stood in this age (#303): a path's way on, where the next step
   * leaves from a trunk age, is the path's own and stays hidden from everyone who didn't walk it.
   */
  walked?: AgeId;
  /** A deed the road needs beyond its price: a tally from the player's stats. */
  deed?: Deed;
  /**
   * An ore door (#356 s3): in a world that holds this rare ore, mining `n` of it opens the road in place of its
   * deeds, and the clue shows once the people has mined any. In a world without the ore the deeds are the only road.
   */
  ore?: { id: RareId; n: number; text: string };
  /**
   * A vein door (#577, spine §3's "only road"): the road opens only once the people has mined `n` of this rare ore, and only in a
   * world that holds it. It is seen once the people has prospected or dug any; where the world holds none, it stays shut.
   */
  vein?: { id: RareId; n: number; text: string };
  /**
   * More deeds, every one needed as well (#49): a hybrid age asks for deeds in two systems at once.
   * A list of tallies rather than a new kind of condition, because every system already keeps its
   * tally in `PlayerStats` (trade, bog iron, relics), so a crossing is one stat and one line here.
   */
  also?: Deed[];
  /** What taking it means, for the tooltip (trunk roads use the age's blurb). */
  blurb?: string;
  /**
   * A coast door (#701): the road opens only to a people with at least `DYKE.need` tiles of shallow water (`shallow` in `water.ts`)
   * within `DYKE.home` tiles of where it began. The land gates it by its shape, not by an ore. The text says why when it is shut.
   */
  coast?: string;
  /** Closed for good to a people that has walked this age (#355 s2): the two branches of a fork shut each other. */
  shuns?: AgeId;
  /**
   * A crossing age's door (#585, `docs/age-roads.md` §5): two sibling ages, branches off the same age, that the people must both have
   * walked. Seen once either is walked, open only with both. (`walked` stays one age: read-only tests read it as one.)
   */
  crossing?: [AgeId, AgeId];
  /**
   * A road for a people that has lived many lives (the Golden Age, #703): seen once it has walked `seen` side ages, open with `n`.
   */
  lives?: { seen: number; n: number };
  /**
   * How hard the door is (#348): an easy on-ramp (a small deed, a modest price) invites a people to try the
   * web; a hard gate (a dear price, a long journey) marks the special ages. Most roads carry neither, and
   * are the usual middle.
   */
  gate?: 'easy' | 'hard';
}

export const ROADS: Road[] = [
  ...TRUNK.slice(1).map((to, i): Road => ({ from: TRUNK[i], to, cost: EPOCHS[i + 1].cost, time: EPOCHS[i + 1].time })),
  { from: 'industrial', to: 'aeronaut', clue: 'airfield', cost: { food: 600, wood: 500, gold: 800 }, time: 60, blurb: 'Build a future around aviation: aircraft cost and training time fall by 25%, but foot, ranged, cavalry and siege units cost 20% more. An Airfield must stand when the journey starts.' },
  { from: 'aeronaut', to: 'industrial', cost: { food: 200, wood: 200 }, time: 30, blurb: 'Return to a balanced Industrial economy: ordinary aircraft production and ordinary land army prices.' },
  // The other future out of the Industrial (#231): fire signals, then the telegraph, then power sent through the air.
  {
    from: 'industrial',
    to: 'lightning',
    cost: { food: 700, stone: 450, gold: 1300 },
    time: 75,
    clue: 'tower',
    gate: 'hard',
    deed: { stat: 'beacons', n: 6, text: 'Your towers light 6 beacons (relays count)' },
    blurb: 'Instead of the skies, the wires that need no wires: every Watch Tower becomes a Coil Tower. Buildings within its field train and research 35% faster, but buildings outside every field run 25% slower, so the town is laid out around its coils, and a coil that falls darkens its quarter. A coil\'s bolt leaps from enemy to enemy, the hardest on armies that crowd together. What it gives up: aircraft. The Airfield builds nothing while you stay.',
  },
  { from: 'lightning', to: 'industrial', cost: { food: 200, wood: 300 }, time: 30, blurb: 'Bring the steam engines back: every building works at its usual speed again, Watch Towers loose arrows, and the Airfield builds aircraft once more.' },
  {
    from: 'middle', to: 'reclaimer', cost: { food: 900, wood: 350, gold: 500 }, time: 65,
    ruin: true,
    blurb: 'Instead of the Gunpowder Age, after your citizens excavate an ancient ruin: build and repair 25% faster, research technologies for 20% less, but train military units 25% more slowly. An expedition buys a rebuilding people; raids and siege can punish its slower reinforcements.',
  },
  { from: 'reclaimer', to: 'industrial', cost: EPOCHS[4].cost, time: EPOCHS[4].time, blurb: 'Rejoin the main road at the Industrial Age for the ordinary price. Construction, research and military training return to their usual rates.' },
  { from: 'reclaimer', to: 'gunpowder', cost: { food: 400, stone: 200 }, time: 30, blurb: 'Leave the rebuilding life for the Gunpowder Age. Construction and technologies lose their advantage, but military training returns to its usual speed.' },
  {
    from: 'bronze',
    to: 'merchant',
    cost: { food: 500, wood: 200, gold: 300 },
    time: 50,
    clue: 'market',
    deed: { stat: 'traded', n: 400, text: 'Your traders bring home 400 gold' },
    ore: { id: 'salt', n: 60, text: 'Your citizens mine 60 salt to provision the caravans' },
    blurb: 'Instead of the Middle Ages: the same soldiers and technologies, but the Market hires foot, bow and horse for gold alone, in half the time; trade pays 25% more; soldiers trained the usual way cost 20% more. Where the seed holds salt, only the caravans\' salt opens this road, not a fortune; where it does not, the traders\' gold does.',
  },
  { from: 'merchant', to: 'gunpowder', cost: { food: 800, gold: 900, stone: 100 }, time: 65, blurb: 'Rejoin the main road: the merchant fortune buys its way into gunpowder (more gold and less stone than from the Middle Ages).' },
  { from: 'merchant', to: 'middle', cost: { food: 300, stone: 150 }, time: 30, blurb: 'Settle down: leave the merchant life for the Middle Ages, no hiring and no levy price.' },
  {
    from: 'stone',
    to: 'iron',
    cost: { food: 350, wood: 150 },
    time: 35,
    found: 'survey',
    deed: { stat: 'iron', n: 150, text: 'Your citizens dig 150 bog iron' },
    blurb: 'Instead of the Bronze Age, as many peoples of Africa went from stone straight to iron: foot soldiers cost a quarter less and strike 1 harder, and iron hoes and axes make farms and woodcutters 10% quicker. Bog iron keeps paying double gold as iron bars, so the marsh is worth guarding. What it gives up: the horse. The Stable trains no cavalry until the Middle Ages.',
  },
  // The Wild route (`docs/wild-road.md`): the third road out of the Stone Age. A Hunting Camp shows it (where a people learns the
  // beasts, as the Steppe's riders do); foraging the wild bushes opens it.
  {
    from: 'stone',
    to: 'wild',
    cost: { food: 300, wood: 150 },
    time: 35,
    clue: 'huntcamp',
    deed: { stat: 'foraged', n: 250, text: 'Your gatherers forage 250 food from wild bushes' },
    blurb: 'Instead of the Bronze Age: keep company with the wild. Citizens tame wolves, boars and mammoths into beasts of war, and a Beast Den breeds the kinds they tamed, for food. No Stables and no Siege Workshop while you stay.',
  },
  { from: 'wild', to: 'middle', cost: EPOCHS[2].cost, time: EPOCHS[2].time, blurb: 'Rejoin the main road at the Middle Ages, for the same price as from the Bronze Age. Your beasts and Dens stay, Stables and Siege Workshops return, and no more beasts are tamed.' },
  { from: 'wild', to: 'bronze', cost: { food: 150, wood: 150 }, time: 20, blurb: 'Settle down: leave the wild for the Bronze Age. Your beasts and Dens stay, Stables and Siege Workshops return, and no more beasts are tamed.' },
  // The Wild route's second step (`docs/wild-road.md` §2): a Den shows it, and the beasts it rears open it (their dung feeds the gardens).
  {
    from: 'wild',
    to: 'grove',
    cost: { food: 500, wood: 300, gold: 60 },
    time: 45,
    clue: 'den',
    walked: 'wild',
    deed: { stat: 'bred', n: 5, text: 'Your Dens rear 5 beasts' },
    blurb: 'Instead of the Middle Ages: grow the town. Thornwalls that grow into living oak and part for your people, Kitchen Gardens fed on Den dung or water, Orchards that bear each summer. No stone walls, gates or Watch Towers while you stay.',
  },
  { from: 'grove', to: 'gunpowder', cost: EPOCHS[3].cost, time: EPOCHS[3].time, blurb: 'Rejoin the main road at the Gunpowder Age for the ordinary price. Your Thornwalls, Gardens and Orchards keep growing, and stone walls, gates and towers return.' },
  { from: 'grove', to: 'middle', cost: { food: 200, wood: 200 }, time: 25, blurb: 'Settle down in the Middle Ages. Your Thornwalls, Gardens and Orchards keep growing, and stone walls, gates and towers return.' },
  // The Wild route's third step (`docs/wild-road.md` §3): a Kitchen Garden shows it (the bees come to its flowers), and its harvest opens it.
  {
    from: 'grove',
    to: 'hive',
    cost: { food: 900, wood: 400, gold: 400 },
    time: 60,
    clue: 'garden',
    walked: 'grove',
    deed: { stat: 'gardened', n: 600, text: 'Your Kitchen Gardens bring in 600 food' },
    blurb: 'Instead of the Gunpowder Age: keep bees. Hives set among your trees swarm any rival who walks your woods, pay honey or mead, and double your Gardens in summer. Blowpipe Hunters, the Cave Bear and Dire Wolves. No guns or cannon while you stay.',
  },
  { from: 'hive', to: 'industrial', cost: EPOCHS[4].cost, time: EPOCHS[4].time, blurb: 'Rejoin the main road at the Industrial Age for the ordinary price. Your Hives keep swarming and your Den keeps its bears; rifles and field guns arrive.' },
  { from: 'hive', to: 'gunpowder', cost: { food: 250, wood: 250 }, time: 30, blurb: 'Settle down in the Gunpowder Age. Your Hives keep swarming and your Den keeps its bears; muskets and cannon return.' },
  // The Wild route's fourth step (`docs/wild-road.md` §4): a Hive shows it (an old wood humming), and the honey it pays opens it.
  {
    from: 'hive',
    to: 'wildwood',
    cost: { food: 1200, wood: 900, gold: 600 },
    time: 75,
    clue: 'hive',
    walked: 'hive',
    deed: { stat: 'honey', n: 250, text: 'Your Hives pay 250 honey or mead' },
    blurb: 'Instead of the Industrial Age: the forest wakes. A Heart Tree wakes the old trees round it as Ents that walk, break towns and root again as trees; your woods spread each spring. No rifles, field guns or aircraft, and fire hits your living things twice as hard while you stay.',
  },
  { from: 'wildwood', to: 'atomic', cost: EPOCHS[5].cost, time: EPOCHS[5].time, blurb: 'Rejoin the main road at the Atomic Age for the ordinary price. Your Heart Tree keeps waking Ents and your woods keep spreading; machines return, and fire burns as it does for anyone.' },
  { from: 'wildwood', to: 'industrial', cost: { food: 300, wood: 300 }, time: 30, blurb: 'Settle down in the Industrial Age. Your Heart Tree keeps waking Ents and your woods keep spreading; rifles, field guns and aircraft return.' },
  // The Wild route's fifth step, the plants' end (`docs/wild-road.md` §5b): the Heart Tree shows it, and a spring's Spreading opens it.
  {
    from: 'wildwood',
    to: 'bloom',
    cost: { food: 1600, wood: 1400, gold: 1200 },
    time: 90,
    clue: 'heart',
    walked: 'wildwood',
    deed: { stat: 'spread', n: 12, text: 'Your woods spread 12 seedlings round the Heart Tree' },
    shuns: 'leviathans',
    blurb: 'Instead of the Atomic Age: the plants\' end. A Seed Spire slings Bloom Seeds that crack a rival\'s town into forest unless they hack the root out, and the Greening wins the match for a people whose land stays green. No new beasts and no Missile Silo while you stay.',
  },
  { from: 'bloom', to: 'atomic', cost: { food: 300, gold: 300 }, time: 30, blurb: 'Rejoin the Atomic Age and its Missile Silo. Your Spire keeps its Seeds and your Dens wake again; the Greening, the pollen storms and the Spreading every season end.' },
  { from: 'bloom', to: 'wildwood', cost: { food: 300, wood: 300 }, time: 30, blurb: 'Go back into the Wildwood: the Dens wake and fire burns twice as hard again. Your Spire keeps its Seeds; the Greening ends.' },
  // The Wild route's fifth step, the beasts' end (`docs/wild-road.md` §5a): a Den shows it, and a town that has bred its beasts opens it.
  // It and the Bloom shut each other: a people chooses the beasts or the plants for good.
  {
    from: 'wildwood',
    to: 'leviathans',
    cost: { food: 1800, wood: 1000, gold: 1200 },
    time: 90,
    clue: 'den',
    walked: 'wildwood',
    deed: { stat: 'bred', n: 20, text: 'Your Dens rear 20 beasts' },
    shuns: 'bloom',
    blurb: 'Instead of the Atomic Age: the beasts\' end. A Great Den breeds Skywhales that carry soldiers over walls and drop seed-bombs of Thornwall, and one Behemoth with a Town Center on its back. The Heart Tree sleeps, machines stay away, and the Bloom is closed to you for good.',
  },
  { from: 'leviathans', to: 'atomic', cost: { food: 300, gold: 300 }, time: 30, blurb: 'Rejoin the Atomic Age: machines and the Missile Silo return, and the Heart Tree wakes. Your Great Den keeps breeding its giants.' },
  { from: 'leviathans', to: 'wildwood', cost: { food: 300, wood: 300 }, time: 30, blurb: 'Go back into the Wildwood: the Heart Tree wakes, Ents walk again and the woods spread each spring. Your Great Den keeps breeding its giants.' },
  // The Wild route's rare gateway (#800, `docs/wild-road.md` §R): a turn off the Wild at tier 2, open only on glowcaps picked from a
  // Glowcap hollow (or bought at a post where the world has none). From it, the only road straight to the Bloom: the web's harvest opens it.
  {
    from: 'wild',
    to: 'mycelium',
    cost: { food: 400, wood: 250, gold: 100 },
    time: 40,
    walked: 'wild',
    vein: { id: 'glowcap', n: 40, text: 'Your citizens pick 40 glowcaps from a Glowcap hollow, or traders buy them at a post' },
    blurb: 'Instead of the Middle Ages, and only where glowcaps are to be had: grow a fungus web under the town. Every hall on it takes in every stock, your people on it are hidden by spores, and rival buildings touching it rot. Soldiers cost a quarter more and fire burns the web back. Weak in a fight; it is the only short road to the Bloom.',
  },
  { from: 'mycelium', to: 'gunpowder', cost: EPOCHS[3].cost, time: EPOCHS[3].time, blurb: 'Rejoin the main road at the Gunpowder Age for the ordinary price. The web withers, the spores settle and soldiers cost what they always did.' },
  { from: 'mycelium', to: 'middle', cost: { food: 200, wood: 200 }, time: 25, blurb: 'Settle down in the Middle Ages. The web withers, the spores settle and soldiers cost what they always did.' },
  {
    from: 'mycelium',
    to: 'bloom',
    cost: { food: 1800, wood: 1400, gold: 1400, stone: 200 },
    time: 120,
    walked: 'mycelium',
    gate: 'hard',
    deed: { stat: 'webbed', n: WEB_DEED, text: `Your web takes in ${WEB_DEED} stock` },
    shuns: 'leviathans',
    blurb: 'Skip the Hive and the Wildwood: the web flowers into the plants\' end, three tiers in one long, dear step. A Seed Spire slings Bloom Seeds once you have planted a Heart Tree, and the Greening wins the match for a people whose land stays green. The web withers, no new beasts and no Missile Silo while you stay, and Leviathans are closed to you for good.',
  },
  // The other road out of the Stone Age (#297): the hunt, not the bog, opens it.
  {
    from: 'stone',
    to: 'steppe',
    cost: { food: 350, wood: 100 },
    time: 35,
    clue: 'huntcamp',
    deed: { stat: 'hunted', n: 400, text: 'Your hunters butcher 400 meat' },
    blurb: 'Instead of the Bronze Age, as the peoples of the great grasslands did, from the Scythians to the Mongols: follow the herds. Town Centers and Houses pack onto wagons (J) and are pitched again where the hunting is, anywhere a rival does not hold. Riders cost a fifth less and train a quarter faster; hunters work 15% faster. What it gives up: the plough and the wall. No Farms, Walls or Gates are raised until the Middle Ages, so the people eats what it hunts, gathers and fishes, and moves on when the land runs thin.',
  },
  { from: 'steppe', to: 'middle', cost: EPOCHS[2].cost, time: EPOCHS[2].time, blurb: 'Rejoin the main road at the Middle Ages, for the same price as from the Bronze Age: fields and walls return. Wagons still on the road can be pitched, but nothing more is packed.' },
  { from: 'steppe', to: 'bronze', cost: { food: 150, wood: 150 }, time: 20, blurb: 'Settle down: leave the herds for the Bronze Age. Fields and walls return, riders cost their usual price, and the town stays where it stands.' },
  // The Steppe Road (#318), second step: the climb into the Horde, a deeper deed of the hunt and now the herd as well.
  // A people that left the steppe for the Middle Ages may turn back to it; nobody who never rode the steppe sees either road.
  {
    from: 'steppe',
    to: 'horde',
    cost: { food: 600, wood: 200, gold: 150 },
    time: 45,
    clue: 'stable',
    walked: 'steppe',
    deed: { stat: 'milked', n: 200, text: 'Your citizens milk 200 from the flock' },
    also: [{ stat: 'hunted', n: 800, text: 'Your hunters butcher 800 meat (slaughtered sheep count)' }],
    blurb: 'Instead of the Middle Ages: the camp grows into a horde. Riders standing in a rival\'s land exact tribute from its treasury, and the town still rolls on wagons with its flocks; riders stay cheap and quick (every age of the Steppe Road walked makes them 5% quicker). What it gives up, still: the plough and the wall.',
  },
  {
    from: 'middle',
    to: 'horde',
    cost: { food: 300, wood: 150, gold: 100 },
    time: 35,
    clue: 'stable',
    walked: 'steppe',
    deed: { stat: 'milked', n: 200, text: 'Your citizens milk 200 from the flock' },
    also: [{ stat: 'hunted', n: 800, text: 'Your hunters butcher 800 meat (slaughtered sheep count)' }],
    blurb: 'A turn, not a climb, for a people that once rode the steppe: back onto the wagons as a horde. Riders standing in a rival\'s land exact tribute from its treasury. What it gives up: no new Farms, Walls or Gates are raised while it rides (the fields already tilled still yield).',
  },
  { from: 'horde', to: 'gunpowder', cost: { food: 1000, gold: 700, stone: 150 }, time: 65, blurb: 'Rejoin the main road: the tribute buys the horde its guns (more gold and less stone than from the Middle Ages: it never built in stone). Fields and walls return, the tribute ends, and nothing more is packed.' },
  // The Steppe Road (#326), third step, a crossing: the Silk Road, from the merchants for a people that once rode
  // the steppe, or a turn off the Gunpowder Age for one that rode as a horde (the Horde's own roads stay the trunk's,
  // as Iron and Blood leaves from the Gunpowder Age for the Warband). A Market is the clue.
  {
    from: 'merchant',
    to: 'silk',
    cost: { food: 1000, wood: 400, gold: 900 },
    time: 70,
    clue: 'market',
    gate: 'hard',
    walked: 'steppe',
    deed: { stat: 'traded', n: 800, text: 'Your traders bring home 800 gold' },
    also: [{ stat: 'hunted', n: 800, text: 'Your hunters butcher 800 meat (the steppe\'s count goes on)' }],
    blurb: 'Instead of the Gunpowder Age, for a merchant people that once rode the steppe: back onto the wagons, and the Market with them. Traders come home to the Market wherever the camp has moved, and every tile it covered while they were out pays them more. Trade pays a fifth more and traders travel faster. What it gives up: the hired swords, the plough and the wall.',
  },
  {
    from: 'gunpowder',
    to: 'silk',
    cost: { food: 400, wood: 200, gold: 200 },
    time: 35,
    clue: 'market',
    walked: 'horde',
    deed: { stat: 'tribute', n: 300, text: 'Your riders take 300 gold in tribute' },
    also: [{ stat: 'traded', n: 400, text: 'Your traders bring home 400 gold' }],
    blurb: 'A turn, not a climb, for a people that rode as a horde: the horde meets the merchants, back on the wagons. The Market packs onto a wagon and rolls with the camp, traders come home to it wherever it has gone, and every tile it covered while they were out pays them more. Trade pays a fifth more and traders travel faster. What it gives up: the tribute (the caravans need open roads), the plough and the wall.',
  },
  { from: 'silk', to: 'industrial', cost: { food: 1300, gold: 1000, stone: 300 }, time: 80, blurb: 'Rejoin the main road: the caravans\' fortune buys its way into the Industrial Age (more gold and less stone than from the Gunpowder Age). Fields and walls return, and nothing more is packed.' },
  { from: 'silk', to: 'gunpowder', cost: { food: 400, wood: 200 }, time: 30, blurb: 'Settle down: the caravan town takes root in the Gunpowder Age. Fields and walls return, riders cost their usual price, trade its usual gold, and the town stays where it stands.' },
  { from: 'horde', to: 'middle', cost: { food: 200, wood: 150 }, time: 25, blurb: 'Settle down: the ordinary Middle Ages. Fields and walls return, riders cost their usual price, the tribute ends and the town stays where it stands.' },
  { from: 'iron', to: 'middle', cost: EPOCHS[2].cost, time: EPOCHS[2].time, blurb: 'Rejoin the main road at the Middle Ages, for the same price as from the Bronze Age: the horse arrives, and the iron foot soldiers become ordinary pikemen.' },
  // Crossing chains (#49): relics, a deed of the faith, open a turn off the Middle Ages; trade and relics
  // together open a hybrid, from either side. Its clue is a Temple from both: the relics are what a
  // merchant people hears of last, and a Middle Ages town with a Market alone shows no sign of it.
  {
    from: 'middle',
    to: 'pilgrim',
    cost: { food: 250, wood: 100, gold: 100 },
    time: 30,
    clue: 'temple',
    gate: 'easy',
    deed: { stat: 'relicGold', n: 60, text: 'Relics kept in your Temples bring in 60 gold' },
    blurb: 'A turn, not a climb: the same soldiers and technologies as the Middle Ages, but the faithful walk from far away to your Temples. Every relic kept there pays double gold, and up to three priests keeping vigil beside the shrine add a gold each to every payment; priests cost half as much and convert and heal a quarter faster. What it gives up: siege. The Siege Workshop builds nothing while you walk the pilgrims\' road, so walls and towers are taken by faith: priests chanting together win over a rival\'s buildings (never a Town Center or a Wonder), slower with soldiers sheltering inside.',
  },
  { from: 'pilgrim', to: 'gunpowder', cost: { food: 900, gold: 750, stone: 200 }, time: 65, blurb: 'Rejoin the main road: the pilgrims\' gold carries your people into gunpowder (more gold and less food and stone than from the Middle Ages). The siege engines return as cannon.' },
  { from: 'pilgrim', to: 'middle', cost: { food: 200, stone: 100 }, time: 25, blurb: 'Leave the pilgrims\' road for the ordinary Middle Ages: relics pay their usual gold, and the Siege Workshop works again.' },
  {
    from: 'merchant',
    to: 'fair',
    cost: { food: 1000, wood: 400, gold: 900 },
    time: 75,
    clue: 'temple',
    gate: 'hard',
    deed: { stat: 'traded', n: 800, text: 'Your traders bring home 800 gold' },
    also: [{ stat: 'relicGold', n: 200, text: 'Relics kept in your Temples bring in 200 gold' }],
    blurb: 'Instead of the Gunpowder Age, for a people both merchant and faithful: trade pays 25% more, and 10% more again for every relic your Temples keep (up to five); traders travel 15% faster. No more hired swords. What it gives up: towns grown open round the fairground, every building 15% weaker.',
  },
  {
    from: 'pilgrim',
    to: 'fair',
    cost: { food: 1000, wood: 400, gold: 900 },
    time: 75,
    clue: 'temple',
    gate: 'hard',
    deed: { stat: 'relicGold', n: 200, text: 'Relics kept in your Temples bring in 200 gold' },
    also: [{ stat: 'traded', n: 800, text: 'Your traders bring home 800 gold' }],
    blurb: 'Instead of the Gunpowder Age, for a people both faithful and merchant: trade pays 25% more, and 10% more again for every relic your Temples keep (up to five); traders travel 15% faster. Relics pay their usual gold, and the Siege Workshop works again. What it gives up: towns grown open round the fairground, every building 15% weaker.',
  },
  // A turn off the Middle Ages for a people of the coast (the Dock is the clue, the catch the deed).
  {
    from: 'middle',
    to: 'sail',
    cost: { food: 300, wood: 300, gold: 100 },
    time: 40,
    clue: 'dock',
    deed: { stat: 'fished', n: 500, text: 'Your boats land 500 fish' },
    blurb: 'A turn, not a climb: the same soldiers and technologies as the Middle Ages, but the people live by the sea. Fishing boats fish half again as fast, every ship costs a quarter less and has a quarter more hull. What it gives up: the fields, which yield 15% less. A sea people can strike from the water and hold the shore, but a rival on land can starve it.',
  },
  { from: 'sail', to: 'gunpowder', cost: { food: 800, wood: 500, gold: 450, stone: 100 }, time: 60, blurb: 'Rejoin the main road: the shipping fortune carries your people into gunpowder (more wood and less gold than from the Middle Ages). Walls and gates may be raised again.' },
  { from: 'sail', to: 'middle', cost: { food: 150, wood: 150 }, time: 25, blurb: 'Come ashore: the Middle Ages again, with walls and gates allowed, ordinary hulls and the usual price for ships.' },
  { from: 'fair', to: 'industrial', cost: { food: 1300, gold: 1100, stone: 300 }, time: 80, blurb: 'Rejoin the main road: the fairs\' fortune buys its way into the Industrial Age (more gold and less food and stone than from the Gunpowder Age).' },
  { from: 'fair', to: 'gunpowder', cost: { food: 400, stone: 200 }, time: 30, blurb: 'Settle down: wall the fairground and join the Gunpowder Age. Trade and buildings go back to their usual strength.' },
  // The Path of Blood (#299), first step: a turn off the Middle Ages. A Barracks is the clue, the enemy dead the deed.
  {
    from: 'middle',
    to: 'warband',
    cost: { food: 250, wood: 100, gold: 60 },
    time: 30,
    clue: 'barracks',
    gate: 'easy',
    deed: { stat: 'slain', n: 10, text: 'Your forces slay 10 enemy units' },
    blurb: 'A turn, not a climb: the first step on the Path of Blood. The same soldiers and technologies as the Middle Ages, but soldiers train 15% faster and every enemy unit slain earns a quarter of its price in plunder, carried by the killer and banked at a Town Center or Barracks (a laden soldier felled in the field hands its pack over), so war feeds the town once the host comes home with it. What it gives up: trade (no traders) and some of the harvest (farms 10% less). A warband that stops fighting grows poor.',
  },
  { from: 'warband', to: 'gunpowder', cost: { food: 1000, gold: 500, stone: 300 }, time: 65, blurb: 'Climb to the Gunpowder Age: the plunder ends, traders and full harvests return (less gold and more stone than from the Middle Ages: the war-host was never rich in coin). The Path of Blood goes on from there, into the Age of Iron and Blood, for a people whose plunder is already taken.' },
  { from: 'warband', to: 'middle', cost: { food: 250, gold: 100 }, time: 30, blurb: 'Hang up the spear: the ordinary Middle Ages, with trade and full fields, and no plunder.' },
  // The Path of Blood (#303), second step: back off the trunk at tier 3. Only a people that walked the Warband
  // sees it, and the plunder it took there is the deed. The climb to Gunpowder just paid, the turn itself is cheap.
  {
    from: 'gunpowder',
    to: 'ironblood',
    cost: { food: 400, wood: 200, gold: 150 },
    time: 35,
    clue: 'barracks',
    walked: 'warband',
    deed: { stat: 'plunder', n: 600, text: 'Your forces take 600 gold in plunder' },
    ore: { id: 'bloodiron', n: 50, text: 'Your citizens mine 50 blood-iron for the war-hosts\' blades' },
    blurb: 'A turn, not a climb: the second step on the Path of Blood. Foot soldiers pitch War Camps where the army stands, even in enemy land, that train foot soldiers at the front and keep the army fed; plunder grows (the Warband walked adds to it). What it gives up: trade, a sixth of the harvest and a fifth more for every technology. A camp left without soldiers burns. Where the seed holds blood-iron, only the blades forged of it open this road, not plunder; where it does not, plunder does.',
  },
  { from: 'ironblood', to: 'industrial', cost: { food: 1400, gold: 700, stone: 500 }, time: 80, blurb: 'Rejoin the main road: the war economy becomes an industry (less gold and more stone than from the Gunpowder Age). The plunder ends, the War Camps are struck, and traders and full harvests return.' },
  { from: 'ironblood', to: 'gunpowder', cost: { food: 300, gold: 150 }, time: 30, blurb: 'Make peace: the ordinary Gunpowder Age, with trade, full fields and the usual price of learning. The plunder ends and the War Camps are struck.' },
  // The Path of Blood (#313), third step: off the trunk again at tier 4, as Iron and Blood left the Gunpowder Age
  // (two read-only tests keep Iron and Blood's own roads to the trunk). Only a people that walked Iron and Blood
  // sees it, and the soldiers its War Camps trained there are the deed.
  {
    from: 'industrial',
    to: 'totalwar',
    cost: { food: 800, wood: 400, gold: 700 },
    time: 60,
    clue: 'barracks',
    gate: 'hard',
    walked: 'ironblood',
    deed: { stat: 'campTrained', n: 12, text: 'Your War Camps train 12 foot soldiers' },
    blurb: 'A turn, not a climb: the last step on the Path of Blood. War Camps return as muster grounds, where citizens are called to arms and become foot soldiers where they stand; plunder is the deepest of the path. What it gives up: trade, a fifth of the harvest and a quarter more for every technology. Every citizen called up is one less at work.',
  },
  { from: 'totalwar', to: 'industrial', cost: { food: 300, gold: 200 }, time: 30, blurb: 'Make peace: the ordinary Industrial Age, with trade, full fields and the usual price of learning. The plunder ends, the War Camps are struck, and those called to arms stay soldiers. From there a people that walked Total War finds the fork at the end of the path: Hemocraft or the Blood-rite.' },
  // The fork (#355 s2): past Total War the Path of Blood splits in two. A read-only test keeps Total War's one road out (to Industry), so
  // the fork leaves the Industrial Age, as Total War itself did, seen only by a people that walked Total War. Each branch shuns the other.
  {
    from: 'industrial',
    to: 'hemocraft',
    cost: { food: 600, wood: 300, gold: 600, stone: 200 },
    time: 60,
    clue: 'workshop',
    gate: 'hard',
    walked: 'totalwar',
    shuns: 'bloodrite',
    deed: { stat: 'grafted', n: 8, text: 'Your Transfusion Stations graft 8 soldiers' },
    blurb: 'A turn, not a climb: one branch of the fork at the end of the Path of Blood, where blood and machinery become one craft. Drain Rigs bleed the living enemy who stand near them; grafts cost less and are fed from farther off. What it gives up: priests, trade, some harvest and some learning. Take it, and the Blood-rite is closed to your people for good.',
  },
  { from: 'hemocraft', to: 'industrial', cost: { food: 300, gold: 200 }, time: 30, blurb: 'Shut the pumps: the ordinary Industrial Age, with priests, trade, full fields and the usual price of learning. The plunder ends and the rigs only catch the fallen again. The Blood-rite stays closed.' },
  {
    from: 'industrial',
    to: 'bloodrite',
    cost: { food: 700, wood: 200, gold: 700 },
    time: 60,
    clue: 'temple',
    gate: 'hard',
    walked: 'totalwar',
    shuns: 'hemocraft',
    deed: { stat: 'levied', n: 6, text: 'Your people give 6 of their own to the levy' },
    blurb: 'A turn, not a climb: one branch of the fork at the end of the Path of Blood, where blood becomes a sacrament. Every Temple is an altar that takes blood from the enemy who fall near it and mends your own with it; priests come cheaper and work faster. What it gives up: the Transfusion Station, trade, some harvest, and siege at a dearer price. Take it, and Hemocraft is closed to your people for good.',
  },
  // The fork past the Atomic Age (#605 s3): a Missile Silo is the clue; each branch shuns the other; each has a road back to the Atomic Age.
  { from: 'atomic', to: 'fission', cost: { food: 1000, gold: 1200, stone: 600 }, time: 60, clue: 'silo', shuns: 'fusion', blurb: 'A turn, not a climb: raw power now. Every clock is 25 seconds and a warhead is made every 100, but every launch poisons the ground round your own silo for a minute. Take it, and Fusion is closed for good.' },
  { from: 'fission', to: 'atomic', cost: { food: 300, gold: 300 }, time: 30, blurb: 'Shut the reactor: the ordinary Atomic Age, a 45 second clock and a warhead every 240 seconds, and no poison round your own silos. Fusion stays closed.' },
  { from: 'atomic', to: 'fusion', cost: { food: 2400, gold: 3000, stone: 1500 }, time: 150, clue: 'silo', shuns: 'fission', blurb: 'A turn, not a climb: clean and limitless, and ruinously dear. Up to three warheads aloft, each made again the moment one lands, and nothing a Fusion warhead strikes is poisoned, but the clock is 70 seconds and the road costs a fortune and 150 seconds. Take it, and Fission is closed for good.' },
  // The Water Road's sixth age (#739): a turn off the Atomic Age for a people with a shore, until the Age of Locks (#701 s5) leads in.
  {
    from: 'atomic',
    to: 'tides',
    cost: { food: 800, gold: 800, stone: 450 },
    time: 60,
    clue: 'dock',
    coast: 'Needs shallow sea within reach of your first town: the tide has nothing to bare on a dry shore',
    blurb: 'A turn, not a climb, for a people with a shore: keep the sea\'s hours. The tide wakes for the whole world, bares the shallows at low water and drowns them again; Tide Mills grind gold on every turn of it, and causeways carry a road over the sea that only high water covers. What it gives up: the Missile Silo, and harbours that ground at low water.',
  },
  { from: 'tides', to: 'atomic', cost: { food: 300, gold: 300 }, time: 30, blurb: 'Back to the ordinary Atomic Age and its Missile Silo. The tide runs on for everyone, the causeways stand, and the mills stop grinding, all but the one you keep.' },
  { from: 'fusion', to: 'atomic', cost: { food: 300, gold: 300 }, time: 30, blurb: 'Quench the plasma: the ordinary Atomic Age, a 45 second clock, one warhead at a time, and fallout where you strike. Fission stays closed.' },
  { from: 'bloodrite', to: 'industrial', cost: { food: 300, gold: 200 }, time: 30, blurb: 'Put out the altar fires: the ordinary Industrial Age, with trade, full fields and siege at its usual price. The plunder ends and the Temples are Temples again. Hemocraft stays closed.' },
  // The first gateway (#577, the age road s5): saltpetre's only door, a turn off the Middle Ages into the Age of Alchemy, and from
  // there the only road to the Age of Sappers. A Siege Workshop is the clue; kegs ground at the mills are the Sappers' deed.
  {
    from: 'middle',
    to: 'alchemy',
    cost: { food: 300, wood: 150, gold: 150 },
    time: 35,
    clue: 'workshop',
    vein: { id: 'saltpetre', n: 40, text: 'Your citizens mine 40 saltpetre for the alchemists' },
    blurb: 'A turn, not a climb, and only where the world holds saltpetre: the same soldiers and technologies as the Middle Ages, but every Siege Workshop becomes a powder mill that grinds the saltpetre in your store into kegs. What it gives up: siege engines, and soldiers train 15% slower. Weak on its own; it is the only road to the Age of Sappers.',
  },
  { from: 'alchemy', to: 'middle', cost: { food: 150, stone: 100 }, time: 25, blurb: 'Shut the mills: the ordinary Middle Ages, with siege engines and the usual training time. The kegs already ground are kept.' },
  {
    from: 'alchemy',
    to: 'sapper',
    cost: { food: 900, gold: 650, stone: 150 },
    time: 60,
    clue: 'workshop',
    gate: 'hard',
    deed: { stat: 'ground', n: 4, text: 'Your mills grind 4 kegs of powder' },
    blurb: 'Instead of the Gunpowder Age, for a people that has ground its powder: citizens and foot soldiers carry kegs to the foot of a rival\'s walls, towers and halls and blow them open. Ranged soldiers hit 1 harder; siege engines cost 30% more. What it gives up: the mills. No new kegs are ground, so the powder you bring is all there is.',
  },
  { from: 'alchemy', to: 'gunpowder', cost: EPOCHS[3].cost, time: EPOCHS[3].time, blurb: 'Rejoin the main road at the Gunpowder Age for the ordinary price: the mills shut, the siege engines return as cannon, and the kegs already ground are kept for a sapper\'s day.' },
  { from: 'sapper', to: 'industrial', cost: { food: 1400, gold: 800, stone: 400 }, time: 80, blurb: 'Rejoin the main road at the Industrial Age: no more kegs are laid, siege engines cost their usual price, and the kegs left are kept.' },
  { from: 'sapper', to: 'gunpowder', cost: { food: 300, gold: 150 }, time: 30, blurb: 'Lay down the kegs: the ordinary Gunpowder Age, with siege engines at their usual price. The kegs left are kept.' },
  // The first crossing (#585, the age road s12): off the Middle Ages, for a people that walked the Warband and the Sail, the two turns
  // off it, so it went into one, came back and went into the other. A Dock is the clue; the journey is the price.
  {
    from: 'middle',
    to: 'searaider',
    cost: { food: 400, wood: 400, gold: 200 },
    time: 45,
    clue: 'dock',
    gate: 'hard',
    crossing: ['warband', 'sail'],
    blurb: 'A turn, not a climb, for a people that has walked both the Warband and the Sail: the war-host takes to the longships. Plunder is carried as in the Warband, but banked only by ship: packs go into a transport\'s hold, and the hold pays out at a Dock. Ships cost a fifth less and soldiers train 10% faster. What it gives up: traders and merchant cogs, and every Town Center and Barracks as a place to bank. A raid far from the sea pays nothing until it walks back to a ship, and a laden ship sunk pays the rival.',
  },
  // The third crossing (#555 s12): off the Stone Age, for a people that walked the Iron Age and the Steppe, the two turns off it. The way back
  // to the Stone Age is a step back (`STEP_BACK`). A Forge is the clue; the journey is the price.
  {
    from: 'stone',
    to: 'chariots',
    cost: { food: 350, wood: 250, gold: 100 },
    time: 40,
    clue: 'forge',
    gate: 'hard',
    crossing: ['iron', 'steppe'],
    blurb: 'A turn, not a climb, for a people that has walked both the Iron Age and the Steppe: the marsh\'s iron on the herd\'s wheels. Riders are chariots, a tenth cheaper and a fifth quicker to train, and every 50 bars of bog iron dug past the first 150 sharpens each one by 1 (up to 3). What it gives up: archers, walls and gates, and the horse is no match for a spear that stands firm.',
  },
  { from: 'chariots', to: 'bronze', cost: { food: 150, wood: 150 }, time: 20, blurb: 'Unyoke the chariots: the Bronze Age, with archers, walls and gates, and riders at their usual price and edge.' },
  { from: 'chariots', to: 'middle', cost: EPOCHS[2].cost, time: EPOCHS[2].time, blurb: 'Rejoin the main road at the Middle Ages, for the same price as from the Bronze Age: archers, walls and gates return, and the chariots become ordinary cavalry.' },
  // The second crossing (#555 s12): off the Middle Ages, for a people that walked the Pilgrims and the Sail. A Temple is the clue.
  {
    from: 'middle',
    to: 'missions',
    cost: { food: 400, wood: 300, gold: 300 },
    time: 45,
    clue: 'temple',
    gate: 'hard',
    crossing: ['pilgrim', 'sail'],
    blurb: 'A turn, not a climb, for a people that has walked both the Pilgrims and the Sail: the priests take ship. Priests raise Missions on far shores that hold the land round them, train priests and pay a tithe that grows with the distance from home. Priests come a third cheaper and ships a tenth. What it gives up: walls, gates and siege engines, and a Mission is only a chapel, razed by any rival who reaches it.',
  },
  { from: 'missions', to: 'middle', cost: { food: 200, wood: 100 }, time: 25, blurb: 'Bring the priests home: the ordinary Middle Ages. The Missions stand, asleep, until your people turns missionary again.' },
  { from: 'missions', to: 'gunpowder', cost: { food: 900, wood: 400, gold: 500, stone: 200 }, time: 65, blurb: 'Climb to the Gunpowder Age: the Missions sleep, their tithe unpaid, and wake if your people turns missionary again.' },
  { from: 'searaider', to: 'middle', cost: { food: 200, wood: 150 }, time: 25, blurb: 'Draw the longships up: the ordinary Middle Ages, with traders, and plunder no longer taken. Gold still in packs and holds is banked where it stands.' },
  { from: 'searaider', to: 'gunpowder', cost: { food: 900, wood: 500, gold: 500, stone: 150 }, time: 65, blurb: 'Climb to the Gunpowder Age: the raids end, traders return, and every pack and hold still laden is banked where it stands (more wood and less gold than from the Middle Ages: the fortune was in the ships).' },
  // The Water Road (#701 s1): off the Middle Ages, for a people with shallows by its town. The land's shape is the door; a Dock,
  // a people working its waters, is the clue.
  {
    from: 'middle',
    to: 'dykes',
    cost: { food: 350, wood: 350, stone: 100 },
    time: 40,
    clue: 'dock',
    coast: 'No shallow water lies near your town: the Age of Dykes wants a bay, a lake or a strait within reach to wall off and drain',
    blurb: 'A turn, not a climb, for a people with shallow water by its town: raise dykes across the shallows and windmills behind them, and pump the sea out into polder, the richest fields there are. Drain a strait and the far shore is a march away. What it gives up: stone walls and gates, for the dykes are the walls, and the best fields lie below the sea.',
  },
  // The Water Road's trunk (#701): the Age of Rivers instead of the Bronze Age, open to everyone (a spring lies by every town), then
  // on to the Age of Dykes with no coast door: a trunk is never shut. A crossing to the Bronze Age at its own tier, and back onto the
  // plain road at the Middle Ages. (From the Bronze Age the way in is a step back to the Stone Age: Bronze's own roads stay as they were.)
  {
    from: 'stone',
    to: 'rivers',
    cost: { food: 350, wood: 250 },
    time: 35,
    // A people that has tilled a field learns to lead the water to it: any Farm shows the road, on every map.
    clue: 'farm',
    // A people that tills no field (the Britons, a camp on the move, the Hunters' Way) sees it at a Dock instead (#794).
    clueAlt: 'dock',
    blurb: 'Instead of the Bronze Age, as the first towns on the Tigris, the Nile and the Indus did: lead the water. Citizens dig Channels out from any spring, stream, lake or shore, and the water runs in behind them; Farms by water work faster, and none is laid away from it, so the town grows along its channels. A channel is a moat that soldiers must wade. The same arms and buildings as the Bronze Age.',
  },
  { from: 'rivers', to: 'bronze', cost: { food: 100, wood: 100 }, time: 20, blurb: 'Lay down the spades: the ordinary Bronze Age. Fields may go anywhere again; the channels you dug stay, and still water the fields beside them no faster.' },
  { from: 'rivers', to: 'middle', cost: EPOCHS[2].cost, time: EPOCHS[2].time, blurb: 'Rejoin the main road at the Middle Ages, for the same price as from the Bronze Age: Farms go anywhere again, and the channels stay dug.' },
  {
    from: 'rivers',
    to: 'dykes',
    cost: { food: 650, wood: 350, stone: 150 },
    time: 50,
    walked: 'rivers',
    blurb: 'Instead of the Middle Ages, on down the Water Road: from leading the water to holding it back. Raise dykes across the shallows and windmills behind them, and pump lakes and dyked-off bays dry into polder, the richest fields there are. Paid in wood and stone, not gold. What it gives up: stone walls and gates, for the dykes are the walls.',
  },
  { from: 'dykes', to: 'middle', cost: { food: 150, wood: 100 }, time: 25, blurb: 'Lay down the spades: the ordinary Middle Ages, with walls and gates. The windmills stand still, but the polder stays dry and the dykes stand.' },
  { from: 'dykes', to: 'gunpowder', cost: EPOCHS[3].cost, time: EPOCHS[3].time, blurb: 'Rejoin the main road at the Gunpowder Age for the ordinary price: walls and gates return, the windmills stand still, and the land you made stays land.' },
  // The Water Road's trunk (#701 s4): the Age of the Water Line instead of the Gunpowder Age, open to every people that walked the
  // Dykes. A crossing from the Gunpowder Age for a people that walked them before, and back onto the plain road at either tier.
  {
    from: 'dykes',
    to: 'waterline',
    cost: { food: 900, wood: 500, gold: 300, stone: 300 },
    time: 60,
    walked: 'dykes',
    blurb: 'Instead of the Gunpowder Age, on down the Water Road: from holding the water back to letting it out when you choose. Set sluices in your dykes and channels; open them as an army comes and your low ground goes under water it can barely wade, while gun-barges sail it. Paid in wood and stone more than gold. What it gives up: stone walls and gates, and the fields under the flood.',
  },
  {
    from: 'gunpowder',
    to: 'waterline',
    cost: { food: 400, wood: 300, stone: 150 },
    time: 40,
    walked: 'dykes',
    blurb: 'A turn, not a climb, for a people that has walked the Age of Dykes: set sluices in the dykes and open them when an army comes, and send gun-barges over the flood. What it gives up: stone walls and gates, and the fields under the water.',
  },
  { from: 'waterline', to: 'gunpowder', cost: { food: 200, gold: 150 }, time: 25, blurb: 'Shut the sluices for good: the ordinary Gunpowder Age, with walls and gates. The flood drains away, the Sluices sleep, and the barges you have keep sailing.' },
  { from: 'waterline', to: 'industrial', cost: EPOCHS[4].cost, time: EPOCHS[4].time, blurb: 'Rejoin the main road at the Industrial Age for the ordinary price: walls and gates return, and the flood drains away as the Sluices sleep.' },
  // The Water Road (#701 s5): the Age of Locks instead of the Industrial Age, a turn off it for a people that walked the Water Line, and
  // back onto the plain road at either tier. (The trunk road straight from the Water Line waits on the owner: `tests/waterline.test.ts`
  // pins the roads out of it, #701.)
  {
    from: 'industrial',
    to: 'locks',
    cost: { food: 500, wood: 400, stone: 250 },
    time: 45,
    walked: 'waterline',
    blurb: 'Instead of the Industrial Age, a turn on down the Water Road for a people that has walked the Water Line: dig canals deep enough for ships, bridge them, and dam the water for turbines. What it gives up: stone walls and gates, and roads your own canals cut.',
  },
  { from: 'locks', to: 'industrial', cost: { food: 250, gold: 200 }, time: 30, blurb: 'Fill in the lock-keepers\' books: the ordinary Industrial Age, with walls and gates. The canals stay dug and the ships keep sailing them, but the Dams stand still, all but the one you keep.' },
  // The Water Road's trunk (#701 s5, with #739): on from the Age of Locks to the Age of Tides, for a people with a shore, instead of the Atomic Age.
  {
    from: 'locks',
    to: 'tides',
    cost: { food: 1600, wood: 900, gold: 900, stone: 600 },
    time: 90,
    coast: 'Needs shallow sea within reach of your first town: the tide has nothing to bare on a dry shore',
    blurb: 'Instead of the Atomic Age, on down the Water Road: from carrying ships inland to keeping the sea\'s hours. The tide wakes for the whole world; Tide Mills grind gold on every turn of it, and causeways carry a road over the sea that only high water covers. Paid in wood and stone as well as gold. What it gives up: the Missile Silo, and harbours that ground at low water.',
  },
  { from: 'locks', to: 'atomic', cost: EPOCHS[5].cost, time: EPOCHS[5].time, blurb: 'Rejoin the main road at the Atomic Age for the ordinary price: walls and gates return, the canals stay dug, and the Dams stand still, all but the one you keep.' },
  // The Water Road's seventh age (#770): on from the Age of Tides only, for a people with open water by home; back to the Tides, or across to the Atomic.
  {
    from: 'tides',
    to: 'floating',
    cost: { food: 1800, wood: 1600, gold: 1000, stone: 300 },
    time: 100,
    coast: 'Needs sea within reach of your first town: a town that floats needs open water to moor on',
    blurb: 'The Water Road\'s last age, past the Atomic: from keeping the sea\'s hours to living on the sea. Moor pontoon districts on open water, link them into a floating town that raises its own citizens, and cast them off to tow a district, people and all, wherever the water goes. Paid mostly in timber. What it gives up: Houses on land and the Missile Silo, and districts that ships hole fast.',
  },
  { from: 'floating', to: 'tides', cost: { food: 300, gold: 300 }, time: 30, blurb: 'Back to the Age of Tides: Houses go up on land again, and the pontoons stay moored and keep their room, but only the one you keep is ever cast off again.' },
  { from: 'floating', to: 'atomic', cost: { food: 500, gold: 400, stone: 200 }, time: 40, blurb: 'Cross to the ordinary Atomic Age and its Missile Silo: Houses go up on land again, and the pontoons stay moored and keep their room, but only the one you keep is ever cast off again.' },
  // The fourth crossing (#783, the Water Road's s8): off the Middle Ages, for a people that walked the Age of Dykes and the Age of Sail,
  // the two turns off it. A Dock is the clue; the journey is the price.
  {
    from: 'middle',
    to: 'beggars',
    cost: { food: 400, wood: 450, gold: 150 },
    time: 45,
    clue: 'dock',
    gate: 'hard',
    crossing: ['dykes', 'sail'],
    blurb: 'A turn, not a climb, for a people that has walked both the Age of Dykes and the Age of Sail: the dyke-builders take to the sea against their rivals. A rival ship your warships beat down is boarded and taken, hold and all, and your ships cut a rival\'s dykes as siege does. What it gives up: walls and gates, fishing boats, and a fifth more for every ship.',
  },
  { from: 'beggars', to: 'middle', cost: { food: 200, wood: 150 }, time: 25, blurb: 'Lay up the beggar fleet: the ordinary Middle Ages, with walls, gates and fishing boats. The ships you took are yours to keep.' },
  { from: 'beggars', to: 'gunpowder', cost: { food: 900, wood: 500, gold: 450, stone: 150 }, time: 65, blurb: 'Climb to the Gunpowder Age: the boarding ends, walls, gates and fishing boats return, and the ships you took sail on as your own (more wood and less gold than from the Middle Ages: the fortune was in the ships).' },
  // The fifth crossing (#801): off the Stone Age, for a people that walked the Wild and the Steppe, the two turns off it. The way back to the
  // Stone Age is a step back (`STEP_BACK`). A Hunting Camp is the clue, as on both; the journey is the price.
  {
    from: 'stone',
    to: 'hunt',
    cost: { food: 350, wood: 200, gold: 100 },
    time: 40,
    clue: 'huntcamp',
    gate: 'hard',
    crossing: ['wild', 'steppe'],
    blurb: 'A turn, not a climb, for a people that has walked both the Wild and the Steppe: the pack and the camp ride as one. Every rider trained at a Stable comes with a War Wolf running at its heel, the wolves follow the wagons when the camp moves, and a Hunting Camp trains Hawks that see far and cannot fight. What it gives up: fields, walls and gates, and riders cost a fifth more.',
  },
  { from: 'hunt', to: 'bronze', cost: { food: 150, wood: 150 }, time: 20, blurb: 'Settle down: the Bronze Age, with fields, walls and gates, and riders at their usual price. The wolves and hawks you have stay, but no wolf comes at a rider\'s heel.' },
  { from: 'hunt', to: 'middle', cost: EPOCHS[2].cost, time: EPOCHS[2].time, blurb: 'Rejoin the main road at the Middle Ages, for the same price as from the Bronze Age: fields, walls and gates return. The wolves and hawks you have stay, but no wolf comes at a rider\'s heel.' },
  // The Golden Age (#703): heard of by a people that has walked two side ages, open to one that has walked three. It ends on its own (`GOLDEN.span`).
  {
    from: 'gunpowder',
    to: 'golden',
    cost: { food: 900, wood: 400, gold: 900, stone: 300 },
    time: 60,
    gate: 'hard',
    lives: { seen: 2, n: 3 },
    shuns: 'golden',
    blurb: 'A turn, not a climb, for a people that has lived many lives: every side age it has walked wakes at once, with none of its doors, for a few minutes. Then it ends for good, and every rival knows when.',
  },
  { from: 'golden', to: 'industrial', cost: EPOCHS[4].cost, time: EPOCHS[4].time, blurb: 'Climb to the Industrial Age before the gold runs out: the Golden Age ends now, for good, and every thread falls asleep.' },
];

/**
 * The Age of Sea-Raiders (#585): a ship banks its hold within `dock` tiles of a finished Dock of its people, and holds `hold` gold at
 * most (a soldier's pack is `SPOILS.cap`; what a full hold can't take stays in the pack). A soldier hands its pack in within
 * `SPOILS.bank` tiles of a transport, or aboard it. The computer sails a ship home once its hold reaches `home`.
 */
export const SEA_RAID = { hold: 400, dock: 6, home: 150 };

/**
 * Dykes (#701 s1, the Water Road). A dyke goes on a water tile whose every corner lies at `depth` or higher (shallow water), or on a
 * land tile with water beside it. The Age of Dykes opens only to a people with `need` such shallow tiles within `home` tiles of where
 * it began (its coast door).
 */
export const DYKE = { depth: -1.0, home: 24, need: 10 };

/**
 * Windmills (#701 s1). A finished Windmill of a people in the Age of Dykes pumps the water within `reach` tiles of its footprint: if
 * the water there (reached through water and polder, four ways) is a basin of at most `most` water tiles that touches no map edge,
 * it drains one tile every `every` seconds, the nearest first, skipping one a boat floats on. A drained tile is polder: land, its
 * corners raised to `ground` (just over the water line), where a Farm (most of its footprint on polder) works `farm` times as fast.
 */
export const POLDER = { reach: 3, most: 160, every: 3, ground: 0.07, farm: 1.5 };

/**
 * The computer in the Age of Dykes (#701 s1). It takes the road on a coin of its own (`take`) when a plan stands near home: a dyke
 * line of at most `line` water tiles from shore to shore, within `reach` tiles of its start, that shuts off a basin of at least
 * `least` water tiles a mill can pump (or a lake that needs none), scored by the tiles won less `cost` for each dyke tile. It raises
 * the line with `crew` citizens, then a mill for every `perMill` tiles of the basin (at most `mills`), and stays in the age until the
 * basin is dry or `hold` seconds have passed.
 */
export const AI_DYKE = { take: 0.5, line: 9, reach: 18, least: 14, cost: 3, crew: 3, perMill: 60, mills: 2, hold: 420 };

/**
 * The Age of Rivers (#701 s1, the Water Road). A finished Channel (a dug ditch) four-ways beside water fills: the water runs in one
 * tile every `fill` seconds, so it is seen running down the ditch. A channel tile is `T_WATER` its corners sunk to `bank` (to `bed`
 * where water lies all round), and land units wade it at `wade` of their pace; no ship sails it. A Farm with water within `wet` tiles
 * of its footprint is watered: in the age it works `farm` times as fast, and in the age no Farm is laid without water so near.
 */
export const RIVERS = { fill: 0.25, bank: -0.16, bed: -0.45, wade: 0.4, wet: 2, farm: 1.3 };

/**
 * The tide (#739, the Age of Tides; `tides.ts`). It wakes for the whole world when the first people enters the age, at high water, and
 * runs on a public clock: every `period` seconds the sea falls through `flats.length` levels to low water and rises back, a step each
 * `period / (2 × flats.length)` seconds. Open sea whose bed (the mean of its corners) lies at or above `flats[k - 1]` is tidal ground
 * of level k: bared while the tide stands below k. A Dock with no open water within `harbour` tiles is aground. A bared tile is wet
 * sand, its corners raised to `dry`. Who is on the flats when the water comes back is swept to the nearest dry tile within `sweep`,
 * losing `hurt` health, or drowned with none. A causeway may be laid on open
 * sea down to `causeway` deep, and is tidal ground of the top level. A Tide Mill grinds `mill.gold` gold each turn of the tide with
 * `mill.most` tiles of tidal ground within `mill.reach` of its footprint (less, pro rata, with fewer), each tile feeding the first mill only.
 */
export const TIDE = { period: 180, flats: [-1.0, -0.75, -0.5], harbour: 2, dry: 0.08, sweep: 6, hurt: 15, causeway: -1.6, mill: { reach: 5, most: 24, gold: 60 } };
/** The computer in the Age of Tides (#739): its odds of taking the road (more for a people already on the Water Road), how many Tide Mills it raises, and how much tidal ground a mill's spot must reach. */
export const AI_TIDES = { take: 0.35, onward: 0.7, mills: 3, least: 8, reach: 20, wary: 12 };
/**
 * Barrages (#748). A causeway line that shuts a body of tidal ground off from the open sea (four ways, through water and tidal ground but
 * not causeways; closed when it touches no map edge and holds no more than `most` tiles, as a mill judges the open sea) makes it a pond:
 * its flats stay wet at every level, and a Tide Mill grinds each pond tile `mill` times over (on the flood and on the ebb). A keg's blast
 * or a warhead breaches every rival causeway tile within its reach: the tile sinks back to the tidal ground (or open sea) it was laid on.
 */
export const BARRAGE = { mill: 2, most: 160 };
/**
 * The computer and barrages (#748). With a Tide Mill standing it looks once for a straight causeway line within `reach` tiles of the
 * mill, running to land (or a causeway) on both sides with `line` tiles at most between, that shuts off at least `least` tiles of tidal ground a mill
 * of its reaches; scored by those tiles less `cost` for each tile of line. It lays it with `crew` citizens once it can pay the whole
 * line, and mends a breach in a line that once stood whole. Its Sappers carry kegs to a rival's barrage first, as to a dyke.
 */
export const AI_BARRAGE = { reach: 9, line: 10, least: 6, cost: 1, crew: 3 };
/**
 * The low-water strike (#748). A clever computer whose march on a rival crosses `across` or more tiles of tidal ground (a straight line from
 * its muster, with no open sea on it) times the wave to the tide: it sets out only when, marching at its slowest soldier's pace (`slack`
 * times the straight line), it would find the flats bare and cross them with `margin` seconds to spare, waiting at most `hold` seconds
 * for it. When the flood is `AI_TIDES.wary` seconds off, the soldiers not yet over the far shore turn back to the muster.
 */
export const AI_EBB = { across: 3, slack: 1.25, margin: 6, hold: 200 };

/**
 * Routes that read the tide (#755). A land unit's route over the flats is timed against the public tide clock: walking at its pace less
 * `slack` (its route's length times `slack`), it must find each tidal tile bare from the moment it reaches it until `margin` seconds after
 * it has crossed it. A route that fails goes round, by a path the tide lets it walk, or waits on the last dry ground before the flats for
 * the first moment within `hold` seconds it can cross, whichever reaches the goal sooner; with neither, it goes as ordered.
 */
export const TIDE_ROUTE = { slack: 1.25, margin: 4, hold: 180 };

/**
 * Cockle beds (#767). When the tide wakes, a patch of beds is laid round each tile of the deeper flats (tidal ground of level `deep` or
 * lower: bared only as the tide runs low) that the map's seed picks, one in `chance`: the tile and those beside it four ways on ground as
 * deep. A bed holds `amount` food, picked by citizens at `rate` a second only while the tide has bared it, and each high water brings
 * `regrow` more back, up to `amount`, to a bed that stands open to the sea: not in a barrage's pond, not under a site or causeway.
 */
export const COCKLE = { deep: 2, chance: 0.006, amount: 60, regrow: 25, rate: 1.0 };
/**
 * Work on the flats that reads the tide (#767). A citizen picking a cockle bed or building out on the flats looks at the clock every
 * `check` ticks: when the water would cover the ground it stands on before it could walk to the shore (its route's pace, `TIDE_ROUTE.slack`)
 * with `margin` seconds to spare, it steps ashore, a gatherer with its basket going home first, and goes back once the ground bares again.
 */
export const TIDE_WORK = { check: 5, margin: 6 };
/**
 * The computer and cockle beds (#767). Every `every` seconds a people in the Age of Tides with a bed bared within `reach` tiles of home,
 * staying bare at least `least` seconds more, sends up to `hands` of its wood or berry gatherers to pick it; one that waits ashore longer
 * than `idle` seconds goes back to the woods.
 */
export const AI_COCKLE = { every: 5, reach: 26, least: 25, hands: 3, idle: 25 };
/**
 * The Cockler's Hut (#779). It goes within `reach` tiles of a cockle bed, and takes in cockles only: a picker with a basket of them
 * empties it at the nearest of its people's huts, if that is nearer than a food store. A picker whose bed is under water waits for low
 * water by a hut within `wait` tiles of the bed, on the dry ground beside it. Beds within `reach` tiles of a hut are tended: each high
 * water brings back `regrow` food to them instead of `COCKLE.regrow`.
 */
export const COCKLER = { reach: 6, wait: 10, regrow: 40 };
/**
 * The computer's Cockler's Hut (#779): when its busiest bed (the most pickers on it, then the lowest tile) lies more than `far` tiles
 * from its nearest food store and has no hut of its within `COCKLER.reach`, it raises one by it, no more often than every `every` seconds.
 */
export const AI_COCKLER = { far: 12, every: 30 };
/**
 * The Tide Gate (#785), set into a causeway tile of its owner's barrage. Shut, the pond holds as ever. Opened while the pond holds water the
 * sea outside has left (`least` tiles of it or more, its head), the pond rushes out through the gate as a scour: up to `spread` tiles of
 * bared flats for each tile of head, the nearest first, within `reach` tiles of the gate on its sea side, go under for `secs` seconds;
 * whoever stands there is swept off, `hurt` health lost (or drowned with no shore near). An open gate's pond runs with the tide like
 * the open flats; shut again, it holds what the next flood brings in. Workers keep off the flats below a rival's loaded gate, looking
 * again every `wary` seconds, and a route over them counts as unsafe.
 */
export const TIDE_GATE = { least: 4, spread: 2, reach: 7, secs: 5, hurt: 40, wary: 8 };
/**
 * The computer's Tide Gate (#785): once its barrage stands whole it sets a gate in it (looked for every `every` seconds), the line's tile
 * nearest its middle with the pond on one side and the sea on the other. Every `look` seconds, with the gate shut and loaded, it opens it
 * when at least `threat` enemy land units stand on the flats it would scour, more than its own there; it shuts it again `shut` seconds on.
 */
export const AI_GATE = { every: 20, look: 1, threat: 3, shut: 8 };
/**
 * The computer answers a rival's loaded Tide Gate on its way (#792). Every `look` seconds a wave ready to march works out whether its way
 * steps onto the flats a rival gate would scour (a path search of `search` steps; a way round no more than `round` times as long is just
 * taken). Then, in order: a Sapper people carries a keg to the gate and holds the wave up to `keg` seconds for the blast; a wave of
 * `bait` + `spare` or more sends its `bait` weakest onto the flats and holds `baitWait` seconds for the gate to fire on them; else (or
 * after) it holds at the muster `wait` seconds while the gate stays loaded, then goes anyway.
 */
export const AI_GATE_ANSWER = { look: 2, search: 12000, round: 1.6, keg: 45, bait: 3, spare: 4, baitWait: 20, wait: 90 };
/**
 * The computer's gate reads bait (#796). With rivals enough on its flats to fire on (`AI_GATE.threat`), it still holds the scour while
 * they number under `full` and a rival army stands on the shore within `near` tiles of the flats with `army` times their health or more
 * (soldiers only, not on the flats). Holding, it fires late: once `rise` more rivals have stepped onto the flats than stood there when it began to hold, once the
 * army's share falls short (it has started across), or `lose` seconds before the tide would leave its head too low to scour. And a
 * rival who could carry a keg (a Sapper people's citizens and foot soldiers) within `watch` tiles of the gate draws a guard: its nearest
 * soldier within `call` tiles goes to stand by the gate, sent again no sooner than `again` seconds on, and runs to stamp out a keg lit there.
 */
export const AI_GATE_READ = { full: 6, near: 9, army: 2, rise: 2, lose: 2, watch: 14, call: 40, again: 15 };

/**
 * The breach (#701 s3, the Water Road). Every `every` seconds the sea runs one tile on: each tile of polder four-ways beside water that
 * flows from the open sea (as a mill judges it: a body touching a map edge, or more than `POLDER.most` tiles; a finished dyke holds it,
 * a dyke site does not) floods, all at once, so water let in this step runs on only at the next. A flooded tile is sea again, its corners
 * sunk to `bank` (to `bed` where water lies all round them). A building on it is drowned; a land unit on it is swept to the nearest dry
 * ground within `sweep` tiles and hurt `unit`, or drowned where there is none. A keg's blast harms a dyke `keg` times as much as any
 * other building. A people that has walked the Age of Dykes may raise dykes in any age after, to mend its banks.
 */
export const BREACH = { every: 0.5, bank: -0.16, bed: -0.4, sweep: 16, unit: 15, keg: 2 };

/**
 * The computer and the breach (#701 s3). A dyke is worth breaching when its fall would flood `least` tiles of polder or more
 * (`heldBack`). On campaign, siege goes for such a dyke within `hunt` tiles of it, and Sappers carry their kegs to one first. A people
 * whose line once stood whole mends any gap in it, in any age, before anything else on the water.
 */
export const AI_BREACH = { least: 8, hunt: 12 };

/**
 * A spring by every town (#701 s1): a start with no water within `near` tiles gets a spring head about `at` tiles away, on dice of
 * its own and laid after everything else. It changes no ground, so every map is as it was; a channel dug beside it fills from it.
 */
export const SPRING = { near: 14, at: 9 };

/**
 * The Water Line (#701 s4, the Water Road). Every `every` seconds the water runs one ring on from each open Sluice with still water
 * four-ways beside it (sea, lake or channel): over low ground, four ways, up to `reach` steps from the Sluice. Low ground is polder,
 * or open meadow or sand whose highest corner lies no more than `rise` over the Sluice's lowest bank; trees, rock, deposits, rises and
 * buildings stand out of it, Farms excepted (a Farm under it yields nothing). The ground's heights are not touched: the water lies
 * knee-deep over them. Land units wade it at `wade` of their pace, siege at `siege`; gun-barges sail it (and pass through any sluice,
 * as a lock). Water no open Sluice reaches drains back a ring every `every` seconds, from its edges in, but never from under a boat
 * while water lies beside it: a boat left on the last wet tile runs aground and is lost.
 */
export const INUND = { every: 1, reach: 7, rise: 0.4, wade: 0.3, siege: 0.1 };

/**
 * The computer in the Age of the Water Line (#701 s4). A people that walked the Dykes takes the road on `take` (a coin of its own). It
 * raises a Sluice on the water nearest home with low ground beside it (within `reach` tiles of its start), keeps `barges` gun-barges,
 * and opens the sluice while an enemy army of at least `threat` stands within `near` tiles of it, shutting it `calm` seconds after
 * the last has gone. It stays `stay` seconds in the age before it climbs on.
 */
export const AI_WATERLINE = { take: 0.6, reach: 16, barges: 2, threat: 4, near: 14, calm: 20, stay: 360 };

/**
 * The computer in the Age of Rivers (#701 s1). It takes the road on a coin of its own (`take`), and digs one channel from the water
 * nearest home (within `reach` tiles of its start), the line of at most `most` tiles that waters the most ground within `stop` tiles
 * of home (drawn again when it arrives), with `crew` citizens; its fields then go along the water. A people that walked the Age of Rivers goes on to the Age of Dykes on `onward`.
 */
export const AI_RIVERS = { take: 0.4, reach: 18, stop: 8, most: 14, crew: 3, onward: 0.7 };

/**
 * Canals (#701 s5, the Age of Locks). A Channel that fills in the Age of Locks is a canal (`GameState.channel` 2): `T_WATER` its corners
 * sunk to `bank` (to `bed` where water lies all round), that every ship sails and land units swim at `wade` of their pace. A Channel
 * laid on an old channel in the age digs it deep. A Bridge over a canal or channel carries its own people across at full pace, and
 * ships pass under it.
 */
export const CANAL = { bank: -0.3, bed: -0.75, wade: 0.25 };

/**
 * Dams (#701 s5, the Age of Locks). A finished, standing Dam with still water four-ways beside it turns: its owner's buildings within
 * `reach` tiles (centre to centre) train and research at `drive` hundredths of their pace, one dam's worth however many stand near (it
 * multiplies the coils' rate in the Age of Lightning). Outside the age only the dam kept as its keepsake turns. A dam that falls with
 * water beside it bursts: the water runs over the low ground round it (as a sluice's flood would, `INUND.rise` over its lowest bank)
 * up to `surge` steps at once, and land units standing there lose `hurt`; then it drains as any flood does.
 */
export const DAM = { reach: 8, drive: 140, surge: 6, hurt: 40 };

/**
 * The computer in the Age of Locks (#701 s5). A people that walked the Water Line takes the road on `take` (a coin of its own). It
 * digs its channel line deep into a canal (`AI_RIVERS`), raises a Dam on the water within `reach` tiles of its start where the most of
 * its training buildings stand within `DAM.reach`, and lays a Bridge over the canal tile nearest home once the water is in. It stays
 * `stay` seconds in the age before it climbs on.
 */
export const AI_LOCKS = { take: 0.6, reach: 14, stay: 360 };

/**
 * The Age of Floating Cities (#770). A Pontoon is moored on open water a ship sails (`sails`), raised beside the shore or another of its
 * people's pontoons so its builders can reach it. Pontoons whose sides touch link; a district of `city` or more linked finished pontoons
 * raises citizens at each. Cast off (the `pack` order), a pontoon is a tow carrying up to `hold` of the people on its deck; the rest
 * swim to the nearest deck or shore within `swim` tiles, losing `hurt`, or drown. Moored again (the `pitch` order) within `spot` tiles of
 * where the tow lies, it raises itself as a pitched camp does (`STEPPE.pitch`). Ships do `hull` times their usual damage to a pontoon.
 */
export const FLOAT = { city: 3, hold: 10, swim: 4, hurt: 25, spot: 3, hull: 3 };
/**
 * The computer in the Age of Floating Cities (#770): it turns from the Age of Tides on its own coin (`take`, `onward` for a Water Road
 * people) once it has kept the Tides `after` seconds (its mills grinding, its barrage laid), moors at least `most` pontoons in a linked row off the shore nearest home (within `reach` tiles), keeps `fishers` fishing
 * boats on them and raises citizens at the linked town up to `hands`, and casts a pontoon off and tows it to `flee` tiles from where a
 * warhead is aimed, when that is within `blast` tiles of it. It stays `stay` seconds.
 */
export const AI_FLOAT = { take: 0.5, onward: 0.8, most: 4, reach: 18, fishers: 4, hands: 50, blast: 12, flee: 16, after: 480, stay: 420 };

/**
 * Stepping back an age (#47), at a Town Center: down to the trunk age one tier below, whatever road
 * led here (the Iron Age falls back to the Stone Age, the merchants to the Bronze Age). Every unit
 * falls back to its older form, and technologies above the new tier are suspended, not lost: they
 * return when the people climbs again, at the climb's full price. What the step itself costs, for each
 * tier given up: food to carry the people through the unrest, gold to pay off those who did well
 * under the new order. `time` is seconds at the Town Center; `cooldown` is seconds after a step lands
 * before the next may begin, so a people can't flicker between ages to dodge a counter.
 */
/**
 * The Golden Age (#703): it burns `span` seconds, `more` seconds longer for every side age walked past the road's `n`, up to `most`.
 * Mods that are boons below 1 (the rest are boons above it), so the weave takes the best of each thread.
 */
export const GOLDEN = { span: 360, more: 60, most: 600 };
export const LOWER_IS_BETTER: (keyof Mods)[] = ['militaryTrain', 'rangedTrain', 'techCost', 'wonderCost', 'rot', 'beastWard'];

export const STEP_BACK = { food: 100, gold: 50, time: 25, cooldown: 300 };
export const stepBackCost = (tier: number): Cost => ({ food: STEP_BACK.food * tier, gold: STEP_BACK.gold * tier });

/**
 * Bog iron (#39): on a `chance` share of seeds, a patch of `tiles` tiles for each player, about `home`
 * tiles from their town (nearer it than any other), each holding `AMOUNT.bog`. Other seeds hold none.
 */
export const BOG_IRON = { chance: 0.5, home: 22, tiles: 5 };

// ---- Units ----------------------------------------------------------------------------------------

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
  shot?: 'stone' | 'arrow' | 'bolt' | 'bullet' | 'boulder' | 'ball' | 'bomb' | 'dart';
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

/** A beast of the Wild: the same from the Bronze tier on, for it does not re-arm. */
const beast = (u: UnitStats): (UnitStats | null)[] => [null, u, u, u, u];
const HAWK: UnitStats = { name: 'Hawk', cls: 'bomber', hp: 26, attack: 0, armor: 0, parmor: 0, range: 0, reload: 1, speed: 3.6, sight: 15, cost: { food: 40 }, time: 12, radius: 0.18, blurb: 'A hunter\'s bird, trained at a Hunting Camp: it flies over walls, woods and water and sees farther than any scout, but it has no weapon and a hawk is soon dead if it lingers in range of an archer or a tower. Right-click ground to send it there.' };
const BLOWPIPE: UnitStats = { name: 'Blowpipe Hunter', cls: 'ranged', hp: 50, attack: 3, armor: 0, parmor: 1, range: 4, reload: 1.6, speed: 1.7, sight: 7, cost: { food: 35, wood: 40 }, time: 14, radius: 0.24, shot: 'dart', blurb: 'A hunter with a long cane blowpipe and darts tipped in venom. Short of reach, but every dart adds venom that burns past armour and slows: death to heavy riders, bears and mammoths. Riders who reach it first cut it down.' };

/** Each line has one version per epoch (null where it isn't available yet). Units re-arm when their owner advances. */
export const UNITS: Record<UnitType, (UnitStats | null)[]> = {
  citizen: [0, 1, 2, 3, 4, 5].map((e) => ({
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
  // ---- Under sail (trade by sea) ----
  cog: [
    null,
    { name: 'Merchant Galley', cls: 'trader', hp: 150, attack: 0, armor: 0, parmor: 2, range: 0, reload: 1, speed: 1.9, sight: 7, cost: { wood: 90, gold: 40 }, time: 22, radius: 0.46, blurb: 'Sails goods from a Dock to a trading post on the coast and brings back gold: the farther the post, the more, and 20% over the land road. Only a post with water within 7 tiles is a port. Warships are its enemy.' },
    { name: 'Merchant Cog', cls: 'trader', hp: 210, attack: 0, armor: 1, parmor: 3, range: 0, reload: 1, speed: 2.0, sight: 7, cost: { wood: 100, gold: 40 }, time: 22, radius: 0.48, blurb: 'Sails goods from a Dock to a trading post on the coast and brings back gold: the farther the post, the more, and 20% over the land road. Only a post with water within 7 tiles is a port. Warships are its enemy.' },
    { name: 'East Indiaman', cls: 'trader', hp: 290, attack: 0, armor: 1, parmor: 4, range: 0, reload: 1, speed: 2.1, sight: 8, cost: { wood: 110, gold: 50 }, time: 22, radius: 0.5, blurb: 'Sails goods from a Dock to a trading post on the coast and brings back gold: the farther the post, the more, and 20% over the land road. Only a post with water within 7 tiles is a port. Warships are its enemy.' },
    { name: 'Steam Freighter', cls: 'trader', hp: 380, attack: 0, armor: 2, parmor: 5, range: 0, reload: 1, speed: 2.5, sight: 8, cost: { wood: 80, gold: 60 }, time: 22, radius: 0.52, blurb: 'Sails goods from a Dock to a trading post on the coast and brings back gold: the farther the post, the more, and 20% over the land road. Only a post with water within 7 tiles is a port. Warships are its enemy.' },
  ],
  // ---- On the flood (#701 s4, the Age of the Water Line) ----
  barge: [
    null,
    null,
    null,
    { name: 'Gun-barge', cls: 'ship', hp: 200, attack: 24, armor: 1, parmor: 3, range: 8, minRange: 2, reload: 5, speed: 1.6, sight: 9, cost: { wood: 130, gold: 70 }, time: 26, radius: 0.45, shot: 'ball', splash: 0.7, blurb: 'A flat boat with a cannon in its bow: it sails the sea, the channels and the flood alike, and shells what stands round it. Thin-sided: a galleon outguns it on open water.' },
    { name: 'Steam Gunboat', cls: 'ship', hp: 280, attack: 32, armor: 2, parmor: 4, range: 9, minRange: 2, reload: 4.5, speed: 2.0, sight: 10, cost: { wood: 110, gold: 110 }, time: 26, radius: 0.47, shot: 'ball', splash: 0.8, blurb: 'A shallow steam launch with a gun: it sails the sea, the channels and the flood alike, and shells what stands round it.' },
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
  // A packed Town Center or House (#297): never trained, only made by striking camp. Cavalry's easy prey (trader class).
  wagon: [0, 1, 2, 3, 4].map((e) => ({
    name: e < 2 ? 'Ger Cart' : 'Ger Wagon',
    cls: 'trader' as const,
    hp: 260 + e * 40,
    attack: 0,
    armor: 1,
    parmor: 3,
    range: 0,
    reload: 1,
    speed: 1.2,
    sight: 6,
    cost: {},
    time: 1,
    radius: 0.5,
    blurb: 'A Town Center or House packed onto an ox cart: drive it to new ground and pitch it there (P). It shelters, trains and takes in nothing while it rolls, and riders run it down.',
  })),
  // A pontoon cast off (#770, the Age of Floating Cities): never trained, only made by casting a Pontoon off. Ships hole it as they hole a pontoon.
  tow: [0, 1, 2, 3, 4, 5].map(() => ({
    name: 'Pontoon in tow',
    cls: 'ship' as const,
    hp: 600,
    attack: 0,
    armor: 2,
    parmor: 8,
    range: 0,
    reload: 1,
    speed: 1.1,
    sight: 6,
    cost: {},
    time: 1,
    radius: 0.7,
    capacity: FLOAT.hold,
    blurb: 'A Pontoon cast off and under tow, with those of its deck aboard: take it to open water and moor it there (P). It shelters, trains and takes in nothing while it is towed, and ships sink it fast.',
  })),
  trader: [
    null,
    { name: 'Pack Donkey', cls: 'trader', hp: 80, attack: 0, armor: 0, parmor: 1, range: 0, reload: 1, speed: 1.3, sight: 6, cost: { wood: 60, gold: 40 }, time: 20, radius: 0.32, blurb: 'Carries goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
    { name: 'Ox Cart', cls: 'trader', hp: 110, attack: 0, armor: 0, parmor: 2, range: 0, reload: 1, speed: 1.3, sight: 6, cost: { wood: 70, gold: 40 }, time: 20, radius: 0.4, blurb: 'Carries goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
    { name: 'Covered Wagon', cls: 'trader', hp: 140, attack: 0, armor: 1, parmor: 2, range: 0, reload: 1, speed: 1.45, sight: 7, cost: { wood: 80, gold: 50 }, time: 20, radius: 0.42, blurb: 'Carries goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
    { name: 'Traction Engine', cls: 'trader', hp: 180, attack: 0, armor: 2, parmor: 3, range: 0, reload: 1, speed: 1.65, sight: 7, cost: { wood: 60, gold: 60 }, time: 20, radius: 0.45, blurb: 'Steams goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
  ],
  // ---- Beasts of the Age of the Wild (`docs/wild-road.md`) ----
  // Tamed from the wild (`TAME`) or bred at a Beast Den once the kind is tamed. A beast is a beast: it does not re-arm with the epochs.
  warwolf: beast({ name: 'War Wolf', cls: 'cavalry', hp: 75, attack: 6, armor: 0, parmor: 1, range: 0, reload: 1.2, speed: 2.8, sight: 8, cost: { food: 65 }, time: 15, radius: 0.26, blurb: 'A wolf of the wild that answers to your people: fast and cheap, it runs down archers, priests and citizens. Spears break it.' }),
  tusker: beast({ name: 'Tusker', cls: 'infantry', hp: 120, attack: 7, armor: 2, parmor: 1, range: 0, reload: 1.4, speed: 1.9, sight: 5, cost: { food: 80, wood: 20 }, time: 18, radius: 0.32, blurb: 'A tame boar with a hide like bark: it holds a line and breaks riders on its tusks. Archers thin it.' }),
  // The Age of the Hive (`HIVE`): the Cave Bear is bred at the Den (`trainsAt`) by a people that has walked the Hive, no taming needed.
  cavebear: beast({ name: 'Cave Bear', cls: 'infantry', hp: 340, attack: 12, armor: 3, parmor: 6, range: 0, reload: 1.8, speed: 1.35, sight: 5, cost: { food: 180, gold: 40 }, time: 32, radius: 0.46, blurb: 'A great bear of the caves raised at your Den: a slow wall of fur that shrugs off arrows and mauls whatever stands before it. Swords, spears and guns bring it down; arrows barely do.' }),
  // The Age of the Hive: its bowmen, trained at the Archery Range by a people that has walked it, from the Gunpowder Age's tier.
  blowpipe: [null, null, null, BLOWPIPE, BLOWPIPE],
  // The Age of the Wildwood (`WILDWOOD`): an Ent, woken from an old tree at the Heart Tree by a people that has walked the Wildwood.
  warden: [null, null, null, null, { name: 'Ent', cls: 'siege', hp: 650, attack: 22, armor: 3, parmor: 8, range: 4, reload: 3.2, speed: 0.85, sight: 7, cost: { food: 150, wood: 200, gold: 80 }, time: 40, radius: 0.6, shot: 'boulder', splash: 0.8, blurb: 'An old tree of your woods, woken at the Heart Tree: it walks slowly, tears boulders from the ground and flings them, and breaks buildings and engines. Arrows barely mark its bark, but swords, riders and fire bring it down. Root it (O) and it is a tree again: it mends, and wakes when a rival comes near.' }],
  // The Age of Leviathans (`LEVIATHANS`): giants bred at the Great Den by a people that has walked it. They don't re-arm either.
  skywhale: [null, null, null, null, null, { name: 'Skywhale', cls: 'bomber', hp: 800, attack: 0, armor: 2, parmor: 4, range: 0, reload: 1, speed: 1.9, sight: 10, cost: { food: 400, wood: 100, gold: 150 }, time: 45, radius: 0.8, capacity: WHALE_HOLD, blurb: `A whale of the air, bred at the Great Den: its great gas-bladder carries it slowly over walls, woods and water with ${WHALE_HOLD} soldiers or citizens aboard (right-click it to board, then right-click ground to set them down). Every ${WHALE_BOMB} seconds it drops a seed-bomb (B): ${WHALE_SEEDS} Thornwall seedlings sprout on the ground beneath it, in a rival's streets as well as your own. It has no weapon; fighters, riflemen and towers bring it down, and those aboard fall with it.` }],
  // The Age of Leviathans at sea (#789): the Kraken, bred at a Great Den by the sea, and the Reef Ship, grown at a Dock in the age.
  kraken: [null, null, null, null, null, { name: 'Kraken', cls: 'ship', hp: 1400, attack: 34, armor: 3, parmor: 5, range: 1.5, reload: 2.5, speed: 2.4, sight: 9, cost: { food: 500, wood: 100, gold: 300 }, time: 60, radius: 0.5, blurb: `A giant of the deep, bred at a Great Den that stands within ${KRAKEN_SEA} tiles of the sea, ${KRAKEN_MOST} to a people. Its arms reach a tile and a half: every blow on a ship grips it ${KRAKEN_GRIP} seconds, so it can't sail away, and it drags at anything on the shore beside it. Your own ships near it are shoved along a third faster. It outruns warships and tears them apart, but warships and towers that shoot first wear it down, and it never leaves the water.` }],
  reefship: [null, null, null, null, null, { name: 'Reef Ship', cls: 'ship', hp: 420, attack: 14, armor: 2, parmor: 4, range: 6, reload: 2.5, speed: 2.0, sight: 9, cost: { food: 140, wood: 60 }, time: 30, radius: 0.5, shot: 'bolt', blurb: `A living ship of coral and kelp, grown at a Dock in the warship's place while your people stands in the Age of Leviathans, for food and wood, not gold. It is launched at ${REEF_BORN}% of its strength and grows to full on the water, ${REEF_MEND} a second, and mends itself the same way once ${LEVIATHANS_CALM} seconds pass without a blow: weaker than an ironclad, but a fleet that grows back between fights.` }],
  behemoth: [null, null, null, null, null, { name: 'Behemoth', cls: 'siege', hp: 3200, attack: 28, armor: 5, parmor: 12, range: 0, reload: 3, speed: 0.75, sight: 9, cost: { food: 1000, wood: 500, stone: 200, gold: 500 }, time: 120, radius: 0.5, blurb: 'A titan turtle with a Town Center on its back, one to a people: a capital that walks. It tramples walls and buildings, and arrows and bullets barely mark its shell; spears and riders swarm it. Kneel it (P) on ground no rival holds and its Town Center stands there at once, working: it trains, takes in every stock and claims the land. Rise (P) and it walks on. It counts as a Town Center while it walks, and losing it loses one.' }],
  // The Age of the Wild Hunt (`HUNT`): a hunter's bird, trained at a Hunting Camp by a people standing in the age. It has no weapon.
  hawk: [null, HAWK, HAWK, HAWK, HAWK, HAWK],
  warmammoth: beast({ name: 'War Mammoth', cls: 'siege', hp: 420, attack: 16, armor: 2, parmor: 4, range: 0, reload: 2.4, speed: 1.1, sight: 6, cost: { food: 260, gold: 60 }, time: 40, radius: 0.55, blurb: 'A woolly mammoth led to war: it tramples walls and buildings as a ram does, and gores soldiers too. Spearmen and riders swarm it.' }),
};

const DOMAINS: Partial<Record<UnitType, Domain>> = { hawk: 'air', fisher: 'water', warship: 'water', transport: 'water', cog: 'water', barge: 'water', tow: 'water', fighter: 'air', bomber: 'air', skywhale: 'air', kraken: 'water', reefship: 'water' };
/** Where a unit line goes: on foot, on the water or in the air. */
export const domainOf = (type: UnitType): Domain => DOMAINS[type] ?? 'land';

export const UNIT_TYPES: UnitType[] = ['citizen', 'infantry', 'ranged', 'cavalry', 'siege', 'priest', 'hero', 'fisher', 'warship', 'transport', 'cog', 'fighter', 'bomber', 'trader', 'wagon', 'warwolf', 'tusker', 'warmammoth', 'blowpipe', 'cavebear', 'barge', 'warden', 'tow', 'skywhale', 'behemoth', 'kraken', 'reefship', 'hawk'];
export const MILITARY: UnitType[] = ['infantry', 'ranged', 'cavalry', 'siege', 'hero', 'warship', 'fighter', 'bomber', 'warwolf', 'tusker', 'warmammoth', 'blowpipe', 'cavebear', 'barge', 'warden', 'behemoth', 'kraken', 'reefship'];

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

// ---- Heroes, priests and relics -------------------------------------------------------------------

/** A hero's presence: soldiers within this many tiles strike harder and heal. */
export const AURA = { radius: 6, attack: 1.2, heal: 1.5 };
/**
 * The hero's Rallying Cry (own pitch): a free shout that stirs every friendly soldier within `radius` tiles for
 * `duration` seconds: blows land `attack` times harder, `armor` more armor, and each is mended `heal` at once.
 * The hero then needs `cooldown` seconds to draw breath. It is a stand, not a charge: the cry does nothing for
 * a soldier who isn't fighting, so it is called when the lines meet.
 */
export const RALLY = { radius: 8, duration: 12, cooldown: 70, attack: 1.3, armor: 1, heal: 6 };
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
 * Faith takes the walls (#209). A pilgrim people (`Mods.consecrate`) builds no siege engines; its priests
 * chant a rival's building over instead, every voice adding to one shared tally on the building.
 * - Each chanting priest wins over `rate` of the building's full health a second, times its people's
 *   priest speed (Theology, the pilgrims) and the Sacred Grove's boost, so a Middle Ages Watch Tower
 *   (1500) takes five pilgrim priests about 16 s if none fall; under its arrows, nearer 28 s, and three
 *   of the five are lost (Theology: 15 s, two lost).
 * - `hard` makes some buildings resist longer: holy ground holds out, and a Temple taken brings its relics.
 * - Every unit sheltering inside slows the chant: rate / (1 + `guard` × those inside). They spill out
 *   to fight when it turns.
 * - Counter-chant: each of the keeper's own priests within `counter.range` tiles of the building (out in the
 *   open, not sheltering) answers, and slows the chant as a guard does, by `counter.each` times its people's
 *   priest speed. Two answering priests halve a lone chanter's pace; a full band of five still wins.
 * - `never`: a people's heart and its glory stay its own.
 * - After `grace` seconds with no one chanting, the faith fades by `fade` of the whole each second.
 */
export const CONSECRATE = {
  rate: 15,
  hard: { temple: 1.5 } as Partial<Record<BuildingType, number>>,
  guard: 0.35,
  counter: { range: 7, each: 0.5, answer: 0.015, stand: 0.5, hold: 3 },
  never: ['towncenter', 'wonder'] as BuildingType[],
  grace: 1,
  fade: 0.05,
};
/**
 * Relics: one lies out for each player, `home` tiles from their town, and `extra` more (by map size) where
 * the land is within `fair` tiles of as far from the two nearest towns, at least `spacing` apart. A
 * relic kept in a Temple brings its owner `gold` every `every` seconds, and `score` to their score.
 */
/**
 * The Town Center is the heart of a people (#452): when the last one falls (finished, under construction, or packed
 * on a steppe wagon all count as standing), a people has `grace` seconds to lay a new foundation before it is lost.
 * The alert for an attack on a Town Center comes at least every `alert` seconds, whatever else is being struck.
 */
export const HEART = { grace: 45, alert: 8 };
export const RELIC = { home: 20, fair: 3, spacing: 12, extra: { small: 1, medium: 2, large: 3 } as Record<MapSize, number>, gold: 1, every: 2, score: 60 };
/**
 * Trade: `posts` trading posts (by map size) stand within `edge` tiles of the map's edge (at least 3),
 * about as far from their two nearest towns (within `fair` tiles), at least `far` of the map's width
 * from every town and `spacing` of it from each other. A post's plaza runs `plaza` tiles each way from
 * its center; a trader trades once within `reach` tiles of the center. A trip pays `gold` × the
 * squared distance (in tiles) from the trader's Market to the post, `epoch` more for each epoch after
 * the Bronze Age, at most `max`: so a long road pays more per minute, and has more road to guard.
 * Each ally with a Market of its own takes `ally` of every trip home (a quarter), so a team trades together.
 * By sea: a post with water within `sea.reach` tiles is a port, and a merchant ship from a Dock sails there for `sea.mul` times the land road's gold.
 * A glut (#493): every load a post gives raises its glut by `each` (up to `max`) and every trip there pays `1 − glut` of its gold;
 * the glut heals `heal` a second, so about one trader in 40 seconds keeps a post at full price, and a flood of them does not.
 */
/**
 * Ancient ruins (#64): `count` (by map size) lie out between the towns, at least `home` tiles from every
 * town, within `fair` tiles of as far from the two nearest, `spacing` apart and clear of relics and
 * trading posts. One citizen digs a ruin out in `dig` seconds (more dig it quicker; the work is shared,
 * and whoever's citizen strikes the last spade takes the find). A hoard is `gold` gold; lost knowledge
 * is the cheapest technology of your age you don't have yet, free (a hoard of `gold` if there's none);
 * an old map shows you the whole land; a relic comes up out of the earth. Diggers stand within `reach`
 * tiles of the ruin's middle, and nothing is built within `clear` tiles of it.
 */
/**
 * Foundations (the Age of Reclaimers): when one of a reclaiming people's buildings falls, its footprint is
 * remembered for `window` seconds. Raising the same building on the same spot again costs `cost` of the
 * usual price and starts `head` built (hit points to match). Walls, gates and wonders leave nothing to build on.
 */

// ---- Aircraft, fairs, convoys and salvage ---------------------------------------------------------

/**
 * Sorties (the Age of Aeronauts): aircraft of a sortie people fly on fuel from their finished Airfields. Within
 * `rearm` tiles of one they are rearmed and mended (`mend` of full health a second); more than `turn` tiles
 * from the nearest they give up their orders and fly home; past `reach` tiles (or with no Airfield left) they
 * burn `burn` of full health a second. Reach a far target with a forward Airfield, raised in your own land.
 */
export const SORTIE = { rearm: 4, mend: 0.08, turn: 30, reach: 36, burn: 0.04 };
/**
 * Feast days (the Age of Fairs): every `every` seconds a feast opens for `open` seconds. A trade trip paid at a
 * Market within `reach` tiles of a standing Temple that keeps a relic (the fairground) pays `pay` times as much
 * while it lasts. The calendar is the same for everyone, so the computer's traders profit too. A fairground Market
 * burned by a rival on a feast day pays that rival `purse` gold: the takings are in the stalls. When the feast
 * closes, a hero standing within `reach` of the fairground Market (no rival soldier there) holds the lists: it is
 * healed whole and the crowd pays `lists` gold. Volunteers flock to the fair: a unit (not a hero) queued on a feast
 * day at a building within `reach` of the fairground costs `levy` times its price.
 */
export const FAIR = { every: 240, open: 60, reach: 12, pay: 1.5, purse: 150, lists: 120, levy: 0.75 };
/**
 * Convoys (the Age of Sail): a merchant ship that loads at a port with a warship of its owner's within `reach`
 * tiles carries `pay` times the gold. Send the fleet with the cogs: the escort is also what the rival's raiders meet.
 */
export const CONVOY = { reach: 6, pay: 1.4 };
/** Prize money (the Age of Sail): a merchant ship sunk by a people in the Age of Sail gives the sinker `share` of the gold it carried. */
export const PRIZE = { share: 0.5 };
/**
 * Vigils (the Age of Pilgrims): each own priest standing within `reach` tiles of a finished Temple that keeps a
 * relic adds `each` gold to that relic's payment, for at most `most` priests; the toast tells of it at most every `toast` seconds. A priest at the shrine is a priest
 * not chanting at a rival's wall, and the shrine is where the rival's raiders come.
 */
export const VIGIL = { reach: 5, each: 1, most: 3, toast: 30 };
/**
 * Salvage (the Age of Reclaimers, #503): any building that falls (a rival's, or your own) while a reclaiming people is in the match leaves rubble
 * for `window` seconds. A reclaimer's citizens strip it: one citizen takes `work` seconds, and the stock gets `share` of the building's price.
 * Rubble of your own fall is the choice: strip it for stock now, or leave the foundations to raise again at `RECLAIM.cost`.
 */
export const SALVAGE = { share: 0.5, work: 10, window: 150, reach: 2.2, find: 40 };
export const RECLAIM = { window: 300, cost: 0.4, head: 0.5, skip: ['wall', 'gate', 'wonder'] as string[] };

// ---- Ruins, landmarks and trade -------------------------------------------------------------------

export const RUINS = { count: { small: 2, medium: 3, large: 4 } as Record<MapSize, number>, home: 24, fair: 4, spacing: 14, dig: 40, gold: 300, reach: 1.7, clear: 1 };
/**
 * Contested landmarks: one more than there are players lies out between the towns (at most `max`), at
 * least `home` tiles from every town and at most `far` from the nearest, within `fair` tiles of as far from the two nearest (looser if the
 * map allows nothing better), `spacing` apart and clear of relics, posts, ruins and wolf dens. Each is a
 * kind dealt from a shuffled hand, so a two-player map holds one of each and the third is a coin toss.
 *
 * Land units (traders aside) within `reach` tiles of one claim it: with one side's people there alone,
 * the claim grows by one tick each tick for each of them, up to `crowd` at once; `claim` seconds of one
 * person's claim takes a landmark nobody keeps. Rivals there alone pull a held one back down to nobody's
 * first, at the same pace. Two sides there at once: nothing moves. During a peace treaty nobody's
 * landmark can be taken from them, though one nobody keeps can be claimed. A keeper holds the land
 * `border` tiles round it (borders: supply, building, the wild), and nothing is built within `clear`
 * tiles of its middle. Each landmark kept adds `score`.
 *
 * - The Sacred Spring mends its keeper's people within `spring.reach` tiles: `spring.heal` of their full
 *   health every `spring.every` seconds. A place to stage a raid from, or to bring the bitten home to.
 * - The Lookout Crag shows its keeper everything within `crag.sight` tiles: the road their rival walks.
 * - The Flint Scatter gives its keeper's citizens good edges: chopping and mining (stone, gold, bog iron) `flint.tools` times as fast.
 * - The Sacred Grove makes its keeper's priests work `grove.priest` times as fast (converting, healing) within `grove.reach` tiles of it: a place to bring a priest to turn a rival's army.
 * - The Old Ford lets its keeper's soldiers march `ford.march` times as fast: a road for the army, so the keeper strikes first.
 * - The Ancestors' Cairn gives its keeper `cairn.pop` more room for people: a house or two not built.
 */
export const LANDMARKS = {
  /** Lords of the Land: a side that keeps every landmark (at least `lordsMin` stand) for `lordsSeconds` wins. */
  lordsSeconds: 240, lordsMin: 3,
  max: 5, home: 22, far: 34, fair: 4, spacing: 16, reach: 3.5, claim: 20, crowd: 3, border: 5, clear: 1, score: 100,
  spring: { reach: 6, heal: 0.03, every: 2 },
  crag: { sight: 14 },
  cairn: { pop: 5 },
  flint: { tools: 1.2 },
  grove: { reach: 10, priest: 1.8 },
  /** The Old Ford: its keeper's soldiers (not citizens or traders) march `march` times as fast, anywhere on land. */
  ford: { march: 1.2 },
  /** A people's own kind of landmark (the Romans, who build their own, have none) gives it `kinMul` times the effect (of the part above that is a bonus). */
  kinMul: 1.5,
  kin: { egyptians: 'flint', greeks: 'spring', mongols: 'crag', chinese: 'grove', britons: 'cairn' } as Partial<Record<CivId, LandmarkKind>>,
};
/**
 * The computer and the landmarks: once it has `townAt` citizens and sees no danger near one nobody
 * keeps within `near` tiles of home (or `rival` of the way to its rival's town, if farther), it sends one citizen to claim it (calling them back after `walk`
 * seconds if it hasn't come to anything). Between waves, with at least `party` soldiers standing ready,
 * it sends up to `guard` of them to take (or take back) the nearest landmark in reach that a rival keeps
 * or is claiming, and holds them there until it's no longer the rival's, or `hold` seconds pass.
 */
/** The computer and its find (#588): seconds a citizen may spend walking out to it. */
export const AI_FIND = { walk: 120 };
export const AI_MARK = { /** In a Lords of the Land match: reach over the whole map, and the band that goes after a landmark. */ lordsReach: 400, lordsParty: 2, escort: 2, far: 28, townAt: 8, near: 44, rival: 0.75, walk: 150, party: 3, guard: 5, hold: 120, linger: 20,
  /** The walker halts when its escort trails it by more than this many tiles, and goes on once they close up. */
  lead: 9,
  /** Divisors of a landmark's distance (bigger: more worth walking for): by kind, with the cairn when houses are full and the spring when people are hurt. */
  worth: { crag: 1, flint: 1.25, ford: 1.1, spring: 1, springHurt: 1.5, cairn: 1, cairnFull: 1.6,
    /** Times more worth walking for the kind its own people favour (`LANDMARKS.kin`), since it pays half again as much. */
    kin: 1.4,
    /** Soldiers weigh a rival's kept Old Ford this many times more: it quickens the strikes against them, so it is taken before a war. */
    fordRival: 1.6 } };

// ---- Buildings ------------------------------------------------------------------------------------

/** Repairs: restoring a building's whole health costs this share of its price, paid as the hammers work. */
export const REPAIR_SHARE = 0.4;
export const TRADE = { posts: { small: 2, medium: 2, large: 3 } as Record<MapSize, number>, edge: 9, fair: 4, far: 0.3, spacing: 0.4, plaza: 1, reach: 1.8, gold: 0.012, epoch: 0.08, max: 180, ally: 0.25, harbor: { reach: 12, mul: 1.3 }, sea: { reach: 7, mul: 1.2 }, glut: { each: 0.12, heal: 0.003, max: 0.5 } };

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
  /** Raised only by a people standing in one of these ages (the War Camp, #303); absent: by anyone. */
  ages?: AgeId[];
  /** Blood paid once, from `Player.blood`, to raise it (the Blood Tower, #355 s3). */
  blood?: number;
  /** Units besides citizens that may raise it (the War Camp is pitched by foot soldiers, #303). */
  builders?: UnitType[];
  /** Only its `builders` raise it, citizens too not (the Mission, #555 s12). */
  only?: boolean;
  /** Burns, rather than sleeps, when its people leaves its `ages` (the War Camp, #303; #555 s10). */
  burns?: boolean;
  /** Which build menu it is in, and its key there. */
  menu: 'eco' | 'mil';
  key: string;
  blurb: string;
}

/**
 * The managed wood (#501, the Britons): a coppice people tills no Farm. A tree its citizens fell to the stump within `reach` tiles of
 * one of its finished wood stores is coppiced: the stool stays and grows a full tree again `regrow` seconds later (if something
 * stands on it then, `retry` seconds after). A rival's axe, or its own far from a store, clears the tree for good, and a building
 * raised over a stool grubs it out. Its citizens plant a Sapling (a 1-tile building) on open ground, which roots as a stool and is
 * a full tree `grow` seconds later. Its snares fill `snare` times as fast (and as much faster again as its farming technologies
 * make fields), at their fastest with `full` trees round them (growing stools count, for young coppice is cover for game too), and hold `cap` times as much, and its tenders carry a game bag `bag` times a basket: the snare line among the standing wood is its field, and the trees it fells for
 * timber starve the snares beside them until they grow back.
 *
 * The computer: lays `aiPerFood` snares for each field its food wants (at most `aiMax`, `aiStone` in the Stone Age while berries grow by home), within `aiNear` tiles of home in woods of
 * `aiThick` trees if it can find them, else `aiTrees`, else any wood a snare may stand in, out to `aiNear` + 10 tiles; raises a Hunting Camp by a snare with no food drop within `aiDrop` tiles (while it has fewer than `aiCamps`); keeps
 * one tender for each `aiPerTender` snares, and once it has a Barracks or a Range and `aiPlantWood` wood to spare, plants up to
 * `aiPlant` saplings at a time round a snare with fewer than `aiThin` trees standing near it.
 */
/**
 * Taming (the Age of the Wild, `docs/wild-road.md`, `src/sim/tame.ts`): a citizen within `reach` tiles of a wild wolf, boar or mammoth
 * sings to it for `secs[kind]` seconds and it becomes a beast of war of that people (`unit[kind]`). The beast stands calm for its tamer
 * while the song lasts and the tamer is within `calm` tiles (from the moment the tamer sets out); a beast hurt within `wary` seconds
 * won't take the hand. The call of the wild (`callWild`): a Wild people's Hunting Camps draw a beast each season (`call*`).
 * The computer takes the road on a coin of `aiTake` (raising the Hunting Camp that shows it once `aiClue` of the deed is in), tames within `aiNear` tiles of home (a wolf only with
 * `aiEscort` soldiers sent ahead at its pack), raises `aiDen` Dens and stays `aiStay` seconds before it climbs on.
 */
export const TAME = {
  reach: 1.1,
  calm: 6,
  wary: 8,
  secs: { wolf: 6, boar: 10, mammoth: 24 } as Record<'wolf' | 'boar' | 'mammoth', number>,
  unit: { wolf: 'warwolf', boar: 'tusker', mammoth: 'warmammoth' } as Record<'wolf' | 'boar' | 'mammoth', UnitType>,
  callAt: 20,
  callFrom: 7,
  callNear: 10,
  callCap: 2,
  aiNear: 40,
  aiEscort: 4,
  aiTake: 0.3,
  aiClue: 0.8,
  aiDen: 1,
  aiStay: 150,
  // Bound for the Grove (#742): the Wild is held up to `aiBreed` seconds while the Den rears the deed's beasts.
  aiBreed: 240,
};

/**
 * The Age of the Grove (`docs/wild-road.md` §2, `src/sim/grove.ts`). A Thornwall grows a stage each `stage` seconds (`spring` times as
 * fast in spring) from seedling to living oak; its most hit points are `hp[stage]` of a wall's; a living oak mends `mend` hit points a
 * second once unhurt for `calm` seconds. A Thornwall cut down sprouts again from its root after `regrow` seconds (`retry` while stood on).
 * A Kitchen Garden works at a Farm's pace, plus `dungMul` if a finished Den stands within `dung` tiles (a Den feeds its `dungFeeds`
 * oldest gardens in reach) and `waterMul` if water lies within `water` tiles. An Orchard bears after `orchardGrow` seconds and then, in
 * summer and autumn, pays `orchardFood` food each `orchardEvery` seconds while a food store stands within `orchardReach` tiles.
 * The computer takes the road on once it walked the Wild, stays `aiStay` seconds, keeps up to `aiGardens` gardens about each Den, sets
 * `aiOrchards` Orchards, and plants a Thornwall line of `aiThorn` pieces across the way the nearest rival comes, `aiThornAt` tiles out.
 */
export const GROVE = {
  stage: 40,
  spring: 2,
  hp: [0.25, 0.6, 1, 1.6],
  mend: 3,
  calm: 5,
  regrow: 45,
  retry: 5,
  dung: 6,
  dungFeeds: 6,
  dungMul: 1.2,
  water: 3,
  waterMul: 0.6,
  orchardGrow: 120,
  orchardFood: 3,
  orchardEvery: 10,
  orchardReach: 8,
  aiStay: 180,
  aiGardens: 6,
  aiOrchards: 2,
  aiThorn: 9,
  aiThornAt: 11,
};

/**
 * Fire (`src/sim/fire.ts`, the Wild route's step 3, `docs/wild-road.md`): the answer to a living town, open to every people from
 * the `epoch`. Citizens and foot soldiers carry torches: one stands `light` seconds within `reach` tiles of a tree, a root, or a
 * rival's living building (`burns`) to set it alight. A tree burns `tree` seconds and falls to ash, which grows a tree again after
 * `ash` seconds. A living building loses `bld` of its most hit points a second until it falls (a Thornwall burnt down leaves no
 * root) or is beaten out: each citizen or foot soldier of its own team within `beatReach` tiles beats a second of fire a second, and
 * `beat` of them put it out (one sent to mend it beats rather than mends). Once a second each fire lights each living neighbour
 * on a roll of `spread[season]` (spring, summer, autumn, winter), no more than `run[season]` tiles from where the torch set it,
 * so a dry summer fire runs and a wet spring one smoulders out. Anyone standing within `scorchReach` of a burning tile loses
 * `scorch` hit points a second.
 * The computer sends up to `aiBearers` foot soldiers out on campaign within `aiNear` tiles of a rival's living building to torch
 * it (every `aiEvery` seconds), and a citizen to beat out any fire on its own, from up to `aiBeatFrom` tiles.
 */
export const FIRE = {
  epoch: 1,
  light: 3,
  reach: 1.2,
  tree: 10,
  ash: 300,
  bld: 0.06,
  beat: 4,
  beatReach: 1.6,
  spread: [0.06, 0.2, 0.12, 0.04],
  run: [2, 6, 4, 2],
  scorch: 2,
  scorchReach: 0.4,
  burns: ['thornwall', 'garden', 'orchard', 'sapling', 'hive', 'heart', 'spire', 'greatden'] as BuildingType[],
  wild: 2,
  aiBearers: 2,
  aiNear: 12,
  aiEvery: 4,
  aiBeatFrom: 24,
};

/**
 * The Age of the Hive (`docs/wild-road.md` §3, `src/sim/hive.ts`). A Hive goes where `trees` trees stand within `SNARE.r` tiles,
 * `apart` tiles from any other Hive, and works while they stand. Awake (not winter, not smoked, not burning), its bees sting each
 * rival land unit within `reach` tiles of it that stands in a wood (`wood` trees in the 3-by-3 round it), `sting` hit points a
 * second past armour, and slow it to `slow` of its pace for `stingFor` seconds. Every `every` seconds it pays `honey` food, or
 * `mead` gold while a finished Market of its people stands within `market` tiles. In summer it doubles (`pollen`) the yield of its
 * people's Kitchen Gardens within `bloom` tiles. A fire within `smoke` tiles quiets it for `quiet` seconds.
 * A Blowpipe Hunter's dart adds a dose of venom (up to `doses`), each dose `dose` hit points a second past armour, lasting `venomFor`
 * seconds after the last dart; a unit with venom in it also walks at `slow`. A people that has walked the Hive breeds Cave Bears
 * at its Den and its War Wolves are Dire Wolves: `dire.hp` times the hit points, `dire.attack` more attack.
 * The computer takes the road on from the Grove, stays `aiStay` seconds, and sets up to `aiHives` Hives in the woods within `aiFrom`
 * tiles of home, by its Kitchen Gardens where it can; its Range and Den train darts and bears in turn with the rest.
 */
export const HIVE = {
  trees: HIVE_TREES,
  apart: 4,
  reach: HIVE_REACH,
  wood: 2,
  sting: 3,
  stingFor: 3,
  slow: 0.6,
  every: 10,
  honey: 3,
  mead: 2,
  market: 10,
  pollen: 2,
  bloom: 5,
  smoke: 4,
  quiet: 40,
  doses: 5,
  dose: 1,
  venomFor: 5,
  dire: { hp: 1.35, attack: 2 },
  aiStay: 240,
  aiHives: 3,
  aiFrom: 14,
};

/**
 * The Age of the Wildwood (`docs/wild-road.md` §4, `src/sim/wildwood.ts`). A people raises one Heart Tree. There it wakes an Ent
 * (`warden`) from the standing tree nearest the Heart Tree within `wake` tiles, which gives way to it. An Ent roots on bare ground
 * (`root`): it is a tree there, mending `mend` of its hit points a second, and it wakes when a rival on the ground comes within
 * `rouse` tiles, or its tree is cut into; fell or burn the tree and the Ent is gone. While its people has no Heart Tree standing,
 * every Ent roots where it stands and none wakes.
 * The Spreading: `spreadAt` seconds into each spring, round each Heart Tree, every bare tile within `spread` tiles that lies in its
 * people's land, beside a tree and clear of buildings by a tile, takes a seedling on a roll of `seed`, up to `seeds` of them, and it is
 * a tree `grow` seconds later (a `Stool`). Its people's Thornwalls each grow a stage.
 * Woodland ways: while a people stands in the Wildwood, its units in a wood (`HIVE.wood`) within `ways.reach` tiles of its Heart Tree
 * walk at `ways.own` pace, and a rival's at `ways.rival`. Fire burns its living buildings and scorches its units `FIRE.wild` times as hard.
 * The computer takes the road on from the Hive, stays `aiStay` seconds, plants its Heart Tree by the thickest wood within `aiFrom`
 * tiles of home (at least `aiTrees` trees to wake), and wakes up to `aiEnts` Ents.
 */
export const WILDWOOD = {
  wake: HEART_WAKE,
  rouse: 3,
  mend: 0.02,
  spreadAt: 20,
  spread: 10,
  seed: 0.3,
  seeds: 18,
  grow: 60,
  ways: { reach: 14, own: 1.25, rival: 0.75 },
  aiStay: 300,
  aiFrom: 22,
  aiTrees: 10,
  aiEnts: 4,
};

/**
 * The Age of the Bloom (`docs/wild-road.md` §5b, `src/sim/bloom.ts`). A people raises one Seed Spire, which ripens a Bloom Seed over
 * `ripen` seconds while its Heart Tree stands (one held at a time). Slung (`fuel` paid) at any point, the Seed flies `flight` seconds,
 * then roots on the open tile nearest its point within `land` tiles (none: it withers). Rooted, it grows `grow` seconds; each rival citizen
 * within `reach` tiles of its heart-root hacks one stroke a second, and `root` strokes cut it out. If it isn't cut out, every rival
 * building whose nearest edge lies within `r` tiles cracks, and its ground grows forest `sprout` seconds later (`Stool`s).
 * The Greening: a people standing in the Bloom with its Heart Tree, whose green tiles (trees, Orchards, its Heart Tree, Thornwalls grown to
 * living oak) cover `green` of its land's open tiles (counted as at least `least`) for `hold` seconds, wins. Measured once a second.
 * Pollen: the first `storm` seconds of each season, rival land units and Watch Towers within `pollen` tiles of a Bloom people's Heart
 * Tree see `blind` as far. The Spreading comes at the start of every season, not only spring (`WILDWOOD.spreadAt`).
 * The computer takes the road on from the Wildwood, stays `aiStay` seconds, raises its Spire within `aiFrom` tiles of home, slings at
 * the rival building it has seen whose ring would crack the most * (keeping the fuel back from `aiSave` seconds before the Seed is ripe),
 * and while its land is short of green, every `aiOrchard` seconds plants an Orchard (one to every `aiThorns` Thornwall pieces) or a
 * line of `aiLine` Thornwall, at the compass points round home `aiRing` tiles out and further. Against a rooted
 * Seed in its town (within `aiNear` tiles of a building of its own) it sends up to `aiHack` citizens to hack it.
 */
export const BLOOM = {
  ripen: BLOOM_RIPEN,
  fuel: { food: 300, wood: 300, gold: 200 } as Cost,
  flight: 10,
  land: 6,
  grow: BLOOM_GROW,
  reach: 1.6,
  root: 90,
  r: BLOOM_RING,
  sprout: 8,
  green: BLOOM_GREEN / 100,
  least: BLOOM_LEAST,
  hold: BLOOM_HOLD,
  storm: 30,
  pollen: 14,
  blind: 0.5,
  aiStay: 600,
  aiFrom: 14,
  aiOrchard: 15,
  aiThorns: 16,
  aiLine: 7,
  aiRing: 9,
  aiNear: 6,
  aiHack: 7,
  aiSave: 40,
};

/**
 * The Age of Leviathans (`docs/wild-road.md` §5a, `src/sim/leviathans.ts`). A Great Den breeds Skywhales and one Behemoth a people.
 * A Skywhale carries `capacity` (`WHALE_HOLD`) of its people on foot, boarding and alighting where there is ground within `reach`
 * tiles of it; every `every` seconds it may drop a seed-bomb, paying `bomb`: up to `seeds` Thornwall seedlings on the open tiles
 * nearest beneath it within `reach`, any people's land. The Behemoth is bred carrying a Town Center (`Unit.packed`): it kneels
 * (`pitch`) where a wagon would pitch, but within `kneel` tiles, its Town Center standing at once at the health it carries, and
 * rises (`pack`) again from a Town Center it knelt, its queue empty.
 * The computer takes the road on from the Wildwood when its coin (`aiTake`) says the beasts rather than the Bloom, stays `aiStay`
 * seconds, raises a Great Den within `aiFrom` tiles of home, breeds its Behemoth and up to `aiWhales` Skywhales, kneels the Behemoth
 * by the nearest gold or stone at least `aiOut` tiles from home, loads up to `aiLoad` of its soldiers into each whale once `aiLoad`
 * stand idle at home, sets them down by a rival building it has seen (else the rival's home) and seed-bombs it there.
 * At sea (#789): a Great Den with navigable water within `sea` tiles of its footprint breeds the Kraken, at most `krakens` a people
 * (a queued one counting). Each blow a Kraken lands on a ship grips it `grip` seconds (it can't move); its people's other ships
 * within `shove` tiles of it sail `shoveMul` times as fast. A Dock grows Reef Ships in the warship's place while its people stands
 * in the age: launched at `reefBorn` of their health, they mend `reefMend` a second while no blow has landed for `reefCalm` seconds
 * (a newborn one grows at once). The computer raises its Great Den by the sea if a spot within `aiShore` tiles of home has it, and breeds
 * up to `aiKrakens` once the Behemoth is bred, if the map is mostly sea or it has seen a rival ship.
 */
/** The giants of the Age of Leviathans: bred for their people alone, so no priest turns them. */
export const GIANTS: UnitType[] = ['skywhale', 'behemoth', 'kraken'];

export const LEVIATHANS = {
  every: WHALE_BOMB,
  seeds: WHALE_SEEDS,
  bomb: { wood: 60 } as Cost,
  reach: 2,
  kneel: 6,
  aiTake: 0.5,
  aiStay: 600,
  aiFrom: 12,
  aiWhales: 3,
  aiLoad: 4,
  aiOut: 14,
  sea: KRAKEN_SEA,
  krakens: KRAKEN_MOST,
  grip: KRAKEN_GRIP,
  shove: 4,
  shoveMul: 1.33,
  reefBorn: REEF_BORN / 100,
  reefMend: REEF_MEND,
  reefCalm: LEVIATHANS_CALM,
  aiShore: 16,
  aiKrakens: 1,
};

/**
 * The Age of the Mycelium (#800, `docs/wild-road.md` §R, `src/sim/mycelium.ts`). While a people stands in it, each of its finished
 * `halls` grows a web `grow` tiles a second (`WEB_GROW` seconds to full), out to `reach` tiles from its footprint.
 * - Every hall with a web takes in every stock (`nearestDrop`), and a load carried onto the web is banked at once at the nearest hall
 *   whose web covers it. What is banked through the web counts as `webbed`, the deed of the road on to the Bloom.
 * - Spores: its units standing on its web are hidden (`Unit.cloak`) unless a rival unit or building is within `reveal` tiles or the
 *   unit struck in the last `shown` seconds. Read every `cloakEvery` ticks.
 * - Rot: once a second (not in a peace) a rival building whose footprint lies within a web loses `rot.wood` of its health, or
 *   `rot.stone` if stone went into it, each web counting once.
 * - Fire: once a second any fire within a web cuts that web back to the fire's distance less one tile; a torch may be set to bare
 *   ground on a rival's web (it burns the web back at once).
 * The web withers the moment its people leaves the age.
 * The computer: turns into it from the Wild on a coin of its own (`aiTake`) where glowcaps are to be had, raising a Prospector's Lodge
 * to learn so, holds the Wild up to `aiHold` seconds while it digs or buys them, stays `aiStay` seconds, and takes the road on to the Bloom on a coin of its own (`aiBloom`) once the deed is done and `aiBanked` of the
 * price is in store (saving the rest from there).
 */
export const MYCELIUM = {
  reach: WEB_REACH,
  grow: WEB_REACH / WEB_GROW,
  reveal: SPORE_REVEAL,
  shown: 3,
  cloakEvery: 4,
  rot: { wood: 0.004, stone: 0.002 },
  halls: ['towncenter', 'house', 'storehouse', 'barracks', 'range', 'stable', 'forge', 'workshop', 'temple', 'market', 'huntcamp', 'prospector', 'den', 'windmill', 'tower', 'wonder', 'shaft'] as BuildingType[],
  deed: WEB_DEED,
  aiTake: 0.5,
  aiHold: 360,
  aiStay: 420,
  aiBloom: 0.6,
  aiBanked: 0.25,
};

export const COPPICE = { reach: 8, regrow: 120, retry: 5, grow: 90, snare: 2, cap: 1.5, bag: 2, full: 12, aiPerFood: 1.5, aiMax: 16, aiTrees: 10, aiThick: 14, aiNear: 14, aiDrop: 7, aiPerTender: 2, aiStone: 6, aiCamps: 2, aiPlant: 3, aiThin: 12, aiPlantWood: 120 };

/**
 * Mine Shafts (#681): stone and gold dug from the ground once the open deposits are gone. A shaft is worked by one miner, like a
 * field, and never runs out; what it digs is its seam, chosen on the shaft. How well depends on the ground round it (within
 * `near` tiles of its footprint), its grade, as a share of an open deposit's pace (`GATHER`, with every mining technology):
 * - `old`: old workings, a deposit of that seam worked out there (the shaft follows the vein down);
 * - `hill`: mountain rock beside it (stone and gold only);
 * - `open`: plain ground (stone and gold only).
 * A rare ore (`RARE`) is dug only over its own old workings, and counts toward its ore gate like any mined. Each seam: its
 * name, and whether only old workings hold it. A later seam is one more entry here and in `SeamId`.
 *
 * The computer: once no deposit of a stock it wants lies within `aiNear` tiles of a drop of its own, it sinks a shaft (from
 * the Bronze Age, with `aiWood` wood in hand, at most `aiMax`), on old workings or by rock within `aiReach` tiles of home if it
 * can find them, and sends its hands for that stock to the free shafts, setting the seam it needs.
 */
export const SHAFT = {
  near: 2,
  grade: { old: 0.75, hill: 0.5, open: 0.3 },
  seams: {
    stone: { name: 'Stone', old: false },
    gold: { name: 'Gold', old: false },
    salt: { name: 'Salt', old: true },
    saltpetre: { name: 'Saltpetre', old: true },
    bloodiron: { name: 'Blood-iron', old: true },
    glowcap: { name: 'Glowcaps', old: true },
  } as Record<'stone' | 'gold' | RareId, { name: string; old: boolean }>,
  aiNear: 26,
  aiReach: 18,
  aiWood: 250,
  aiMax: 3,
};

/** The interceptor's numbers (`INTERCEPT`), named here so the battery's words can say them. */
const INTERCEPT_REACH = 12;
const INTERCEPT_FIRE = 2;
const INTERCEPT_PCT = 60;
const INTERCEPT_RELOAD = 90;

export const BUILDINGS: Record<BuildingType, BuildingStats> = {
  towncenter: { name: 'Town Center', size: 4, hp: 2800, cost: { wood: 275, stone: 150 }, time: 110, pop: 10, sight: 8, trains: ['citizen', 'hero'], drop: ['food', 'wood', 'stone', 'gold'], epoch: 0, guns: { damage: 6, range: 7, reload: 2 }, garrison: 15, menu: 'eco', key: 'T', blurb: 'Trains citizens and heroes, takes in every resource and leads your people into the next epoch. Citizens shelter here when the bell rings. Lose your last one and you have 45 seconds to raise another, or your people is lost: build a second far from the first.' },
  house: { name: 'House', size: 2, hp: 600, cost: { wood: 35 }, time: 18, pop: 5, sight: 3, trains: [], drop: [], epoch: 0, menu: 'eco', key: 'E', blurb: 'Room for 5 more people.' },
  storehouse: { name: 'Storehouse', size: 2, hp: 800, cost: { wood: 75 }, time: 22, pop: 0, sight: 4, trains: [], drop: ['food', 'wood', 'stone', 'gold'], epoch: 0, menu: 'eco', key: 'S', blurb: 'A drop-off for every resource, and better tools for gatherers. Build it by woods and mines.' },
  farm: { name: 'Farm', size: 3, hp: 300, cost: { wood: 55 }, time: 12, pop: 0, sight: 2, trains: [], drop: [], epoch: 0, open: true, menu: 'eco', key: 'F', blurb: 'Food that never runs out, worked by one citizen.' },
  market: { name: 'Market', size: 3, hp: 1600, cost: { wood: 175 }, time: 40, pop: 0, sight: 5, trains: ['trader'], drop: [], epoch: 1, menu: 'eco', key: 'M', blurb: 'Buy and sell food, wood and stone for gold (prices move as people trade), and train traders, who bring back gold from the trading posts.' },
  temple: { name: 'Temple', size: 3, hp: 1600, cost: { wood: 120, stone: 100 }, time: 40, pop: 0, sight: 6, trains: ['priest'], drop: [], epoch: 1, menu: 'eco', key: 'Y', blurb: 'Trains priests, who heal and convert.' },
  wonder: { name: 'Wonder', size: 5, hp: 4000, cost: { wood: 1000, stone: 1000, gold: 1000 }, time: 400, pop: 0, sight: 8, trains: [], drop: [], epoch: 1, menu: 'eco', key: 'X', blurb: 'The glory of your people. If it stands long enough once finished, you win.' },
  wall: { name: 'Wall', size: 1, hp: 500, cost: { wood: 3 }, costByEpoch: [{ wood: 3 }, { stone: 4 }, { stone: 4 }, { stone: 5 }, { stone: 5 }], time: 5, pop: 0, sight: 2, trains: [], drop: [], epoch: 0, menu: 'eco', key: 'L', blurb: 'Drag to raise a line of wall: a palisade of logs in the Stone Age, stone after.' },
  gate: { name: 'Gate', size: 2, hp: 1200, cost: { stone: 30 }, costByEpoch: [{ wood: 30 }, { stone: 30 }, { stone: 30 }, { stone: 40 }, { stone: 40 }], time: 20, pop: 0, sight: 3, trains: [], drop: [], epoch: 0, menu: 'eco', key: 'G', blurb: 'Opens for your people and allies only. Put it in a wall.' },
  barracks: { name: 'Barracks', size: 3, hp: 1400, cost: { wood: 150 }, time: 35, pop: 0, sight: 5, trains: ['infantry'], drop: [], epoch: 0, menu: 'mil', key: 'B', blurb: 'Trains foot soldiers, who beat cavalry and siege.' },
  range: { name: 'Archery Range', size: 3, hp: 1400, cost: { wood: 150 }, time: 35, pop: 0, sight: 5, trains: ['ranged', 'blowpipe'], drop: [], epoch: 0, menu: 'mil', key: 'A', blurb: 'Trains slingers, archers and their heirs, who beat infantry.' },
  stable: { name: 'Stable', size: 3, hp: 1400, cost: { wood: 150, gold: 50 }, time: 40, pop: 0, sight: 5, trains: ['cavalry'], drop: [], epoch: 1, menu: 'mil', key: 'C', blurb: 'Trains cavalry, who beat archers, priests and siege.' },
  forge: { name: 'Forge', size: 3, hp: 1600, cost: { wood: 175 }, time: 40, pop: 0, sight: 5, trains: [], drop: [], epoch: 1, menu: 'mil', key: 'R', blurb: 'Better weapons and armor for every soldier.' },
  workshop: { name: 'Siege Workshop', size: 3, hp: 1400, cost: { wood: 200 }, time: 40, pop: 0, sight: 5, trains: ['siege'], drop: [], epoch: 1, menu: 'mil', key: 'K', blurb: 'Builds rams, catapults and cannon to break towns.' },
  tower: { name: 'Watch Tower', size: 2, hp: 250, cost: { wood: 50, stone: 125 }, time: 45, pop: 0, sight: 9, trains: [], drop: [], epoch: 1, guns: { damage: 5, range: 7, reload: 2 }, garrison: 5, menu: 'mil', key: 'W', blurb: 'Sees far and shoots at enemies nearby, aircraft too, but a raw tower is a lookout more than a fort: raise each one to a Guard Tower, a Keep and a Bastion. Shelter soldiers inside for more arrows.' },
  dock: { name: 'Dock', size: 3, hp: 1800, cost: { wood: 150 }, time: 35, pop: 0, sight: 6, trains: ['fisher', 'transport', 'warship', 'cog'], drop: ['food'], epoch: 0, shore: true, menu: 'eco', key: 'D', blurb: 'Builds fishing boats, transports, warships and merchant ships, and takes in fish. Build it on the shore.' },
  huntcamp: { name: 'Hunting Camp', size: 2, hp: 500, cost: { wood: 45 }, time: 14, pop: 0, sight: 5, trains: [], drop: ['food'], epoch: 0, menu: 'eco', key: 'N', blurb: 'A drop-off for food, and a small claim on the land round it. Raise it by the herd or a far kill: meat inside your border is safe from wolves, and Drying Racks keep it.' },
  // Snares in the wood (#485): set among standing trees, they fill with small game by themselves (`SNARE`, `src/sim/snares.ts`).
  snare: { name: 'Snare', size: 1, hp: 60, cost: { wood: 30 }, time: 6, pop: 0, sight: 2, trains: [], drop: [], epoch: 0, open: true, menu: 'eco', key: 'J', blurb: 'A noose on a bent sapling, set among standing trees. It fills with small game by itself, faster the more trees stand round it and fastest in winter, until it is full. A citizen sent to it walks the trap line, emptying each snare in turn. Fell the trees round it and it starves.' },
  // The managed wood (#501): a coppice people plants it on open ground; it roots as a stool and grows into a tree (`COPPICE`, `src/sim/coppice.ts`).
  sapling: { name: 'Sapling', size: 1, hp: 30, cost: { wood: 10 }, time: 5, pop: 0, sight: 1, trains: [], drop: [], epoch: 0, menu: 'eco', key: 'I', blurb: `A young tree set in open ground. Once planted it roots and grows into a full tree in ${COPPICE.grow} seconds: wood to fell, and woods for snares. A row of them grows into a hedge no one walks through.` },
  // The Age of the Wild (`docs/wild-road.md`): raised by a people that has tamed a beast; breeds the kinds it tamed, in any age after.
  den: { name: 'Beast Den', size: 3, hp: 900, cost: { food: 50, wood: 75 }, time: 35, pop: 0, sight: 6, trains: ['warwolf', 'tusker', 'warmammoth'], drop: [], epoch: 1, menu: 'mil', key: 'D', blurb: 'A ring of earth banks and woven hurdles round a hollow of straw, where tamed beasts whelp and are reared. It breeds only the kinds your people has tamed from the wild: tame one wolf and it raises wolves. Raised only by a people that has tamed a beast, and it keeps breeding after the people leaves the Age of the Wild. A people that has walked the Age of the Hive breeds Cave Bears here too.' },
  // The Age of the Grove (`docs/wild-road.md` §2, `GROVE`): raised by a people that has walked it, in any age after.
  thornwall: { name: 'Thornwall', size: 1, hp: 400, cost: { wood: 5 }, time: 3, pop: 0, sight: 2, trains: [], drop: [], epoch: 2, menu: 'eco', key: 'B', blurb: `Drag to plant a line of thorn. It grows a stage every ${GROVE.stage} seconds (twice as fast in spring): seedling, bramble, thicket, then living oak, tougher than stone and mending itself. It parts for your own people and shuts on everyone else, and a piece cut down sprouts again from its root unless the ground is built on. Fire is its bane: a piece that burns down leaves no root.` },
  garden: { name: 'Kitchen Garden', size: 1, hp: 120, cost: { wood: 35 }, time: 8, pop: 0, sight: 2, trains: [], drop: [], epoch: 2, open: true, menu: 'eco', key: 'U', blurb: `Maize, beans and squash grown together on one tile, worked by one gardener. Fed by a Beast Den's dung within ${GROVE.dung} tiles it yields ${Math.round((1 + GROVE.dungMul) * 10) / 10} times a farmer's food; by water within ${GROVE.water} tiles, ${Math.round((1 + GROVE.waterMul) * 10) / 10} times; by both, more. Unfed, it grows at a field's pace. A Den feeds its ${GROVE.dungFeeds} oldest gardens.` },
  orchard: { name: 'Orchard', size: 2, hp: 300, cost: { wood: 100 }, time: 20, pop: 0, sight: 2, trains: [], drop: [], epoch: 2, menu: 'eco', key: 'R', blurb: `Fruit trees set near a food store. After ${GROVE.orchardGrow} seconds they bear, and every summer and autumn they drop food into your stores by themselves while a store stands within ${GROVE.orchardReach} tiles. Slow to start, free for years.` },
  // The Age of the Hive (`docs/wild-road.md` §3, `HIVE`): raised by a people that has walked it, in any age after.
  hive: { name: 'Hive', size: 1, hp: 160, cost: { wood: 60, gold: 30 }, time: 15, pop: 0, sight: 4, trains: [], drop: [], epoch: 3, menu: 'eco', key: 'V', blurb: `A straw skep on a stand, set among standing trees (${HIVE_TREES} within 3 tiles). Its bees swarm any rival who walks the woods within ${HIVE_REACH} tiles, stinging past armour and slowing them. It pays honey into your stores, or mead for gold while a Market of yours stands near, and in summer it doubles the Kitchen Gardens beside it. Bees sleep in winter, smoke quiets them, and fire takes the skep. Fell its woods and the bees leave.` },
  // The Age of the Wildwood (`docs/wild-road.md` §4, `WILDWOOD`): one to a people that has walked it, in any age after.
  heart: { name: 'Heart Tree', size: 3, hp: 2500, cost: { food: 300, wood: 400, gold: 200 }, time: 90, pop: 0, sight: 8, trains: ['warden'], drop: [], epoch: 4, menu: 'mil', key: 'E', blurb: `A vast old tree planted once, the soul of your town: one to a people. At it an old tree within ${HEART_WAKE} tiles is woken as an Ent. While it stands your woods spread round it each spring and your rooted Ents wake when a rival comes near; if it falls, every Ent roots where it stands and sleeps. It is alive, so fire takes it.` },
  // The Age of the Bloom (`docs/wild-road.md` §5b, `BLOOM`): one to a people that has walked it, in any age after.
  spire: { name: 'Seed Spire', size: 2, hp: 1800, cost: { wood: 600, stone: 200, gold: 400 }, time: 80, pop: 0, sight: 8, trains: [], drop: [], epoch: 5, menu: 'mil', key: 'G', blurb: `A living tower of woven trunks, one to a people. While your Heart Tree stands it ripens a Bloom Seed every ${BLOOM_RIPEN} seconds, one at a time. Sling it (G) at any point on the map: it roots there, and ${BLOOM_GROW} seconds later every rival building within ${BLOOM_RING} tiles of its heart-root cracks into forest, unless their citizens hack the root out first. It is alive, so fire takes it.` },
  // The Age of Leviathans (`docs/wild-road.md` §5a, `LEVIATHANS`): raised by a people that has walked it, in any age after.
  greatden: { name: 'Great Den', size: 3, hp: 2400, cost: { food: 300, wood: 500, stone: 200, gold: 200 }, time: 80, pop: 0, sight: 8, trains: ['skywhale', 'behemoth', 'kraken'], drop: [], epoch: 5, menu: 'mil', key: 'J', blurb: `A hill hollowed out and roofed with living turf, where giants are bred: Skywhales that carry ${WHALE_HOLD} over walls and drop seed-bombs of Thornwall, and one Behemoth, a titan turtle with a Town Center on its back. Raised within ${KRAKEN_SEA} tiles of the sea, it breeds the Kraken too. It is alive, so fire takes it.` },
  // The age road (#562, `docs/age-roads.md` spine §4): raised in the Stone Age, it answers which key resources this world holds (`PROSPECTOR`).
  prospector: { name: "Prospector's Lodge", size: 2, hp: 500, cost: { food: 50, wood: 75 }, time: 20, pop: 0, sight: 6, trains: [], drop: [], epoch: 0, menu: 'eco', key: 'P', blurb: 'A lodge of prospectors who walk the streams, scrape the rock and dig at old mounds. Once it stands it tells you which key resources this world holds (bog iron, salt, saltpetre, blood-iron, ancient ruins): yes or no for each, never where. Some ages open only with them; a world that lacks one shuts that door.' },
  // The Path of Blood (#303): pitched by foot soldiers where the army stands, enemy land too; burns when left alone (`WARCAMP`).
  warcamp: { name: 'War Camp', size: 2, hp: 700, cost: { wood: 100, gold: 40 }, time: 30, pop: 0, sight: 6, trains: ['infantry'], drop: [], epoch: 3, ages: ['ironblood', 'totalwar'], burns: true, builders: ['infantry'], menu: 'mil', key: 'Q', blurb: 'Tents, a stockade and a war standard, pitched by foot soldiers where the army stands, in enemy land too. Trains foot soldiers at the front and holds the land round it, so the army there is fed. Left without soldiers nearby, it burns.' },
  // The Silk Road (#334): a waystation by the road, raised in no one's land too; it rests traders, holds the land round it, and makes a near post pay more (`SERAI`).
  drainrig: { name: 'Drain Rig', size: 2, hp: 600, cost: { wood: 120, gold: 60 }, time: 30, pop: 0, sight: 6, trains: [], drop: [], epoch: 3, ages: ['ironblood', 'totalwar', 'hemocraft', 'bloodrite'], menu: 'mil', key: 'H', blurb: 'Copper troughs, a windlass and a rack of pale jars on trampled ground. Every living enemy who falls within 14 tiles of a finished rig gives up a fifth of its price as blood; a beast slain there gives a fifth of its meat. An enemy citizen your soldiers strike down within 14 tiles is taken here alive instead, up to 6 at once, and bled a blood a second until its 45 are spent; raze the rig and they go free. Your own sheep grazing within 6 tiles are bled instead of milked. Citizens within 6 tiles can be given to the levy (C): each is gone, and pays 30 blood. Blood raises Blood Towers and, in Total War and Hemocraft, grafts soldiers at Transfusion Stations. In Hemocraft the rig drains: living enemies standing within 6 tiles bleed into the store.' },
  // Hemocraft (#355 s3): blood spent. The Station grafts the soldiers sheltered inside (`HEMO`); the Blood Tower pays blood once and fires on the living (`BLOOD_TOWER`).
  transfusion: { name: 'Transfusion Station', size: 2, hp: 800, cost: { wood: 100, stone: 60, gold: 80 }, time: 35, pop: 0, sight: 6, trains: [], drop: [], epoch: 4, garrison: 5, ages: ['totalwar', 'hemocraft'], menu: 'mil', key: 'T', blurb: 'A riveted iron shed of glass tanks, pumps and cots. Soldiers sent inside (foot, archers, riders and heroes) are grafted one at a time, 40 blood each: faster, harder-hitting and self-mending, deaf to conversion, and shrugging off blades, arrows and hooves, but machines (siege, ships, aircraft, a coil\'s bolt) hit them harder. A graft stays fed within 10 tiles of a standing Station and runs dry 150 seconds away from one: then the soldier crashes, losing a third of its health.' },
  bloodtower: { name: 'Blood Tower', size: 2, hp: 1000, cost: { wood: 60, stone: 150 }, blood: 60, time: 45, pop: 0, sight: 9, trains: [], drop: [], epoch: 3, guns: { damage: 8, range: 8, reload: 2 }, ages: ['ironblood', 'totalwar', 'hemocraft', 'bloodrite'], menu: 'mil', key: 'L', blurb: 'A squat tower of black brick crowned with a copper cistern, paid for once with 60 blood. Its barbed bolts tear the living (soldiers, riders, citizens, priests) for three times a Watch Tower\'s harm, but glance off what does not bleed: siege, ships, aircraft and wagons take almost nothing. It takes no one inside.' },
  // The Age of Missions (#555 s12): raised by priests on a shore, in no rival's land; claims land, trains priests, pays a tithe (`MISSION`).
  mission: { name: 'Mission', size: 2, hp: 1000, cost: { wood: 100, gold: 60 }, time: 30, pop: 0, sight: 7, trains: ['priest'], drop: [], epoch: 2, shore: true, ages: ['missions'], builders: ['priest'], only: true, menu: 'eco', key: 'O', blurb: 'A whitewashed chapel and a bell on a far shore, raised by priests. Holds the land round it, trains priests, and pays a tithe that grows with its distance from your Town Center. Nothing in it shoots: a rival who reaches it razes it.' },
  caravanserai: { name: 'Caravanserai', size: 2, hp: 900, cost: { wood: 90, gold: 30 }, time: 25, pop: 0, sight: 6, trains: [], drop: [], epoch: 3, ages: ['silk'], menu: 'eco', key: 'C', blurb: 'A walled courtyard by the road where caravans rest. Raise it by a far trading post, in no one\'s land too: your traders\' trips to a post within 8 tiles of it pay a quarter more, traders and wagons within 4 tiles of it mend, and the land round it is yours, so rival traders crossing it pay your toll.' },
  silo: { name: 'Missile Silo', size: 3, hp: 3000, cost: { wood: 300, stone: 400, gold: 700 }, time: 80, pop: 0, sight: 8, trains: [], drop: [], epoch: 5, menu: 'mil', key: 'M', blurb: 'A concrete collar round a hatch in the ground. Launch (M) names any point on the map: after a countdown every rival can see, the warhead blasts what stands there, hardest at the centre and less with every tile, and every player sees the blast and the fog lifts over it for a minute. Destroy the silo while it counts and the launch is scrubbed, its warhead lost. Warheads come from the people\'s store, not the silo: one at first, one more every 240 seconds, up to 3 counting those in the air, fired from any silo. At most 2 silos (3 with Launch Control, researched here, which opens the salvo (B): three silos firing at once), and every player sees a finished one on the map.' },
  // Mine Shafts (#681): one miner digs stone or gold (or a rare ore over its old workings) for good, best where a deposit was worked out (`SHAFT`).
  shaft: { name: 'Mine Shaft', size: 2, hp: 700, cost: { wood: 150 }, time: 30, pop: 0, sight: 4, trains: [], drop: [], epoch: 1, menu: 'eco', key: 'H', blurb: 'A timber headframe over a hole in the ground. One citizen digs stone or gold here for good, slower than an open deposit; best sunk where a deposit was worked out, fair beside mountain rock. Choose its seam on the shaft.' },
  // The Water Road (#701 s1): a bank of earth across the shallows, and the mill that pumps the water out behind it (`DYKE`, `POLDER`, `water.ts`).
  dyke: { name: 'Dyke', size: 1, hp: 700, cost: { wood: 2, stone: 4 }, time: 7, pop: 0, sight: 2, trains: [], drop: [], epoch: 2, ages: ['dykes'], menu: 'eco', key: 'K', blurb: 'A bank of earth with a stone crown, raised on shallow water or on the shore beside it. Drag to lay out a line. Your own people walk along its crown; rivals and ships can\'t pass. Shut a bay or a strait off from the open sea with dykes, then set a Windmill by it to pump it dry. A dyke that falls (to siege, or a Sapper\'s keg) lets the sea back in: it floods the polder ring by ring until a dyke stands in the gap again. A people that has walked the Age of Dykes raises dykes in any age after, to mend its banks.' },
  channel: { name: 'Channel', size: 1, hp: 150, cost: { wood: 4 }, time: 8, pop: 0, sight: 1, trains: [], drop: [], epoch: 1, ages: ['rivers', 'locks'], open: true, menu: 'eco', key: 'Q', blurb: 'A ditch dug out from water across the land. Drag to lay out a line from a spring, stream, lake or shore: as each stretch is dug the water runs into it and it stays. Farms within 2 tiles of water work faster in the Age of Rivers. Soldiers wade a channel at well under half their pace, and no ship sails it. In the Age of Locks it is dug deep, as a canal: every ship sails it and soldiers swim it at a quarter of their pace; an old channel may be dug deep too.' },
  causeway: { name: 'Causeway', size: 1, hp: 400, cost: { wood: 4, stone: 8 }, time: 6, pop: 0, sight: 1, trains: [], drop: [], epoch: 5, ages: ['tides'], menu: 'eco', key: 'W', blurb: 'A raised road of packed stone over the tidal flats or the shallow sea. Drag to lay out a line from the shore. Once laid it is tidal ground that only high water covers: anyone may walk it, at every hour but the top of the tide, and whoever is on it when the water comes back is swept off. A causeway counts as tidal ground for the mills. A line laid across the mouth of a bay of flats is a barrage: behind it the flats are a pond, wet at every hour, that Tide Mills grind twice. A rival\'s keg or warhead breaches it.' },
  tidemill: { name: 'Tide Mill', size: 2, hp: 900, cost: { wood: 200, stone: 150 }, time: 35, pop: 0, sight: 5, trains: [], drop: [], epoch: 5, ages: ['tides'], shore: true, menu: 'eco', key: 'A', blurb: 'A mill on the shore whose pond fills on the flood and runs out through its wheel on the ebb. Every time the tide turns it grinds gold, more for every tile of tidal ground within 5 tiles (up to 24), each tile feeding one mill only. Flats a causeway line has shut off from the sea (a barrage\'s pond) are ground twice, on the flood and on the ebb. Only in the Age of Tides, or the one your people kept on leaving it.' },
  // The Cockler's Hut (#779): a drop for cockles by the beds, where pickers wait for low water (`COCKLER`, `tides.ts`).
  cockler: { name: "Cockler's Hut", size: 2, hp: 350, cost: { wood: 60 }, time: 15, pop: 0, sight: 6, trains: [], drop: [], epoch: 5, ages: ['tides'], menu: 'eco', key: 'C', blurb: `A hut of driftwood and thatch on the shore by the cockle beds, raised within ${COCKLER.reach} tiles of one. Pickers empty their baskets of cockles here instead of walking them home (it takes nothing else), and wait beside it, on dry ground, for the tide to bare their bed again. The beds within ${COCKLER.reach} tiles of it are tended: each high water brings back ${COCKLER.regrow} food to them instead of ${COCKLE.regrow}. Only in the Age of Tides.` },
  // The Tide Gate (#785): a gate in a barrage that holds the pond, or lets it out over the flats below as a scour (`TIDE_GATE`, `tides.ts`).
  tidegate: { name: 'Tide Gate', size: 1, hp: 600, cost: { wood: 80, stone: 120 }, time: 20, pop: 0, sight: 5, trains: [], drop: [], epoch: 5, ages: ['tides'], menu: 'mil', key: 'U', blurb: `A timber gate between stone piers, set into a causeway tile of your own barrage, beside its pond. Shut, the barrage holds as ever: the pond stays wet at every hour and the Tide Mills by it grind it twice. Open it (O) at low water and the pond rushes out through it as a scour: the flats below the gate, up to ${TIDE_GATE.reach} tiles out, go under for ${TIDE_GATE.secs} seconds, and whoever stands there is swept off, hurt (${TIDE_GATE.hurt}), or drowned with no shore near. The bigger the head of water held above the sea, the farther it runs. Then the pond runs with the tide (its mills grind it once) until you shut the gate and the next flood fills it again. Your own people walk across it at every hour; a rival's must go round it, or break it. Everyone can see whether it is loaded. Only in the Age of Tides.` },
  bloomery: { name: 'Bloom Hearth', size: 2, hp: 900, cost: { wood: 100, stone: 40 }, time: 30, pop: 0, sight: 5, trains: ['infantry'], drop: ['gold'], epoch: 1, ages: ['iron'], menu: 'mil', key: 'I', blurb: 'A clay hearth and bellows raised beside the marsh. Bog iron dropped here is smelted hard: every bar counts twice toward your spearmen\'s edge, and the hearth arms foot soldiers on the spot. Raise it by the bog and a rival who wants the iron must come to it. Kept (J) when your people leaves the Iron Age, it goes on arming spearmen at the Iron Age\'s price.' },
  stockade: { name: 'Spoils Stockade', size: 2, hp: 700, cost: { wood: 120, stone: 40 }, time: 25, pop: 0, sight: 6, trains: ['infantry'], drop: [], epoch: 2, ages: ['warband'], menu: 'mil', key: 'X', blurb: 'A palisade of sharpened stakes raised wherever the host fights, even far from home. A laden soldier within 5 tiles banks its pack here at once, but the quartermaster keeps a quarter: 75% reaches your coffers, against the whole of it at a Town Center or Barracks. It arms foot soldiers a tenth cheaper. Only in the Age of the Warband. Kept (J) when your people leaves it, it goes on arming foot soldiers at that price.' },
  hirehall: { name: 'Hire Hall', size: 2, hp: 800, cost: { wood: 120, gold: 60 }, time: 30, pop: 0, sight: 5, trains: ['infantry', 'ranged', 'cavalry'], drop: [], epoch: 2, ages: ['merchant'], menu: 'mil', key: 'V', blurb: 'A counting-house with a muster yard, where a captain signs his company for a term. Swords signed here cost gold alone, 1.6 times the Market\'s hire price, but they are paid once, up front: no wages, no payday behind, none walks off the field. Cavalry too, when the Stable is barred. Pick the Market for a cheap sword you must keep paying, or the Hall for one that is yours. Kept (J) when your people leaves the Age of Merchants, it goes on signing swords at that price on any road.' },
  standard: { name: 'Horsetail Standard', size: 1, hp: 500, cost: { wood: 80, stone: 30 }, time: 20, pop: 0, sight: 7, trains: [], drop: [], epoch: 2, ages: ['horde'], menu: 'mil', key: 'Z', blurb: 'A tall pole hung with horse-tails and the khan\'s banner, planted where the horde means to be paid. Riders who stand within 5 tiles of it take tribute from the nearest rival whose land lies within 8 tiles of it, as though they stood in that land: the horde can wait at the border, out of reach of the Town Center\'s arrows, and still be paid. Only in the Age of the Horde. Kept (J) when your people leaves it, it goes on drawing tribute from a rival\'s border, on any road. Cut it down and the horde must ride into the rival\'s land again.' },
  gallery: { name: 'Mine Gallery', size: 2, hp: 800, cost: { wood: 100, stone: 80 }, time: 30, pop: 0, sight: 5, trains: [], drop: [], epoch: 3, ages: ['sapper'], menu: 'mil', key: 'P', blurb: 'A timbered shaft and spoil heap raised near a rival\'s walls, the sappers\' way into the ground. A keg laid within 6 tiles of it is mined: the fuse burns underground, and no rival can stamp it out. And a gallery listens: a rival keg laid within 6 tiles of one is countermined and lost. Only in the Age of Sappers. Kept (J) when your people leaves it, it goes on listening for rival kegs, on any road.' },
  windmill: { name: 'Windmill', size: 2, hp: 600, cost: { wood: 120, stone: 40 }, time: 30, pop: 0, sight: 5, trains: [], drop: [], epoch: 2, ages: ['dykes'], menu: 'eco', key: 'W', blurb: 'A post mill whose sails turn a scoop wheel. Raised by water a dyke has shut off from the open sea (or a small lake), it pumps it dry a tile every few seconds, nearest first, into polder: low black ground where a Farm yields half again as much. Two mills drain twice as fast. The open sea is too big to pump.' },
  // The Water Line (#701 s4): a gate in a dyke or a channel that lets the water out over the low ground behind it (`INUND`, `water.ts`).
  sluice: { name: 'Sluice', size: 1, hp: 800, cost: { wood: 60, stone: 80 }, time: 20, pop: 0, sight: 4, trains: ['barge'], drop: [], epoch: 3, ages: ['waterline'], menu: 'mil', key: 'S', blurb: 'A timber gate in a dyke, on a channel or on shallow water, raised on its banks by a winch. Shut, it holds the water back as a dyke does, and your own people walk across it. Open it (O) and the water runs out over the low ground round it, a ring a second, up to 7 tiles: soldiers wade the flood at a crawl, siege can hardly cross it, and your gun-barges sail it. Shut it and the water drains away. It launches Gun-barges onto the water beside it.' },
  // The Age of Locks (#701 s5): a swing bridge over a canal, and a dam whose turbines drive the buildings by it (`CANAL`, `DAM`, `water.ts`).
  bridge: { name: 'Bridge', size: 1, hp: 500, cost: { wood: 50, stone: 30 }, time: 12, pop: 0, sight: 2, trains: [], drop: [], epoch: 4, ages: ['locks'], menu: 'eco', key: 'Z', blurb: 'A timber swing bridge on stone piers, laid over a canal or a channel. Your own people cross on it at full pace; rivals can\'t, and must swim the water round it. It swings for ships: every ship and barge passes under it.' },
  pontoon: { name: 'Pontoon', size: 3, hp: 1500, cost: { wood: 150, gold: 40 }, time: 30, pop: 10, sight: 5, trains: ['citizen', 'fisher'], drop: ['food', 'wood', 'stone', 'gold'], epoch: 5, ages: ['floating'], garrison: 10, menu: 'eco', key: 'E', blurb: 'A district on pontoons, moored on open water beside the shore or beside another of your pontoons: room for 10, every kind of goods taken in, fishing boats launched, and a deck your own people walk. Three or more moored side by side link into a floating town, and each of its pontoons raises citizens. Cast it off (O) to tow it, with up to 10 of those on its deck aboard, and moor it again (P) on any open water. Ships hole it three times as fast as anything else.' },
  dam: { name: 'Dam', size: 1, hp: 1200, cost: { wood: 100, stone: 150 }, time: 30, pop: 0, sight: 4, trains: [], drop: [], epoch: 4, ages: ['locks'], menu: 'mil', key: 'N', blurb: 'A stone dam with a turbine house, raised on a channel, a canal, the shallows or the shore. With still water beside it, its turbines drive every building of yours within 8 tiles: they train and research two fifths faster (one dam\'s worth, however many stand near). Your own people walk across its crown; ships can\'t pass it. If it falls with water behind it, it bursts: the water runs over the low ground below it all at once, up to 6 tiles, hurting all who stand there.' },
  // Missile defence (#759 s2): after Interceptors, a battery that fires one interceptor at a warhead whose ring falls in its cover (`INTERCEPT`, `silo.ts`).
  battery: { name: 'Interceptor Battery', size: 2, hp: 1400, cost: { wood: 150, stone: 250, gold: 300 }, time: 50, pop: 0, sight: 8, trains: [], drop: [], epoch: 4, menu: 'mil', key: 'I', blurb: `A concrete pad with a radar dish and one interceptor on its rail, raised after Interceptors. It covers ${INTERCEPT_REACH} tiles round it, a circle every player sees. When a rival warhead's ring as you are shown it lies inside that cover, it fires on its own ${INTERCEPT_FIRE} seconds before the warhead lands and stops it ${INTERCEPT_PCT}% of the time: no blast and no fallout. One attempt for each warhead, however many batteries cover it, and the charge is spent hit or miss: it reloads in ${INTERCEPT_RELOAD} seconds. Every player sees a finished battery.` },
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
  /** Added to foot soldiers' blows (the Iron Age). */
  infantryAttack: number;
  /** Added to cavalry's blows (the Age of Chariots, #555 s12). */
  cavalryAttack: number;
  priest: number;
  /** Multiplies the strength of a priest's chant over a rival's building (Litany), not its healing or converting. */
  chant: number;
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
  /** Gold paid for each unit of bog iron dug (the Iron Age: bars were coin). */
  bogGold: number;
  /** How fast carcasses rot on land the player holds (1 = as in the open). */
  rot: number;
  /** Damage from wolves, boars and mammoths is multiplied by this (Hounds). */
  beastWard: number;
  /** Extra tiles of water a trading post may lie from the sea and still be a port. */
  portReach: number;
  /** Added to a mounted soldier's sight (the Yam Relay). */
  riderSight: number;
  /** Above 0, the people's priests can chant a rival's building over to their side (the Age of Pilgrims, #209). */
  consecrate: number;
  /** Above 0, a Temple within a Watch Tower's reach mends its people's soldiers near it (St. Elmo's Fire, #240). */
  elmo: number;
  /** Above 0, ships and Docks standing in a Watch Tower's reach see `TELEGRAPH.sight` tiles farther (Wireless Telegraphy, #240). */
  telegraph: number;
  /** Above 0, repairs inside a Watch Tower's reach are free and quicker, and ruins you dug there pay (Galvanic Revival, #240). */
  galvanic: number;
  /** Share of a slain enemy unit's price paid to its killer's people as gold (the Path of Blood, #299). */
  plunder: number;
  /** Gold a second each standing rider takes from the rival whose land it holds (the Age of the Horde, #318; `TRIBUTE`). */
  tribute: number;
  /** Share of a loaded rival trader's gold taken once a trip when it crosses the people's land (safe passage on the Silk Road, #334; `TOLL`). */
  toll: number;
  /** Above 0, a graft standing in a Watch Tower's reach is fed as at a Transfusion Station, in any age (Galvanic Blood, #355 s6). */
  veins: number;
  /** Above 0, a soldier near one of the people's priests is sworn: no rival priest can turn, offer up or curse it (Military Orders, #355 s6; `ORDERS`). */
  sworn: number;
}

export const NO_MODS: Mods = {
  meleeAttack: 0, rangedAttack: 0, armor: 0, parmor: 0, range: 0, carry: 0, citizenSpeed: 1, wood: 1, mine: 1, farm: 1, forage: 1, hunt: 1,
  buildingHp: 1, buildSpeed: 1, militaryTrain: 1, rangedTrain: 1, cavalrySpeed: 1, infantryHp: 1, infantryArmor: 0, infantryAttack: 0, cavalryAttack: 0, priest: 1, chant: 1,
  siegeAttack: 1, siegeRange: 0, techCost: 1, wonderCost: 1, extraCitizens: 0, fish: 1, shipHp: 1, shipRange: 0, airSpeed: 1, airHp: 1,
  traderSpeed: 1, tradeGold: 1, relicGold: 1, bogGold: 1, rot: 1, beastWard: 1, portReach: 0, riderSight: 0, consecrate: 0, elmo: 0, telegraph: 0, galvanic: 0, plunder: 0, tribute: 0, toll: 0, veins: 0, sworn: 0,
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
  /** A survey (#39): when done, it answers whether this world holds what the state's flag records. */
  survey?: 'bogIron';
  /**
   * Never researched (#562, #563): only granted. Survey the Land is what a finished Prospector's Lodge knows; no building
   * offers it and a `research` command for it is refused. Kept as a technology so saves and the iron road read it.
   */
  legacy?: true;
  /** Learned and worked only while the people stands in this age (a craft of one road); it lapses when they leave and returns if they come back. */
  only?: AgeId;
  /**
   * An heirloom (#224): opened only to a people that has stood in both these ages, in either order and
   * at any time in the match. Unlike `only`, it is kept for good once learned, on whatever road comes next.
   */
  walked?: [AgeId, AgeId];
  /** A rare ore door (#356): researched only in a world that holds this ore, once the people has mined `n` of it. A world without it keeps the plain technologies. */
  ore?: { id: RareId; n: number };
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
  blackPowder: { name: 'Black Powder', at: 'workshop', epoch: 3, ore: { id: 'saltpetre', n: 40 }, cost: { food: 250, gold: 150 }, time: 45, add: { rangedAttack: 1 }, mul: { siegeAttack: 1.15 }, blurb: 'Only where saltpetre lies: once your citizens have mined 40, the powder-makers grind it fine. Musketeers and all ranged soldiers hit for 1 more and siege 15% harder, on top of Chemistry. Where there is none, the plain road stays open.', icon: '💥' },
  bloodForged: { name: 'Blood-Forged Blades', at: 'forge', epoch: 3, ore: { id: 'bloodiron', n: 30 }, cost: { food: 250, gold: 175 }, time: 45, needs: 'ironCasting', add: { meleeAttack: 1, armor: 1 }, blurb: 'Only where blood-iron lies: once your citizens have mined 30, the smiths quench blades and plates in it. Foot soldiers, riders and heroes hit for 1 more and wear 1 more melee armor, on top of the plain forge. Where there is none, the plain road stays open.', icon: '🩸' },
  interceptors: { name: 'Interceptors', at: 'workshop', epoch: 4, cost: { food: 500, gold: 700, stone: 250 }, time: 60, blurb: `Rockets that climb to meet a falling warhead. Raise Interceptor Batteries (I): each covers ${INTERCEPT_REACH} tiles and stops a warhead whose ring lies in its cover ${INTERCEPT_PCT}% of the time, blast and fallout both.`, icon: '🛡' },
  launchControl: { name: 'Launch Control', at: 'silo', epoch: 5, cost: { food: 600, gold: 900, stone: 400 }, time: 60, blurb: 'A bunker that ties every silo of your people to one clock. You may raise a third Missile Silo, and three standing silos may fire a salvo (B): three Atomic warheads at once, on three points at least 8 tiles apart, on your one clock. A rival sees three rings as for any launch, and cannot tell a salvo from one warhead and two decoys until the last 3 seconds, when all three stay. Each silo that falls scrubs its own warhead. Rivals can count your silos, so three of them is warning enough.', icon: '🎯' },
  saltCuring: { name: 'Salt Curing', at: 'storehouse', epoch: 1, ore: { id: 'salt', n: 30 }, cost: { food: 100, wood: 60 }, time: 30, add: { carry: 2 }, mul: { hunt: 1.25, forage: 1.15 }, blurb: 'Only where salt lies: once your citizens have mined 30, meat keeps and berries dry. Game is butchered 25% faster and berries gathered 15% faster, and every citizen carries 2 more. Where there is none, hunting stays as it was.', icon: '🧂' },
  gillnets: { name: 'Gillnets', at: 'dock', epoch: 1, cost: { food: 100, wood: 100 }, time: 30, mul: { fish: 1.25 }, blurb: 'Fishing boats fish 25% faster.', icon: '🐟' },
  lighthouse: { name: 'Lighthouse', at: 'dock', epoch: 2, cost: { wood: 200, gold: 120 }, time: 35, needs: 'gillnets', add: { portReach: 4 }, blurb: 'A beacon on the headland: trading posts up to 4 tiles farther from the water become ports for your merchant ships.', icon: '🗼' },
  shipwright: { name: 'Shipwright', at: 'dock', epoch: 2, cost: { wood: 250, gold: 150 }, time: 40, add: { shipRange: 1 }, mul: { shipHp: 1.2 }, blurb: 'Ships are 20% sturdier, and warships shoot 1 tile farther.', icon: '⚓' },
  rifling: { name: 'Rifling', at: 'forge', epoch: 4, cost: { food: 300, gold: 250 }, time: 45, needs: 'bodkin', add: { rangedAttack: 2, range: 1 }, blurb: '+2 attack and +1 range for riflemen and towers.', icon: '🎯' },
  steamEngine: { name: 'Steam Engine', at: 'towncenter', epoch: 4, cost: { food: 400, wood: 300 }, time: 50, add: { carry: 4 }, mul: { citizenSpeed: 1.15, wood: 1.1, mine: 1.1 }, blurb: 'Citizens carry 4 more, walk 15% faster, and cut and mine 10% faster.', icon: '🚂' },
  aviation: { name: 'Aviation', at: 'airfield', epoch: 4, cost: { food: 300, gold: 300 }, time: 45, mul: { airSpeed: 1.15, airHp: 1.2 }, blurb: 'Aircraft fly 15% faster and are 20% sturdier.', icon: '✈' },
  caravan: { name: 'Caravans', at: 'market', epoch: 2, cost: { food: 200, gold: 100 }, time: 40, mul: { traderSpeed: 1.2 }, blurb: 'Traders travel 20% faster.', icon: '🐪' },
  banking: { name: 'Banking', at: 'market', epoch: 3, cost: { food: 300, gold: 200 }, time: 45, needs: 'caravan', mul: { tradeGold: 1.2 }, blurb: 'Every trade trip pays 20% more gold.', icon: '🏦' },
  pilgrimage: { name: 'Pilgrimage', at: 'temple', epoch: 2, cost: { food: 200, gold: 150 }, time: 40, mul: { relicGold: 2 }, blurb: 'Every relic kept in a Temple pays double gold.', icon: '🕯' },
  drying: { name: 'Drying Racks', at: 'towncenter', epoch: 0, cost: { food: 60, wood: 60 }, time: 20, mul: { rot: 0.25 }, blurb: 'Meat hung on racks keeps: carcasses on land you hold rot at a quarter the pace.', icon: '🍖' },
  hounds: { name: 'Hounds', at: 'huntcamp', epoch: 0, cost: { food: 80, wood: 40 }, time: 20, mul: { hunt: 1.25, beastWard: 0.5 }, blurb: 'Tamed hounds run beside your hunters: game is butchered 25% faster, and wolves, boars and mammoths do half their damage to your people.', icon: '🐕' },
  bloomery: { name: 'Bloomery', at: 'forge', epoch: 1, only: 'iron', cost: { food: 120, gold: 80 }, time: 35, mul: { infantryHp: 1.2 }, add: { infantryArmor: 1 }, blurb: 'Iron Age only: bloom iron into hard-wearing mail and helms. Foot soldiers have 20% more health and 1 more armor. The craft is lost when the people leaves the Iron Age, and returns if it comes back.', icon: '🔥' },
  ropewalk: { name: 'Ropewalk', at: 'dock', epoch: 2, only: 'sail', cost: { wood: 200, gold: 100 }, time: 35, mul: { shipHp: 1.15 }, add: { shipRange: 1 }, blurb: 'Age of Sail only: long ropes and tarred rigging. Ships are 15% sturdier and warships shoot 1 tile farther. The craft is lost when the people leaves the Age of Sail, and returns if it comes back.', icon: '🪢' },
  credit: { name: 'Letters of Credit', at: 'market', epoch: 2, only: 'merchant', cost: { food: 150, gold: 150 }, time: 35, mul: { techCost: 0.85 }, blurb: 'Age of Merchants only: paper in place of coin lets guilds fund the schools. Technologies cost 15% less. Lost when the people leaves the Age of Merchants, and returns if it comes back.', icon: '📜' },
  litany: { name: 'Litany', at: 'temple', epoch: 2, only: 'pilgrim', cost: { food: 100, gold: 120 }, time: 35, mul: { chant: 1.3 }, blurb: 'Age of Pilgrims only: a chant sung in answer, line and response, carries further. Priests chant over a rival\'s building 30% faster. Lost when the people leaves the pilgrims\' road, and returns if it comes back.', icon: '🎶' },
  // Heirlooms (#224): what two roads walked teach together, kept for good once learned.
  bellFoundry: { name: 'Bell Foundry', at: 'temple', epoch: 2, walked: ['iron', 'pilgrim'], cost: { wood: 150, gold: 150 }, time: 40, mul: { relicGold: 1.5, priest: 1.2 }, blurb: 'Heirloom of the Iron Age and the Age of Pilgrims: smiths who learned the bloom cast bells for the shrines, and the faithful come from farther to hear them. Relics pay 50% more gold and priests convert and heal 20% faster. Kept for good, on any road.', icon: '🔔' },
  ironHulls: { name: 'Iron-Bound Hulls', at: 'dock', epoch: 2, walked: ['iron', 'sail'], cost: { wood: 200, gold: 100 }, time: 40, mul: { shipHp: 1.3, fish: 1.2 }, blurb: 'Heirloom of the Iron Age and the Age of Sail: iron knees, nails and anchors from the marsh smithies. Ships are 30% sturdier and fishing boats fish 20% faster. Kept for good, on any road.', icon: '🔩' },
  jointStock: { name: 'Joint-Stock Company', at: 'market', epoch: 2, walked: ['merchant', 'sail'], cost: { food: 200, gold: 200 }, time: 40, mul: { tradeGold: 1.15, traderSpeed: 1.1 }, blurb: 'Heirloom of the Age of Merchants and the Age of Sail: the guilds\' ledgers meet the shipping fortune, and many purses share one venture. Every trade trip pays 15% more and traders travel 10% faster. Kept for good, on any road.', icon: '📈' },
  telegraphy: { name: 'Wireless Telegraphy', at: 'dock', epoch: 4, walked: ['sail', 'lightning'], cost: { wood: 200, gold: 250 }, time: 50, add: { telegraph: 1 }, blurb: 'Heirloom of the Age of Sail and the Age of Lightning: the masters of the sea learn to speak through the coil\'s current. Ships and Docks within a Watch Tower\'s reach (10 tiles) see 5 tiles farther, so a coil on the headland becomes a lookout over the water: no fleet closes on the harbour unseen. Kept for good, on any road.', icon: '📡' },
  galvanic: { name: 'Galvanic Revival', at: 'workshop', epoch: 4, walked: ['reclaimer', 'lightning'], cost: { wood: 250, gold: 200 }, time: 50, add: { galvanic: 1 }, blurb: 'Heirloom of the Age of Reclaimers and the Age of Lightning: the coil\'s current wakes old machines. Inside a Watch Tower\'s reach (10 tiles) repairs cost nothing and go half as fast again, and every ancient ruin your citizens dug that lies in a field yields 25 gold every 30 seconds. A forward coil beside a ruin becomes a mine; a coil at home, a free field hospital for buildings. Kept for good, on any road.', icon: '🔌' },
  stElmo: { name: 'St. Elmo\'s Fire', at: 'temple', epoch: 4, walked: ['pilgrim', 'lightning'], cost: { gold: 300, stone: 150 }, time: 50, add: { elmo: 1 }, blurb: 'Heirloom of the Age of Pilgrims and the Age of Lightning: the faithful read the blue glow on the coil\'s crown as a blessing. A Temple within a Watch Tower\'s reach (10 tiles) mends the soldiers standing near it, 4% of their health every 2 seconds, so an army can be staged between a coil and a shrine. Kept for good, on any road.', icon: '🌩' },
  // The Path of Blood's heirlooms (#355 s6): each with one road of the path, kept for good like the rest.
  galvanicBlood: { name: 'Galvanic Blood', at: 'workshop', epoch: 4, walked: ['lightning', 'hemocraft'], cost: { wood: 200, gold: 250 }, time: 50, add: { veins: 1 }, blurb: 'Heirloom of the Age of Lightning and the Age of Hemocraft: the coil\'s current runs the pumps, and the grafts drink it. A grafted soldier standing in a Watch Tower\'s reach (10 tiles) is fed as at a Transfusion Station, in any age, so a grafted army lives on wherever the towers stand, after Hemocraft too. Bring the towers down and it runs dry. Kept for good, on any road.', icon: '⚡' },
  militaryOrders: { name: 'Military Orders', at: 'temple', epoch: 2, walked: ['pilgrim', 'warband'], cost: { food: 200, gold: 200 }, time: 40, add: { sworn: 1 }, blurb: 'Heirloom of the Age of Pilgrims and the Age of the Warband: warriors who took a rule of prayer, sworn to the shrine and the sword. A soldier within 6 tiles of one of your priests is sworn: no rival\'s priest can turn it, offer it up or curse it, and your priests mend soldiers half again as fast. Walk the priests with the army. Kept for good, on any road.', icon: '⚜' },
  masonsLodge: { name: 'Masons\' Lodge', at: 'temple', epoch: 2, walked: ['pilgrim', 'reclaimer'], cost: { wood: 200, stone: 150 }, time: 40, mul: { buildSpeed: 1.2, buildingHp: 1.15 }, blurb: 'Heirloom of the Age of Pilgrims and the Age of Reclaimers: the builders who studied the old ruins raise the great churches, and keep their lodge. Buildings go up 20% faster and are 15% sturdier. Kept for good, on any road.', icon: '⛪' },
  // The Prospector's Lodge, level 2 (#565, spine §4): where each key resource lies, marked on the map (`chart` in `ages.ts`).
  chart: { name: 'Chart the Veins', at: 'prospector', epoch: 1, needs: 'survey', cost: { food: 150, gold: 100 }, time: 30, blurb: 'The prospectors map what they found: every patch of bog iron, every vein of salt, saltpetre and blood-iron, every cave mouth and every ancient ruin is marked on your map, under the fog too. A mark, not sight: the map shows the land as it was charted, not who digs there now.', icon: '🗺️' },
  // The Prospector's Lodge, level 3 (#568, spine §4): who digs each vein now, and what each people holds (`diggersAt`, `holdingsOf`).
  assay: { name: 'Assay the Holdings', at: 'prospector', epoch: 2, needs: 'chart', cost: { gold: 200, stone: 100 }, time: 35, blurb: 'Assayers follow the ore to market and back: on your map every charted vein is ringed in the colour of the people digging it now, and the lodge tells how much salt, saltpetre and blood-iron each people holds, and how much bog iron it has dug. Read a rival\'s road before it takes it, know whose diggers to fall on, and whose store to break: ore spilled from a fallen store is marked on your map wherever it lies.', icon: '⚖️' },
  survey: { name: 'Survey the Land', at: 'prospector', epoch: 0, cost: {}, time: 0, survey: 'bogIron', legacy: true, blurb: "What a Prospector's Lodge learns when it is raised: which key resources lie anywhere in this world, bog iron among them. Yes or no; not where, nor how much.", icon: '🧭' },
};

export const TECH_IDS = Object.keys(TECHS) as TechId[];

// ---- Civilizations ---------------------------------------------------------------------------------

export interface Civ {
  name: string;
  /** The verbs rubric (`docs/verbs.md`, #506): what the player now does, in words and never a number, and the door it shuts. */
  verb?: string;
  door?: string;
  blurb: string;
  add?: Partial<Mods>;
  mul?: Partial<Mods>;
  /** The Nile flood (#501 s1, `FLOOD`): each year in the flood season its fields yield nothing and its builders work faster. */
  flood?: boolean;
  /** The polis (#501, `POLIS`): its citizens are its foot soldiers, armed and disarmed in place; it trains none. */
  polis?: boolean;
  /** The legion (#501, `LEGION`): few citizens; its foot soldiers fell timber, quarry stone and raise buildings between wars. */
  legion?: boolean;
  /** The household tax (#501, `HOUSEHOLD`): its citizens mine no gold; every house pays it, more on a built-up street. */
  household?: boolean;
  /** Born on the move (#501, `NOMAD`): the camp is on wagons and the flock walks with it from the first minute; no fields and no quarry. */
  nomad?: boolean;
  /** The managed wood (#501, `COPPICE`): no farms; its felled trees grow back near its stores, it plants saplings, and its snares feed it. */
  coppice?: boolean;
  /** The set line (#501, `LONGBOW`): its bowmen who stand still `LONGBOW.after` seconds draw farther and harder; a step breaks it. */
  longbow?: boolean;
}


/**
 * Born on the move (#501, the Mongols): the camp packs onto wagons and the flock grazes with it from the first minute, in every age
 * (the Steppe Road's town on wheels, `STEPPE` and `FLOCK`, is theirs from the start), beginning with `start` sheep. No Farm is ever
 * tilled and no stone quarried. The flock is the field: each House, standing or on its wagon, keeps `house` more sheep; a nomad
 * flock grazes `range` tiles from camp, each bite gives `milk` times the milk, and the grass it crops grows back in `regrow` of the
 * usual time, though a big flock still crops a camp out. The farming technologies (the `farm` mod) speed its milking instead.
 * Stone comes by the Market and as tribute: riders standing in a rival's land take `stone` stone for each gold of tribute due.
 *
 * The computer: buys stone at the Market below `aiStone` with more than `aiGold` gold (and the next road's stone with its gold, keeping `aiMargin` over), and food below `aiFood` while a lot costs
 * under `aiFoodPrice`; raises its Market from the Bronze Age at `aiMarket` citizens; sends its stone share of hands to the gold.
 * It raises a lamb whenever it holds `aiSpare` food more than one costs while the flock is under `aiFlock` (after that, from what
 * its savings spare), and keeps a milker for every `aiPerMilker` grown sheep. It strikes camp at most every `aiEvery` seconds, once
 * the flock has been hungry for `aiHungry`, looking for fresh grass up to `aiFar` tiles out and `aiSideways` tiles nearer the rival.
 * Off the Steppe Road its tribute band is `aiRiders` riders, gathered at home, and it may stand outside its own supply.
 */
export const NOMAD = { house: 2, stone: 0.6, aiStone: 160, aiGold: 220, aiMargin: 40, aiMarket: 12, aiRiders: 4, aiFood: 500, aiFoodPrice: 260, aiSellWood: 500, aiGoldShort: 600, aiWoodFloor: 60, aiSpare: 30, aiFlock: 14, aiPerMilker: 2, aiEvery: 90, aiHungry: 30, aiFar: 30, aiSideways: 8, regrow: 0.25, milk: 2, range: 8, start: 4 };

/**
 * The polis (#501, the Greeks): a citizen takes up arms where it stands for `arm`, becoming a foot soldier with its health share
 * (what it carried is dropped), and a foot soldier lays them down within `home` tiles of one of its Town Centers. The computer
 * arms at most `aiShare` of its citizens and keeps `aiKeep` at work, answers a raid of `aiThreat` or more, and lays arms down `aiRest`
 * seconds after arming at the soonest.
 */
export const POLIS = { arm: { wood: 20 } as Cost, home: 14, aiShare: 0.2, aiKeep: 8, aiRest: 90, aiThreat: 2, harvest: 2 };

/**
 * The legion (#501, the Romans): a legion people keeps only `citizens` (+ `perEpoch` for each epoch past the first) citizens, so its
 * foot soldiers are its hands: they fell timber and quarry stone at `rate` times a citizen's pace and raise any building, and a
 * working soldier drops its tools for an enemy within `watch` times its sight, going back to the work after. The computer keeps
 * `aiCitizenWood` of the share of wood and stone its citizens would take, since the soldiers carry them, keeps `aiGuard` idle
 * soldiers off the work (and only through epoch `aiUntil`: after it the army is wanted for war and rites), trains foot until it has `aiHands` + `aiHandsEpoch` for each epoch, sends `aiStone` of its working soldiers to stone, and surveys for bog iron from `aiSurvey` hands (its citizens are few).
 */
export const LEGION = { citizens: 12, perEpoch: 3, rate: 0.8, watch: 0.8, aiCitizenWood: 0.25, aiGuard: 4, aiHands: 10, aiHandsEpoch: 4, aiStone: 0.3, aiUntil: 2, aiSurvey: 14 };

/**
 * The set line (#501, the Britons): a ranged soldier (not siege) of a longbow people that has not moved for `after` seconds is set,
 * and shoots `range` tiles farther and `attack` harder until it moves again. The computer needs no new play, for its archers
 * already stop to shoot, but a rival's cavalry and ranged soldiers can answer it: charge before the line sets, or out-reach it.
 */
export const LONGBOW = { after: 3, range: 1.5, attack: 3 };

/**
 * The household tax (#501, the Chinese): a household people's citizens mine no gold or bog iron. Instead every `every` seconds each
 * finished house pays `gold` a second at full occupancy (the people's population over its room), `street` more for each house within
 * `reach` tiles (at most `streetMax`; a finished Market counts as `market` of them), so a built-up ward is worth more than a scatter.
 * A house felled by a rival's hands costs its owner `raid` gold, which the raider takes. The computer lays its houses in streets
 * (within `aiStreet` tiles of its others), and wants no gold miners.
 */
export const HOUSEHOLD = { every: 5, gold: 0.12, street: 0.04, streetMax: 4, reach: 3, market: 2, raid: 25, aiStreet: 4 };

/**
 * The Nile flood (#501 s1): in season `season` (summer) the fields of a flood people lie under the river and yield nothing,
 * and the corvée makes its builders work `build` times as fast. The computer moves up to `move` farmers a think to other work,
 * and once the river falls sends up to `back` berry pickers a think to the fields it left empty (#517).
 */
export const FLOOD = { season: 1, build: 2, move: 3, back: 3 };

export const CIVS: Record<CivId, Civ> = {
  egyptians: {
    name: 'Egyptians',
    blurb: 'A people of the great river, whose year turns on the flood. Each summer the Nile lies over the fields: they yield nothing, but the corvée calls the farmers to build, and every Egyptian builder works twice as fast. Lay food up in spring, and build in the flood. The black silt makes farms work half again as fast the rest of the year, and wonders cost a quarter less.',
    verb: 'Each summer, take your farmers off the flooded fields and build: the corvée raises buildings twice as fast while the river is up',
    door: 'No farm yields anything in the flood, so food must be laid up before it',
    flood: true,
    mul: { farm: 1.5, wonderCost: 0.75 },
  },
  greeks: {
    name: 'Greeks',
    blurb: 'Citizens of the polis, who are its army. A Greek city trains no foot soldiers: any citizen takes up shield and spear where it stands (H), and lays them down at home to go back to work (L). Every campaign empties the fields, and every farmer can hold the line. Hoplites have 15% more health and +1 melee armor.',
    verb: 'Arm your citizens where they stand when war comes, and send them home to lay their arms down and work again',
    door: 'No foot soldiers are trained: the army is the workforce, so a long campaign starves the town',
    polis: true,
    add: { infantryArmor: 1 },
    mul: { infantryHp: 1.15 },
  },
  romans: {
    name: 'Romans',
    blurb: 'The legion builds. A Roman town keeps few citizens (twelve at first, three more each epoch), for its foot soldiers are its hands: they fell timber, quarry stone and raise any building, and an idle army is a working army. A legionary at work drops his tools for a foe who comes near and goes back to them after. Buildings are 20% sturdier and go up 25% faster.',
    verb: 'Put your foot soldiers to the axe, the quarry and the trowel between wars, and raise a town with a legion instead of a crowd',
    door: 'Few citizens: food and gold come slowly, and every soldier at the quarry is not at the front',
    legion: true,
    mul: { buildingHp: 1.2, buildSpeed: 1.25 },
  },
  mongols: {
    name: 'Mongols',
    blurb: `Born on the move. A Mongol camp is on wagons from the first minute: Town Centers and Houses pack up (J) and are pitched again wherever the grass is, and a flock walks with it, milked for food and raising lambs. Every House keeps ${NOMAD.house} more sheep. No Farm is ever tilled and no stone quarried: stone is bought at the Market or taken as tribute, for riders who stand in a rival's land take stone with the gold. Cavalry ride 15% faster and hunters work 40% faster.`,
    verb: 'Drive your camp and its flock to fresh grass from the first minute, and take your stone as tribute from the settled',
    door: 'No fields and no quarry, ever: food walks with the flock, and every stone is bought or taken',
    nomad: true,
    add: { tribute: 0.15 },
    mul: { cavalrySpeed: 1.15, hunt: 1.4 },
  },
  chinese: {
    name: 'Chinese',
    blurb: 'The household tax. Nobody mines gold here: every house pays it, in proportion to the people who live in it, and more for each neighbour on its street (a Market counts as two). A town built close is rich, and a rival who burns your houses takes gold from your treasury. Start with 2 more citizens, and technologies cost 15% less.',
    verb: 'Lay your houses out in streets and wards to fill the treasury: gold is people and housing, not mines',
    door: 'Citizens mine no gold, so a scattered or thin town is poor, and a raid on the houses empties the treasury',
    household: true,
    add: { extraCitizens: 2 },
    mul: { techCost: 0.85 },
  },
  britons: {
    name: 'Britons',
    blurb: `The managed wood and the set line. A British town tills no fields: its food is the wood's. Snares among standing trees fill ${COPPICE.snare} times as fast and hold half again as much, and gain from every farming technology; a tree felled near your stores is coppiced, its stool growing a full tree again in ${COPPICE.regrow / 60} minutes, and citizens plant Saplings (I) to grow a wood where you want one. Fell a stand for timber and the snares beside it starve until it grows back; a rival who fells your wood clears it for good. In war, a Briton bowman who has stood still ${LONGBOW.after} seconds is set: he draws the longbow to the full, reaching ${LONGBOW.range} tiles farther and striking ${LONGBOW.attack} harder, until he takes a step. Archers reach 1 tile farther always, and archery ranges train 25% faster.`,
    verb: 'Work the wood in turns, felling one stand for timber while the snares in the next feed you; and in war pick your ground and plant the line, for bowmen who stand still draw the longbow to the full',
    door: 'No Farm is ever tilled, so a wood felled or lost is a field lost; and a bowman on the move is plain, so a line caught marching or charged before it sets breaks the longbow',
    coppice: true,
    longbow: true,
    add: { range: 1 },
    mul: { rangedTrain: 0.75 },
  },
};

export const CIV_IDS = Object.keys(CIVS) as CivId[];

/**
 * Known gaps in the verbs rubric (#506): entries that still change only numbers, each with the issue that gives it a verb.
 * `tests/verbs.test.ts` lets these go without a `verb`, and fails once one has a verb but is still listed: strike it then.
 */
export const VERB_GAPS: { ages: Partial<Record<AgeId, number>>; civs: Partial<Record<CivId, number>> } = {
  ages: {},
  civs: {},
};

/**
 * A people's great work (seed #133): once in each epoch from `WORK.from`, a player may call it from a
 * Town Center, free, and for `WORK.duration` seconds the people's stats change as `add` and `mul` say
 * (the same levers as technologies and civilizations). Each is a real achievement of that people.
 */
export interface GreatWork {
  name: string;
  icon: string;
  /** What the player reads on the button. */
  blurb: string;
  /** What the computer is calling it for: its economy, or its war. */
  use: 'eco' | 'war';
  add?: Partial<Mods>;
  mul?: Partial<Mods>;
}

export const WORK = {
  /** The first epoch a great work can be called in (the Stone Age has none). */
  from: 1,
  /** Seconds a great work lasts. */
  duration: 90,
};

/**
 * The Age of Lightning (#231). `reach`: tiles from a finished Watch (Coil) Tower's centre within which a
 * building's centre is in its field. `lit` and `dark`: how fast a building in a field, and one outside every
 * field, trains and researches, in hundredths. The arc: one bolt strikes at most `strikes` enemies, leaping
 * at most `leap` tiles from one to the next, and keeps `keep` of its strength at each leap. Its first strike is `bolt` times
 * the tower's arrow, so a coil keeps the bite it had before the tower line weakened raw towers (2026-10-24).
 */
/** St. Elmo's Fire (#240): soldiers within `reach` tiles of a Temple in a Tower's field mend `heal` of their health every `every` seconds. */
export const ELMO = { reach: 6, heal: 0.04, every: 2 };

/** Military Orders (#355 s6): a soldier within `reach` tiles of one of its people's priests is sworn, and their priests mend soldiers `mend` times as fast. */
export const ORDERS = { reach: 6, mend: 1.5 };

/** Wireless Telegraphy (#240): ships and Docks in a Tower's field see `sight` tiles farther. */
export const TELEGRAPH = { sight: 5 };

/** Galvanic Revival (#240): repairs in a Tower's field cost nothing and go `repair` times as fast; a dug ruin in a field pays `gold` every `every` seconds. */
export const GALVANIC = { repair: 1.5, gold: 25, every: 30 };

export const LIGHTNING = { reach: 10, lit: 135, dark: 75, strikes: 4, leap: 2.5, keep: 0.7, bolt: 2 };

/**
 * Signal beacons (own pitch): a built Watch Tower can light a fire on its roof. While it burns the tower sees
 * `sight` tiles farther, and every rival sees the ground around it (`exposed` tiles): the flame is visible to all.
 */
export const BEACON = {
  /** Seconds a lit beacon burns. */
  duration: 45,
  /** Seconds after lighting before the same tower can light again. */
  cooldown: 120,
  cost: { wood: 30 } as Cost,
  /** Extra tiles of sight for the tower while lit. */
  sight: 7,
  /** Tiles around a lit beacon that every rival sees. */
  exposed: 3,
  /** A lit beacon sets alight the owner's other finished, rested Watch Towers within this many tiles, and so on down a chain. */
  relay: 14,
  /** Seconds a relayed beacon burns (it costs no wood; the same cooldown follows). */
  relayDuration: 25,
};

export const WORKS: Record<CivId, GreatWork> = {
  egyptians: { name: 'The Shaduf Sweeps', icon: '🪣', use: 'eco', blurb: 'Every bank is lined with shadufs lifting the river onto the fields: farms work 60% faster. Wasted while the fields lie under the flood.', mul: { farm: 1.6 } },
  greeks: { name: 'The Phalanx', icon: '🛡', use: 'war', blurb: 'Shields locked, spears level: foot soldiers have +2 melee armor and strike +2 harder.', add: { infantryArmor: 2, infantryAttack: 2 } },
  romans: { name: 'The Roman Road', icon: '🛣', use: 'eco', blurb: 'Legions and labourers lay the road: buildings go up 75% faster and citizens walk a quarter faster.', mul: { buildSpeed: 1.75, citizenSpeed: 1.25 } },
  mongols: { name: 'The Yam Relay', icon: '🐎', use: 'war', blurb: 'Fresh mounts waiting at every post: cavalry ride 40% faster and see 3 tiles farther, and citizens walk 15% faster.', add: { riderSight: 3 }, mul: { cavalrySpeed: 1.4, citizenSpeed: 1.15 } },
  chinese: { name: 'The Grand Canal', icon: '🛶', use: 'eco', blurb: 'Barges carry the empire’s grain and silk: every trade trip pays 50% more, and traders travel 30% faster.', mul: { tradeGold: 1.5, traderSpeed: 1.3 } },
  britons: { name: 'The Longbow Volley', icon: '🏹', use: 'war', blurb: 'Every yeoman draws as one: ranged soldiers strike +3 harder, and archery ranges train twice as fast.', add: { rangedAttack: 3 }, mul: { rangedTrain: 0.5 } },
};

/**
 * Ways (#336): a custom your people choose in the Stone Age and keep the whole match. Free, once. Since #463 s1
 * each Way gives the people something new to do (its verb, `KILL_CAMP`, `KIN`, `RAID`) and shuts a door
 * (`shuts`: buildings it never raises; `herdShuts`: in the Stone Age, none while game grazes near home; `noBell`), with a smaller number
 * left beside it. The moment passes when the people climb out of the Stone Age.
 */
export interface Way {
  name: string;
  icon: string;
  blurb: string;
  add?: Partial<Mods>;
  mul?: Partial<Mods>;
  /** Buildings a people of this Way never raises, and those it raises in the Stone Age only once no game grazes near its Town Centers (`KILL_CAMP.home`). */
  shuts?: BuildingType[];
  herdShuts?: BuildingType[];
  /** Its town bell does not ring: its citizens never run to shelter. */
  noBell?: boolean;
  /** Laid over `add`/`mul` once the Way is deepened in the Bronze Age (#338). */
  deep: { add?: Partial<Mods>; mul?: Partial<Mods>; blurb: string };
  /** The verbs rubric (`docs/verbs.md`, #506): what the player now does, in words and never a number, and the door it shuts. */
  verb?: string;
  door?: string;
}

export const WAY_IDS: WayId[] = ['hunt', 'hearth', 'warband'];

/** The Way each people's computer leans to (#463 s1): the hunters of the steppe and the greenwood, the river and rice farmers, the legion and the phalanx. */
export const WAY_LEAN: Record<CivId, WayId> = { mongols: 'hunt', britons: 'hunt', egyptians: 'hearth', chinese: 'hearth', romans: 'warband', greeks: 'warband' };

export const WAYS: Record<WayId, Way> = {
  hunt: { verb: 'Pitch Hunting Camps free beside game or a fresh kill', door: 'No Farms in the Stone Age while game grazes near home', name: 'The Hunters\' Way', icon: '🦌', blurb: 'Camp where the kill falls: a Hunting Camp pitched within 6 tiles of game or a fresh kill costs nothing and goes up three times as fast. Hunting yields 25% more, and wolves, boars and mammoths bite 30% softer. But a people that follows the herds sows nothing where they graze: in the Stone Age no Farm is raised while deer, boars or mammoths live within 24 tiles of your Town Center. Hunt the home herd out to open the fields, or spare it and range for your meat; on the Herd Plains a spared herd treks away each autumn, and its ground lies open to the plough until spring. Berries are gathered 10% slower.', mul: { hunt: 1.25, beastWard: 0.7, forage: 0.9 }, herdShuts: ['farm'], deep: { mul: { hunt: 1.15, beastWard: 0.85, forage: 0.9 }, blurb: 'Hunting yields another 15%, beasts bite another 15% softer; berries are gathered 10% slower.' } },
  hearth: { verb: 'Call the Kin at a Town Center, more in winter, so lay food up for the lean season', door: 'No Hunting Camps', name: 'The Hearth Way', icon: '🔥', blurb: 'The hearth that keeps: Call the Kin at a Town Center, 120 food for 2 citizens in 16 seconds, and 3 in winter, so lay food up for the lean season. Berries yield 20% more, farms 10% and wood 10%, for the fire that burns all winter. But a people of the hearth keeps no camps in the wild: no Hunting Camps, hunting is 20% slower and beasts bite 20% harder.', mul: { forage: 1.2, farm: 1.1, wood: 1.1, hunt: 0.8, beastWard: 1.2 }, shuts: ['huntcamp'], deep: { mul: { forage: 1.15, farm: 1.1, wood: 1.05, hunt: 0.9 }, blurb: 'Berries yield another 15%, farms another 10%, wood 5%; hunting another 10% slower.' } },
  warband: { verb: 'Raid a rival\'s food buildings and citizens and carry their food home', door: 'The town bell never rings', name: 'The Warband Way', icon: '🗡', blurb: 'Feed on the raid: every blow your soldiers land on a rival Town Center, Storehouse, Hunting Camp, Dock or Farm carries off food from the rival\'s store, and a rival citizen slain gives up its load. Soldiers train 15% faster and strike 1 harder in melee. But a warband does not hide: the town bell does not ring, and berries and hunting are 15% slower.', add: { meleeAttack: 1 }, mul: { militaryTrain: 0.85, forage: 0.85, hunt: 0.85 }, noBell: true, deep: { add: { meleeAttack: 1 }, mul: { militaryTrain: 0.9, forage: 0.9, hunt: 0.9 }, blurb: 'Soldiers train another 10% faster and strike 1 harder again; berries and hunting another 10% slower.' } },
};

/**
 * The Hunters' kill camp (#463 s1): a Hunting Camp whose middle lies within `near` tiles of a living deer, boar
 * or mammoth, or a carcass with meat on it, costs nothing and takes `time` of the usual time to raise. In the Stone Age the
 * Hunters raise no Farm while such game lives within `home` tiles of one of their Town Centers.
 */
export const KILL_CAMP = { near: 6, time: 1 / 3, home: 24 };
/**
 * The Hearth's kin (#463 s1): at a finished Town Center, `cost` buys `n` citizens (`winter` in winter, season 3),
 * who come out together after `time` seconds in the queue. They need room under the cap like any citizen.
 */
export const KIN = { cost: { food: 120 } as Cost, time: 16, n: 2, winter: 3 };
/**
 * The Warband's raid (#463 s1): each point of damage a soldier deals to a rival's food building (`at`) carries off
 * `take` food from that rival's store (never more than it holds); a slain rival citizen gives up what it carried,
 * plus `slain` food. The rival hears of it at most every `tell` seconds.
 */
/**
 * Thralls (the Age of the Warband, #502): a rival citizen slain by a people in that age is taken captive. A thrall of the
 * slayer rises where it fell with `hp` of a citizen's health (a share), and goes to work nearby within `reach` tiles. A
 * people holds at most `max` at a time, and none while its pop is full. A thrall gathers and farms but never builds or repairs.
 * The rival answers by guarding its workers, walling its fields, or cutting the thralls down (a thrall slain by a warband changes hands).
 */
export const THRALL = { max: 8, hp: 0.6, reach: 14 };

export const RAID = { at: ['towncenter', 'storehouse', 'huntcamp', 'dock', 'farm'] as BuildingType[], take: 0.35, slain: 10, tell: 15 };

/**
 * Ways are taken in the Stone Age (epoch `until`) and no later; the computer takes its own after `aiAfter` seconds,
 * weighing berries within `near`, herds within `far` and a rival within `foe` tiles, with `lean` toward its people's
 * own Way (`WAY_LEAN`, `wayFor` in `ways.ts`).
 */
export const WAY = { until: 0, aiAfter: 25, near: 16, far: 30, foe: 80, raid: 2, lean: 4, vow: 1, deepenCost: { food: 200, wood: 100 } as Cost, turnCost: { food: 100 } as Cost };

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
export const CARRY = [10, 12, 14, 16, 18, 18];
/** What a fishing boat holds, by epoch. */
export const FISH_CARRY = [15, 18, 21, 24, 30, 30];
/** Gathering per second, before the epoch bonus. */
export const GATHER: Record<'tree' | 'berry' | 'stone' | 'gold' | 'farm' | 'meat' | 'fish' | 'bog', number> = { tree: 0.65, berry: 0.8, stone: 0.55, gold: 0.55, farm: 0.6, meat: 1.0, fish: 0.75, bog: 0.45 };
export const EPOCH_GATHER_BONUS = 0.1;
/**
 * Meat spoils (own pitch, Stone Age depth). A carcass keeps `grace` seconds, then loses `rate` of what it
 * held each second, so a mammoth hunt is a race to the butchering, not just to the kill. On land a
 * player holds, their `rot` modifier slows it (Drying Racks).
 */
export const ROT = { grace: 40, rate: 1 / 160 };
/**
 * Seasons (own pitch, Stone Age depth): the year turns every `len` seconds, from a season the seed picks.
 * `plant` scales berry gathering and `field` farming; `rot` scales how fast meat spoils (cold keeps it);
 * `bold` scales how far wolves and boars notice your people. Summer is for foraging, winter for the hunt.
 */
export const SEASON = { len: 150 };
export const SEASONS = [
  { name: 'Spring', icon: '🌱', plant: 1, field: 1, rot: 1, bold: 1, grass: 1.2, blurb: 'The thaw: berries and herds return.' },
  { name: 'Summer', icon: '☀️', plant: 1.25, field: 1.1, rot: 1.5, bold: 0.85, grass: 1, blurb: 'Berries are heavy, but meat spoils fast.' },
  { name: 'Autumn', icon: '🍂', plant: 1.1, field: 1.15, rot: 1, bold: 1, grass: 0.8, blurb: 'The harvest, and the beasts grow lean.' },
  { name: 'Winter', icon: '❄️', plant: 0.55, field: 0.75, rot: 0.5, bold: 1.4, grass: 0.4, blurb: 'Berries fail, meat keeps, grass grows back slowly, and hungry wolves range further.' },
] as const;
/**
 * The clever computer plans for winter (autumn onward, season `from`): it counts no berries (they fail in
 * the cold), wants `fields` more fields and `food` more of its people on food, hunts mammoths and boars with `hunters` fewer citizens (meat
 * keeps in the cold) and, in the winter itself, clears wolves with `pack` fewer soldiers.
 */

// ---- Citizens at work -----------------------------------------------------------------------------

/**
 * A bulk order from the player spreads (#266): gatherers fan over nodes of that resource within `reach` tiles
 * of the one clicked, `perNode` to a node; attackers fall on foes within `foe` tiles of the one clicked,
 * `perFoe` to a foe (the clicked one first), the rest on the clicked one. Meat is one carcass, so it isn't spread.
 */
export const SPREAD = { reach: 5, perNode: 2, foe: 4, perFoe: 3, far: 18 };
/**
 * Moving citizens between jobs from the Workers panel: the farthest a citizen is sent to a node, in tiles, the most moved at once,
 * the builders sent to one unfinished building before the next gets any (`crew`), and the seconds of work a "Get more" suggestion aims to cover (`window`).
 */
export const LABOR = { reach: 30, most: 200, crew: 5, window: 30 };
/**
 * Patrol and explore (#454). Soldiers on either look for foes every `scan` ticks: an aggressive one as far
 * as it sees, a defensive one within `provoke` of its sight, one standing its ground only within reach.
 * A patrol gives up after `misses` legs in a row end short of their point; it holds at most `points`.
 * An explorer picks unseen ground on a grid every `grid` tiles, keeps `apart` tiles from where its fellows
 * are headed, and passes over ground within `shun` tiles of a tile it couldn't reach; `fails` such tiles in a row
 * (with nothing new seen between) and it stops. It keeps `wary` tiles beyond the reach of every enemy tower it
 * has seen (and turns away if it strays in), and reports a rival army of `army` soldiers in sight, at most once
 * every `tell` seconds (s3).
 */
export const PATROL = { scan: 6, provoke: 0.5, misses: 4, points: 8, flee: 6 };
export const EXPLORE = { grid: 4, apart: 12, fails: 8, shun: 6, wary: 2, army: 4, tell: 30 };
/**
 * Idle hands find work (#344), for the player's people only (the computer sets its own to work):
 * - `trained`: a citizen trained with no rally point takes the nearest node within this many tiles;
 * - `rally`: a rally flag on a resource that has since run out sends new hands to the nearest of its kind
 *   within this many tiles of the flag (then `SPREAD.far`);
 * - `herd`: a hunter done with a carcass spears the next deer within this many tiles of it;
 * - `farm`: a food gatherer whose bushes and game are gone takes an unworked field within this many tiles.
 * - `retry`: a laden citizen jammed on the way home tries the road again this often, instead of standing idle.
 */
export const AUTO_WORK = { trained: 14, rally: 8, herd: 8, farm: 12, shaft: 16, lay: 5, retry: secs(4) };
/**
 * The clever computer plans for winter from season `from` (`coldComing` in `ai.ts`); in the Stone Age it raises no winter fields while its larder holds `larder` food (#486).
 * Its hunters of the turning year (#546) keep `shy` tiles from a rival's soldiers.
 */
export const AI_WINTER = { from: 2, fields: 2, hunters: 3, pack: 1, food: 0.3, larder: 500, shy: 8 };

/**
 * Faith takes the walls (#209), for the computer: a pilgrim computer keeps `priests` priests once its army
 * numbers six, and sends those that have kept up with its army (within `reach` + `keep` tiles of its
 * centre, idle, walking or healing) in a band of at least `band` to chant over the rival building nearest that centre, within
 * `reach` tiles, that it can see. Towers and gates weigh as if `wall` times as near, a Temple that keeps
 * relics `relic` times. Counter-chant (#216): a free priest within `ward` tiles of a building of its own that a rival is
 * chanting over walks to stand by it; against a pilgrim rival, a spare priest stands by the tower, gate or Temple nearest
 * that rival's town.
 */
export const AI_FAITH = { priests: 6, band: 3, reach: 14, keep: 6, wall: 0.4, relic: 0.6, ward: 30 };
export const AMOUNT = { tree: 80, berry: 125, stone: 300, gold: 400, meat: 140, fish: 250, bog: 300 };

// ---- Homelands ------------------------------------------------------------------------------------

/**
 * Homelands (#473, Goal 1 s2): what lies round every town at the start. The seed rolls one (by `weight` for
 * the map type) and every town gets the same, so the start stays fair while the best opening changes by map.
 * Each counts tiles or beasts at home: `berries` in the first patch, `thicket` in a second, `deer` in the
 * home herd and `herd2` in a second; `grove` how many trees crowd in close, `mammoth` how far out each town's mammoth stands, `fish` how many shoals lie off home,
 * and `mere` the radius of a fishing mere cut `HOMELAND.mereAt` tiles out from every town (0 for none).
 */
export interface Homeland {
  name: string;
  icon: string;
  /** A few words for the opening banner. */
  short: string;
  blurb: string;
  berries: number;
  thicket: number;
  deer: number;
  herd2: number;
  grove: number;
  mammoth: number;
  fish: number;
  mere: number;
  weight: Record<MapType, number>;
  /** The verbs rubric (`docs/verbs.md`, #506): what the player now does, in words and never a number, and the door it shuts. */
  verb?: string;
  door?: string;
  /** The turning year (#479): what each season's turn does to this homeland, for the season's banner ('' for nothing new). */
  year: [string, string, string, string];
}
export const HOMELAND_IDS: HomelandId[] = ['glade', 'shore', 'herds', 'wood'];
export const HOMELANDS: Record<HomelandId, Homeland> = {
  glade: {
    verb: 'Forage and hunt near home: the easy start, where any opening works',
    door: 'Nothing: it is the plain start',
    name: 'The Glade', icon: '🌿', short: 'berries and deer near home',
    blurb: 'Berries by the Town Center and a deer herd beyond: the old, easy start, where any opening works.',
    berries: 7, thicket: 0, deer: 4, herd2: 0, grove: 0, mammoth: 17, fish: 4, mere: 0,
    weight: { continental: 3, highlands: 3, lakes: 2, forest: 2, plains: 2, sea: 2 },
    year: ['', '', '', ''],
  },
  shore: {
    verb: 'Raise a Dock early and fish the mere by boat',
    door: 'Few berries, so a rival who burns the Dock starves you',
    name: 'The Shore', icon: '🌊', short: 'few berries; fish the mere from a Dock',
    blurb: 'A rich shoal just off home and only a thin berry bush. Food comes by boat: raise a Dock and launch canoes early, so the opening is hungry for wood, and a rival who burns the Dock starves you. The shoals run thick in autumn, and in winter the mere ices over. Each spring every shoal left in the water spawns, growing by what was spared, and a full one seeds another: a shoal fished out never grows back, and a mere stripped bare stays bare.',
    berries: 3, thicket: 0, deer: 3, herd2: 0, grove: 0, mammoth: 17, fish: 8, mere: 6,
    weight: { continental: 2, highlands: 1, lakes: 3, forest: 1, plains: 1, sea: 3 },
    year: ['The ice breaks and the shoals spawn: each grows by what you spared, and the full ones seed new shoals.', '', 'The autumn run: the shoals are thick, so fish hard and lay food up.', 'The mere ices over: boats fish at a third of their pace until spring.'],
  },
  herds: {
    verb: 'Hunt in bursts and camp by the kills, then follow the herds\' autumn trek or wait it out',
    door: 'Little to forage',
    name: 'The Herd Plains', icon: '🦣', short: 'herds and a mammoth close, few berries',
    blurb: 'Two deer herds and a mammoth close by, and little to forage. A meat economy: meat spoils, so hunt in bursts and camp by the kills. Each autumn the herds trek out toward the middle and come home in spring, each deer that lived with a calf: hunt a herd out and it never comes back.',
    berries: 3, thicket: 0, deer: 5, herd2: 5, grove: 0, mammoth: 12, fish: 4, mere: 0,
    weight: { continental: 2, highlands: 1, lakes: 1, forest: 0, plains: 4, sea: 2 },
    year: ['The herds come home, each deer that lived with a calf.', '', 'The herds trek out toward the open middle: follow them, or eat from the store and the fields.', ''],
  },
  wood: {
    verb: 'Chop room to build and lay snares among the trees you keep; walk far for meat until winter',
    door: 'No herd near home',
    name: 'The Deep Wood', icon: '🌲', short: 'woods and berries close, no herd near',
    blurb: 'Woods crowd in on the Town Center and a wide berry thicket grows at their edge, but no herd grazes near home. Forage and chop: wood is a short walk, room to build is not, so clear ground or build out, and meat means going far, until winter, when the berries fail and deer come in to yard in the woods by home.',
    berries: 7, thicket: 6, deer: 0, herd2: 0, grove: 40, mammoth: 17, fish: 4, mere: 0,
    weight: { continental: 2, highlands: 3, lakes: 2, forest: 4, plains: 0, sea: 1 },
    year: ['The yarded deer go back out to their summer grass.', '', '', 'Deer come in from the cold to yard in the woods by your town: the berries fail, but the hunt is close.'],
  },
};
export const HOMELAND = { mereAt: 16 };
/** The computer on the Shore (#473): it raises its Dock once it has `dockAt` citizens and keeps `boats` more fishing boats. */
export const AI_SHORE = { dockAt: 4, boats: 2 };
/**
 * The turning year (#479, Goal 1 s3): each homeland's staple has a lean season and a fat one, so the opening
 * that suits it stops working for part of every year. The Glade keeps the old year.
 * - The Herd Plains: deer that start within `home` tiles of a town are that town's herds. They don't drift:
 *   each autumn they trek out to grazing `out` tiles from the town, toward the map's middle (or as much as
 *   `trek` nearer, or turned aside, where the way is blocked), and each spring they walk home, each deer still alive bringing `calves` calves, up to `herdMax` a herd. A herd
 *   hunted out never comes back. A clever computer leaves `spare` of each home herd alive, and in autumn and
 *   winter follows its herds out to `follow` tiles from home.
 * - The Shore: boats fish at `run` of their pace in autumn and `ice` in winter, when the mere freezes over.
 *   Each spring every shoal still in the water spawns (#482): it gains `breed` times what is left in it, up to a
 *   full shoal (`AMOUNT.fish`), and one that is at least `seedAt` full seeds a new shoal of `spawn` a full one on
 *   open water two tiles off, where fewer than `crowd` shoals lie within `crowdIn` tiles. A shoal fished to nothing is gone.
 *   A clever computer moves its boats off a shoal once it is down to `fishSpare`, unless it has under `fishHungry` food.
 * - The Deep Wood: each winter `yard` deer come in (from `from` tiles out at most, `enter` at least) to a
 *   yard `yardMin`–`yardMax` tiles from every town, by at least `trees` trees within two tiles; in spring they
 *   go back out to where they came in, and return to the same yard the next winter. A clever computer sends
 *   `yardHunters` more hunters in winter.
 * Deer on the move walk for up to `walk` seconds.
 */

// ---- The wild: snares, herds, caves and beasts ----------------------------------------------------

/**
 * Snares in the wood (#485), the Deep Wood's own verb. A Snare goes only where at least `need` trees stand
 * within `r` tiles, and `apart` tiles from any other snare. Each second it fills by `rate` food times the trees
 * round it over `full` (at most 1), times `winter` in winter, up to `cap`; a full snare catches nothing more.
 * A tender empties `take` food a second into its basket, then walks on to the next of its people's snares
 * within `round` tiles holding at least `worth`, and carries the catch home when its basket is full or the
 * line is empty. The computer lays up to `ai` snares in the Deep Wood once it has `aiAt` citizens and `aiFrom` seconds
 * have passed (its first year it hunts the winter yard with every hand), at least
 * `aiFar` tiles from its lumber where at least `aiTrees` trees stand, with `aiTenders` tenders.
 */
export const SNARE = { r: 3, need: 6, full: 16, apart: 5, rate: 0.15, winter: 1.5, cap: 24, take: 3, round: 14, worth: 4, ai: 4, aiAt: 9, aiFrom: 600, aiFar: 5, aiTrees: 14, aiTenders: 1 };
export const YEAR = { home: 16, out: 26, trek: 6, calves: 1, herdMax: 6, spare: 2, follow: 34, run: 1.3, ice: 0.3, yard: 5, from: 20, enter: 8, yardMin: 7, yardMax: 12, trees: 3, yardHunters: 4, walk: 45, breed: 1, seedAt: 1, spawn: 0.5, crowd: 8, crowdIn: 4, fishSpare: 60, fishHungry: 150 };
/**
 * Caves (#356): on a world that holds any rare ore, `count` caves for the map's size are cut into open ground at least
 * `away` tiles from every town and `apart` from each other. Each is a single tile of one of the world's ores, `rich` times
 * a vein tile's amount, and with the roll `den` (none on small maps, where a pack in the middle would sit on every road) a wolf pack (`WOLF.pack`) lairs beside it: the richest ore is the best
 * guarded. Mined like any vein, and the wolves are the ordinary kind (they hold the ground round their den).
 */
export const CAVE = { count: { small: 1, medium: 2, large: 3 } as Record<MapSize, number>, rich: 3, den: { small: 0, medium: 0.5, large: 0.5 } as Record<MapSize, number>, away: 18, apart: 24 };
/**
 * The Prospector's Lodge (#562, `docs/age-roads.md` spine §4), level 1: raised, it answers yes or no for every key
 * resource (`KeyId`), ruins included. What each is called and what it means for a people, on the lodge and in the toast.
 * Its price is the building's (`BUILDINGS.prospector`). Levels 2 (where) and 3 (who) come later.
 */
export const PROSPECTOR: { keys: Record<KeyId, { name: string; icon: string }> } = {
  keys: {
    bogIron: { name: 'Bog iron', icon: '🟤' },
    salt: { name: 'Salt', icon: '🧂' },
    saltpetre: { name: 'Saltpetre', icon: '⚗️' },
    bloodiron: { name: 'Blood-iron', icon: '🩸' },
    glowcap: { name: 'Glowcap hollow', icon: '🍄' },
    ruin: { name: 'Ancient ruins', icon: '🏛️' },
  },
};
/**
 * Finds (#588, `docs/age-roads.md` rule 5): one mark of the land stands near each town, `ring[size]` tiles out (the
 * same for every town, within `fair`; looser only when the map allows nothing better), at least `spacing` tiles from
 * anything else laid on the map. Each speaks of one key resource this world holds, dealt from a shuffled hand of
 * what the world holds, so a hint never points at a shut road (a world that holds none has hunters' stashes, which say so). The first people to put a land unit within `reach`
 * tiles of one takes its `reward` and learns of the resource (`Player.leads`): the lodge's yes for that one resource,
 * and a mark on the minimap at the nearest of it. The computer sends its first idle soldier or citizen when its
 * town has `citizens`, after `after` seconds.
 */
export const FINDS = {
  ring: { small: 18, medium: 21, large: 24 } as Record<MapSize, number>,
  fair: 0.75,
  spacing: 7,
  reach: 1.6,
  after: 90,
  citizens: 8,
  until: 1,
  idBase: 1_100_000_000,
  kinds: {
    wreck: { key: 'bogIron', name: 'A nailed wreck', icon: '⚓', reward: { wood: 80 }, hint: "The ribs of an old boat, held together with rust-red nails. Bog iron lies in this land." },
    cairn: { key: 'bloodiron', name: 'A battlefield cairn', icon: '🗿', reward: { stone: 60 }, hint: 'Spear-heads piled under stones, dark as dried blood. Blood-iron lies in this land.' },
    lick: { key: 'salt', name: 'A salt lick', icon: '🧂', reward: { food: 100 }, hint: 'Every game trail runs to this white crust. Salt lies in this land.' },
    meteor: { key: 'saltpetre', name: 'A fallen star', icon: '☄️', reward: { stone: 60 }, hint: 'A black stone in a scorched hollow, pale crystals on the grass round it. Saltpetre lies in this land.' },
    stash: { key: null, name: "A hunters' stash", icon: '🧺', reward: { food: 100 }, hint: 'A cache the first hunters left: dried meat and bone needles, and nothing else. No hidden roads lie in this land: the plain ones are the ones to take.' },
    shrine: { key: 'ruin', name: "A hermit's shrine", icon: '🛖', reward: { gold: 40 }, hint: 'A hermit tends stones older than any town and tells you where they stand. Ancient ruins lie in this land.' },
  } as Record<FindKind, { key: KeyId | null; name: string; icon: string; reward: Cost; hint: string }>,
};
/**
 * Deep veins (#356): rare ores that only some seeds hold. Each is rolled by its own dice (`chance`), then laid as
 * `veins` neutral veins of `tiles` tiles, `amount` an ore tile, out between the towns (at least `away` tiles from
 * any town, `apart` from each other), where every town can walk to them. `rate` is how fast a citizen mines one.
 * The ore is paid into `Player.rare`; a later step makes the ages and roads that want it.
 */
export const RARE: Record<RareId, { name: string; chance: number; veins: number; tiles: number; amount: number; rate: number; away: number; apart: number; blurb: string }> = {
  salt: { name: 'Salt', chance: 0.7, veins: 2, tiles: 3, amount: 200, rate: 0.5, away: 14, apart: 10, blurb: 'White crust on bare ground. Cures meat, tans hides and keeps a long march fed.' },
  saltpetre: { name: 'Saltpetre', chance: 0.5, veins: 2, tiles: 2, amount: 160, rate: 0.45, away: 16, apart: 12, blurb: 'Pale, bitter crystal scraped from damp rock. The black of powder is made from it.' },
  bloodiron: { name: 'Blood-iron', chance: 0.35, veins: 1, tiles: 3, amount: 140, rate: 0.35, away: 18, apart: 12, blurb: 'Dark ore veined like flesh that is never quite dry. Whatever works it learns that it is warm.' },
  // The Glowcap hollow (#800): one damp hollow of pale fungus, the Age of the Mycelium's only door. Picked like an ore.
  glowcap: { name: 'Glowcaps', chance: 0.4, veins: 1, tiles: 4, amount: 120, rate: 0.45, away: 16, apart: 12, blurb: 'Pale caps crowding a damp hollow, glowing faintly blue after dark. Their threads run under the soil for a mile, and whatever is planted over them is fed.' },
};
/** Deer: health, speeds, and how far a hunter throws a spear. */
export const DEER = { hp: 8, walk: 0.8, flee: 2.3, spear: 3.5, spearDamage: 4,
  /**
   * Herds drift: a herd keeps its ground `every` seconds, then moves `min`–`max` tiles to a new one, never
   * onto land inside a border (the wild shies from towns, so the easy hunting near home thins as the
   * borders grow) and never further than `range` tiles from where it began. Deer within `herd` tiles of
   * each other at the start move as one.
   * Herds breed (#491): each spring a herd of at least `pair` living deer drops a calf for every `pair` of them, up to
   * `cap` a herd, so game is never hunted out for good while a pair is spared (a lone deer breeds nothing).
   */
  pair: 2, cap: 6, herd: 4, every: 150, min: 7, max: 12, range: 26 };
/**
 * The wild (#171). A mammoth grazes `home` tiles out from every town (and `extra` more in the open): it
 * doesn't bolt when speared but turns on whoever threw, charging and goring for `rage` seconds after its
 * last wound, and falls as one carcass of `meat`. Wolves keep `dens` out between the towns, each by a
 * patch of wild gold: a pack of `pack` roams `roam` tiles about its den and falls on anyone within
 * `notice` tiles, chasing no further than `leash` from home. Bitten or gored people fight back.
 * Speeds in tiles a second, blows every `reload` seconds, `reach` from the beast's edge.
 */
export const MAMMOTH = { hp: 90, walk: 0.5, charge: 1.7, gore: 8, reach: 0.5, reload: 1.8, rage: 7, roam: 2.5, meat: 600, radius: 0.55, home: 17, extra: { small: 1, medium: 2, large: 3 } as Record<MapSize, number> };
/**
 * Wild boars: one stands guard by a berry patch 7–15 tiles from each town, so the second patch is a choice,
 * not free food. A boar charges anyone who comes within `notice`, gives up past `leash` of its patch, and
 * leaves a carcass worth `meat` (more than a deer's). A lone citizen loses; three win.
 */
export const BOAR = { hp: 36, walk: 0.7, run: 2.3, bite: 5, reach: 0.35, reload: 1.2, notice: 3.2, leash: 7, roam: 1.5, meat: 260, radius: 0.28, near: 3, min: 7, max: 15, count: 1, extra: { small: 0, medium: 1, large: 2 } as Record<MapSize, number> };
export const WOLF = { hunt: 7, hp: 20, walk: 0.9, run: 2.1, bite: 3, reach: 0.35, reload: 1.2, notice: 4.5, leash: 10, roam: 2.5, radius: 0.22, pack: 3, home: 22, fair: 6, spacing: 14,
  /**
   * Carrion (own pitch): a pack within `scent` tiles of a carcass that has begun to turn (`ROT.grace`) on land nobody holds comes to eat it, each
   * wolf `gnaw` food a second, and fights anyone at the meat as if it were its den (its leash and notice
   * centre on the carcass). Meat inside a border is safe, so a far kill is a race: butcher it fast, guard
   * it, or clear the den first.
   */
  scent: 15, gnaw: 3, dens: { small: 2, medium: 3, large: 4 } as Record<MapSize, number> };

/**
 * Raider camps (own pitch): `camps` of them stand out between the towns, each a band of `guards` raiders
 * (a Stone Age war party that fell on no one yet). They keep watch like a wolf pack: one that notices
 * anyone within `notice` tiles calls the whole band, which chases no further than `leash` from its fire.
 * They leave no carcass; when the last falls, whoever struck it takes the camp's `loot`. A lone citizen
 * loses, two or three soldiers win, and the band is worth a fight only if the loot buys more than the wounds.
 */
export const RAIDER = { hp: 30, walk: 0.8, run: 2.2, bite: 4, reach: 0.4, reload: 1.1, notice: 3.8, leash: 6.5, roam: 1.3, radius: 0.24, guards: 3, home: 22, fair: 10, spacing: 18,
  idBase: 1_000_000_000, loot: { gold: 120, food: 80, wood: 60 }, camps: { small: 1, medium: 2, large: 3 } as Record<MapSize, number> };

// ---- Tidings, the market and starting resources ---------------------------------------------------

/**
 * Tidings at the fire (#443): twice in the Stone Age a card comes to each people with a choice that costs
 * something. `at` is when each draw comes (seconds, plus up to `jitter` more, by the seed), `fade` how long
 * it waits for an answer before passing with the do-nothing answer. Each card's numbers are its own.
 */
export const TIDINGS = { at: [140, 290], jitter: 50, fade: 30,
  /** A lone traveller: take them in for food, a citizen for the town (needs room in a house). */
  traveller: { cost: { food: 50 } as Cost, aiFloor: 0 },
  /** A hunter's trade: wood for meat. */
  hunter: { cost: { wood: 40 } as Cost, food: 70, aiFloor: 60 },
  /** A stranger's tale: feed them and they tell where a raider camp (else a ruin, else a cave) lies; `reveal` tiles of it laid open. */
  tale: { cost: { food: 25 } as Cost, reveal: 7, aiFloor: 260 },
  /** A storm: shore up the huts for wood, or chance it: on `odds` of seeds it strikes, every house losing `harm` of its health. */
  storm: { cost: { wood: 40 } as Cost, odds: 0.5, harm: 0.4, aiFloor: 0 },
  /** A fever: tend the sick for food, or let it run: on `odds` of seeds one citizen dies of it. */
  fever: { cost: { food: 40 } as Cost, odds: 0.5, aiFloor: 0 } };

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
  { food: 1500, wood: 1000, stone: 800, gold: 1300 },
];
export const START_CITIZENS = 5;
/** Deathmatch: everyone starts rich. */
export const DEATHMATCH_RES = { food: 20000, wood: 20000, stone: 5000, gold: 20000 };

// ---- Match settings -------------------------------------------------------------------------------

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

// ---- Computer opponent levels ---------------------------------------------------------------------

export interface AiLevel {
  label: string;
  /** Gathering multiplier (a small edge on Expert, a handicap on Easy and Normal). */
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
  /**
   * Seconds, once its first wave has gone out, that an army short of the next wave holds back the next
   * age (#113). A beaten town that can't raise the wave stops waiting for it and climbs.
   */
  armyWait: number;
  /**
   * The town bell (#113): it rings when `ring` enemy soldiers are near and the army can't meet half of
   * them, and the citizens come back out once `quiet` or fewer are left, the bell `hold` seconds rung.
   */
  bell: { ring: number; quiet: number; hold: number };
  /** Whether a clever computer raises a forward Tower as a foothold (#132 s5); `scripts/ai-ab.ts` sets it back to compare. */
  fort: boolean;
  /** Off, a clever computer leaves its own Wonder unguarded (#374); `scripts/ai-ab.ts` sets it so to compare. */
  /** Off, the computer keeps a single Town Center (#452); `scripts/ai-ab.ts` sets it so to compare. */
  spareHeart?: boolean;
  wonderGuard?: boolean;
  /** Off, fighters stay at the home Airfield instead of guarding a forward one (#379); `scripts/ai-ab.ts` sets it so to compare. */
  fieldGuard?: boolean;
  /** A pilgrim town detours to the Age of Sail for an heirloom (#232); off only in `scripts/ai-ab.ts`. */
  detour: boolean;
  /** Whether a landmark's worth follows what the town needs (`AI_MARK.worth`); off, every one counts the same. `scripts/ai-ab.ts` sets it back to compare. */
  worthy: boolean;
  /** Off, a clever computer neither draws nor spends blood, nor sends machines at a rival's Hemocraft (#355 s5); off only in `scripts/ai-ab.ts`. */
  hemo?: boolean;
  /** Off: the computer never takes the fork past Total War (#355 s5; only `scripts/ai-ab.ts` turns it off). */
  fork?: boolean;
  /** Off: no leaning toward a route (#749; only to judge it with `scripts/ai-ab.ts`). */
  lean?: boolean;
  /** Off: no wave sent at a rival's weak window after a step back (#749; only to judge it). */
  strike?: boolean;
  /** Off: the town trains hands on while a climb is paid for (#555; only `scripts/ai-ab.ts` turns it off). */
  climbHold?: boolean;
  /** Off: the Stone Age climb neither waits on a Prospector's Lodge that is due nor saves its price (#540; only `scripts/ai-ab.ts` turns it off). */
  lodgeHold?: boolean;
  /** Off: the Workshop counts only the engines out, not those in the queues, against the number wanted (#540; only `scripts/ai-ab.ts` turns it off). */
  siegeQueued?: boolean;
  /** Off: the engine a Masons' Lodge rival calls for is not saved from the town's buildings (#242, #501; only `scripts/ai-ab.ts` turns it off). */
  lodgeEngine?: boolean;
  /** Off: a Hunters' Way town on the glade or elsewhere spares the wild pair near home, which bars its fields (#555; only `scripts/ai-ab.ts` turns it off). */
  fieldsClear?: boolean;
  /** Off: a Blood-rite computer's priests neither curse nor sacrifice (#355 s4; only `scripts/ai-ab.ts` turns it off). */
  rite?: boolean;
  /** Off: a priest that has taken up healing by itself is left at it, as before (only `scripts/ai-ab.ts` turns it off). */
  healers?: boolean;
  /** Off: a cursed computer army fights on and its riders ignore the priest (#434; only `scripts/ai-ab.ts` turns it off). */
  curseAnswer?: boolean;
  /** Off: the computer does not ride down the priests who swear a rival's army (Military Orders, #459; only `scripts/ai-ab.ts` turns it off). */
  breakOath?: boolean;
  /** Off: a clever computer sends no scout and posts no guards (#454 s4; only `scripts/ai-ab.ts` turns it off). */
  scouts?: boolean;
}

/**
 * Four honest difficulties (#256, #258). A newcomer picks the one called Normal, so Normal is the fair
 * learning game and Easy is gentler still: a first-timer should reach the Bronze Age alive. The ids keep
 * the behaviour they always had, so saves, replays, rooms and tests stay as they were; only the names
 * moved: `easy` is shown as Normal, `normal` as Hard, `hard` as Expert (the campaign proof's level).
 */
/** The all-clear for a siege that stopped (#487): the bell sounds once no foe has come closer for `stale` seconds and the nearest stands at least `far` tiles off. */
export const AI_BELL = { stale: 60, far: 8 };

export const AI_LEVELS: Record<Difficulty, AiLevel> = {
  gentle: { label: 'Easy', gather: 0.65, citizens: 12, firstAttack: 1080, wave: 4, waveGrowth: 2, think: 2, towers: 0, clever: false, traders: 1, armyWait: 90, bell: { ring: 5, quiet: 2, hold: 20 }, fort: true, worthy: true, detour: true },
  easy: { label: 'Normal', gather: 0.8, citizens: 16, firstAttack: 720, wave: 6, waveGrowth: 3, think: 1.5, towers: 0, clever: false, traders: 2, armyWait: 90, bell: { ring: 5, quiet: 2, hold: 20 }, fort: true, worthy: true, detour: true },
  normal: { label: 'Hard', gather: 1, citizens: 24, firstAttack: 480, wave: 8, waveGrowth: 4, think: 1, towers: 1, clever: true, traders: 5, armyWait: 90, bell: { ring: 5, quiet: 2, hold: 20 }, fort: true, worthy: true, detour: true },
  hard: { label: 'Expert', gather: 1.15, citizens: 32, firstAttack: 330, wave: 9, waveGrowth: 5, think: 0.5, towers: 2, clever: true, traders: 8, armyWait: 90, bell: { ring: 5, quiet: 2, hold: 20 }, fort: true, worthy: true, detour: true },
};

/**
 * How the computer walks the web of ages (#50). It takes a side road that plays to its people's
 * strength (its signature line comes cheaper there) whenever it qualifies, never one that bars that
 * line, and any other with chance `take`, decided once; a road that would open an heirloom with an age
 * it has already walked, with chance `heir` instead (#232). It surveys for bog iron once its town has
 * `survey` citizens, and keeps `diggers` citizens on bog iron toward the Iron Age (twice as many while it
 * holds for the deed; none once the deed is dug, #79); it holds its Town Center for a chosen road's deeds once a `nearly` share of each is
 * done or under way, for at most `patience` seconds (twice that once a `close` share of each is done, #113); it turns pilgrim with at least `relics` relics
 * kept. Against a merchant rival, a band of `riders` riders waits by the trading post nearest its town
 * and falls on the traders it sees within `raid` tiles (anyone's traders within `raidNear` tiles of home
 * are fair game anyway); against an iron rival, it trains the archers that answer its foot with chance
 * `read`. It reads a rival's heirlooms (#242): a Joint-Stock Company makes the rival a trade rival on any road, a Masons' Lodge asks `lodge` more siege engines, Iron-Bound Hulls `hulls` more warships, and a Bell Foundry rival's relic Temples are pulled `bell` ahead as a target (as a pilgrim people's are).
 */
/**
 * A clever computer guards its own Wonder (#374) while it rises or counts down: `share` of its army (at least `least`, at most `most`) stays within
 * `stay` tiles of it and out of the attack waves; any rival soldier within `reach` tiles of it draws the whole army.
 */
export const AI_WONDER = { share: 0.4, least: 3, most: 14, stay: 6, reach: 26 };

/**
 * The computer and feast days (#379 s1): a clever computer raises its Market on the fairground, searching up to `ring`
 * tiles round its relic Temple, and in the Age of Fairs keeps up to `markets` Markets so one stands there.
 */
/** `raid`: how much nearer (squared tiles) a rival's fairground Market seems to a raid on a feast day. */
export const AI_FAIR = { ring: 10, markets: 2, raid: 900, save: 40, army: 6, hoard: 4 };
/**
 * The computer and sorties (#379): when the enemy building it means to bomb lies more than `gap` tiles from its nearest
 * finished Airfield (so its aircraft would turn for home before they arrive, `SORTIE.turn`), it raises another Airfield
 * `step` tiles nearer, searching `search` tiles round that point, up to `fields` in all.
 */
export const AI_SORTIE = { gap: 26, step: 18, search: 6, fields: 3 };
/**
 * The computer and vigils (#379 s2): in the Age of Pilgrims a clever computer keeps `VIGIL.most` priests at its relic Temple,
 * training them on top of those it sends with the army, and walks a keeper back once it strays past `VIGIL.reach` less `slack` tiles.
 */
export const AI_VIGIL = { slack: 1.5 };
/**
 * The computer and convoys (#379 s3): in the Age of Sail a clever computer keeps its first `escorts` warships within `stay` tiles
 * of the port where most of its merchant ships load, so each cog loading there sails escorted (`CONVOY`).
 */
export const AI_CONVOY = { escorts: 1, stay: 3 };

// ---- Blood and hemocraft --------------------------------------------------------------------------

/**
 * Blood (#355 s1): a living enemy who falls within `reach` tiles of the killer's finished Drain Rig gives up `share` of its price as blood.
 * The levy takes up to `levyMost` citizens within `levyReach` tiles of a rig at once, `levy` blood each, and rests the rig `rest` seconds for each.
 *
 * Beasts, flocks and captives (s1's leftovers): a beast slain within `reach` of the slayer's rig gives `beast` of its meat as blood (a
 * wolf, which leaves no meat, `wolf`). Each second a rig bleeds its people's grown sheep grazing within `flockReach` tiles instead of
 * their being milked: up to `flockMilk` of each one's milk, `flockYield` blood for each. An enemy citizen struck down by a soldier
 * within `reach` of the soldier's rig (or, in the Blood-rite, altar) is taken there alive while it holds fewer than `hold`: each
 * captive holds `captive` blood and is bled `bleed` a second until spent, and goes free to its own people if the rig falls.
 */
export const BLOOD = { reach: 14, share: 0.2, levy: 30, levyReach: 6, levyMost: 3, rest: 15, beast: 0.2, wolf: 8, flockReach: 6, flockMilk: 2, flockYield: 0.6, hold: 6, captive: 45, bleed: 1 };

/**
 * Hemo-engineered soldiers (#355 s3). A Transfusion Station grafts one soldier sheltered inside every `work` seconds for `cost` blood,
 * and opens its doors once none inside is left ungrafted. A graft: blows `attack` times harder, `pace` times faster, `mend` health a
 * second; blows from the living (blades, arrows, hooves, a Watch Tower's arrows) land `flesh` times as hard, blows from machines (siege,
 * ships, aircraft, a coil's bolt) `machine` times; no priest can turn it. It is fed while within `reach` tiles of one of its people's
 * standing Stations; `last` seconds away from all of them it runs dry, and the soldier loses `crash` of its full health.
 */
export const HEMO = { cost: 40, work: 4, last: 150, reach: 10, attack: 1.2, pace: 1.15, mend: 1.5, flesh: 0.6, machine: 1.5, crash: 0.33 };

/**
 * Quenched grafts (#355 s3 + #356): where the seed holds blood-iron, a Transfusion Station that finds `cost` of it in its people's rare
 * stock when a graft finishes spends it and quenches the soldier. A quenched graft stays fed `last` times as long away from a Station,
 * mends `mend` times as fast, and costs only `crash` of the usual crash. Without the ore the plain graft is unchanged.
 */
export const HEMO_IRON = { cost: 3, last: 2, mend: 1.5, crash: 0.5 };

/** The Blood Tower (#355 s3): its bolts hit the living `living` times as hard as a Watch Tower's arrows, the bloodless `bloodless` times. */
export const BLOOD_TOWER = { living: 3, bloodless: 0.15 };
/**
 * Guns on buildings: a Town Center's (and a Blood Tower's) arrows hit `epoch` harder for each epoch its people has reached.
 * A Watch Tower gains only `towerEpoch` an epoch by itself; the rest it earns through the tower line (Guard Tower, Keep, Bastion).
 */
export const GUNS = { epoch: 0.2, towerEpoch: 0.1 };

/**
 * The tower line (owner, 2026-10-24: "towers are too strong", and "the towers should be per tower upgrade"): each Watch Tower
 * is raised on its own, one step at a time, at that tower. Step `i` raises a tower from level `i` to `i + 1`, from `epoch` on:
 * its arrows hit `attack` harder, it shoots `range` tiles farther, and its hit points are multiplied by `hp`. While it is being
 * raised the tower still shoots. A tower taken over (priests, reclaim) keeps its level.
 */
export const TOWER_LEVELS: { name: string; epoch: number; cost: Cost; time: number; attack: number; range: number; hp: number; icon: string; blurb: string }[] = [
  { name: 'Guard Tower', epoch: 1, cost: { wood: 100, stone: 50 }, time: 30, attack: 2, range: 0, hp: 1.5, icon: '🗼', blurb: 'A timber gallery braced out from the walls: +2 arrow attack and 50% more hit points, for this tower.' },
  { name: 'Keep', epoch: 2, cost: { wood: 100, stone: 125 }, time: 40, attack: 2, range: 1, hp: 1.5, icon: '🏰', blurb: 'A stone skirt and buttresses: +2 arrow attack, +1 range and 50% more hit points, for this tower.' },
  { name: 'Bastion', epoch: 3, cost: { wood: 100, gold: 75, stone: 175 }, time: 50, attack: 2, range: 0, hp: 1.4, icon: '🛡', blurb: 'A low, wide, angled gun platform that shrugs off shot: +2 arrow attack and 40% more hit points, for this tower.' },
];
/** A clever computer raises a tower a step only with this much of each resource left over beyond the step's price. */
export const AI_TOWER_KEEP = 50;
/** Nor while the peace has more than this many seconds to run: no one can strike, and the wood is wanted for the town (#720). */
export const AI_TOWER_PEACE = 90;

/**
 * The Age of Hemocraft (#355 s2): each second a finished Drain Rig bleeds up to `most` living enemies within `drain` tiles (nearest first,
 * ties in id order) of `bleed` health each, and `yield` blood comes into its people's store for every point bled. Grafts cost `graft` of
 * `HEMO.cost`, and a Station feeds grafts within `reach` tiles of it (in place of `HEMO.reach`).
 */
export const HEMOCRAFT = { drain: 6, bleed: 2, most: 8, yield: 0.5, graft: 0.75, reach: 16 };

/**
 * The Age of the Blood-rite (#355 s2): a finished Temple draws blood from the enemy who fall within `BLOOD.reach` tiles of it, as a Drain
 * Rig does. Each second it mends up to `most` of its people's hurt living (nearest first) within `reach` tiles, `mend` health each, paying
 * `price` blood a point from the store; with the store dry it mends no one.
 *
 * Its priests (#355 s4) have two more rites over an enemy that bleeds (never a machine, ship or aircraft). To sacrifice, a priest chants
 * as for a conversion, and the victim dies at the end, paying `offering` of its price as blood (a Hero `hero` times that; a King is never
 * offered). To curse, a priest chants `chant` seconds and spends `curse` blood: the target and up to `most` living enemies within
 * `spread` tiles of it take `taken` times the damage from every blow for `last` seconds. A priest rests `rest` seconds after a curse.
 */
export const RITE = {
  reach: 8, mend: 2, most: 10, price: 0.25,
  offering: 0.6, hero: 2,
  curse: 20, chant: 3, spread: 3, last: 20, taken: 1.35, rest: 30, curses: 12,
};

/**
 * The computer and Hemocraft (#355 s5). A clever computer at war (Iron and Blood, Total War) with `town` citizens raises a Drain Rig `rig` tiles from home
 * toward where `foes` or more rival living soldiers last came within `watch` tiles of it (else toward the rival), and builds again no
 * sooner than `again` seconds after. It raises up to `towers` Blood Towers `tower` tiles out toward them, `gap` seconds apart and `spread`
 * tiles from each other, while at least `living` of the rival's army bleeds. In Total War, with `army` soldiers, it raises a Transfusion
 * Station by its muster point, and between waves sends the idle soldiers within `near` tiles of it inside, as many as its blood pays for. It gives citizens to
 * the levy only when that blood is short for `batch` or more soldiers waiting, or for a Blood Tower it wants, and only out of a town within
 * `spare` of the citizens it wants (never under `AI_BLOOD.held`), every `levyGap` seconds at most. Its siege and warships go for a rival
 * Station or Blood Tower seen within `hunt` tiles (its warships for one by the shore), and a rival with one (or `grafted` grafted soldiers
 * seen) gets `siege` engines more. Its bombers count a rival Station `bomb` squared tiles nearer than it is (a Blood Tower half that).
 */
export const AI_HEMO = { town: 24, army: 6, rig: 6, watch: 26, foes: 2, again: 60, towers: 2, tower: 10, gap: 45, spread: 6, living: 0.6, near: 16, batch: 2, spare: 1, levyGap: 12, hunt: 22, grafted: 3, siege: 2, bomb: 2500, forward: 12 };

/**
 * The computer at the fork (#355 s5). A clever computer in Total War picks its branch once its town has grown (`AI_HEMO.town`): the Blood-rite when
 * under `living` of the rival's army bleeds (a drain finds nothing in steel), else Hemocraft with chance `hemo`. It works that road's
 * deed there (grafts at its Station, or citizens to the levy from a full town), stays at least `stay` seconds, and once a deed is done
 * (its branch's, else the other's) and the price of peace and of the branch are both in hand, makes peace into the Industrial Age and
 * turns down that branch; with no deed done `patience` seconds after its town grew (or the road still shut `back` seconds into
 * Industry) it gives the fork up. In Hemocraft it keeps up to `rigs` Drain Rigs, the later ones
 * `AI_HEMO.tower` tiles out where the living come so its `towers` Blood Towers ring them. In the rite it keeps up to `altars` Temples,
 * the later ones `altar` tiles out toward where the rival's soldiers come, musters its army by that altar, trains `priests` priests, and
 * gives citizens to the levy while its store is under `store` blood, to mend with. Its rivals' siege also goes for a Hemocraft rig and
 * a rite altar near a wave.
 */
export const AI_FORK = { living: 0.6, hemo: 0.5, stay: 300, patience: 1200, back: 240, rigs: 2, towers: 3, altars: 2, altar: 9, priests: 4, store: 60 };

/**
 * A clever computer's priests in the Blood-rite (#355 s4) work its rites. An idle priest within 9 tiles of the enemy curses the target
 * with the most of their soldiers (no citizens, priests or traders) within `RITE.spread` tiles of it, when `pack` or more stand there
 * uncursed and the store would still hold `keep` blood after paying; failing that, while the store is under `AI_FORK.store`, it
 * sacrifices the dearest victim whose offering is at least `dear` blood. Everything else is converted as before. A soldier held within
 * `pinned` tiles of one of ours counts double; and a pack none of ours holds yet, with our foot soldiers marching on it within `closing`
 * tiles, is left uncursed a beat, until they land or `patience` seconds pass.
 */
export const AI_RITE = { pack: 3, keep: 40, dear: 30, pinned: 2, closing: 7, patience: 6 };

/**
 * A clever computer answers a curse on its own army (#434). For the last `late` seconds of a curse, a cursed soldier that isn't winning
 * (hurt below `hurt` of its health, or with more rival soldiers than friends within `near` tiles) steps back to the muster point and
 * stays out of the waves until the curse lifts. While any soldier of its own lies cursed, up to `riders` of its riders within `reach`
 * tiles of a rival priest of the Blood-rite ride at that priest.
 */
export const AI_CURSE = { late: 14, hurt: 0.7, near: 5, riders: 3, reach: 14 };

/**
 * A clever computer reads a rival's Military Orders (#459): when a rival soldier within `reach` tiles of one of its riders is sworn,
 * up to `riders` of those riders (its archers, if it has no riders) go for the nearest rival priest swearing it: the priest's fall
 * breaks the oath and the faster mending together.
 */
/**
 * The computer's spare heart (#452): a people that loses its last Town Center has `HEART.grace` seconds, so once it has
 * reached `epoch` (by level) it raises a second one `away` tiles from home on the side away from the nearest rival,
 * keeping `reserve` of wood and stone back for the rebuild. Switch `AiLevel.spareHeart` (off only in `scripts/ai-ab.ts`).
 */
export const AI_HEART = { epoch: { gentle: 2, easy: 1, normal: 1, hard: 1 } as Record<Difficulty, number>, away: 24, reach: 8, builders: 3, reserve: 100, retry: 40 };
export const AI_ORDERS = { reach: 14, riders: 2 };

// ---- Rare ore and mercenaries ---------------------------------------------------------------------

/** Selling rare ore at a Market (#356 s5): a lot of `lot` pays `gold[ore]` gold at a flat price. Ore mined still counts toward its doors; only the stock in hand is spent. */
export const ORE_TRADE = { lot: 20, gold: { salt: 40, saltpetre: 55, bloodiron: 90, glowcap: 70 } as Record<RareId, number> };
/**
 * Posts that sell what the map lacks (#573, the age road s13): on a world without one of the `ores` a road's ore door asks
 * for, a trading post sells it (one lacking ore to a post, in post order; none in campaign chapters). A trader told to buy
 * pays for a load of `lot` there, at `markup` times what the Market pays for that ore, dearer by `rise` with every load anyone
 * has bought, and carries it home to its Market: bought ore opens the road's door as mined ore does. Saltpetre opens no road
 * yet, and the ore technologies stay open only where the world holds their ore, so it is not sold. Glowcaps (#800) are: on a
 * world with no Glowcap hollow, the Age of the Mycelium's vein door opens on glowcaps bought here, so the rare age is a dearer
 * road there, not a shut one. The computer keeps `traders` buying for a road it has planned whose ore this world lacks.
 */
export const ORE_POST = { lot: 10, markup: 1.5, rise: 0.1, traders: 1, ores: ['salt', 'bloodiron', 'glowcap'] as RareId[] };

/** The computer and the rare ores (#356 s5): the crew it sends to dig the ore a road's door asks for, and how far from home it will look for the vein. */
export const AI_ORE = { crew: 3, reach: 70 };

/**
 * Hired swords (the Age of Merchants, #37) are paid by the day, not once: the hire price covers a sword's first `first` seconds, then every
 * `every` seconds each draws `wage` gold from its people's treasury. A purse too thin to pay one leaves it a payday behind; a sword `patience` paydays behind walks off the field, for good.
 * Wages go on after the people leaves the Age of Merchants, until the swords are dead or gone.
 */
export const MERC = { every: 15, wage: 2, patience: 2, first: 45 };

/** The computer's hired swords (the Age of Merchants): it hires only with `reserve` paydays of every sword it would then keep still in the purse. */
export const AI_MERC = { reserve: 6 };

/** A climb `banked` paid for (that share of its whole price in hand, #532) is not spent on the next wave: army-first lets it go ahead. */
export const AI_CLIMB = { banked: 0.6 };

/**
 * The computer and the lodge's third level (#568): a clever computer assays once a rival stands in an age a key resource
 * opens; assayed, `riders` idle riders fall on a rival's digger at a key-resource tile within `reach` tiles of home.
 */
export const AI_ASSAY = { reach: 36, riders: 3 };
/** `lodgeWait`: seconds at most the Stone Age climb is held while a Prospector's Lodge it means to raise is due (#540). */
/**
 * Rivals with a leaning (#749, `docs/engagement.md` Phase 3): a clever computer in a skirmish favours a route a `lean` share of the
 * time, choosing that route's side ages from its first turn (the navy and the water road only on a map with water). And while a
 * rival's weak window after a step back is open, it strikes with `strike` of a full wave (at least `least` soldiers).
 */
export const AI_TEMPER = { lean: 0.6, strike: 0.5, least: 6 };

export const AI_WEB = { lodgeWait: 120, take: 0.6, heir: 1, survey: 22, diggers: 3, nearly: 0.5, patience: 90, close: 0.75, relics: 2, raid: 18, raidNear: 30, riders: 4, read: 0.85, lodge: 1, hulls: 1, bell: 900 };

// ---- Colours, names and lookups -------------------------------------------------------------------

export const PLAYER_COLORS = ['#2f7fe0', '#d9364a', '#f0c828', '#3aa35a', '#9b59d0', '#e8702a'];
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


// ---- Borders, war camps and attrition -------------------------------------------------------------

/**
 * Borders (#132 s1): a finished building claims the land within `radius` tiles; a tile belongs to the
 * nearest claimant (ties go to the older building). Shown only, so far; attrition and building limits
 * are later steps of the seed.
 */
export const BORDERS: Partial<Record<BuildingType, number>> = { towncenter: 14, tower: 6, wonder: 9, dock: 5, airfield: 6, silo: 5, huntcamp: 4, warcamp: 3, caravanserai: 5, mission: 5, heart: 8 };

/**
 * War Camps (#303): a finished camp with none of its people's soldiers (land units that fight) within
 * `watch` tiles for `grace` seconds starts to burn, losing `burn` of its full health a second until
 * soldiers come back; a people off the path it belongs to (`BUILDINGS.warcamp.ages`) can't keep one
 * at all, so its camps burn at once. `train`: a camp trains its foot soldiers this much slower than a
 * Barracks (tents, not a drill yard).
 */
/**
 * Spoils (#502, the Age of the Warband): the plunder a soldier's kill earns is carried in its pack, up to `cap` gold (the rest is left
 * on the field), and banked at the first of the people's `homes` it comes within `bank` tiles of. Fell a laden soldier and its
 * spoils pay you in full. The computer sends a soldier home once it carries `home` gold.
 */
export const SPOILS = { cap: 90, bank: 5, homes: ['towncenter', 'barracks'] as BuildingType[], home: 45, stockadeCut: 0.75 };
/** The Warband's Spoils Stockade (#727): a forward bank paying `SPOILS.stockadeCut` of a pack, and arming foot soldiers at `price` of the usual cost. */
export const STOCKADE = { price: 0.9, away: 15 };
/** The computer's Spoils Stockade: the host it needs before it raises one. */
export const AI_STOCKADE = { army: 8 };

/**
 * Take it back (#570, the age road s3): a people's mined key ore (salt, saltpetre, blood-iron) is kept in its ore stores, the
 * buildings that take stone in. One that falls spills `share` of each ore, split across the stores standing, as a cache on the
 * ground; a fallen digger or carrier drops its basket. Any people's citizen lifts up to `load` at a time and banks it within
 * `bank` tiles of its own ore store. Spilled ore is taken off the loser's ore door too, and counts toward the taker's.
 */
export const CACHE = { share: 0.5, load: 20, bank: 1.5, merge: 1.5 };
/** The computer and caches (#570): it sends up to `hands` citizens for a cache within `near` tiles of home with no rival soldier within `safe` of it; assayed, it aims a wave at a rival's ore store once that rival holds `worth` ore. */
export const AI_CACHE = { near: 20, hands: 3, safe: 6, worth: 30 };

/**
 * Powder (#577, the age road's first gateway). In the Age of Alchemy every finished Siege Workshop is a mill: each second it adds
 * one to the people's milling, and every `time` seconds of milling grind a keg from `ore` saltpetre in store, up to `most` kegs
 * held (milling waits while the store is short or full). In the Age of Sappers a citizen or foot soldier carries a keg to within
 * `lay` tiles of a rival building and lays it; `fuse` seconds later it blows, and every rival building within `reach` tiles of it
 * takes `building`, every rival unit on the ground within `reach` takes `unit`. A rival unit on the ground within `douse` tiles of
 * a burning keg stamps it out (the keg is lost).
 */
export const KEG = { ore: 20, time: 30, most: 20, lay: 1.2, fuse: 8, reach: 2, building: 600, unit: 30, douse: 1 };
/**
 * The Horde's Horsetail Standard (#727): riders standing within `reach` tiles of one take tribute at `rate` a second from the nearest
 * rival whose land lies within `border` tiles of it, as though they stood in that land (the same `TRIBUTE.most` riders a rival).
 */
export const STANDARD = { reach: 5, border: 8, rate: 0.3 };
/** The Mine Gallery (#727): a keg laid within `mine` tiles of its own gallery can't be stamped out; a rival keg within `listen` tiles of one is countermined. */
export const GALLERY = { mine: 6, listen: 6, away: 14 };
/**
 * The computer and powder (#577): a people whose coin falls under `take` (and whose strength siege isn't) means to walk the
 * gateway. It digs saltpetre until it holds `ore` in store and the road's door is open, then turns into Alchemy; there it keeps
 * `mills` Siege Workshops and digs on until it has ground (or holds the saltpetre for) `kegs`, and holds the climb for the
 * Sappers' deed up to `hold` seconds. In the Sappers, every `every` seconds, it sends up to `sappers` foot soldiers out on
 * campaign with a keg each at the nearest rival building within `near` tiles of them, towers and Town Centers first, passing over
 * any with a rival standing within `guard` tiles of it.
 */
/**
 * The Missile Silo (#605, the Atomic Age): `launch` names a point; `fuse` seconds later (a countdown every player sees) the warhead
 * lands: every rival building within `reach` tiles takes `building`, every rival unit on the ground within `reach` takes `unit`.
 * Destroying the silo while it counts scrubs the launch. A launch spends a warhead from the people's pool (#753) and costs `fuel`,
 * paid when the launch is made.
 */
/**
 * Fallout (#605 s2, grows seed #533): the ring a warhead struck stays poisoned for `time` seconds. Every second each land unit
 * standing in it, whoever's it is, takes `dps` damage; buildings are not hurt. A town can be flattened and still not be walked into.
 */
export const FALLOUT = { time: 90, dps: 4 };
/**
 * The Age of Fission (#605 s3, seed #533): raw power now. Every launch's clock is `fuse` seconds, the pool makes a warhead every
 * `refuel`, a Fission warhead's fuel is `fuel`, and each launch, whatever the warhead, poisons `reach` tiles round your own silo for
 * `ownFallout` seconds (`silo.ts`). The Age of Fusion: clean and limitless but slow. Every clock is `fuse` seconds, the pool refills
 * at once, a Fusion warhead's fuel is `fuel`, and nothing it strikes is poisoned. Its road costs the earth, leaving the town exposed while it builds.
 */
export const FISSION = { fuse: 25, refuel: 100, ownFallout: 60, reach: 3, fuel: { gold: 800, stone: 250 } };
export const FUSION = { fuse: 70, refuel: 0, fuel: { gold: 450, stone: 120 } };
/**
 * The Missile Silo. `reach` is the radius of the fallout a strike leaves at its impact point; how far the blast itself carries is the
 * warhead's own `r` (`WARHEADS`). `lift` is how many seconds a blast clears the fog for every player over its radius (#752).
 * The missile pool (#753): a people keeps one store of warheads, fired from any of its silos. It holds `stock` when its first silo
 * stands, and makes one more every `refuel` seconds (the plain Atomic Age's; Fission and Fusion have their own) while the warheads in
 * store and in the air number under `cap`. `fuel` is an Atomic warhead's. A people raises at most `most` silos; every player sees a finished one.
 */
/**
 * The three-zone warning (#762): a rival is shown the real zone and two decoys `apart` tiles or more from it and each other, each ring's
 * centre moved by a whole number of tiles up to `blur` on each axis; at `reveal` seconds left the decoys vanish. A town too sparse to
 * draw decoys from falls back to points within `spread` tiles of the target.
 */
export const SILO = { fuse: 45, reach: 5, fuel: { gold: 600, stone: 200 }, refuel: 240, most: 2, lift: 60, stock: 1, cap: 3, blur: 2, reveal: 3, apart: 8, spread: 24 };
/**
 * The salvo (#765): three Atomic warheads from the store at once, one from each of `trio` standing silos, on the people's one clock. Only a
 * people with Launch Control fires one, and only it may raise a third silo (`trio`). A plain Atomic people pays `surcharge` more fuel for
 * each of the three (a Fission or Fusion people's silos are built to share a clock).
 */
export const SALVO = { trio: 3, surcharge: 0.5 };
/**
 * Missile defence (#759 s2): a finished Interceptor Battery holds one charge. Exactly `fire` seconds before a rival warhead lands, each of its
 * live warheads whose ring, as the battery's team is shown it, lies within `reach` tiles of a charged battery draws one attempt: the nearest
 * such battery fires, its charge spent hit or miss, and the roll (`chance`) is drawn then from the match's dice and stored on the launch.
 * Exactly `meet` seconds before it lands the interceptor meets it: a hit and that warhead is gone, with no blast and no fallout; a miss and it
 * flies on. A spent battery reloads in `reload` seconds. The computer learns Interceptors once a rival stands in the Industrial Age or later
 * and raises `most` batteries, one to cover each of its Town Centers, nearest home first, `gap` seconds apart.
 *
 * A silo held in Reserve (#759 s3): a warhead no battery answered draws one attempt from a rival's Reserve silo instead, anywhere on the map,
 * at the same chance; it spends a warhead from that people's store and its own warhead's launch fuel. A silo set to Reserve stands ready
 * `arm` seconds later, and again `arm` seconds after each interceptor it fires; it may stand down at once, but launches nothing while set.
 * The computer holds a silo in Reserve while a rival stands a silo and it stands two (or its store is full), deciding once every `think` seconds.
 */
export const INTERCEPT = { chance: INTERCEPT_PCT / 100, reach: INTERCEPT_REACH, fire: INTERCEPT_FIRE, meet: 1, reload: INTERCEPT_RELOAD, most: 2, gap: 40, arm: 30, think: 10 };
/**
 * A missile's flight (#772): the course every player watches inside the fuse. It climbs toward the middle of a rival's rings (the lure,
 * moved up to `jitter` tiles by the seed) and covers `knee` of the way there, bowing sideways by up to `bow` of that stretch, so the first
 * part reads as a district, not a point. Then it bends onto its true point (`lead`: how far past the bend's start the curve leans on along
 * its old heading) and dives. The bend starts `read` seconds before the reveal, scaled by the lure's distance over `ref` tiles (between `lo`
 * and `hi` of it): a sharp eye reads the target in that window. The arc peaks at `rise` of the lure's distance, between `low` and `high`
 * tiles, at the bend. A lure nearer the silo than `near` tiles is replaced by the target.
 */
export const FLIGHT = { knee: 0.55, bow: 0.3, jitter: 3, lead: 0.5, read: 8, ref: 40, lo: 0.6, hi: 1.5, rise: 0.18, low: 4, high: 9, near: 6 };
/**
 * The three warheads (#751 s1). A blast does `peak / (1 + (d/half)²)` at distance `d` tiles (from a building's nearest edge, or a unit's
 * position), tapering linearly over the last `taper` tiles to nothing at the blast radius `r`. A people fires its branch's warhead:
 * plain Atomic, Fission or Fusion, and from #753 chooses at launch between Atomic and its branch's own.
 */
export const WARHEADS = {
  atomic: { peak: 12000, r: 8 },
  fission: { peak: 20000, r: 10 },
  fusion: { peak: 40000, r: 12 },
  half: 2,
  taper: 2,
};
/**
 * The computer and the silo (#605): in the Atomic Age a clever computer raises one silo once it has `hands` citizens, waits `wait`
 * seconds after it stands, then launches whenever a point would catch `worth` or more of a rival's buildings (a Town Center counts
 * `heart`) and soldiers (each counts `soldier`) inside the ring. Its soldiers and citizens run from the ring of a rival warhead
 * in the air, `margin` tiles past its edge. On a coin of its own it takes the fork (`fork` odds, then `fusion` odds of Fusion over Fission)
 * once its silo has stood `forkAfter` seconds and it holds half the road's price. An Industrial computer bound for Aeronauts or Lightning holds off the climb `hold` seconds.
 *
 * The salvo (#765): when three rival targets at least `SILO.apart` apart are each worth a launch and together worth `salvo` times the best
 * single strike (`salvoPlain` times for a plain Atomic people, who pays the surcharge), the computer raises silos to three, learns Launch
 * Control, and holds its single strikes until the store holds three.
 *
 * The flight (#772): `read` seconds after a rival missile starts to bend, the computer reads its course as a player would (where it is,
 * where it is going, how it turns) and stops clearing the rings the course has ruled out.
 */
export const AI_SILO = { fork: 0.7, fusion: 0.4, forkAfter: 120, hold: 300, hands: 20, wait: 20, worth: 6, heart: 4, soldier: 2, margin: 1.5, salvo: 1.8, salvoPlain: 2.4, read: 5 };
export const AI_KEG = { take: 0.5, ore: 80, kegs: 6, mills: 2, hold: 180, sappers: 2, near: 12, guard: 4, every: 2 };

/**
 * The computer and the first crossing (#585): a people that has walked the Warband or the Sail and keeps a Dock decides once, at
 * `take` odds on a coin of its own, to walk the other and turn Sea-Raider. It stays `stay` seconds in each sibling before it goes back
 * to the Middle Ages, and `raid` seconds in the Sea-Raiders before it climbs on.
 */
/**
 * The Age of Missions (#555 s12): every `every` seconds each finished, awake Mission of a people pays `base` plus `perTile` gold for each tile
 * it stands from the people's nearest finished Town Center, at most `cap`, for the `most` farthest Missions it keeps. The computer raises one
 * on a shore `AI_MISSION.far` tiles or more out (up to `most`), sending a priest to raise it.
 */
/** The Iron Age's Bloomery (#727): each bar of bog iron hauled to its hearth counts this many times toward the edge. */
export const BLOOMERY = { smelt: 2 };
/** The Merchants' Hire Hall (#727): a sword signed there costs the Market's hire price `dear` times over, once, and draws no wages. */
export const HIREHALL = { dear: 1.6 };
export const MISSION = { every: 5, base: 1, perTile: 0.12, cap: 8, most: 3 };
export const AI_MISSION = { far: 18, search: 10, take: 0.6, stay: 120, hold: 240, gap: 45 };
/** The computer and the Age of Chariots (#555 s12): the odds it plans the crossing once it has walked one sibling, and its stay in each. */
export const AI_CHARIOT = { take: 0.6, stay: 120 };
export const AI_SEA = { take: 0.6, stay: 120, raid: 300 };

/**
 * The Age of the Sea Beggars (#783). A rival ship (a district under tow aside) that a ship of a boarding people would sink is taken
 * instead, with `left` of its full health, unless it carries soldiers. A Dock kept as the age's keepsake boards ships beaten down within
 * `haven` tiles of it on any road. A boarding people's ships strike dykes, sluices, dams and causeways with `cut` of their blow, as siege does.
 */
export const BEGGARS = { left: 0.35, haven: 12, cut: 1.2 };
/**
 * The computer and the Sea Beggars (#783): the odds it plans the crossing once it has walked one sibling (`take`), its stay in each
 * (`stay`) and in the age itself (`hold`); there its idle warships cut the rival dyke seen within `hunt` tiles of its Dock that holds back polder.
 */
export const AI_BEGGARS = { take: 0.5, stay: 120, hold: 300, hunt: 30 };
/**
 * The Age of the Wild Hunt (#801, `hunt.ts`). A War Wolf of a people with the pack at heel that stands idle within `follow` tiles of one
 * of its wagons, and farther than `heel` from it, runs to it (looked at every `every` seconds). The computer keeps `hawks` Hawks aloft, sent
 * exploring, from the moment it walks the age.
 */
export const HUNT = { follow: 18, heel: 2.5, every: 2, hawks: 1 };
/**
 * The computer and the Wild Hunt (#801): the odds it plans the crossing once it has walked one sibling (`take`), its stay in each (`stay`)
 * and in the age itself (`hold`).
 */
export const AI_HUNT = { take: 0.5, stay: 120, hold: 240 };


export const WARCAMP = { watch: 8, grace: 10, burn: 0.05, train: 1.2 };

/**
 * The call to arms (the Age of Total War, #313): a War Camp calls up to `most` of its people's citizens standing
 * within `reach` tiles of it, the nearest first; each becomes a foot soldier of the age where it stands, with the
 * share of health it had, for `cost` (its arms), and the camp then rests `rest` seconds for each one called.
 */
export const CALL_UP = { reach: 8, most: 5, rest: 4, cost: { wood: 15, gold: 25 } as Cost };

/**
 * Attrition (#132 s2): every `every` seconds a land soldier standing in an enemy's land, with none of its
 * own team's land within `deep` tiles, loses `loss` of its full health. Ships and aircraft, citizens,
 * priests and traders are exempt, and so is everyone during a peace treaty. A town centre or tower raised nearby gives a foothold (its border).
 */
export const ATTRITION = { every: 5, deep: 9, loss: 0.02 };

/**
 * The computer reads the borders (#132 s4): a wave out in enemy land, past its own team's supply, whose
 * soldiers have worn to under `weary` of their health on average, with no enemy within `calm` tiles, falls
 * back to the muster to heal and regroup instead of dying to attrition. Not when it is all in, or racing a wonder.
 * A clever computer with `pop` citizens also raises one forward Tower `fort` tiles toward its rival, at the edge of its own
 * land, so its next wave has a border to fight from (#132 s5).
 * `flame`: a clever computer that sees a rival's beacon burning within this many tiles of one of its Towers lights that Tower's own.
 * `stage`: a clever computer that keeps an Old Ford up to this many tiles from home, on the rival's side of it, musters its waves there, so they march out already forward.
 */

// ---- Computer tuning for each Way -----------------------------------------------------------------

/**
 * The computer and the Age of Lightning (#231): it takes the road with at least `towers` finished towers and no
 * aircraft, and while it walks the web in the Industrial Age it lights a beacon every `every` seconds toward
 * the deed. In the age it raises a coil by a dark workshop, `gap` seconds apart, up to `most` towers.
 * `raid`: a rival's coil that is the only one lighting some buildings draws a raid, `raid` tiles² of pull for each building it alone keeps lit.
 */
export const AI_LIGHTNING = { towers: 2, every: 40, gap: 45, most: 6, raid: 150 };

/**
 * The computer on the Path of Blood (#307). `take`: odds a clever war-people (foot or riders for its signature)
 * chooses the path. `patience`: seconds it holds the Warband for the plunder before the climb to Gunpowder,
 * given up after that. `stay`: seconds in Iron and Blood before it climbs out. `reach`: how near (tiles) to
 * the rival's home a wave must be before it pitches a War Camp; `clear`: tiles it keeps from the rival's
 * Town Center and Towers (arrow range and a margin). `keep`: soldiers left by each camp. `again`: seconds
 * before a burnt camp is pitched anew. `answer`: tiles from home within which a rival's camp draws a strike
 * band of `strike` soldiers. Total War (#315): `home` tiles from the Town Center a muster camp is pitched (and held
 * in Iron and Blood for the deed, up to `patience` seconds); `alarm` tiles from it within which `foes` enemy soldiers
 * call citizens to arms; `held` citizens are always kept at their work.
 */
export const AI_BLOOD = { take: 0.6, patience: 480, stay: 360, reach: 40, clear: 11, keep: 3, again: 120, answer: 48, strike: 5, home: 9, alarm: 16, foes: 3, held: 22 };

export const AI_RAID = { weary: 0.5, calm: 7, fort: 15, pop: 24, flame: 24, stage: 36 };
/**
 * The computer and the Ways' verbs (#463 s1). Hunters: up to `hunters` chase deer within `huntReach` of home, and it pitches kill camps by any kill of `campMeat` or more once it has `campAt` citizens,
 * up to `camps`, one each `campAgain` seconds. Hearth: kin called with `kinKeep` food left over, a citizen trained alone when the kin can't be paid, and in a Stone Age winter none trained alone once it has `kinFrom` (#486). Warband: a Barracks and soldiers from `barracksAt` citizens, a band of `band` foot before more citizens once it has `bandAt` (in the Stone Age, out of a treaty), and up to epoch `raidUntil`
 * its band goes out every `raidEvery` seconds, first for a rival food building of `raidAt` within `raidReach` of home and
 * `raidSafe` tiles clear of its forts, with `raidTime` seconds for the walk. Hunters on the Herd Plains put by the wood for `trekFields`
 * fields in summer, to sow when their herd treks out (#529).
 */
export const AI_WAYS = { trekFields: 4, hunters: 12, huntReach: 34, campAt: 5, camps: 5, campAgain: 12, campMeat: 40, kinKeep: 0, kinFrom: 8, barracksAt: 6, bandAt: 9, band: 4, raidUntil: 1, raidEvery: 45, raidAt: ['storehouse', 'huntcamp', 'farm', 'dock'] as BuildingType[], raidReach: 90, raidSafe: 8, raidTime: 100 };
/**
 * Hunters hunted (#260): between waves a clever computer sends `band` to `most` idle soldiers at a rival citizen
 * its own units see working within `reach` tiles of its home, more than `safe` tiles from any rival Town Center
 * or Tower, with no rival soldier within `guard` tiles and at most `odds` rival citizens per raider within 4
 * tiles of it. The band chases on to the next such citizen within `chase` tiles, goes home when a rival soldier
 * comes within `guard` or after `time` seconds, and sets out again at most every `every` seconds. Seeing no one,
 * a band walks to a rival Hunting Camp it has seen within `reach` (one more than `safe` from the rival's forts)
 * to find who works there, and looks within `look` tiles of the band once it is near.
 */
/**
 * The computer scouts and keeps watch (#454 s4): after `after` seconds a clever computer sends one idle rider exploring (again after
 * `rest` seconds if it stops), and, with `army` soldiers idle, posts `guards` of them (foot or bowmen) to patrol its trade road
 * or, with no post, `reach` tiles out toward its rival.
 */
export const AI_SCOUT = { after: 150, rest: 60, guards: 2, army: 8, reach: 16 };
export const AI_PROWL = { band: 2, most: 3, reach: 40, safe: 12, guard: 7, odds: 2, chase: 8, look: 10, time: 45, every: 75, burn: 45, cover: 14, extra: 2 };
/**
 * The computer and the wild (#171): once it has `mammothAt` citizens it sends a party of `party` after the
 * mammoth within `mammothNear` tiles of home; with `pack` soldiers at hand it clears wolves within `clear`.
 */
export const AI_WILD = { mammothAt: 10, party: 5, mammothNear: 22, pack: 3, clear: 32, boarAt: 6, boarParty: 3, boarNear: 18,
  /** A Hunting Camp goes up by a kill of at least `campMeat` food that lies `campFar` tiles from any food drop (and within `campNear` of home: as far as the far hunt goes, so a far feast gets its camp). */
  campMeat: 150, campFar: 9, campNear: 38,
  /** A mammoth `mammothNear` to `far` tiles from home is hunted too, by a clever computer, with `escort` idle soldiers sent along (beyond a guard of `guard` at home) and no rival soldier seen within `safe` tiles of it. */
  far: 38, escort: 2, guard: 3, safe: 12,
  /** A clever computer past the Stone Age raises a Watch Tower within `towerNear` tiles of a far kill (22 to `campNear` tiles from home) whose Hunting Camp stands. */
  towerNear: 6,
  /** A computer with `raid` soldiers idle at hand marches on a raider camp within `raidNear` tiles of home. */
  raid: 4, raidNear: 34 };

/**
 * The computer on the steppe (#320, s5a of #297). A clever computer whose people the steppe neither suits nor
 * spites means to take it at `take` odds (a riding people always does). In the Stone Age one bound there, once
 * it has `at` citizens, raises a Hunting Camp by the nearest deer `campFrom` to `campTo` tiles from home (the
 * road's clue), and keeps up to `hunters` citizens on deer within `reach` tiles of home until the deed is met.
 * On the steppe it raises a lamb whenever its budget holds `spare` food beyond the lamb's price, keeps one
 * milker for each `perMilker` grown sheep, and slaughters a grown sheep whose fat is full while it can't breed
 * (the flock is full, or the people has left the steppe), one at a time. It strikes camp at most every `every`
 * seconds, when a `hungry` share of its grown sheep have gone hungry or no deer or berries lie within `bare`
 * tiles of camp, and no rival soldiers are near: it drives its Town Center `move` to `far` tiles to the best
 * fresh pasture that lies no nearer the rival, and pitches there; a wagon still on the road after `drive`
 * seconds pitches where it stands. It keeps to the steppe at least `stay` seconds before rejoining the trunk.
 */
/**
 * The computer in the Age of the Horde (#322, s5b of #297). It holds the climb out of the steppe for the Horde's
 * deeds up to `hold` seconds, keeping a milker for each sheep (`milkers` at most), raising lambs at `spare` food over their price and, once the milk is in, culling the flock for the meat down to `least` grown sheep; it saves for a Stable, the road's clue; stays in the Horde `stay` seconds, and trains riders `cavalry` of
 * the time while it has under a full band. Then `riders` idle riders (up to `TRIBUTE.most`) ride to the nearest
 * rival land inside their supply, `clear` tiles from the rival's Town Centers and Towers, and stand there; the
 * band comes home when it numbers under `weary` or more than its own number of rival soldiers (at least `foes`
 * for the choice of site) stand within `alarm` tiles, and sets out again after `redo` seconds. A computer drained
 * by standing riders sends its army against them once `answer` of them stand in its land.
 */
export const AI_HORDE = { milkers: 5, spare: 40, least: 3, hold: 300, stay: 300, cavalry: 0.9, riders: 6, clear: 12, weary: 3, foes: 4, alarm: 9, redo: 150, answer: 2 };

/** The computer and the Horsetail Standard (#727): it plants one `past` tiles outside a rival Town Center's border. */
export const AI_STANDARD = { past: 4 };

export const AI_STEPPE = { take: 0.35, at: 12, campFrom: 8, campTo: 30, hunters: 6, reach: 26, spare: 100, perMilker: 3, every: 150, hungry: 0.5, bare: 16, move: 10, far: 18, drive: 40, stay: 90 };

/**
 * The tide of battle (#606), a read of each fight a player can see. A fight is where a unit of theirs or a foe they
 * see struck or was struck within `recent` seconds with one of the other side within `near` tiles; such units
 * within `join` tiles of a fight's middle are one fight, and every fighter within `reach` of it is counted. Each
 * side's strength is its hit points times its damage a second (Lanchester's square law); the share of the two is
 * the tide. The words: `crushing` and over, `winning`, `even` down to `losing`, then routed. A fight whose tide
 * falls under `turn` that was at least `even` warns the player, no more often than every `warnEvery` seconds; a
 * side counts at most `most` fighters' blows against at most `most` targets (a sample, so a huge melee stays cheap).
 */
export const BATTLE = { recent: 3, near: 8, join: 9, reach: 10, crushing: 0.8, winning: 0.6, even: 0.4, losing: 0.2, turn: 0.38, warnEvery: 20, most: 48 };

/**
 * Citizens run from danger on their own (a person's people only; the computer's citizens stand their ground):
 * struck by a soldier, one makes for the nearest shelter within `shelter` tiles, or runs `run` tiles from it if
 * none has room; shot by a tower or Town Center, one steps `pad` tiles past its reach. Sheltered, they come out
 * once nothing armed and hostile is within `clear` tiles of the building and `hold` seconds have passed.
 */
export const FLEE = { shelter: 14, run: 8, pad: 3, clear: 10, hold: 6 };
