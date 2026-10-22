import { AGES, CIVS, HOMELANDS, HOUSEHOLD, NOMAD, LEGION, BLOOD, BUILDINGS, HEMO, HEMOCRAFT, RITE, CALL_UP, KILL_CAMP, ROADS, ROT, SERAI, SICKNESS, SILK, STEP_BACK, TRIBUTE, WAY, secs } from '../sim/data';
import { ageDef } from '../sim/ages';
import { ageOf, backTo, hasWalked, deedProgress, deedsDone, findsOf, mainRoad, prospected, roadKnown, roadsFrom, shutRoads } from '../sim/ages';
import type { AgeId, Building, GameState, Unit } from '../sim/types';
import { R_FISH } from '../sim/types';
import { isIdleCitizen } from './idle';
import { seasonAt } from '../sim/seasons';

/**
 * Advice for a first game, one tip at a time in a corner: what to do next, given how the match is
 * going. Each tip shows once; the player can close them for good.
 */

const MERCHANT_ROAD = ROADS.find((r) => r.to === 'merchant')!;
const IRON_ROAD = ROADS.find((r) => r.to === 'iron')!;
const PILGRIM_ROAD = ROADS.find((r) => r.to === 'pilgrim')!;
const SAIL_ROAD = ROADS.find((r) => r.to === 'sail')!;
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
  // The household tax (#501): a Chinese town's gold is owed by its houses, not dug.
  { id: 'household', when: (s, me) => !!CIVS[s.players[me].civ].household && secsIn(s) > 30, text: `🏮 <b>The household tax.</b> Nobody here mines gold: every <b>house</b> pays it every ${HOUSEHOLD.every} seconds, in proportion to how full your town is, and <b>more for each house on its street</b> (within ${HOUSEHOLD.reach} tiles, a Market counting as two). Build houses in lanes close together and keep the town full of people; hover the gold to see the tax a minute. A rival who <b>burns your houses</b> takes ${HOUSEHOLD.raid} gold from the treasury for each, so guard the streets.` },
  // Born on the move (#501): a Mongol camp is on wagons from the first minute, with no fields and no quarry.
  { id: 'nomad', when: (s, me) => !!CIVS[s.players[me].civ].nomad && secsIn(s) > 20, text: `🐎 <b>Born on the move.</b> Your camp is on wagons: select the Town Center or a House and <b>strike camp</b> (<kbd>J</kbd>), drive the wagon to fresh grass, and <b>pitch</b> it there. Your <b>flock</b> walks with the camp: milk it, raise lambs at the Town Center, and each House keeps ${NOMAD.house} more sheep. You till no fields and quarry no stone, ever: the grass is your field, so move when the flock goes hungry. The <b>Plow</b> and <b>Irrigation</b> speed your milking instead.` },
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
  { id: 'sickness', when: (s, me) => (s.players[me].taint ?? 0) >= 0.4 || !!s.players[me].fever, text: `🤒 <b>The Sickness.</b> A big town with full houses packed close builds taint (the chip by your population); at 100% it breaks out and your people work slower, and some die in a bad fever. Keep <b>priests by a finished Temple</b> to nurse it down, space your houses out, and mind the roads: a sick town's trader leaves its trading post foul for ${SICKNESS.foul} seconds and a trader of yours loading there brings it home. <b>Quarantine</b> (Town Center, <kbd>N</kbd>) keeps your traders at home.` },
  { id: 'bell', when: (s, me) => s.players[me].alert > 0 && s.tick - s.players[me].alert < 40, text: 'Under attack? Ring the <b>town bell</b> (Town Center, <kbd>R</kbd>): citizens shelter inside and the Town Center shoots more arrows. <kbd>T</kbd> sends them back to work.' },
  { id: 'heart', when: (s, me) => !s.scenario && s.mode !== 'regicide' && s.players[me].epoch >= 1 && buildings(s, me).filter((b) => b.type === 'towncenter').length === 1 && secsIn(s) > 300, text: 'Your Town Center is your <b>heart</b>: if the last one falls you have 45 seconds to lay a new foundation, or your people is lost. A second Town Center (<kbd>B</kbd>) is cheap insurance.' },
  { id: 'forge', when: (s, me) => s.players[me].epoch >= 1 && secsIn(s) > 30 && !has(s, me, 'forge'), text: `A <b>Forge</b> (<kbd>V</kbd> <kbd>R</kbd>) makes every soldier hit harder and take less damage. The <b>${BUILDINGS.market.name}</b> trades surplus goods for gold.` },
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
  { id: 'cog', when: (s, me) => units(s, me).some((u) => u.type === 'cog'), text: 'A <b>merchant ship</b> sails from your Dock to a trading post with water near it (a <b>port</b>) and brings back gold, 20% more than the land road. Select it and right-click the post. Warships are its enemy.' },
  { id: 'transport', when: (s, me) => units(s, me).some((u) => u.type === 'transport'), text: 'To cross the water, select soldiers and <b>right-click your transport</b> to board. Then select the transport and right-click a far shore to land them.' },
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


