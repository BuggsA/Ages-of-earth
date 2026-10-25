import { COCKLE, COCKLER } from '../sim/data';
import { TIDE_GATE } from '../sim/data';
import { AI_GATE_ANSWER } from '../sim/data';
import { AI_GATE_READ } from '../sim/data';
import { gateReach } from '../sim/tides';
import { isEnemy } from '../sim/world';
import { AGES, BLOOM, LEVIATHANS, MYCELIUM, UNITS, BLOOMERY, HIREHALL, HIVE, INTERCEPT, WILDWOOD, CIVS, CIV_IDS, CHARIOT_FORGE, KEG, MISSION, BEGGARS, SEA_RAID, SPOILS, GALLERY, HOMELANDS, HOUSEHOLD, LONGBOW, NOMAD, LEGION, BLOOD, BUILDINGS, HEMO, HEMOCRAFT, RITE, CALL_UP, KILL_CAMP, ROADS, ROT, SERAI, SILK, STEP_BACK, TRIBUTE, WAY, BATTLE, SHAFT, TAME, GROVE, FIRE, secs, TIDE } from '../sim/data';
import { battlesFor } from '../sim/battles';
import { ageDef } from '../sim/ages';
import { ageOf, backTo, hasWalked, deedProgress, deedsDone, findsOf, mainRoad, prospected, roadKnown, roadsFrom, shutRoads } from '../sim/ages';
import type { AgeId, Building, GameState, Unit } from '../sim/types';
import { R_FISH, R_GOLD, R_STONE } from '../sim/types';
import { isIdleCitizen } from './idle';
import { laterTip, type Opening } from './opening';
import { findResource } from '../sim/units';
import { seasonAt } from '../sim/seasons';
import { tideWaitLeft } from '../sim/tides';
import { bared } from '../sim/tides';
import { R_COCKLE } from '../sim/types';

/**
 * Advice for a first game, one tip at a time in a corner: what to do next, given how the match is
 * going. Each tip shows once; the player can close them for good.
 */

const MERCHANT_ROAD = ROADS.find((r) => r.to === 'merchant')!;
const IRON_ROAD = ROADS.find((r) => r.to === 'iron')!;
const PILGRIM_ROAD = ROADS.find((r) => r.to === 'pilgrim')!;
const SAIL_ROAD = ROADS.find((r) => r.to === 'sail')!;
const ALCHEMY_ROAD = ROADS.find((r) => r.to === 'alchemy')!;
const SAPPER_ROAD = ROADS.find((r) => r.to === 'sapper')!;
const SEA_ROAD = ROADS.find((r) => r.to === 'searaider')!;
const CHARIOTS_ROAD = ROADS.find((r) => r.to === 'chariots')!;
const HUNT_ROAD = ROADS.find((r) => r.to === 'hunt')!;
const GOLDEN_ROAD = ROADS.find((r) => r.to === 'golden')!;
const MISSIONS_ROAD = ROADS.find((r) => r.to === 'missions')!;
const BEGGARS_ROAD = ROADS.find((r) => r.to === 'beggars')!;
const WARBAND_ROAD = ROADS.find((r) => r.to === 'warband')!;
const IRONBLOOD_ROAD = ROADS.find((r) => r.to === 'ironblood')!;
const TOTALWAR_ROAD = ROADS.find((r) => r.to === 'totalwar')!;
const CRAFT_ROAD = ROADS.find((r) => r.to === 'hemocraft')!;
const RITE_ROAD = ROADS.find((r) => r.to === 'bloodrite')!;
/** The ages where blood is drawn: the late Path of Blood and both branches of its fork (#355). */
const BLOOD_AGES: AgeId[] = ['ironblood', 'totalwar', 'hemocraft', 'bloodrite'];
const FAIR_ROAD = ROADS.find((r) => r.to === 'fair')!;
const HORDE_ROAD = ROADS.find((r) => r.from === 'steppe' && r.to === 'horde')!;

interface Tip {
  id: string;
  /** Whether this is the moment for it. */
  when: (s: GameState, me: number) => boolean;
  text: string;
}

const units = (s: GameState, me: number) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === me && e.hp > 0);
const buildings = (s: GameState, me: number) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === me && e.hp > 0);
const has = (s: GameState, me: number, type: Building['type']) => buildings(s, me).some((b) => b.type === type);
/** Whether there are fish within reach of home. */
const waterNear = (s: GameState, me: number) => {
  const p = s.players[me];
  for (let dy = -22; dy <= 22; dy += 2) {
    for (let dx = -22; dx <= 22; dx += 2) {
      const x = Math.floor(p.startX) + dx;
      const y = Math.floor(p.startY) + dy;
      if (x >= 0 && y >= 0 && x < s.w && y < s.h && s.res[y * s.w + x] === R_FISH) return true;
    }
  }
  return false;
};
const secsIn = (s: GameState) => s.tick / 20;
/** Whether the player can see a beast of the wild (#171). */
const sighted = (s: GameState, me: number, kind: 'mammoth' | 'wolf' | 'boar' | 'raider') => s.animals.some((a) => a.kind === kind && s.players[me].vis[Math.floor(a.y) * s.w + Math.floor(a.x)]);

const TIPS: Tip[] = [
  // The people's own loop, a minute in, once the opening card has been read (#555 s8).
  ...CIV_IDS.map((c): Tip => ({ id: `people-loop-${c}`, when: (s, me) => s.players[me].civ === c && secsIn(s) > 70, text: laterTip(c) })),
  { id: 'gather', when: (s) => secsIn(s) > 2, text: 'Drag a box around your <b>citizens</b>, then <b>right-click</b> berry bushes, trees or a deer to gather food and wood.' },
  { id: 'shore', when: (s, me) => s.homeland === 'shore' && secsIn(s) > 8 && !has(s, me, 'dock'), text: `${HOMELANDS.shore.icon} <b>The Shore</b>: few berries, but a rich shoal in the mere by home. Raise a <b>Dock</b> on its bank (<kbd>B</kbd> <kbd>D</kbd>) and train <b>fishing canoes</b>; they feed you while your citizens cut the wood they cost.` },
  { id: 'herds', when: (s) => s.homeland === 'herds' && secsIn(s) > 8, text: `${HOMELANDS.herds.icon} <b>The Herd Plains</b>: deer and a mammoth close by, few berries. Hunt with several citizens, put a <b>Hunting Camp</b> by the kills so meat doesn't spoil on the walk, and follow the herds out when they thin.` },
  { id: 'deepwood', when: (s) => s.homeland === 'wood' && secsIn(s) > 8, text: `${HOMELANDS.wood.icon} <b>The Deep Wood</b>: the woods crowd your Town Center and berries grow thick at their edge, but no herd grazes near. Forage and chop close to home; cut the trees back to make room for fields and houses.` },
  // The turning year (#479): a season ahead of each homeland's lean or fat time.
  { id: 'herds-year', when: (s) => s.homeland === 'herds' && seasonAt(s) === 1, text: `${HOMELANDS.herds.icon} <b>Autumn is coming</b>: your herds will trek out toward the middle of the map until spring. Lay food up, raise a <b>Hunting Camp</b> out by them, or plant fields; and leave a few of each herd alive, for every deer that lives to spring comes home with a calf.` },
  { id: 'shore-year', when: (s) => s.homeland === 'shore' && seasonAt(s) === 2, text: `${HOMELANDS.shore.icon} <b>The autumn run</b>: the shoals are thick, so fish hard now. In winter the mere ices over and boats fish at a third of their pace: lay food up, or have fields ready. But each spring every shoal still in the water grows by what is left in it, and a full one seeds another: move a boat on before its shoal is gone, for a shoal fished out never grows back.` },
  { id: 'wood-year', when: (s) => s.homeland === 'wood' && seasonAt(s) === 3, text: `${HOMELANDS.wood.icon} <b>Deer in the yard</b>: a herd has come in from the cold to shelter in the woods by your town. The berries are failing, so send foragers to hunt while it stays; it leaves in spring.` },
  // Snares in the wood (#485): the Deep Wood's own verb, once the town is going.
  { id: 'snares', when: (s, me) => s.homeland === 'wood' && secsIn(s) > 90 && !has(s, me, 'snare'), text: `${HOMELANDS.wood.icon} <b>Snares</b> (economy menu, <kbd>J</kbd>, 30 wood) go among standing trees and fill with game by themselves, fastest in winter. Lay a line a few tiles apart in woods you won't fell, and <b>right-click</b> one with a citizen to walk the line. Fell the trees round a snare and it starves; a <b>Hunting Camp</b> by the line saves the walk home.` },
  { id: 'vow', when: (s, me) => { const p = s.players[me]; return !!p.way && !p.vowed && p.epoch === WAY.vow; }, text: 'The Bronze Age is the time for a <b>vow</b>: at your Town Center, <b>deepen</b> your Way (its gifts and its price both grow) or <b>turn</b> to another. Once only; pass it by and your Way stays as it is.' },
  { id: 'way', when: (s, me) => s.players[me].epoch <= WAY.until && !s.players[me].way && secsIn(s) > 40, text: 'Choose a <b>Way</b> at your Town Center, and it changes what you do: <b>Hunters</b> pitch free camps at the kill but sow no fields while the herd grazes by home; the <b>Hearth</b> calls its kin in bursts but keeps no hunting camps; the <b>Warband</b> feeds on raids but its bell never rings. Free, once, and the moment passes when you leave the Stone Age. Look at the deer and berries near home, and at how close your rival is.' },
  { id: 'wayHunt', when: (s, me) => s.players[me].way === 'hunt' && s.players[me].epoch === 0, text: '<b>The Hunters\' Way:</b> follow the herds. Raise a <b>Hunting Camp</b> (<kbd>B</kbd> <kbd>N</kbd>) within ' + KILL_CAMP.near + ' tiles of game or a fresh kill and it costs nothing and goes up fast. In the Stone Age you raise no Farm while game lives within ' + KILL_CAMP.home + ' tiles of your Town Center: hunt the home herd out to open the fields, or spare it and range farther.' },
  { id: 'wayHearth', when: (s, me) => s.players[me].way === 'hearth', text: '<b>The Hearth Way:</b> select your Town Center and <b>Call the Kin</b> (<kbd>K</kbd>): two citizens come together, three in <b>winter</b>. Lay food by in autumn for the winter call, or spend it on the Bronze Age.' },
  { id: 'wayWarband', when: (s, me) => s.players[me].way === 'warband' && s.players[me].epoch <= 1, text: '<b>The Warband Way:</b> your soldiers eat by raiding. Send a few to strike a rival\'s <b>Storehouse</b>, <b>Farms</b> or <b>Hunting Camp</b>: every blow carries food home. Your bell never rings, so keep soldiers by home too.' },
  // Mine Shafts (#681): once the open stone and gold near home are gone.
  { id: 'shaft', when: (s, me) => s.players[me].epoch >= 1 && secsIn(s) > 240 && !has(s, me, 'shaft') && !buildings(s, me).some((b) => BUILDINGS[b.type].drop.length && (findResource(s, R_STONE, b.x, b.y, SHAFT.aiNear) >= 0 || findResource(s, R_GOLD, b.x, b.y, SHAFT.aiNear) >= 0)), text: 'No stone or gold left near home? A <b>Mine Shaft</b> (<kbd>B</kbd> <kbd>H</kbd>, 150 wood) digs it from the ground for good. Best over <b>old workings</b> where a deposit was worked out, then beside mountain rock, then plain ground. Right-click it with a citizen and pick the seam.' },
  { id: 'train', when: (s) => secsIn(s) > 25, text: 'More citizens mean a faster economy. Click your <b>Town Center</b> and press <kbd>Q</kbd> to train one (you can queue several).' },
  { id: 'house', when: (s, me) => s.players[me].pop >= s.players[me].cap - 2, text: 'You are nearly out of room. Select a citizen, press <kbd>B</kbd> then <kbd>E</kbd> to build a <b>house</b> (5 more people each).' },
  { id: 'idle', when: (s, me) => secsIn(s) > 60 && s.ents.some((e) => isIdleCitizen(e, me)), text: 'Someone is standing around: press <kbd>.</kbd> to find an idle citizen, or <kbd>Shift</kbd> + <kbd>.</kbd> to select every idle citizen and put them to work.' },
  { id: 'store', when: (s) => secsIn(s) > 110, text: 'Long walks waste time. Build a <b>Storehouse</b> (<kbd>B</kbd> <kbd>S</kbd>) next to the woods or a mine. It also teaches better tools.' },
  { id: 'mammoth', when: (s, me) => sighted(s, me, 'mammoth'), text: 'A <b>mammoth</b>! Its carcass feeds a town for a long while, but it charges when speared. Send <b>five or more</b> citizens together, or put a couple of soldiers in front.' },
  { id: 'boar', when: (s, me) => sighted(s, me, 'boar'), text: 'A <b>wild boar</b> guards that berry patch and charges anyone who comes close. One citizen will lose; send <b>three</b> to spear it, and its carcass pays better than a deer. Or leave the berries and gather elsewhere.' },
  { id: 'raiders', when: (s, me) => sighted(s, me, 'raider'), text: 'A <b>raider camp</b>: a band of spearmen who guard their fire and loot, and they all turn on anyone who comes near. Citizens alone will lose. Bring <b>soldiers</b> (a few clubmen will do) and strike the band together: whoever fells the last raider takes the camp\'s <b>gold, food and wood</b>. Or leave them be, and keep clear.' },
  { id: 'rot', when: (s) => !!s.carcasses?.some((c) => s.tick - c.born > secs(ROT.grace)), text: '<b>Meat spoils.</b> A carcass left too long rots away: put more hands on it, or research <b>Drying Racks</b> at the Town Center to keep it on your own land. Out in the open, turning meat draws <b>wolves</b> from dens nearby.' },
  { id: 'huntcamp', when: (s, me) => !s.scenario && !!s.carcasses?.some((c) => s.tick - c.born > secs(ROT.grace)) && !has(s, me, 'huntcamp'), text: '<b>A Hunting Camp</b> (economy menu, N) takes in food and holds a little land round it: raise one by a far kill or the herd, and the meat is safe from wolves and kept by your Drying Racks.' },
  { id: 'seasons', when: (s) => secsIn(s) > 150, text: '<b>The year turns</b> every 2½ minutes (the icon by the clock). <b>Summer</b> berries are heavy but meat spoils fast; in <b>winter</b> berries fail, meat keeps and hungry wolves range further: hunt, and dry your meat, before the cold.' },
  { id: 'wolves', when: (s, me) => sighted(s, me, 'wolf'), text: '<b>Wolves</b> keep a den out here, often by wild gold, and fall on anyone who comes near. A lone citizen won\'t survive them: send a few soldiers, or a band of citizens, to clear the den first.' },
  { id: 'flock', when: (s, me) => s.animals.some((a) => a.kind === 'sheep' && a.owner === me), text: 'Your <b>flock</b> grazes by the Town Center. <b>Right-click</b> a sheep with citizens to <b>milk</b> it: slow food that comes back. A sheep left unmilked fattens and bears lambs; <kbd>A</kbd> then click one to <b>slaughter</b> it for meat. Each bite crops the grass bare a while: when the flock goes hungry, strike camp (<kbd>J</kbd>) and move on, and the sheep follow.' },
  { id: 'rustle', when: (s, me) => s.animals.some((a) => a.kind === 'sheep' && a.owner !== undefined && a.owner !== me && s.players[me].team !== s.players[a.owner].team && s.players[me].vis[Math.floor(a.y) * s.w + Math.floor(a.x)]), text: 'A rival\'s <b>flock</b>. Sheep with none of their people near can be <b>driven off</b>: stand a rider or a citizen right beside one and it follows them home to your Town Center.' },
  // The legion (#501): a Roman town keeps few citizens, and its foot soldiers are its hands.
  { id: 'legion', when: (s, me) => !!CIVS[s.players[me].civ].legion && secsIn(s) > 30, text: `🦅 <b>The legion builds.</b> A Roman town keeps only ${LEGION.citizens} citizens (three more each epoch): leave them the food and the gold. Raise a <b>Barracks</b> early, and put your foot soldiers to work: select them and <b>right-click a tree or a stone</b> to fell and quarry, or <b>right-click a building site</b> to raise it. A soldier at work still keeps watch and drops his tools for a foe who comes near, but a wave marched off to war leaves the wood-line empty.` },
  // The set line (#501): a British bowman who stands still draws the longbow to the full.
  { id: 'longbow', when: (s, me) => !!CIVS[s.players[me].civ].longbow && secsIn(s) > 60, text: `🏹 <b>The set line.</b> A bowman who stands still ${LONGBOW.after} seconds is <b>set</b>: he reaches ${LONGBOW.range} tiles farther and strikes ${LONGBOW.attack} harder until he takes a step. Pick your ground, plant the line, and let the foe walk onto it. A line that chases is only archers, and horsemen that reach it before it sets ride it down.` },
  // The household tax (#501): a Chinese town's gold is owed by its houses, not dug.
  { id: 'household', when: (s, me) => !!CIVS[s.players[me].civ].household && secsIn(s) > 30, text: `🏮 <b>The household tax.</b> Nobody here mines gold: every <b>house</b> pays it every ${HOUSEHOLD.every} seconds, in proportion to how full your town is, and <b>more for each house on its street</b> (within ${HOUSEHOLD.reach} tiles, a Market counting as two). Build houses in lanes close together and keep the town full of people; hover the gold to see the tax a minute. A rival who <b>burns your houses</b> takes ${HOUSEHOLD.raid} gold from the treasury for each, so guard the streets.` },
  // Born on the move (#501): a Mongol camp is on wagons from the first minute, with no fields and no quarry.
  { id: 'nomad', when: (s, me) => !!CIVS[s.players[me].civ].nomad && secsIn(s) > 20, text: `🐎 <b>Born on the move.</b> Your camp is on wagons: select the Town Center or a House and <b>strike camp</b> (<kbd>J</kbd>), drive the wagon to fresh grass, and <b>pitch</b> it there. Your <b>flock</b> walks with the camp: milk it, raise lambs at the Town Center, and each House keeps ${NOMAD.house} more sheep. You till no fields and quarry no stone, ever: the grass is your field, so move when the flock goes hungry. The <b>Plow</b> and <b>Irrigation</b> speed your milking instead.` },
  // The tower line (2026-10-24): a raw Watch Tower is a lookout; it is raised at the tower itself.
  { id: 'towerLine', when: (s, me) => buildings(s, me).some((b) => b.type === 'tower' && b.built && !b.level), text: `🗼 <b>A tower grows.</b> A new Watch Tower is a lookout more than a fort: its arrows are light and its walls thin. Select it and raise it (<kbd>Q</kbd>) to a <b>Guard Tower</b>, then a <b>Keep</b> (Middle Ages) and a <b>Bastion</b> (Gunpowder Age): each step is paid for that tower alone, harder arrows and sturdier walls, so choose which towers are worth the stone. Rams, siege and a crowd of soldiers still bring a tower down, the sooner the less it has learned.` },
  { id: 'nomadStone', when: (s, me) => !!CIVS[s.players[me].civ].nomad && s.players[me].epoch >= 1, text: `🐎 <b>Stone is taken, not cut.</b> A Mongol camp quarries none: buy it at a <b>Market</b>, or ride into a rival's land and <b>hold your riders still</b> there. Each takes ${CIVS.mongols.add!.tribute} gold a second as tribute and ${NOMAD.stone} stone for every gold, up to ${TRIBUTE.most} riders a rival. Spears and towers answer them, so pick the edge of their land they guard least.` },
  { id: 'army', when: (s) => secsIn(s) > 200, text: 'Rivals will come. Build a <b>Barracks</b> (<kbd>V</kbd> <kbd>B</kbd>) and train soldiers. Infantry beat cavalry, archers beat infantry, cavalry beat archers.' },
  { id: 'farm', when: (s, me) => secsIn(s) > 260 && !has(s, me, 'farm') && !CIVS[s.players[me].civ].nomad, text: 'Berries and deer run out. <b>Farms</b> (<kbd>B</kbd> <kbd>F</kbd>) give food forever; build them near your Town Center.' },
  {
    id: 'epoch',
    when: (s, me) => {
      const p = s.players[me];
      const road = mainRoad(p);
      if (!road) return false;
      const c = road.cost;
      return (p.res.food >= (c.food ?? 0)) && (p.res.gold >= (c.gold ?? 0)) && (p.res.wood >= (c.wood ?? 0)) && (p.res.stone >= (c.stone ?? 0));
    },
    text: 'You can afford the next epoch! Select the Town Center and press <kbd>W</kbd>. New epochs bring stronger units and new buildings.',
  },
  { id: 'bell', when: (s, me) => s.players[me].alert > 0 && s.tick - s.players[me].alert < 40, text: 'Under attack? Ring the <b>town bell</b> (Town Center, <kbd>R</kbd>): citizens shelter inside and the Town Center shoots more arrows. <kbd>T</kbd> sends them back to work.' },
  { id: 'heart', when: (s, me) => !s.scenario && s.mode !== 'regicide' && s.players[me].epoch >= 1 && buildings(s, me).filter((b) => b.type === 'towncenter').length === 1 && secsIn(s) > 300, text: 'Your Town Center is your <b>heart</b>: if the last one falls you have 45 seconds to lay a new foundation, or your people is lost. A second Town Center (<kbd>B</kbd>) is cheap insurance.' },
  { id: 'forge', when: (s, me) => s.players[me].epoch >= 1 && secsIn(s) > 30 && !has(s, me, 'forge'), text: `A <b>Forge</b> (<kbd>V</kbd> <kbd>R</kbd>) makes every soldier hit harder and take less damage. The <b>${BUILDINGS.market.name}</b> trades surplus goods for gold.` },
  // The tide of battle (#606): the first time a fight's bar shows.
  { id: 'tide', when: (s, me) => units(s, me).some((u) => s.tick - u.hurt < secs(BATTLE.recent)) && battlesFor(s, me).length > 0, text: 'The bar over a fight is its <b>tide</b>: your strength against what you can see of the foe’s. <b>Click it</b> to pick up your fighters there, to pull back before a rout or push on. If a fight turns against you out of sight, a horn sounds: <kbd>Space</kbd> looks.' },
  { id: 'queue', when: (s) => secsIn(s) > 420, text: 'Hold <kbd>Shift</kbd> while giving orders to queue them: walk here, then there, then attack. <kbd>,</kbd> selects your whole army.' },
  { id: 'cameraBookmarks', when: (s) => secsIn(s) > 300, text: 'Guarding two fronts? Save this camera view with <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>1</kbd>–<kbd>4</kbd>, then jump back with <kbd>Shift</kbd> + <kbd>1</kbd>–<kbd>4</kbd>. Your selected troops keep their orders.' },
  { id: 'scoutFlags', when: (s) => secsIn(s) > 240, text: 'Planning an ambush or revisiting a ruin? <b>Ctrl + right-click</b> explored ground or the minimap to plant a golden Scout Flag. Add <b>Shift</b> for a red danger flag; repeat to remove. Up to six, without ordering your units.' },
  {
    id: 'relic',
    when: (s, me) => s.players[me].epoch >= 1 && s.relics.some((r) => !r.carrier && !r.temple && s.players[me].seen[Math.floor(r.y) * s.w + Math.floor(r.x)] === 1),
    text: 'A golden <b>relic</b> glints out there (a gold diamond on the map). Build a <b>Temple</b> (<kbd>B</kbd> <kbd>Y</kbd>), then select a <b>priest</b> and right-click the relic: carried home, it brings in gold. Keep every relic long enough and you win.',
  },
  {
    id: 'landmarks',
    when: (s, me) => !!s.landmarks?.length && (secsIn(s) > 75 || s.landmarks.some((m) => s.players[me].seen[Math.floor(m.y) * s.w + Math.floor(m.x)] === 1)),
    text: 'Out between the towns stand <b>landmarks</b> (grey triangles on the map, once found): a <b>Sacred Spring</b> that mends, a <b>Lookout Crag</b> that sees far, an <b>Ancestors\' Cairn</b> that makes room for more people, a <b>Flint Scatter</b> that speeds axes and picks, a <b>Sacred Grove</b> where your priests chant faster, an <b>Old Ford</b> that quickens the march of your soldiers. Right-click one with anyone, a citizen will do, and keep rivals off it to claim it and the land round it. Rivals can take it back the same way, so a fight over it may come before any army does.',
  },
  {
    id: 'tidings',
    when: (s, me) => !!s.players[me].tiding,
    text: '<b>Tidings at the fire</b>: twice in the Stone Age someone or something comes to your camp. Pay the price, or let it pass. Leave the card and it fades with the second answer, so a storm or a fever is left to chance.',
  },
  {
    id: 'ruins',
    when: (s, me) => !!s.ruins?.some((r) => r.by < 0 && s.players[me].seen[Math.floor(r.y) * s.w + Math.floor(r.x)] === 1),
    text: 'You have found <b>ancient ruins</b> (two pale columns on the map). Select a few <b>citizens</b> and right-click them to dig: whoever finishes the dig takes what lies beneath, a hoard of gold, lost knowledge, an old map of the land or a relic. Excavation can also reveal a new road for your people. It\'s a long way from home, so send an escort.',
  },
  {
    id: 'salvage',
    when: (s, me) => !!s.rubble?.length && !!ageDef(s.players[me]).salvage,
    text: 'A building has fallen and left <b>rubble</b> (a heap of stone and beams). In the Age of Reclaimers, select <b>citizens</b> and right-click it to <b>strip</b> it: half the building\'s price goes into your stock. Rubble of your own is a choice: strip it now, or leave the foundations to raise the building again for 40% of the price. A rival\'s rubble lies where the fighting was, so send an escort.',
  },
  {
    id: 'orePost',
    when: (s, me) => s.players[me].epoch >= 1 && s.ents.some((e) => e.kind === 'unit' && e.owner === me && e.type === 'trader') && s.posts.some((t) => !!t.sells),
    text: 'This world lacks a <b>key ore</b>, but a <b>trading post</b> sells it (its heart on the map is the ore\'s colour). Select <b>traders</b> and press <b>Buy</b>: they pay gold at the post for each load and carry it home to the Market, where it counts as mined ore toward the road it opens (salt: the Age of Merchants; blood-iron: Iron and Blood). Every load anyone buys makes the next dearer, and a trader felled on the road drops its load for anyone to carry off.',
  },
  {
    id: 'cache',
    when: (s, me) => !!s.caches?.some((c) => s.players[me].vis[Math.floor(c.y) * s.w + Math.floor(c.x)] === 1),
    text: '<b>Key ore</b> lies spilled on the ground (a split sack of salt, saltpetre or blood-iron). Salt, saltpetre and blood-iron are kept in your <b>Town Center</b> and <b>Storehouses</b>: when one falls, half of what you hold spills out, shared across the stores standing, and a fallen digger drops its basket. Select <b>citizens</b> and right-click the ore to carry it home, anyone\'s: what you carry home counts toward your ore doors, and what you lose sets yours back. Assay the Holdings shows who holds the most, and where it spills.',
  },
  {
    id: 'trade',
    when: (s, me) => s.players[me].epoch >= 1 && s.posts.some((t) => s.players[me].seen[Math.floor(t.y) * s.w + Math.floor(t.x)] === 1),
    text: 'You have found a <b>trading post</b> (a camel on the map). Build a <b>Market</b> (<kbd>B</kbd> <kbd>M</kbd>), train <b>traders</b> there (<kbd>T</kbd>) and right-click the post: they bring back gold every trip, more the farther the Market. Guard the road: cavalry love to raid it.',
  },
  {
    id: 'merchants',
    // A side road (#37) just came into view: the Market is up while the Bronze Age lasts.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'bronze' && roadsFrom(p).some((r) => r.to === 'merchant' && roadKnown(s, p, r) && (deedProgress(p, r)?.have ?? 0) < r.deed!.n);
    },
    text: `There is another road out of the Bronze Age. Bring home ${MERCHANT_ROAD.deed!.n} gold by trade, and the Town Center (<kbd>Y</kbd>) can take your people into the <b>${AGES.merchant.name}</b> instead of the Middle Ages: the Market hires soldiers for gold, trade pays more, levies cost more. The road shuts once you advance; stepping back (<kbd>Z</kbd>) reopens it.`,
  },
  {
    id: 'survey',
    // Some worlds hold bog iron, salt, saltpetre, blood-iron (#39, #356): a Prospector's Lodge answers, while the Stone Age lasts (#562).
    when: (s, me) => !s.scenario && ageOf(s.players[me]) === 'stone' && secsIn(s) > 140 && !has(s, me, 'prospector') && !prospected(s.players[me]),
    text: `Some worlds hold <b>bog iron</b>, salt, saltpetre or blood-iron, and some don't; some ages open only with them. A <b>${BUILDINGS.prospector.name}</b> (<kbd>B</kbd> <kbd>${BUILDINGS.prospector.key}</kbd>, a little food and wood) answers yes or no for each, never where.`,
  },
  {
    id: 'find',
    // A find (#588) lies unclaimed near home and the player has seen its tile.
    when: (s, me) => !s.scenario && secsIn(s) > 60 && !!s.finds?.some((f) => f.by < 0 && f.near === me && s.players[me].seen[Math.floor(f.y) * s.w + Math.floor(f.x)] === 1),
    text: 'Something odd stands a short walk from home: a wreck, a cairn, a salt lick, a fallen star, a hermit\'s shrine or a hunters\' stash (a ringed dot on the minimap). Send a <b>citizen</b> to stand on it: it pays a little, and tells you what this land holds.',
  },
  {
    id: 'chart',
    // A lodge in the Bronze Age (#565): Chart the Veins marks where each key resource lies.
    when: (s, me) => !s.scenario && s.players[me].epoch >= 1 && has(s, me, 'prospector') && !s.players[me].chart && findsOf(s).some((k) => k !== 'ruin'),
    text: 'Your <b>Prospector\'s Lodge</b> can <b>Chart the Veins</b> (🗺️) now: every patch of bog iron, salt, saltpetre and blood-iron, and every ruin, marked on your map under the fog. Know where to dig, and where your rival will.',
  },
  {
    id: 'assay',
    // A charted lodge in the Middle Ages (#568): Assay the Holdings shows who digs where and what each people holds.
    when: (s, me) => !s.scenario && s.players[me].epoch >= 2 && !!s.players[me].chart && !s.players[me].techs.includes('assay'),
    text: 'Your <b>Prospector\'s Lodge</b> can <b>Assay the Holdings</b> (⚖️): see whose citizens dig each charted vein, and how much of each rare ore every people holds. Know a rival\'s road before it gets there.',
  },
  {
    id: 'iron',
    // The survey said yes, and the Stone Age lasts: the road to the Iron Age is in view.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'stone' && roadKnown(s, p, IRON_ROAD) && (deedProgress(p, IRON_ROAD)?.have ?? 0) < IRON_ROAD.deed!.n;
    },
    text: `This world holds bog iron: rust-red ore in marsh mud (look on the minimap). Dig ${IRON_ROAD.deed!.n} of it, and the Town Center (<kbd>Y</kbd>) can take your people into the <b>${AGES.iron.name}</b> instead of the Bronze Age: cheap, hard-hitting foot soldiers and iron tools, but no horses until the Middle Ages.`,
  },
  {
    id: 'pilgrims',
    // Relics open a door (#49): a Temple stands while the Middle Ages last.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'middle' && roadKnown(s, p, PILGRIM_ROAD) && !deedsDone(p, PILGRIM_ROAD, s);
    },
    text: `There is a turning off the Middle Ages. Carry relics to your Temple: once they have brought in ${PILGRIM_ROAD.deed!.n} gold, the Town Center (🔀) can turn your people into the <b>${AGES.pilgrim.name}</b>: relics pay double and priests come cheap, but no siege engines. The road shuts once you advance.`,
  },
  {
    id: 'consecrate',
    // Faith takes the walls (#209): a pilgrim people with priests to send.
    when: (s, me) => ageOf(s.players[me]) === 'pilgrim' && s.ents.some((e) => e.kind === 'unit' && e.owner === me && e.type === 'priest'),
    text: 'A pilgrim people takes walls by faith. Select several priests and right-click a rival\'s <b>tower, gate or Temple</b>: they chant it over together, faster with every voice, and a Temple brings its relics. Soldiers sheltering inside slow them, and towers shoot back, so keep an escort near. Town Centers and Wonders never turn.',
  },
  {
    id: 'alchemy',
    // The first gateway (#577): saltpetre in this world, known of, and a Siege Workshop standing in the Middle Ages.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'middle' && roadKnown(s, p, ALCHEMY_ROAD);
    },
    text: `This world holds saltpetre. Mine ${ALCHEMY_ROAD.vein!.n} of it, and the Town Center (🔀) can turn your people into the <b>${AGES.alchemy.name}</b>: your Siege Workshops become mills that grind the saltpetre in store into powder kegs, but build no engines, and soldiers train slower. Weak on its own: it is the only road to the <b>${AGES.sapper.name}</b>, where kegs blow walls and towers open.`,
  },
  {
    id: 'mills',
    // In Alchemy: the mills and the climb they are for.
    when: (s, me) => ageOf(s.players[me]) === 'alchemy',
    text: `Every Siege Workshop is a powder mill now: each grinds a keg from ${KEG.ore} saltpetre in store every ${KEG.time} seconds (🧨 at the top). Once ${SAPPER_ROAD.deed!.n} are ground, the Town Center can climb to the <b>${AGES.sapper.name}</b>, but no keg is ground there: stay longer for more powder, or go sooner and give a rival less time to punish a town without engines.`,
  },
  {
    id: 'sappers',
    // In the Sappers with kegs to lay.
    when: (s, me) => ageOf(s.players[me]) === 'sapper' && (s.players[me].kegs ?? 0) > 0,
    text: `Select citizens or foot soldiers and press <kbd>K</kbd>, then click a rival building: each carries a keg to its foot and lights it. ${KEG.fuse} seconds later it blows, wrecking every rival building within ${KEG.reach} tiles. A rival who reaches a burning keg stamps it out, so lay it where your army holds the ground, or where nobody is looking.`,
  },
  {
    id: 'sail',
    // A Dock stands while the Middle Ages last: the sea is a road too.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'middle' && roadKnown(s, p, SAIL_ROAD) && !deedsDone(p, SAIL_ROAD, s);
    },
    text: `The sea is a road. Land ${SAIL_ROAD.deed!.n} fish with your boats, and the Town Center (🔀) can turn your people into the <b>${AGES.sail.name}</b>: fishing is half again as quick, ships cost less and have sturdier hulls, but a sea people raises no walls or gates (the fleet is the wall). The road shuts once you advance.`,
  },
  {
    id: 'warband',
    // The Path of Blood (#299): a Middle Ages town with a Barracks and blood already shed.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'middle' && roadKnown(s, p, WARBAND_ROAD) && (p.stats.slain ?? 0) > 0 && !deedsDone(p, WARBAND_ROAD, s);
    },
    text: `War can be a way of life. Slay ${WARBAND_ROAD.deed!.n} enemy units and the Town Center (🔀) can set your people on the <b>Path of Blood</b>, into the <b>${AGES.warband.name}</b>: soldiers train faster and every enemy slain earns plunder, carried in the killer\'s pack until it is walked home, but no traders, and the fields yield less. The road shuts once you advance.`,
  },
  {
    id: 'plunder',
    when: (s, me) => ageOf(s.players[me]) === 'warband',
    text: 'Your warband lives on plunder, but it is carried: each kill fills the killer\'s pack (💰 in its panel), and the gold is yours only once that soldier walks home to a Town Center or Barracks; a laden soldier felled in the field hands its pack to the rival. And a rival citizen who falls is taken, not lost: a <b>thrall</b> rises where it fell, yours, to work your fields (up to 8; it never builds). Raid the rival\'s workers, and guard your own.',
  },
  {
    id: 'crossing',
    // The first crossing (#585): a people that has walked one of its two sibling ages, back in the Middle Ages with a Dock.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'middle' && roadKnown(s, p, SEA_ROAD) && !SEA_ROAD.crossing!.every((a) => hasWalked(p, a));
    },
    text: `A crossing: your people has walked one of the <b>${AGES.warband.name}</b> and the <b>${AGES.sail.name}</b>. Walk the other too, then come back to the Middle Ages, and the Town Center (🔀) can turn your people into the <b>${AGES.searaider.name}</b>: the war-host raids from the ships. The way back is the price.`,
  },
  {
    id: 'searaider',
    when: (s, me) => ageOf(s.players[me]) === 'searaider',
    text: `Sea-raiders bank their plunder by ship. A kill fills the killer's pack (💰), and the pack goes into the hold of a transport the soldier comes within ${SPOILS.bank} tiles of, or rides in (up to ${SEA_RAID.hold} gold a ship). The ship banks its hold at a Dock of yours, within ${SEA_RAID.dock} tiles. A Town Center or Barracks banks nothing, and a rival who sinks a laden ship takes the hold: land, raid, re-embark, sail home.`,
  },
  {
    id: 'golden-heard',
    // The Golden Age (#703): heard of by a people that has walked two side ages.
    when: (s, me) => {
      const p = s.players[me];
      return roadKnown(s, p, GOLDEN_ROAD) && !hasWalked(p, 'golden');
    },
    text: `✨ Your people has lived ${GOLDEN_ROAD.lives!.seen} lives, and hears of a <b>${AGES.golden.name}</b>: walk ${GOLDEN_ROAD.lives!.n} side ages in all (go back a step and take another road), and from the Gunpowder Age every one of them wakes at once, with none of their prices, for a few minutes. Every age you walk is one more thread, and a minute more of gold.`,
  },
  {
    id: 'golden',
    when: (s, me) => !!ageDef(s.players[me]).golden,
    text: `✨ <b>The ${AGES.golden.name}.</b> Everything your people learned on its road works at once: build what those ages built, train what they trained, and use what they did, with none of their doors shut. It will not last: spend it. Click empty ground to see the clock. When it ends you wake in the Gunpowder Age, and the road never opens again.`,
  },
  {
    id: 'golden-rival',
    when: (s, me) => s.players.some((o) => o.id !== me && !!ageDef(o).golden),
    text: `✨ A rival is in its <b>${AGES.golden.name}</b>: every way of life it has walked, at once, and nothing shut. It ends on its own in a few minutes, and then every thread sleeps: hold your walls, and strike when the gold runs out.`,
  },
  {
    id: 'crossing-chariots',
    // The third crossing (#555 s12): a people that has walked the Iron Age or the Steppe, back in the Stone Age.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'stone' && roadKnown(s, p, CHARIOTS_ROAD) && !CHARIOTS_ROAD.crossing!.every((a) => hasWalked(p, a));
    },
    text: `A crossing: your people has walked one of the <b>${AGES.iron.name}</b> and the <b>${AGES.steppe.name}</b>. Walk the other too, then come back to the Stone Age (a step back), and the Town Center (🔀) can turn your people into the <b>${AGES.chariots.name}</b>: riders sharpened by the marsh's iron.`,
  },
  {
    id: 'chariots',
    when: (s, me) => ageOf(s.players[me]) === 'chariots',
    text: `Your riders are <b>chariots</b>. Every ${CHARIOT_FORGE.per} bars of bog iron dug past the first ${CHARIOT_FORGE.base} sharpen each one by ${CHARIOT_FORGE.attack}, up to ${CHARIOT_FORGE.most}: keep citizens in the marsh. They beat archers and men on foot with no spears, but a firm line of spearmen beats them, and you have no archers, walls or gates to answer with.`,
  },
  {
    id: 'crossing-hunt',
    // The fifth crossing (#801): a people that has walked the Wild or the Steppe, back in the Stone Age.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'stone' && roadKnown(s, p, HUNT_ROAD) && !HUNT_ROAD.crossing!.every((a) => hasWalked(p, a));
    },
    text: `A crossing: your people has walked one of the <b>${AGES.wild.name}</b> and the <b>${AGES.steppe.name}</b>. Walk the other too, then come back to the Stone Age (a step back), and the Town Center (🔀) can turn your people into the <b>${AGES.hunt.name}</b>: the pack and the camp ride as one.`,
  },
  {
    id: 'hunt',
    when: (s, me) => ageOf(s.players[me]) === 'hunt',
    text: `Every rider from a Stable comes out with a <b>War Wolf</b> at its heel (if there is room for it in your houses), and the wolves follow your wagons when the camp moves (<b>J</b> packs a Town Center or House). Raise a <b>${BUILDINGS.huntcamp.name}</b> (${BUILDINGS.huntcamp.key}) and train <b>Hawks</b> there: cheap birds that fly over walls, woods and water and see far, with no weapon. Right-click ground to send one. Archers and towers can still shoot a hawk down. You till no fields and raise no walls, and riders cost a fifth more.`,
  },
  {
    id: 'crossing-missions',
    // The second crossing (#555 s12): a people that has walked the Pilgrims or the Sail, back in the Middle Ages.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'middle' && roadKnown(s, p, MISSIONS_ROAD) && !MISSIONS_ROAD.crossing!.every((a) => hasWalked(p, a));
    },
    text: `A crossing: your people has walked one of the <b>${AGES.pilgrim.name}</b> and the <b>${AGES.sail.name}</b>. Walk the other too, then come back to the Middle Ages, and the Town Center (🔀) can turn your people into the <b>${AGES.missions.name}</b>: priests take ship and raise Missions on far shores. The way back is the price.`,
  },
  {
    id: 'missions',
    when: (s, me) => ageOf(s.players[me]) === 'missions',
    text: `Select a priest and press <b>O</b> to raise a <b>Mission</b> on a shore in your own land or no one's. It holds the land round it, trains priests, and every ${MISSION.every} seconds pays a tithe that grows with its distance from your Town Center (up to ${MISSION.cap} gold, for your ${MISSION.most} farthest). It is only a chapel: nothing in it shoots, and a rival who reaches it razes it. Carry a priest across the water in a transport.`,
  },
  {
    id: 'gallery',
    when: (s, me) => ageOf(s.players[me]) === 'sapper',
    text: `Raise a <b>${BUILDINGS.gallery.name}</b> (<b>P</b>) near the rival's walls. A keg laid within ${GALLERY.mine} tiles of it is mined: no rival can stamp out its fuse. And it listens: a rival keg laid within ${GALLERY.listen} tiles of one is countermined. Kept (<b>J</b>) it goes on listening on any road. A rival can raze it.`,
  },
  {
    id: 'stockade',
    when: (s, me) => ageOf(s.players[me]) === 'warband',
    text: `Raise a <b>${BUILDINGS.stockade.name}</b> (<b>X</b>) where the host fights. A laden soldier within ${SPOILS.bank} tiles banks its pack there at once, so it need not walk home with it and is not felled with it, but the quartermaster keeps a quarter (${Math.round(SPOILS.stockadeCut * 100)}% reaches you). It arms foot soldiers a tenth cheaper, and kept (<b>J</b>) it goes on doing so on any road. A rival can raze it.`,
  },
  {
    id: 'bloomery',
    when: (s, me) => ageOf(s.players[me]) === 'iron' && s.bogIron === true,
    text: `Raise a <b>${BUILDINGS.bloomery.name}</b> (<b>I</b>) beside the bog. Bog iron your diggers drop there is smelted hard: every bar counts ${BLOOMERY.smelt} times toward your spearmen's edge, and the hearth arms foot soldiers on the spot. Press <b>J</b> on it before you leave the Iron Age and it goes on arming spearmen at the Iron Age's price on any road. A rival who wants your iron must come to the marsh.`,
  },
  {
    id: 'hirehall',
    when: (s, me) => ageOf(s.players[me]) === 'merchant' && s.players[me].epoch >= 2,
    text: `Hired swords draw wages. A <b>${BUILDINGS.hirehall.name}</b> (<b>V</b>, ${BUILDINGS.hirehall.cost.wood} wood ${BUILDINGS.hirehall.cost.gold} gold) signs them instead for a one-off price, ${HIREHALL.dear} times the Market's: no payday, none walks off, and it signs cavalry too. Cheap and paid by the day, or dear and yours. Press <b>J</b> on it before you leave the age and it goes on signing swords at that price.`,
  },
  {
    id: 'crossing-beggars',
    // The fourth crossing (#783): a people that has walked the Dykes or the Sail, back in the Middle Ages.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'middle' && roadKnown(s, p, BEGGARS_ROAD) && !BEGGARS_ROAD.crossing!.every((a) => hasWalked(p, a));
    },
    text: `A crossing: your people has walked one of the <b>${AGES.dykes.name}</b> and the <b>${AGES.sail.name}</b>. Walk the other too, then come back to the Middle Ages, and the Town Center (🔀) can turn your people into the <b>${AGES.beggars.name}</b>: your warships board a rival's ships instead of sinking them, and cut its dykes from the sea.`,
  },
  {
    id: 'beggars',
    when: (s, me) => ageOf(s.players[me]) === 'beggars',
    text: `Send your warships at a rival's cogs, fishing boats, barges and warships: one beaten down strikes its colours and <b>sails for you</b>, with ${Math.round(BEGGARS.left * 100)}% of its timbers and whatever it carries (a transport with soldiers aboard sinks instead). Your ships also strike a rival's <b>dykes</b> and sluices as hard as siege does: cut a bank that holds back polder and the sea takes the fields behind it. Keep a Dock as you leave, and ships beaten down within ${BEGGARS.haven} tiles of it are still taken.`,
  },
  {
    id: 'ironblood',
    // The Path of Blood goes on (#303): a people that walked the Warband, now in the Gunpowder Age.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'gunpowder' && roadKnown(s, p, IRONBLOOD_ROAD);
    },
    text: `The Path of Blood goes on. With ${IRONBLOOD_ROAD.deed!.n} gold of plunder taken, the Town Center (🔀) can turn your people into the <b>${AGES.ironblood.name}</b>: your foot soldiers pitch War Camps where the army stands, even in enemy land, and the plunder grows. The road shuts once you advance.`,
  },
  {
    id: 'warcamp',
    when: (s, me) => ageOf(s.players[me]) === 'ironblood' && !has(s, me, 'warcamp'),
    text: 'Select foot soldiers and press <b>B</b> to pitch a <b>War Camp</b> where they stand, in enemy land too. It trains foot soldiers at the front and holds the land round it, so your army there is fed. Keep soldiers by it: a camp left alone burns.',
  },
  {
    id: 'campdeed',
    // The way to Total War (#313): a camp stands, and the soldiers it trains are the next step's deed.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'ironblood' && has(s, me, 'warcamp') && (p.stats.campTrained ?? 0) < TOTALWAR_ROAD.deed!.n;
    },
    text: `Train foot soldiers at your War Camps, not only at home: ${TOTALWAR_ROAD.deed!.n} trained at the front open the last step of the Path of Blood, the <b>${AGES.totalwar.name}</b>, once your people reaches the Industrial Age.`,
  },
  {
    id: 'totalwar',
    // The last step (#313): a people that walked Iron and Blood, now in the Industrial Age.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'industrial' && roadKnown(s, p, TOTALWAR_ROAD);
    },
    text: `The Path of Blood has one step left. With ${TOTALWAR_ROAD.deed!.n} soldiers trained at War Camps, the Town Center (🔀) can turn your people into the <b>${AGES.totalwar.name}</b>: War Camps return as muster grounds, where citizens are called to arms, and the plunder is the deepest of the path.`,
  },
  {
    id: 'drainrig',
    // The Drain Rig (#355 s1): a late age of the Path of Blood, until the player has raised one.
    when: (s, me) => BLOOD_AGES.includes(ageOf(s.players[me])) && !has(s, me, 'drainrig'),
    text: `The Path of Blood has one more thing to take from the fallen. A <b>Drain Rig</b> (military buildings) draws a fifth of the price of every living enemy who falls within ${BLOOD.reach} tiles as <b>blood</b> (🩸 in the top bar), and its levy (<b>C</b>) gives the citizens beside it for ${BLOOD.levy} blood each. Machines and ships bleed nothing. Blood raises <b>Blood Towers</b> and, in Total War, grafts soldiers.`,
  },
  {
    id: 'bloodtower',
    // The Blood Tower (#355 s3): once there is blood to raise one with.
    when: (s, me) => BLOOD_AGES.includes(ageOf(s.players[me])) && (s.players[me].blood ?? 0) >= (BUILDINGS.bloodtower.blood ?? 0) && !has(s, me, 'bloodtower'),
    text: `You hold enough blood for a <b>Blood Tower</b> (military buildings, <b>L</b>): paid for once, it tears the living for three times a Watch Tower's harm, but siege, ships and aircraft barely notice it. Raise it where infantry and riders will come; meet machines with machines.`,
  },
  {
    id: 'transfusion',
    // Hemocraft (#355 s3): Total War with blood in store, until the player has a Transfusion Station.
    when: (s, me) => ageOf(s.players[me]) === 'totalwar' && (s.players[me].blood ?? 0) >= HEMO.cost && !has(s, me, 'transfusion'),
    text: `Blood can remake your soldiers. A <b>Transfusion Station</b> (military buildings, <b>T</b>) grafts the soldiers you send inside, ${HEMO.cost} blood each: faster, harder-hitting, self-mending and deaf to priests, shrugging off blades and arrows. But machines hit them harder, and a graft runs dry ${HEMO.last} seconds from every Station: guard the Stations, or the army crashes.`,
  },
  {
    id: 'fork',
    // The fork at the end of the Path of Blood (#355 s2): in Total War, or back in the Industrial Age after it, before either branch is taken.
    when: (s, me) => {
      const p = s.players[me];
      return (ageOf(p) === 'totalwar' || (ageOf(p) === 'industrial' && hasWalked(p, 'totalwar'))) && !hasWalked(p, 'hemocraft') && !hasWalked(p, 'bloodrite');
    },
    text: `Past Total War the Path of Blood forks, and you may take only one branch. Make peace, and from the Industrial Age the Town Center (🔀) can turn to <b>${AGES.hemocraft.name}</b> (${CRAFT_ROAD.deed!.n} soldiers grafted, a Siege Workshop standing): Drain Rigs bleed the living who stand near them. Or to <b>${AGES.bloodrite.name}</b> (${RITE_ROAD.deed!.n} citizens given to the levy, a Temple standing): every Temple becomes an altar that mends your own with blood.`,
  },
  {
    id: 'hemocraft',
    when: (s, me) => ageOf(s.players[me]) === 'hemocraft',
    text: `Your Drain Rigs drain now: every living enemy standing within ${HEMOCRAFT.drain} tiles of one bleeds ${HEMOCRAFT.bleed} health a second into your store. Raise rigs where the enemy must come, behind Blood Towers, and graft soldiers for ${HEMO.cost * HEMOCRAFT.graft} blood. Your rival's answer will be machines: siege, ships and aircraft bleed nothing, so keep guns of your own for them.`,
  },
  {
    id: 'bloodrite',
    when: (s, me) => ageOf(s.players[me]) === 'bloodrite',
    text: `Every Temple is an altar now. Enemies who fall within ${BLOOD.reach} tiles of one give up their blood, and the altar spends it to mend your own within ${RITE.reach} tiles. Fight near your Temples, keep the store full with a Drain Rig and the levy, and send cheaper, quicker priests with the army. Select one and press <b>X</b> to sacrifice an enemy that bleeds (it dies, and ${Math.round(RITE.offering * 100)}% of its price comes into your store as blood), or <b>K</b> to curse it: for ${RITE.curse} blood it and the living around it take ${Math.round((RITE.taken - 1) * 100)}% more from every blow for ${RITE.last} seconds. Machines are beyond both rites. No Transfusion Station is raised, and siege comes dear: the rite answers machines with faith and towers.`,
  },
  {
    id: 'callup',
    when: (s, me) => ageOf(s.players[me]) === 'totalwar',
    text: `Every War Camp is a muster ground now. Select one and press <b>C</b> to call the nearest citizen within ${CALL_UP.reach} tiles to arms, or <b>V</b> for up to ${CALL_UP.most}: each becomes a foot soldier where it stands, for its arms alone. A town under attack can take up arms at once, but every citizen called is one less at work.`,
  },
  {
    id: 'horde',
    // The Steppe Road's second step (#318): a steppe people with a Stable, its flock already milked.
    when: (s, me) => {
      const p = s.players[me];
      return ageOf(p) === 'steppe' && roadKnown(s, p, HORDE_ROAD) && (p.stats.milked ?? 0) > 0 && !deedsDone(p, HORDE_ROAD, s);
    },
    text: `The camp can grow into a horde. Milk ${HORDE_ROAD.deed!.n} from your flock and butcher ${HORDE_ROAD.also![0].n} meat in all, and the Town Center (🔀) can take your people into the <b>${AGES.horde.name}</b> instead of the Middle Ages: still on wagons, still no fields or walls, and riders who stand in a rival's land take tribute from its treasury.`,
  },
  {
    id: 'wild',
    // The Age of the Wild (`docs/wild-road.md`): nothing tamed yet.
    when: (s, me) => ageOf(s.players[me]) === 'wild' && !s.players[me].tamed?.length,
    text: `Your people keeps company with the wild now. Select a citizen and <b>right-click a wolf, boar or mammoth</b> to sing it calm: ${TAME.secs.wolf} seconds for a wolf, ${TAME.secs.boar} for a boar, ${TAME.secs.mammoth} for a mammoth, and it becomes yours, a beast of war. The beast stands still for its tamer, but its pack bites, so bring an escort. Once a kind is tamed, a <b>${BUILDINGS.den.name}</b> breeds more of it.`,
  },
  {
    id: 'grove',
    // The Age of the Grove (`docs/wild-road.md` §2): its first minute.
    when: (s, me) => ageOf(s.players[me]) === 'grove',
    text: `Your people grows its town now. Plant a <b>${BUILDINGS.thornwall.name}</b> line (drag, like a wall): it grows from seedling to living oak in about ${GROVE.stage * 3} seconds (twice as fast in spring), parts for your own people, and sprouts again from its root if cut down. Set <b>${BUILDINGS.garden.name}s</b> within ${GROVE.dung} tiles of a ${BUILDINGS.den.name} or ${GROVE.water} of water: fed, a gardener brings in far more than a farmer. <b>${BUILDINGS.orchard.name}s</b> by a store bear food by themselves each summer and autumn.`,
  },
  {
    id: 'tides',
    // The Age of Tides (#739): its first minute.
    when: (s, me) => ageOf(s.players[me]) === 'tides',
    text: `Your people keeps the sea's hours. Watch the tide clock (🌊, top bar): every ${TIDE.period / 60} minutes the sea falls to low water and back, baring the shallows as flats anyone may cross. Raise <b>${BUILDINGS.tidemill.name}s</b> (<kbd>${BUILDINGS.tidemill.key}</kbd>) on the shore where the most tidal ground lies near: each grinds gold at every turn of the tide. Drag <b>${BUILDINGS.causeway.name}s</b> (<kbd>${BUILDINGS.causeway.key}</kbd>) over the flats or the shallow sea: a road that only high water covers. Get off the flats before the water comes back, and strike across the bay at low water.`,
  },
  {
    id: 'tideAwake',
    // The tide (#739) woke for a people that is not in the age: it runs for everyone.
    when: (s, me) => s.tideFrom !== undefined && ageOf(s.players[me]) !== 'tides',
    text: 'A rival keeps the sea\'s hours, and the <b>tide</b> has woken for everyone: watch its clock (🌊, top bar). At low water the shallows bare as flats an army can cross, toward you or from you; ships on them sit aground, and a Dock with only flats beside it launches nothing. Whoever stands on the flats when the water comes back is swept ashore, hurt.',
  },
  {
    id: 'tideRoute',
    // Routes that read the tide (#755): one of the viewer's people stands on the shore waiting for the flats to bare.
    when: (s, me) => s.tideFrom !== undefined && s.ents.some((e) => e.kind === 'unit' && e.owner === me && tideWaitLeft(s, e) > 0),
    text: '<b>Your people read the tide.</b> Sent over the flats, a soldier, citizen or trader crosses only if it will be over before the water comes back. Otherwise it goes round by dry ground, or waits on the shore (🌊 and the seconds left, on its panel) for the next low water, whichever is quicker. To be across sooner, send it earlier in the ebb, or lay a causeway: high water alone covers that road.',
  },
  {
    id: 'cockles',
    // Cockle beds (#767): the viewer's people keeps the sea's hours, and the tide has bared a bed.
    when: (s, me) => !!s.cockles && !!ageDef(s.players[me]).tides && s.cockles.some((b, i) => b === 1 && s.res[i] === R_COCKLE && bared(s, i)),
    text: '<b>Cockle beds</b> lie on the deeper flats (pale shells on the wet sand, 🐚 on its panel), bared only as the tide runs low. Send citizens to pick them while they stand bare: food, and each high water brings some back. Your pickers read the clock themselves: before the flood they come ashore with what they have, and go back at the next low water. A barrage that ponds the flats drowns its beds; a causeway goes over one only once it is picked out.',
  },
  {
    id: 'cocklerHut',
    // The Cockler's Hut (#779): the viewer's people picks cockles, and has no hut yet.
    when: (s, me) => !!s.cockles && !!ageDef(s.players[me]).tides && !has(s, me, 'cockler') && s.ents.some((e) => e.kind === 'unit' && e.owner === me && e.order.k === 'gather' && !!e.order.cockle),
    text: `<b>A hut by the beds.</b> Your pickers carry every basket of cockles home, a long walk past wolves and the flood. Raise a <b>${BUILDINGS.cockler.name}</b> (<kbd>B</kbd> <kbd>${BUILDINGS.cockler.key}</kbd>, ${BUILDINGS.cockler.cost.wood} wood) within ${COCKLER.reach} tiles of a bed: they empty their baskets there, wait beside it on dry ground for low water, and the beds round it come back richer at each high water (${COCKLER.regrow} food, not ${COCKLE.regrow}). It takes cockles only, and stands where a rival crossing at low water will find it.`,
  },
  {
    id: 'barrage',
    // Barrages (#748): a Tide Mill stands, and no pond yet.
    when: (s, me) => ageOf(s.players[me]) === 'tides' && has(s, me, 'tidemill') && !s.pond,
    text: `<b>Shut a bay.</b> Drag a line of ${BUILDINGS.causeway.name}s (<kbd>${BUILDINGS.causeway.key}</kbd>) across the mouth of a bay of flats, shore to shore: behind it the bay is a <b>pond</b> whose flats stay wet at every hour, and a Tide Mill by it grinds them twice, on the flood and on the ebb. What it costs: nobody crosses that bay at low water any more, you included, and powder or a warhead on the line lets the pond out.`,
  },
  {
    id: 'tideGate',
    // The Tide Gate (#785): the viewer's people has a barrage's pond, and no gate in it yet.
    when: (s, me) => ageOf(s.players[me]) === 'tides' && !!s.pond && !!s.causewayBy && s.causewayBy.some((o) => o - 1 === me) && !has(s, me, 'tidegate'),
    text: `<b>A gate in the barrage.</b> Set a <b>${BUILDINGS.tidegate.name}</b> (<kbd>V</kbd> <kbd>${BUILDINGS.tidegate.key}</kbd>) on a causeway tile of your barrage, beside the pond. Shut, the pond holds and the mills grind it twice. At low water, when a rival army walks the flats below it, open it (<kbd>O</kbd>): the pond rushes out over them for ${TIDE_GATE.secs} seconds and sweeps them off, hurt or drowned. Then shut it again, and the next flood fills it. Rivals can read whether it is loaded, and keep off.`,
  },
  {
    id: 'gateRead',
    // The computer answers a rival's gate (#792): the viewer has a Tide Gate standing.
    when: (s, me) => ageOf(s.players[me]) === 'tides' && has(s, me, 'tidegate'),
    text: `<b>Your gate is read.</b> A loaded ${BUILDINGS.tidegate.name} shapes when a rival crosses, even shut: the computer holds its army back at the muster, sends ${AI_GATE_ANSWER.bait} of its weakest onto the flats below to draw your scour (fire on them and the gate is spent until the next flood fills it), or, a Sapper people, carries a keg to the gate. A guard by the gate stamps a keg out. Letting the bait walk is a choice too.`,
  },
  {
    id: 'gateHolds',
    // The computer's gate reads bait (#796): the viewer has soldiers on the flats below a computer rival's loaded gate.
    when: (s, me) => s.ents.some((g) => {
      if (g.kind !== 'building' || g.type !== 'tidegate' || !s.players[g.owner]?.ai || !isEnemy(s, me, g.owner)) return false;
      const below = gateReach(s, g);
      if (!below.length) return false;
      const flats = new Set(below);
      return s.ents.some((e) => e.kind === 'unit' && e.owner === me && e.hp > 0 && !e.inside && flats.has(Math.floor(e.y) * s.w + Math.floor(e.x)));
    }),
    text: `<b>The gate is watching.</b> Your soldiers stand on the flats below a computer's loaded ${BUILDINGS.tidegate.name}. Bait it with a few while your army waits close on the shore and it <b>holds</b> its scour for the army: it fires once ${AI_GATE_READ.rise} more step onto the flats, once your army starts across, or just before the flood takes its head. Keep the army out of sight (over ${AI_GATE_READ.near} tiles back) and the bait looks like all there is. A Sapper's keg-carrier near the gate draws a guard who runs to stamp the fuse out.`,
  },
  {
    id: 'breachCauseway',
    // Barrages (#748): a Sapper people with kegs, and a rival's causeway on the map.
    when: (s, me) => ageOf(s.players[me]) === 'sapper' && (s.players[me].kegs ?? 0) > 0 && !!s.causewayBy && s.causewayBy.some((o) => o > 0 && o - 1 !== me),
    text: 'A rival has laid <b>causeways</b> over the flats. Select citizens or foot soldiers, choose <b>Lay a keg</b> (<kbd>K</kbd>), and click a stretch of the causeway: the blast breaches it, cutting the road, and a barrage breached lets its pond drain. Lay it at low water, with time to spare: the flood drowns a burning fuse.',
  },
  {
    id: 'hive',
    // The Age of the Hive (`docs/wild-road.md` §3): its first minute.
    when: (s, me) => ageOf(s.players[me]) === 'hive',
    text: `Your people keeps bees now. Set a <b>${BUILDINGS.hive.name}</b> (${BUILDINGS.hive.key}) among standing trees (${HIVE.trees} within 3 tiles): its bees sting any rival who walks the woods within ${HIVE.reach} tiles, past armour, and slow them, so a wood by a Hive is a wall. It pays honey, or mead for gold if a Market stands within ${HIVE.market} tiles, and in summer doubles your <b>${BUILDINGS.garden.name}s</b> within ${HIVE.bloom} tiles. Bees sleep in winter, and smoke quiets them: that is when a rival comes, with torches. No muskets or cannon: train <b>Blowpipe Hunters</b> at the Archery Range, whose venom stacks and cuts down riders and beasts, and breed <b>Cave Bears</b> at the Den; your wolves are Dire Wolves now.`,
  },
  {
    id: 'wildwood',
    // The Age of the Wildwood (`docs/wild-road.md` §4): its first minute.
    when: (s, me) => ageOf(s.players[me]) === 'wildwood',
    text: `The forest wakes for your people now. Plant your one <b>${BUILDINGS.heart.name}</b> (${BUILDINGS.heart.key}) by old woods: at it, train an <b>Ent</b> and the tree nearest it within ${WILDWOOD.wake} tiles wakes, a slow giant that flings boulders and breaks buildings, so it is your siege now. Select Ents and press <kbd>O</kbd> to <b>root</b> them on bare ground: they are trees again, mend, and wake when a rival comes near, an ambush no one sees. Each spring your woods spread round the Heart Tree, and your people run through those woods while a rival's are slowed. No rifles, field guns or aircraft, and fire hits your living things twice as hard: guard the Heart Tree, for if it falls every Ent roots and sleeps.`,
  },
  {
    id: 'bloom',
    // The Age of the Bloom (`docs/wild-road.md` §5b): its first minute.
    when: (s, me) => ageOf(s.players[me]) === 'bloom',
    text: `The plants' end: your people outgrows its rivals now. Raise your one <b>${BUILDINGS.spire.name}</b> (${BUILDINGS.spire.key}): while your Heart Tree stands it ripens a <b>Bloom Seed</b> every ${BLOOM.ripen} seconds. Sling it (G) at a rival town and send your army after it: once it roots, ${BLOOM.grow} seconds later every rival building within ${BLOOM.r} tiles cracks into forest, unless their citizens hack out its heart-root first. Or win by <b>the Greening</b>: keep your Heart Tree while trees, Orchards and Thornwalls grown to living oak cover ${BLOOM.green * 100}% of your land for ${BLOOM.hold / 60} minutes. Your woods spread every season now, and each season opens with a pollen storm that half-blinds rival soldiers and towers near your Heart Tree. Your Dens are quiet and you raise no Missile Silo; rivals will come with fire.`,
  },
  {
    id: 'leviathans',
    // The Age of Leviathans (`docs/wild-road.md` §5a): its first minute.
    when: (s, me) => ageOf(s.players[me]) === 'leviathans',
    text: `The beasts' end: your people breeds giants now. Raise a <b>${BUILDINGS.greatden.name}</b> (${BUILDINGS.greatden.key}). Its <b>Skywhales</b> fly over walls, woods and water: right-click one with soldiers to board (up to ${UNITS.skywhale[5]?.capacity}), then right-click ground behind a rival's walls to set them down. Over a rival's street, press <kbd>B</kbd> to drop a seed-bomb: ${LEVIATHANS.seeds} Thornwall seedlings sprout beneath it and grow, cutting their town in pieces. Fighters and riflemen bring whales down, with all aboard. Breed your one <b>Behemoth</b>: a titan with a Town Center on its back. Walk it to the wood, the gold or the front and press <kbd>P</kbd> to kneel: the Town Center stands there at once, working. Select it and press <kbd>P</kbd> to rise and walk on. At sea: a Great Den raised within ${LEVIATHANS.sea} tiles of the water breeds the <b>Kraken</b>, which grips the ships it strikes so they can't sail and shoves yours along, and your Docks grow <b>Reef Ships</b> in the warships' place, launched young and mending themselves after a fight. Your Heart Tree sleeps: no new Ents and no Spreading, and the Bloom is closed to you for good.`,
  },
  {
    id: 'mycelium',
    // The Age of the Mycelium (#800, `docs/wild-road.md` §R): its first minute.
    when: (s, me) => ageOf(s.players[me]) === 'mycelium',
    text: `A web grows under your town now: pale threads spread from each of your halls, ${MYCELIUM.reach} tiles out over ${Math.round(MYCELIUM.reach / MYCELIUM.grow)} seconds. Build close and work close: every hall on the web takes in every stock, and a load carried onto the web is banked the moment it gets there, so gatherers in the web never walk home. Your people standing on the web are <b>hidden</b>: no rival sees them or aims at them unless it comes within ${MYCELIUM.reveal} tiles, or they have just struck, so fight at home and let them come to you. A rival building touching your web rots. Soldiers cost a quarter more, and fire burns the web back: a rival's torch (F) on your threads, or a burning tree near them. Bank ${MYCELIUM.deed} stock through the web and the long road to the Bloom opens, skipping two ages.`,
  },
  {
    id: 'web',
    // A rival's fungus web (#800) in sight.
    when: (s, me) => s.ents.some((e) => e.kind === 'building' && !!e.web && e.web > 2 && e.hp > 0 && s.players[e.owner].team !== s.players[me].team && s.players[me].vis[e.ty * s.w + e.tx] === 1),
    text: `Pale threads glow round a rival's halls: a fungus web. Their people on it are hidden from you until you come within ${MYCELIUM.reveal} tiles, their halls take every stock, and any building of yours that touches it rots. Burn it back: select citizens or foot soldiers, press <kbd>F</kbd> and click bare ground on the threads. And they may be bound for the Bloom: the web is its short road.`,
  },
  {
    id: 'torch',
    // Fire (`fire.ts`): a rival's living town is in sight, and torches are in hand.
    when: (s, me) =>
      s.players[me].epoch >= FIRE.epoch &&
      s.ents.some((e) => e.kind === 'building' && e.hp > 0 && FIRE.burns.includes(e.type) && e.owner !== me && s.players[e.owner].team !== s.players[me].team && s.players[me].vis[e.ty * s.w + e.tx] === 1),
    text: `A rival grows its town: Thornwalls, Kitchen Gardens, Orchards, Hives and Heart Trees burn. Select citizens or foot soldiers and press <kbd>F</kbd>, then click one: each stands ${FIRE.light} seconds to set it alight, and unless its people beat it out it burns down. A Thornwall that burns leaves no root, and in a dry summer the fire runs along the hedge and through the woods beside it.`,
  },
  {
    id: 'burning',
    // Fire (`fire.ts`): something of yours burns.
    when: (s, me) => !!s.fires?.some((f) => f.b !== undefined && s.byId.get(f.b)?.owner === me),
    text: `Your living buildings are burning. Right-click a burning one with citizens: they beat the flames before they mend it, and ${FIRE.beat} seconds of beating put it out (two citizens, half the time). A gardener at work in a Garden beats at it already. Fell the trees beside your hedges for a firebreak: fire leaps only to what grows.`,
  },
  {
    id: 'tribute',
    when: (s, me) => ageOf(s.players[me]) === 'horde',
    text: `Your horde lives on <b>tribute</b>. Ride into a rival's land and <b>hold your riders still</b> there (<kbd>C</kbd>, stand ground): each takes ${AGES.horde.add!.tribute} gold a second from that rival, up to ${TRIBUTE.most} riders a rival. Riders on the move take nothing, spears and towers answer them, and deep past your own land they wear down: pitch a camp near the border to keep them fed.`,
  },
  {
    id: 'silkroad',
    // The Steppe Road's third step (#326), a crossing: a merchant people that rode the steppe, or a Gunpowder people that rode as a horde.
    when: (s, me) => {
      const p = s.players[me];
      return roadsFrom(p).some((r) => r.to === 'silk' && roadKnown(s, p, r) && !deedsDone(p, r, s));
    },
    text: `Your people remembers the wagons. Bring home the gold its deeds ask by trade (the Town Center's 🔀 shows how far along you are), and it can take the <b>${AGES.silk.name}</b> instead: the Market packs onto a wagon and rolls with the camp, and every tile it covers while a trader is out pays that trip ${Math.round(SILK.each * 100)}% more.`,
  },
  {
    id: 'caravans',
    when: (s, me) => ageOf(s.players[me]) === 'silk',
    text: `Your town is a moving trade post. Select the Market and press <b>J</b> to pack it onto a wagon, drive it along the road and pitch it (<b>P</b>) further on: traders come home to it wherever it is, rolling or pitched, and every tile it moved since they set out pays ${Math.round(SILK.each * 100)}% more, up to ${Math.round(SILK.each * SILK.most * 100)}% (🐫 on a trader shows it). Nobody buys or sells while it rolls, and riders run a lone wagon down: keep it with the camp.`,
  },
  {
    id: 'caravanserai',
    // The Silk Road's waystation (#334), once the caravans are rolling.
    when: (s, me) => ageOf(s.players[me]) === 'silk' && has(s, me, 'market') && !has(s, me, 'caravanserai'),
    text: `Raise a <b>Caravanserai</b> (<kbd>C</kbd> in the economy build menu) by a far trading post, in no one's land too: your traders' trips to any post within ${SERAI.near} tiles of it pay ${Math.round((SERAI.pay - 1) * 100)}% more, traders and wagons within ${SERAI.rest} tiles mend, and the land round it becomes yours.`,
  },
  {
    id: 'toll',
    when: (s, me) => ageOf(s.players[me]) === 'silk' && has(s, me, 'caravanserai'),
    text: `Your land is the road now. A rival's trader heading home with gold across it pays you <b>${Math.round((AGES.silk.add!.toll ?? 0) * 100)}% of its load</b> for safe passage, once a trip. A Caravanserai beside a post your rivals use makes the ground there yours, so every trader loading there pays. They may burn it, or trade elsewhere.`,
  },
  {
    id: 'fairs',
    // The hybrid (#49): a merchant or pilgrim people with the other system's building in view.
    when: (s, me) => {
      const p = s.players[me];
      return roadsFrom(p).some((r) => r.to === 'fair' && roadKnown(s, p, r) && !deedsDone(p, r, s));
    },
    text: `A people both <b>merchant</b> and <b>faithful</b> can hold great fairs. Bring home ${FAIR_ROAD.deed!.n} gold by trade <i>and</i> ${FAIR_ROAD.also![0].n} from relics, and the Town Center (🔀) leads into the <b>${AGES.fair.name}</b> instead of the Gunpowder Age: every relic your Temples keep makes trade pay more. Guard the Temples and the roads, though: fair towns stand weaker.`,
  },
  {
    id: 'stepBack',
    // A side road (#47) shut behind the player: the way back to it.
    when: (s, me) => {
      const p = s.players[me];
      return !!backTo(p) && shutRoads(s, p).some((r) => AGES[r.from].tier < p.epoch);
    },
    text: `A road is shut behind you (🔒 at the Town Center). The Town Center can <b>step back</b> an age (<kbd>Z</kbd>): units fall back to their older form and newer technologies wait, suspended, until you climb again. Then ${Math.round(STEP_BACK.cooldown / 60)} minutes before the next step back.`,
  },
  { id: 'wonder', when: (s, me) => s.players[me].epoch >= 2, text: 'Rich? Build a <b>Wonder</b> (<kbd>B</kbd> <kbd>X</kbd>). If it stands long enough, you win, but everyone will come for it.' },
  { id: 'dock', when: (s, me) => secsIn(s) > 150 && !has(s, me, 'dock') && waterNear(s, me), text: 'Water nearby! A <b>Dock</b> (<kbd>B</kbd> <kbd>D</kbd>) on the shore trains <b>fishing boats</b>: fish shoals feed you for a long time. Later, warships and transports.' },
  { id: 'aeronaut', when: (s, me) => s.players[me].epoch === 4 && buildings(s, me).some((b) => b.type === 'airfield' && b.built), text: 'Your Airfield reveals the <b>Age of Aeronauts</b> at the Town Center: aircraft cost and training time fall by 25%, but foot, ranged, cavalry and siege units cost 20% more. Riflemen and towers still shoot them down. A paid road returns to Industrial.' },
  { id: 'lightning', when: (s, me) => s.players[me].epoch === 4 && buildings(s, me).some((b) => b.type === 'tower' && b.built), text: 'Your Watch Towers point the way to the <b>Age of Lightning</b>: once they have lit 6 beacons (<kbd>F</kbd>; relays count), the Town Center can take it. Every tower becomes a <b>Coil Tower</b>: buildings in its field train and research faster, those outside run slower, and its bolt leaps through crowded armies. No aircraft fly there.' },
  // The Water Line (#701 s4): its first minute is a sluice, and the first time the water is let out.
  { id: 'waterline', when: (s, me) => ageOf(s.players[me]) === 'waterline' && !has(s, me, 'sluice'), text: 'The <b>Age of the Water Line</b>: raise a <b>Sluice</b> (<kbd>V</kbd> <kbd>S</kbd>) in your dyke line, on a channel, or on shallow water. Open it (<kbd>O</kbd>) when an army comes: the low ground round it goes under knee-deep water that soldiers wade at a crawl and siege can hardly cross. Shut it and the water goes. Fields under the flood yield nothing, so open it only when it pays.' },
  { id: 'locks', when: (s, me) => ageOf(s.players[me]) === 'locks' && !has(s, me, 'dam'), text: 'The <b>Age of Locks</b>: a <b>Canal</b> (<kbd>B</kbd> <kbd>Q</kbd>) dug from the shore or a lake now fills deep enough for ships, so a Dock on it launches a fleet in the heart of your land; an old channel can be dug deep the same way. Raise a <b>Dam</b> (<kbd>V</kbd> <kbd>N</kbd>) on water beside your Barracks and workshops: its turbines make them train and research two fifths faster. Guard it: a dam that falls bursts over the low ground below it.' },
  { id: 'bridge', when: (s, me) => ageOf(s.players[me]) === 'locks' && !!s.channel && s.channel.some((v) => v === 2) && !has(s, me, 'bridge'), text: 'Your canals cut your own roads too: soldiers swim a canal at a quarter of their pace. Lay a <b>Bridge</b> (<kbd>B</kbd> <kbd>Z</kbd>) over it where your people cross: they walk it at full pace, rivals can\'t, and ships pass under it.' },
  { id: 'floating', when: (s, me) => ageOf(s.players[me]) === 'floating' && !has(s, me, 'pontoon'), text: 'The <b>Age of Floating Cities</b>: your town goes onto the water. Raise a <b>Pontoon</b> (<kbd>B</kbd> <kbd>E</kbd>, where the House was) on open water beside your shore: room for 10, a drop for every kind of goods, fishing boats, and a deck your people walk. Moor <b>three side by side</b> and they link into a floating town that raises citizens. No Houses go up on land now, and no Missile Silo.' },
  { id: 'towing', when: (s, me) => ageOf(s.players[me]) === 'floating' && buildings(s, me).filter((b) => b.type === 'pontoon' && b.built).length >= 2, text: 'A floating town can leave. Select a Pontoon and <b>Cast off</b> (<kbd>O</kbd>): it goes under tow with up to 10 of those on its deck aboard. Sail it to the fish, to a rival\'s shore, or out of a warhead\'s reach, and <b>Moor</b> it (<kbd>P</kbd>) on any open water. Warships hole pontoons three times as fast as anything else: keep a fleet by your town.' },
  { id: 'barge', when: (s, me) => ageOf(s.players[me]) === 'waterline' && buildings(s, me).some((b) => b.type === 'sluice' && b.built), text: 'Your Sluice launches <b>Gun-barges</b>: flat boats with a cannon that sail the sea, the channels and the flood alike. With the sluice open they shell an army wading your fields; they pass through any sluice, as through a lock. Shut the sluice with a barge far out on the flood and it may be left aground.' },
  { id: 'cog', when: (s, me) => units(s, me).some((u) => u.type === 'cog'), text: 'A <b>merchant ship</b> sails from your Dock to a trading post with water near it (a <b>port</b>) and brings back gold, 20% more than the land road. Select it and right-click the post. Warships are its enemy.' },
  { id: 'transport', when: (s, me) => units(s, me).some((u) => u.type === 'transport'), text: 'To cross the water, select soldiers and <b>right-click your transport</b> to board. Then select the transport and right-click a far shore to land them.' },
  { id: 'silo', when: (s, me) => s.players[me].epoch >= 5 && !has(s, me, 'silo'), text: 'The <b>Atomic Age</b> brings the <b>Missile Silo</b> (<kbd>V</kbd> <kbd>M</kbd>), dear to raise. Select it, press <kbd>M</kbd> and click any point on the map: after 45 seconds the warhead lands (12,000 at the centre, less with every tile, to nothing 8 tiles out), and every player sees the clock and the blast, and the fog lifts over it for a minute. Warheads come from your people\'s store (one at first, one more every 240 seconds, up to 3), fired from any silo; you may raise 2 (3 with Launch Control), and every rival sees them on the map. A rival is warned with <b>three rings</b>, your target and two decoys drawn where you might have aimed, each set off up to 2 tiles; only in the last 3 seconds do the decoys vanish. Guard them: if the silo falls while the clock runs, the launch is scrubbed and that warhead lost. The 5 tiles round the point stay poisoned for 90 seconds after, for your own army too.' },
  { id: 'fork', when: (s, me) => s.players[me].epoch >= 5 && buildings(s, me).some((b) => b.type === 'silo' && b.built), text: 'Your silo reveals a fork at the Town Center: the <b>Age of Fission</b> (a 25 second clock, a warhead every 100 seconds, a 20,000 warhead with a 10 tile blast, but each launch poisons the ground round your own silo) or the <b>Age of Fusion</b> (up to three warheads aloft, each 40,000 with a 12 tile blast, made again at once, nothing you strike poisoned, but a 70 second clock and a ruinous road). Either way you choose at each launch between an Atomic warhead (<kbd>N</kbd>) and your own (<kbd>M</kbd>), on the same clock. One shuts the other for good; a paid road leads back to the Atomic Age.' },
  { id: 'salvo', when: (s, me) => s.players[me].epoch >= 5 && s.players[me].techs.includes('launchControl'), text: '<b>Launch Control</b> ties your silos to one clock: raise a third, then select one and press <kbd>B</kbd> to fire a <b>salvo</b>, three Atomic warheads at three points at least 8 tiles apart, all from your store at once. Rivals see three rings, just as for one warhead and two decoys, and learn that all three are real only in the last 3 seconds. Each silo they destroy before then scrubs its own warhead; the others fly on.' },
  { id: 'salvoThreat', when: (s, me) => s.players.some((p) => p.team !== s.players[me].team && !p.defeated && s.ents.filter((e) => e.kind === 'building' && e.owner === p.id && e.type === 'silo' && e.built && e.hp > 0).length >= 3), text: 'A rival stands <b>three Missile Silos</b>: enough for a <b>salvo</b>. When it launches, all three warning rings may be real, not one and two decoys, and you will know only in the last 3 seconds. Spread out, or break a silo: each one that falls scrubs its own warhead.' },
  { id: 'missile', when: (s, me) => (s.launches ?? []).some((l) => !!l.arc && s.players[l.owner].team !== s.players[me].team), text: 'A rival <b>missile</b> is in the air. It climbs toward the middle of the warning rings, so for most of its flight it tells you only the district. Some seconds before the rings flash it <b>bends toward where it falls</b>: watch which way it turns and you can clear the right ring early, or trust it and stay.' },
  // Missile defence (#759 s3): once you stand a silo and a rival does too, hold one back.
  { id: 'reserve', when: (s, me) => s.players[me].epoch >= 5 && buildings(s, me).some((b) => b.type === 'silo' && b.built) && s.players.some((p) => p.team !== s.players[me].team && !p.defeated && s.ents.some((e) => e.kind === 'building' && e.owner === p.id && e.type === 'silo' && e.built && e.hp > 0)), text: `A rival stands a <b>Missile Silo</b> too. Select one of yours and press <kbd>R</kbd> to <b>hold it in Reserve</b>: it launches nothing, and after ${INTERCEPT.arm} seconds it stands ready to fire a warhead of your store at any rival warhead no Interceptor Battery answers, anywhere on the map, stopping it ${Math.round(INTERCEPT.chance * 100)}% of the time. Each answer costs a warhead and a launch's fuel. Every player sees the teal band of a silo held back; a quick Fission clock can land before a late Reserve stands ready.` },
  { id: 'interceptors', when: (s, me) => s.players[me].epoch >= 4 && !has(s, me, 'battery') && s.players.some((p) => p.team !== s.players[me].team && !p.defeated && p.epoch >= 5), text: `A rival stands in the <b>Atomic Age</b>. Learn <b>Interceptors</b> at a Siege Workshop, then raise <b>Interceptor Batteries</b> (<kbd>V</kbd> <kbd>I</kbd>) by your towns. Each covers ${INTERCEPT.reach} tiles: when a warhead's ring falls inside that circle, the battery fires by itself ${INTERCEPT.fire} seconds before it lands and stops it ${Math.round(INTERCEPT.chance * 100)}% of the time, blast and fallout both. One charge, then a ${INTERCEPT.reload} second reload: a salvo of three can still get through.` },
  { id: 'airfield', when: (s, me) => s.players[me].epoch >= 4 && !has(s, me, 'airfield'), text: 'The Industrial Age brings flight: an <b>Airfield</b> (<kbd>V</kbd> <kbd>F</kbd>) trains fighters and bombers. Only missiles reach them: fighters, riflemen, towers and warships.' },
];

const KEY = 'ages-tips';

export class Tips {
  private el = document.getElementById('tip-box')!;
  private shown = new Set<string>();
  private off = false;
  private current: string | null = null;
  private since = 0;
  private gameTipsLeft = 0;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      this.off = saved.off === true;
      for (const id of saved.shown ?? []) this.shown.add(id);
    } catch {
      /* Storage may be off: tips simply show again. */
    }
    this.el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-tip-act]')?.dataset.tipAct;
      if (act === 'next') this.hide();
      if (act === 'off') {
        this.off = true;
        this.hide();
        this.save();
      }
    });
  }

  get enabled(): boolean {
    return !this.off;
  }

  set enabled(on: boolean) {
    this.off = !on;
    if (on) this.shown.clear();
    else this.hide();
    this.save();
  }

  /** A new match. `limit` caps how many tips this match may show (0 for the default). */
  start(limit: number): void {
    this.hide();
    this.gameTipsLeft = limit || 99;
    this.since = 0;
  }

  /** The first minute's card (#555 s8): shown at once, ahead of the hints, for a new match only. */
  open(o: Opening): void {
    if (this.off) return;
    this.current = 'opening';
    this.since = 0;
    this.el.innerHTML = `<div class="tip-head">🧭 Your first minute: the ${o.people}</div><div>${o.lines.join('<br>')}</div><div class="tip-btns"><button data-tip-act="next">Got it</button><button data-tip-act="off">No more tips</button></div>`;
    this.el.classList.remove('hidden');
  }

  update(s: GameState, me: number, dt: number): void {
    if (this.off) return;
    this.since += dt;
    if (this.current) {
      if (this.since > 26) this.hide();
      return;
    }
    if (this.since < 6 || this.gameTipsLeft <= 0) return;
    const tip = TIPS.find((t) => !this.shown.has(t.id) && t.when(s, me));
    if (!tip) return;
    this.shown.add(tip.id);
    this.save();
    this.current = tip.id;
    this.since = 0;
    this.gameTipsLeft--;
    this.el.innerHTML = `<div class="tip-head">💡 Tip</div><div>${tip.text}</div><div class="tip-btns"><button data-tip-act="next">Got it</button><button data-tip-act="off">No more tips</button></div>`;
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.current = null;
    this.since = 0;
    this.el.classList.add('hidden');
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ off: this.off, shown: [...this.shown] }));
    } catch {
      /* Not saved; no harm. */
    }
  }
}



/** When a tip is due (by its id), for tests that check a tip's moment headlessly (#796). */
export const tipWhen = (id: string): Tip['when'] | undefined => TIPS.find((t) => t.id === id)?.when;
