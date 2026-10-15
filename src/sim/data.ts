import type { AgeId, PathId, LandmarkKind, BuildingType, CivId, Cost, Difficulty, Domain, MapSize, MapType, Res, TechId, UnitType, PlayerStats } from './types';

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

/**
 * Ages as a web (#37). An age is where a people stands; its tier is the epoch that every
 * epoch-based number reads (unit versions, building styles and toughness, technologies, walls), so
 * a side age's armies keep pace. The trunk is the five epochs above, the dependable road on every
 * map; side ages branch off it, change how a people works while it stays there, and rejoin it.
 */
export interface Age {
  name: string;
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
   * Trade fed by faith (#49): every relic the people keeps in its Temples makes each trade trip pay
   * `each` more of its usual gold, counting at most `most` relics.
   */
  relicTrade?: { each: number; most: number };
  /**
   * Trade fed by iron: every `per` bars of bog iron the people has ever dug make each trade trip pay `each`
   * more, counting at most `most` such steps. Iron dug on the way here still counts (the web's link).
   */
  ironTrade?: { per: number; each: number; most: number };
  /**
   * Power broadcast from coils (the Age of Lightning, #231): Watch Towers become Coil Towers, whose field
   * speeds the work of buildings near them and slows every building outside, and whose shot is a leaping
   * arc. The numbers are `LIGHTNING`.
   */
  coils?: boolean;
  /** The path (#299) this age is a step of: a chain of side ages, one per tier, that carries its own way of life across epochs. */
  path?: PathId;
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
}

export const PATHS: Record<PathId, Path> = {
  blood: {
    name: 'Path of Blood',
    blurb: 'A people that lives by war: it trades with no one, and feeds its towns on what its soldiers take from the enemy dead. Each age of the path opens with a deeper deed of blood, and the plunder grows with every age of it walked.',
    carry: { plunder: 0.1 },
    planned: ['tier 4: the Age of Total War'],
  },
};

export const TRUNK: AgeId[] = ['stone', 'bronze', 'middle', 'gunpowder', 'industrial'];

const trunkAge = (e: number): Age => ({ name: EPOCHS[e].name, short: EPOCHS[e].short, tier: e, blurb: EPOCHS[e].blurb });

/** Iron wares: bog iron dug (any age) raises trade in the trading ages (Merchants, Fairs, Sail): +8% a 75 bars, to +40%. */
export const IRON_TRADE = { per: 75, each: 0.08, most: 5 };

export const AGES: Record<AgeId, Age> = {
  stone: trunkAge(0),
  bronze: trunkAge(1),
  middle: trunkAge(2),
  gunpowder: trunkAge(3),
  industrial: trunkAge(4),
  aeronaut: {
    name: 'Age of Aeronauts', short: 'Aeronauts', tier: 4,
    blurb: 'A future built around the airfield: fighters and bombers cost 25% less and train in 25% less time. Foot, ranged, cavalry and siege units cost 20% more. Aircraft keep Industrial combat strength; riflemen, towers, ironclads and enemy fighters still answer them.',
    price: { fighter: 0.75, bomber: 0.75, infantry: 1.2, ranged: 1.2, cavalry: 1.2, siege: 1.2 },
    training: { fighter: 0.75, bomber: 0.75 },
  },
  reclaimer: {
    name: 'Age of Reclaimers',
    short: 'Reclaimers',
    tier: 3,
    blurb: 'Build tomorrow from yesterday: excavating an ancient ruin teaches a people to rebuild. Construction and repairs work 25% faster, technologies cost 20% less, but military units take 25% longer to train. The same armies and technologies as the Gunpowder Age.',
    mul: { buildSpeed: 1.25, techCost: 0.8, militaryTrain: 1.25 },
  },
  merchant: {
    name: 'Age of Merchants',
    short: 'Merchant',
    tier: 2,
    blurb: 'Guilds, banks and hired swords: the Market hires soldiers for gold, trade pays more (more still for every bar of bog iron your people ever dug), and levies cost dear.',
    mul: { tradeGold: 1.25 },
    ironTrade: IRON_TRADE,
    hire: { at: 'market', units: ['infantry', 'ranged', 'cavalry'], gold: 1.2, time: 0.5 },
    levy: 1.2,
  },
  iron: {
    name: 'Iron Age',
    short: 'Iron',
    tier: 1,
    blurb: 'Iron spears, iron hoes and iron axes, but no horse: cheap, hard-hitting foot soldiers and quicker farms and woodcutters, and every scrap of bog iron dug pays twice its gold, so the marsh is worth holding; cavalry waits for the Middle Ages.',
    add: { infantryAttack: 1 },
    mul: { farm: 1.1, wood: 1.1, bogGold: 2 },
    price: { infantry: 0.75 },
    no: { units: ['cavalry'], why: 'No horses in the Iron Age: cavalry waits for the Middle Ages' },
  },
  pilgrim: {
    name: 'Age of Pilgrims',
    short: 'Pilgrim',
    tier: 2,
    blurb: 'The faithful walk from far away to see the relics in your Temples: relics pay double, and priests come at half price and work a quarter faster. A pilgrim people builds no siege engines, but its priests, chanting together, win a rival\'s towers, gates and Temples over.',
    add: { consecrate: 1 },
    mul: { relicGold: 2, priest: 1.25 },
    price: { priest: 0.5 },
    no: { units: ['siege'], why: 'A pilgrim people builds no siege engines: rams and catapults wait until it leaves the pilgrims\' road' },
  },
  fair: {
    name: 'Age of Fairs',
    short: 'Fairs',
    tier: 3,
    blurb: 'Where pilgrims gather, merchants follow: feast days become great fairs. Trade pays more for every relic your Temples keep, and traders travel faster, but towns grown open round the fairground stand 15% weaker.',
    mul: { tradeGold: 1.25, traderSpeed: 1.15, buildingHp: 0.85 },
    relicTrade: { each: 0.1, most: 5 },
    ironTrade: IRON_TRADE,
  },
  sail: {
    name: 'Age of Sail',
    short: 'Sail',
    tier: 2,
    blurb: 'A people that has turned to the sea: boats fish half again as fast, ships come a quarter cheaper and a quarter sturdier, but the fields are tilled with less care. A Market within a dozen tiles of a Dock ships its goods by water: its trade trips pay 30% more.',
    mul: { fish: 1.5, shipHp: 1.25, farm: 0.85 },
    price: { ship: 0.75 },
    ironTrade: IRON_TRADE,
  },
  lightning: {
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
    blurb: 'The war-host is the people: soldiers train 15% faster, and every enemy unit your forces slay pays a quarter of its price as plunder in gold. But a warband trades with no one: no traders leave its Markets, and with the young away at war the fields yield 10% less.',
    add: { plunder: 0.25 },
    mul: { militaryTrain: 0.85, farm: 0.9 },
    no: { units: ['trader'], why: 'A warband trades with no one: traders wait until your people leave the Path of Blood' },
  },
  // The second step of the Path of Blood (#303): a turn off the Gunpowder Age, open only to a people that walked the Warband.
  ironblood: {
    name: 'Age of Iron and Blood',
    short: 'Iron & Blood',
    tier: 3,
    path: 'blood',
    blurb: 'War is the state. Foot soldiers pitch War Camps where the army stands, even in enemy land, and the camps train foot soldiers at the front and hold a little land, so the army is fed and the march home is gone. Soldiers train 15% faster and the enemy dead pay plunder, more than in the Warband. But a camp left without soldiers burns, no traders leave the Markets, the fields yield 15% less and scholars cost a fifth more: a people at war has no patience for them.',
    add: { plunder: 0.25 },
    mul: { militaryTrain: 0.85, farm: 0.85, techCost: 1.2 },
    no: { units: ['trader'], why: 'A people of iron and blood trades with no one: traders wait until your people leave the Path of Blood' },
  },
  steppe: {
    name: 'Age of the Steppe',
    short: 'Steppe',
    tier: 1,
    blurb: 'A people of herders and riders, whose town goes where the herds go: Town Centers and Houses pack onto wagons and are pitched again wherever the land is not a rival\'s. Riders cost a fifth less and train a quarter faster, and hunters work 15% faster. No fields are tilled and no walls raised until the Middle Ages.',
    mul: { hunt: 1.15 },
    price: { cavalry: 0.8 },
    training: { cavalry: 0.75 },
    mobile: true,
    noBuild: { buildings: ['farm', 'wall', 'gate'], why: 'A steppe people tills no fields and raises no walls: they wait for the Middle Ages' },
  },
};

/**
 * The Age of the Steppe (#297): a town on wheels. A Town Center or House that stands finished, with nothing
 * in training, can be packed onto a wagon in an instant (its sheltering people step out). A wagon pitches
 * where it stands, on any ground a rival does not hold, within `spot` tiles of it, and the building raises
 * itself in `pitch` seconds with the health it was packed with. While packed it gives no room, takes in
 * nothing and trains no one: the price of moving.
 */
export const STEPPE = { pitch: 10, spot: 3, packs: ['towncenter', 'house'] as BuildingType[] };

/** Something a people must have done before a road opens: a tally from its stats reaching `n`. */
export interface Deed {
  stat: keyof PlayerStats;
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
   * More deeds, every one needed as well (#49): a hybrid age asks for deeds in two systems at once.
   * A list of tallies rather than a new kind of condition, because every system already keeps its
   * tally in `PlayerStats` (trade, bog iron, relics), so a crossing is one stat and one line here.
   */
  also?: Deed[];
  /** What taking it means, for the tooltip (trunk roads use the age's blurb). */
  blurb?: string;
}

export const ROADS: Road[] = [
  ...TRUNK.slice(1).map((to, i): Road => ({ from: TRUNK[i], to, cost: EPOCHS[i + 1].cost, time: EPOCHS[i + 1].time })),
  { from: 'industrial', to: 'aeronaut', clue: 'airfield', cost: { food: 600, wood: 500, gold: 800 }, time: 60, blurb: 'Build a future around aviation: aircraft cost and training time fall by 25%, but foot, ranged, cavalry and siege units cost 20% more. An Airfield must stand when the journey starts.' },
  { from: 'aeronaut', to: 'industrial', cost: { food: 200, wood: 200 }, time: 30, blurb: 'Return to a balanced Industrial economy: ordinary aircraft production and ordinary land army prices.' },
  // The other future out of the Industrial (#231): fire signals, then the telegraph, then power sent through the air.
  {
    from: 'industrial',
    to: 'lightning',
    cost: { food: 500, stone: 300, gold: 900 },
    time: 60,
    clue: 'tower',
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
    blurb: 'Instead of the Middle Ages: the same soldiers and technologies, but the Market hires foot, bow and horse for gold alone, in half the time; trade pays 25% more; soldiers trained the usual way cost 20% more.',
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
  { from: 'iron', to: 'middle', cost: EPOCHS[2].cost, time: EPOCHS[2].time, blurb: 'Rejoin the main road at the Middle Ages, for the same price as from the Bronze Age: the horse arrives, and the iron foot soldiers become ordinary pikemen.' },
  // Crossing chains (#49): relics, a deed of the faith, open a turn off the Middle Ages; trade and relics
  // together open a hybrid, from either side. Its clue is a Temple from both: the relics are what a
  // merchant people hears of last, and a Middle Ages town with a Market alone shows no sign of it.
  {
    from: 'middle',
    to: 'pilgrim',
    cost: { food: 300, wood: 100, gold: 150 },
    time: 40,
    clue: 'temple',
    deed: { stat: 'relicGold', n: 120, text: 'Relics kept in your Temples bring in 120 gold' },
    blurb: 'A turn, not a climb: the same soldiers and technologies as the Middle Ages, but the faithful walk from far away to your Temples. Every relic kept there pays double gold; priests cost half as much and convert and heal a quarter faster. What it gives up: siege. The Siege Workshop builds nothing while you walk the pilgrims\' road, so walls and towers are taken by faith: priests chanting together win over a rival\'s buildings (never a Town Center or a Wonder), slower with soldiers sheltering inside.',
  },
  { from: 'pilgrim', to: 'gunpowder', cost: { food: 900, gold: 750, stone: 200 }, time: 65, blurb: 'Rejoin the main road: the pilgrims\' gold carries your people into gunpowder (more gold and less food and stone than from the Middle Ages). The siege engines return as cannon.' },
  { from: 'pilgrim', to: 'middle', cost: { food: 200, stone: 100 }, time: 25, blurb: 'Leave the pilgrims\' road for the ordinary Middle Ages: relics pay their usual gold, and the Siege Workshop works again.' },
  {
    from: 'merchant',
    to: 'fair',
    cost: { food: 900, wood: 300, gold: 700 },
    time: 65,
    clue: 'temple',
    deed: { stat: 'traded', n: 800, text: 'Your traders bring home 800 gold' },
    also: [{ stat: 'relicGold', n: 200, text: 'Relics kept in your Temples bring in 200 gold' }],
    blurb: 'Instead of the Gunpowder Age, for a people both merchant and faithful: trade pays 25% more, and 10% more again for every relic your Temples keep (up to five); traders travel 15% faster. No more hired swords. What it gives up: towns grown open round the fairground, every building 15% weaker.',
  },
  {
    from: 'pilgrim',
    to: 'fair',
    cost: { food: 900, wood: 300, gold: 700 },
    time: 65,
    clue: 'temple',
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
  { from: 'sail', to: 'gunpowder', cost: { food: 800, wood: 500, gold: 450, stone: 100 }, time: 60, blurb: 'Rejoin the main road: the shipping fortune carries your people into gunpowder (more wood and less gold than from the Middle Ages). Farms return to their usual yield.' },
  { from: 'sail', to: 'middle', cost: { food: 150, wood: 150 }, time: 25, blurb: 'Come ashore: the Middle Ages again, with ordinary fields, ordinary hulls and the usual price for ships.' },
  { from: 'fair', to: 'industrial', cost: { food: 1300, gold: 1100, stone: 300 }, time: 80, blurb: 'Rejoin the main road: the fairs\' fortune buys its way into the Industrial Age (more gold and less food and stone than from the Gunpowder Age).' },
  { from: 'fair', to: 'gunpowder', cost: { food: 400, stone: 200 }, time: 30, blurb: 'Settle down: wall the fairground and join the Gunpowder Age. Trade and buildings go back to their usual strength.' },
  // The Path of Blood (#299), first step: a turn off the Middle Ages. A Barracks is the clue, the enemy dead the deed.
  {
    from: 'middle',
    to: 'warband',
    cost: { food: 350, wood: 150, gold: 100 },
    time: 40,
    clue: 'barracks',
    deed: { stat: 'slain', n: 25, text: 'Your forces slay 25 enemy units' },
    blurb: 'A turn, not a climb: the first step on the Path of Blood. The same soldiers and technologies as the Middle Ages, but soldiers train 15% faster and every enemy unit slain pays a quarter of its price as plunder in gold, so war feeds the town. What it gives up: trade (no traders) and some of the harvest (farms 10% less). A warband that stops fighting grows poor.',
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
    blurb: 'A turn, not a climb: the second step on the Path of Blood. Foot soldiers pitch War Camps where the army stands, even in enemy land, that train foot soldiers at the front and keep the army fed; plunder grows (the Warband walked adds to it). What it gives up: trade, a sixth of the harvest and a fifth more for every technology. A camp left without soldiers burns.',
  },
  { from: 'ironblood', to: 'industrial', cost: { food: 1400, gold: 700, stone: 500 }, time: 80, blurb: 'Rejoin the main road: the war economy becomes an industry (less gold and more stone than from the Gunpowder Age). The plunder ends, the War Camps are struck, and traders and full harvests return.' },
  { from: 'ironblood', to: 'gunpowder', cost: { food: 300, gold: 150 }, time: 30, blurb: 'Make peace: the ordinary Gunpowder Age, with trade, full fields and the usual price of learning. The plunder ends and the War Camps are struck.' },
];

/**
 * Stepping back an age (#47), at a Town Center: down to the trunk age one tier below, whatever road
 * led here (the Iron Age falls back to the Stone Age, the merchants to the Bronze Age). Every unit
 * falls back to its older form, and technologies above the new tier are suspended, not lost: they
 * return when the people climbs again, at the climb's full price. What the step itself costs, for each
 * tier given up: food to carry the people through the unrest, gold to pay off those who did well
 * under the new order. `time` is seconds at the Town Center; `cooldown` is seconds after a step lands
 * before the next may begin, so a people can't flicker between ages to dodge a counter.
 */
export const STEP_BACK = { food: 100, gold: 50, time: 25, cooldown: 300 };
export const stepBackCost = (tier: number): Cost => ({ food: STEP_BACK.food * tier, gold: STEP_BACK.gold * tier });

/**
 * Bog iron (#39): on a `chance` share of seeds, a patch of `tiles` tiles for each player, about `home`
 * tiles from their town (nearer it than any other), each holding `AMOUNT.bog`. Other seeds hold none.
 */
export const BOG_IRON = { chance: 0.5, home: 22, tiles: 5 };

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
  // ---- Under sail (trade by sea) ----
  cog: [
    null,
    { name: 'Merchant Galley', cls: 'trader', hp: 150, attack: 0, armor: 0, parmor: 2, range: 0, reload: 1, speed: 1.9, sight: 7, cost: { wood: 90, gold: 40 }, time: 22, radius: 0.46, blurb: 'Sails goods from a Dock to a trading post on the coast and brings back gold: the farther the post, the more, and 20% over the land road. Only a post with water within 7 tiles is a port. Warships are its enemy.' },
    { name: 'Merchant Cog', cls: 'trader', hp: 210, attack: 0, armor: 1, parmor: 3, range: 0, reload: 1, speed: 2.0, sight: 7, cost: { wood: 100, gold: 40 }, time: 22, radius: 0.48, blurb: 'Sails goods from a Dock to a trading post on the coast and brings back gold: the farther the post, the more, and 20% over the land road. Only a post with water within 7 tiles is a port. Warships are its enemy.' },
    { name: 'East Indiaman', cls: 'trader', hp: 290, attack: 0, armor: 1, parmor: 4, range: 0, reload: 1, speed: 2.1, sight: 8, cost: { wood: 110, gold: 50 }, time: 22, radius: 0.5, blurb: 'Sails goods from a Dock to a trading post on the coast and brings back gold: the farther the post, the more, and 20% over the land road. Only a post with water within 7 tiles is a port. Warships are its enemy.' },
    { name: 'Steam Freighter', cls: 'trader', hp: 380, attack: 0, armor: 2, parmor: 5, range: 0, reload: 1, speed: 2.5, sight: 8, cost: { wood: 80, gold: 60 }, time: 22, radius: 0.52, blurb: 'Sails goods from a Dock to a trading post on the coast and brings back gold: the farther the post, the more, and 20% over the land road. Only a post with water within 7 tiles is a port. Warships are its enemy.' },
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
  trader: [
    null,
    { name: 'Pack Donkey', cls: 'trader', hp: 80, attack: 0, armor: 0, parmor: 1, range: 0, reload: 1, speed: 1.3, sight: 6, cost: { wood: 60, gold: 40 }, time: 20, radius: 0.32, blurb: 'Carries goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
    { name: 'Ox Cart', cls: 'trader', hp: 110, attack: 0, armor: 0, parmor: 2, range: 0, reload: 1, speed: 1.3, sight: 6, cost: { wood: 70, gold: 40 }, time: 20, radius: 0.4, blurb: 'Carries goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
    { name: 'Covered Wagon', cls: 'trader', hp: 140, attack: 0, armor: 1, parmor: 2, range: 0, reload: 1, speed: 1.45, sight: 7, cost: { wood: 80, gold: 50 }, time: 20, radius: 0.42, blurb: 'Carries goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
    { name: 'Traction Engine', cls: 'trader', hp: 180, attack: 0, armor: 2, parmor: 3, range: 0, reload: 1, speed: 1.65, sight: 7, cost: { wood: 60, gold: 60 }, time: 20, radius: 0.45, blurb: 'Steams goods to a trading post and brings back gold: the farther its Market from the post, the more. Easy prey for cavalry.' },
  ],
};

const DOMAINS: Partial<Record<UnitType, Domain>> = { fisher: 'water', warship: 'water', transport: 'water', cog: 'water', fighter: 'air', bomber: 'air' };
/** Where a unit line goes: on foot, on the water or in the air. */
export const domainOf = (type: UnitType): Domain => DOMAINS[type] ?? 'land';

export const UNIT_TYPES: UnitType[] = ['citizen', 'infantry', 'ranged', 'cavalry', 'siege', 'priest', 'hero', 'fisher', 'warship', 'transport', 'cog', 'fighter', 'bomber', 'trader', 'wagon'];
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
export const AI_MARK = { /** In a Lords of the Land match: reach over the whole map, and the band that goes after a landmark. */ lordsReach: 400, lordsParty: 2, escort: 2, far: 28, townAt: 8, near: 44, rival: 0.75, walk: 150, party: 3, guard: 5, hold: 120, linger: 20,
  /** The walker halts when its escort trails it by more than this many tiles, and goes on once they close up. */
  lead: 9,
  /** Divisors of a landmark's distance (bigger: more worth walking for): by kind, with the cairn when houses are full and the spring when people are hurt. */
  worth: { crag: 1, flint: 1.25, ford: 1.1, spring: 1, springHurt: 1.5, cairn: 1, cairnFull: 1.6,
    /** Times more worth walking for the kind its own people favour (`LANDMARKS.kin`), since it pays half again as much. */
    kin: 1.4,
    /** Soldiers weigh a rival's kept Old Ford this many times more: it quickens the strikes against them, so it is taken before a war. */
    fordRival: 1.6 } };
/** Repairs: restoring a building's whole health costs this share of its price, paid as the hammers work. */
export const REPAIR_SHARE = 0.4;
export const TRADE = { posts: { small: 2, medium: 2, large: 3 } as Record<MapSize, number>, edge: 9, fair: 4, far: 0.3, spacing: 0.4, plaza: 1, reach: 1.8, gold: 0.012, epoch: 0.08, max: 180, ally: 0.25, harbor: { reach: 12, mul: 1.3 }, sea: { reach: 7, mul: 1.2 } };

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
  /** Units besides citizens that may raise it (the War Camp is pitched by foot soldiers, #303). */
  builders?: UnitType[];
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
  dock: { name: 'Dock', size: 3, hp: 1800, cost: { wood: 150 }, time: 35, pop: 0, sight: 6, trains: ['fisher', 'transport', 'warship', 'cog'], drop: ['food'], epoch: 0, shore: true, menu: 'eco', key: 'D', blurb: 'Builds fishing boats, transports, warships and merchant ships, and takes in fish. Build it on the shore.' },
  huntcamp: { name: 'Hunting Camp', size: 2, hp: 500, cost: { wood: 45 }, time: 14, pop: 0, sight: 5, trains: [], drop: ['food'], epoch: 0, menu: 'eco', key: 'N', blurb: 'A drop-off for food, and a small claim on the land round it. Raise it by the herd or a far kill: meat inside your border is safe from wolves, and Drying Racks keep it.' },
  // The Path of Blood (#303): pitched by foot soldiers where the army stands, enemy land too; burns when left alone (`WARCAMP`).
  warcamp: { name: 'War Camp', size: 2, hp: 700, cost: { wood: 100, gold: 40 }, time: 30, pop: 0, sight: 6, trains: ['infantry'], drop: [], epoch: 3, ages: ['ironblood'], builders: ['infantry'], menu: 'mil', key: 'Q', blurb: 'Tents, a stockade and a war standard, pitched by foot soldiers where the army stands, in enemy land too. Trains foot soldiers at the front and holds the land round it, so the army there is fed. Left without soldiers nearby, it burns.' },
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
}

export const NO_MODS: Mods = {
  meleeAttack: 0, rangedAttack: 0, armor: 0, parmor: 0, range: 0, carry: 0, citizenSpeed: 1, wood: 1, mine: 1, farm: 1, forage: 1, hunt: 1,
  buildingHp: 1, buildSpeed: 1, militaryTrain: 1, rangedTrain: 1, cavalrySpeed: 1, infantryHp: 1, infantryArmor: 0, infantryAttack: 0, priest: 1, chant: 1,
  siegeAttack: 1, siegeRange: 0, techCost: 1, wonderCost: 1, extraCitizens: 0, fish: 1, shipHp: 1, shipRange: 0, airSpeed: 1, airHp: 1,
  traderSpeed: 1, tradeGold: 1, relicGold: 1, bogGold: 1, rot: 1, beastWard: 1, portReach: 0, riderSight: 0, consecrate: 0, elmo: 0, telegraph: 0, galvanic: 0, plunder: 0,
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
  /** Learned and worked only while the people stands in this age (a craft of one road); it lapses when they leave and returns if they come back. */
  only?: AgeId;
  /**
   * An heirloom (#224): opened only to a people that has stood in both these ages, in either order and
   * at any time in the match. Unlike `only`, it is kept for good once learned, on whatever road comes next.
   */
  walked?: [AgeId, AgeId];
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
  masonsLodge: { name: 'Masons\' Lodge', at: 'temple', epoch: 2, walked: ['pilgrim', 'reclaimer'], cost: { wood: 200, stone: 150 }, time: 40, mul: { buildSpeed: 1.2, buildingHp: 1.15 }, blurb: 'Heirloom of the Age of Pilgrims and the Age of Reclaimers: the builders who studied the old ruins raise the great churches, and keep their lodge. Buildings go up 20% faster and are 15% sturdier. Kept for good, on any road.', icon: '⛪' },
  survey: { name: 'Survey the Land', at: 'storehouse', epoch: 0, cost: { food: 50, wood: 50 }, time: 15, survey: 'bogIron', blurb: 'Prospectors walk the streams and marshes and answer one question: is there bog iron anywhere in this world? Yes or no; not where, nor how much.', icon: '🧭' },
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
 * at most `leap` tiles from one to the next, and keeps `keep` of its strength at each leap.
 */
/** St. Elmo's Fire (#240): soldiers within `reach` tiles of a Temple in a Tower's field mend `heal` of their health every `every` seconds. */
export const ELMO = { reach: 6, heal: 0.04, every: 2 };

/** Wireless Telegraphy (#240): ships and Docks in a Tower's field see `sight` tiles farther. */
export const TELEGRAPH = { sight: 5 };

/** Galvanic Revival (#240): repairs in a Tower's field cost nothing and go `repair` times as fast; a dug ruin in a field pays `gold` every `every` seconds. */
export const GALVANIC = { repair: 1.5, gold: 25, every: 30 };

export const LIGHTNING = { reach: 10, lit: 135, dark: 75, strikes: 4, leap: 2.5, keep: 0.7 };

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
  egyptians: { name: 'The Nile Flood', icon: '🌊', use: 'eco', blurb: 'The river rises and leaves its black silt: farms work 60% faster.', mul: { farm: 1.6 } },
  greeks: { name: 'The Phalanx', icon: '🛡', use: 'war', blurb: 'Shields locked, spears level: foot soldiers have +2 melee armor and strike +2 harder.', add: { infantryArmor: 2, infantryAttack: 2 } },
  romans: { name: 'The Roman Road', icon: '🛣', use: 'eco', blurb: 'Legions and labourers lay the road: buildings go up 75% faster and citizens walk a quarter faster.', mul: { buildSpeed: 1.75, citizenSpeed: 1.25 } },
  mongols: { name: 'The Yam Relay', icon: '🐎', use: 'war', blurb: 'Fresh mounts waiting at every post: cavalry ride 40% faster and see 3 tiles farther, and citizens walk 15% faster.', add: { riderSight: 3 }, mul: { cavalrySpeed: 1.4, citizenSpeed: 1.15 } },
  chinese: { name: 'The Grand Canal', icon: '🛶', use: 'eco', blurb: 'Barges carry the empire’s grain and silk: every trade trip pays 50% more, and traders travel 30% faster.', mul: { tradeGold: 1.5, traderSpeed: 1.3 } },
  britons: { name: 'The Longbow Volley', icon: '🏹', use: 'war', blurb: 'Every yeoman draws as one: ranged soldiers strike +3 harder, and archery ranges train twice as fast.', add: { rangedAttack: 3 }, mul: { rangedTrain: 0.5 } },
};

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
  { name: 'Spring', icon: '🌱', plant: 1, field: 1, rot: 1, bold: 1, blurb: 'The thaw: berries and herds return.' },
  { name: 'Summer', icon: '☀️', plant: 1.25, field: 1.1, rot: 1.5, bold: 0.85, blurb: 'Berries are heavy, but meat spoils fast.' },
  { name: 'Autumn', icon: '🍂', plant: 1.1, field: 1.15, rot: 1, bold: 1, blurb: 'The harvest, and the beasts grow lean.' },
  { name: 'Winter', icon: '❄️', plant: 0.55, field: 0.75, rot: 0.5, bold: 1.4, blurb: 'Berries fail, meat keeps, and hungry wolves range further.' },
] as const;
/**
 * The clever computer plans for winter (autumn onward, season `from`): it counts no berries (they fail in
 * the cold), wants `fields` more fields and `food` more of its people on food, hunts mammoths and boars with `hunters` fewer citizens (meat
 * keeps in the cold) and, in the winter itself, clears wolves with `pack` fewer soldiers.
 */
/**
 * A bulk order from the player spreads (#266): gatherers fan over nodes of that resource within `reach` tiles
 * of the one clicked, `perNode` to a node; attackers fall on foes within `foe` tiles of the one clicked,
 * `perFoe` to a foe (the clicked one first), the rest on the clicked one. Meat is one carcass, so it isn't spread.
 */
export const SPREAD = { reach: 5, perNode: 2, foe: 4, perFoe: 3 };
export const AI_WINTER = { from: 2, fields: 2, hunters: 3, pack: 1, food: 0.3 };

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
/** Deer: health, speeds, and how far a hunter throws a spear. */
export const DEER = { hp: 8, walk: 0.8, flee: 2.3, spear: 3.5, spearDamage: 4,
  /**
   * Herds drift: a herd keeps its ground `every` seconds, then moves `min`–`max` tiles to a new one, never
   * onto land inside a border (the wild shies from towns, so the easy hunting near home thins as the
   * borders grow) and never further than `range` tiles from where it began. Deer within `herd` tiles of
   * each other at the start move as one.
   */
  herd: 4, every: 150, min: 7, max: 12, range: 26 };
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
  /** A pilgrim town detours to the Age of Sail for an heirloom (#232); off only in `scripts/ai-ab.ts`. */
  detour: boolean;
  /** Whether a landmark's worth follows what the town needs (`AI_MARK.worth`); off, every one counts the same. `scripts/ai-ab.ts` sets it back to compare. */
  worthy: boolean;
}

/**
 * Four honest difficulties (#256, #258). A newcomer picks the one called Normal, so Normal is the fair
 * learning game and Easy is gentler still: a first-timer should reach the Bronze Age alive. The ids keep
 * the behaviour they always had, so saves, replays, rooms and tests stay as they were; only the names
 * moved: `easy` is shown as Normal, `normal` as Hard, `hard` as Expert (the campaign proof's level).
 */
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
export const AI_WEB = { take: 0.6, heir: 1, survey: 22, diggers: 3, nearly: 0.5, patience: 90, close: 0.75, relics: 2, raid: 18, raidNear: 30, riders: 4, read: 0.85, lodge: 1, hulls: 1, bell: 900 };

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


/**
 * Borders (#132 s1): a finished building claims the land within `radius` tiles; a tile belongs to the
 * nearest claimant (ties go to the older building). Shown only, so far; attrition and building limits
 * are later steps of the seed.
 */
export const BORDERS: Partial<Record<BuildingType, number>> = { towncenter: 14, tower: 6, wonder: 9, dock: 5, airfield: 6, huntcamp: 4, warcamp: 3 };

/**
 * War Camps (#303): a finished camp with none of its people's soldiers (land units that fight) within
 * `watch` tiles for `grace` seconds starts to burn, losing `burn` of its full health a second until
 * soldiers come back; a people off the path it belongs to (`BUILDINGS.warcamp.ages`) can't keep one
 * at all, so its camps burn at once. `train`: a camp trains its foot soldiers this much slower than a
 * Barracks (tents, not a drill yard).
 */
export const WARCAMP = { watch: 8, grace: 10, burn: 0.05, train: 1.2 };

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
 * band of `strike` soldiers.
 */
export const AI_BLOOD = { take: 0.6, patience: 480, stay: 360, reach: 40, clear: 11, keep: 3, again: 120, answer: 48, strike: 5 };

export const AI_RAID = { weary: 0.5, calm: 7, fort: 15, pop: 24, flame: 24, stage: 36 };
/**
 * Hunters hunted (#260): between waves a clever computer sends `band` to `most` idle soldiers at a rival citizen
 * its own units see working within `reach` tiles of its home, more than `safe` tiles from any rival Town Center
 * or Tower, with no rival soldier within `guard` tiles and at most `odds` rival citizens per raider within 4
 * tiles of it. The band chases on to the next such citizen within `chase` tiles, goes home when a rival soldier
 * comes within `guard` or after `time` seconds, and sets out again at most every `every` seconds. Seeing no one,
 * a band walks to a rival Hunting Camp it has seen within `reach` (one more than `safe` from the rival's forts)
 * to find who works there, and looks within `look` tiles of the band once it is near.
 */
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
  towerNear: 6 };
