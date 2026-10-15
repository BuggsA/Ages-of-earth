import { AGES, BUILDINGS, ROADS, ROT, STEP_BACK, secs } from '../sim/data';
import { ageOf, backTo, deedProgress, deedsDone, mainRoad, roadKnown, roadsFrom, shutRoads } from '../sim/ages';
import type { Building, GameState, Unit } from '../sim/types';
import { R_FISH } from '../sim/types';
import { isIdleCitizen } from './idle';

/**
 * Advice for a first game, one tip at a time in a corner: what to do next, given how the match is
 * going. Each tip shows once; the player can close them for good.
 */

const MERCHANT_ROAD = ROADS.find((r) => r.to === 'merchant')!;
const IRON_ROAD = ROADS.find((r) => r.to === 'iron')!;
const PILGRIM_ROAD = ROADS.find((r) => r.to === 'pilgrim')!;
const SAIL_ROAD = ROADS.find((r) => r.to === 'sail')!;
const FAIR_ROAD = ROADS.find((r) => r.to === 'fair')!;

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
const sighted = (s: GameState, me: number, kind: 'mammoth' | 'wolf' | 'boar') => s.animals.some((a) => a.kind === kind && s.players[me].vis[Math.floor(a.y) * s.w + Math.floor(a.x)]);

const TIPS: Tip[] = [
  { id: 'gather', when: (s) => secsIn(s) > 2, text: 'Drag a box around your <b>citizens</b>, then <b>right-click</b> berry bushes, trees or a deer to gather food and wood.' },
  { id: 'train', when: (s) => secsIn(s) > 25, text: 'More citizens mean a faster economy. Click your <b>Town Center</b> and press <kbd>Q</kbd> to train one (you can queue several).' },
  { id: 'house', when: (s, me) => s.players[me].pop >= s.players[me].cap - 2, text: 'You are nearly out of room. Select a citizen, press <kbd>B</kbd> then <kbd>E</kbd> to build a <b>house</b> (5 more people each).' },
  { id: 'idle', when: (s, me) => secsIn(s) > 60 && s.ents.some((e) => isIdleCitizen(e, me)), text: 'Someone is standing around: press <kbd>.</kbd> to find an idle citizen, or <kbd>Shift</kbd> + <kbd>.</kbd> to select every idle citizen and put them to work.' },
  { id: 'store', when: (s) => secsIn(s) > 110, text: 'Long walks waste time. Build a <b>Storehouse</b> (<kbd>B</kbd> <kbd>S</kbd>) next to the woods or a mine. It also teaches better tools.' },
  { id: 'mammoth', when: (s, me) => sighted(s, me, 'mammoth'), text: 'A <b>mammoth</b>! Its carcass feeds a town for a long while, but it charges when speared. Send <b>five or more</b> citizens together, or put a couple of soldiers in front.' },
  { id: 'boar', when: (s, me) => sighted(s, me, 'boar'), text: 'A <b>wild boar</b> guards that berry patch and charges anyone who comes close. One citizen will lose; send <b>three</b> to spear it, and its carcass pays better than a deer. Or leave the berries and gather elsewhere.' },
  { id: 'rot', when: (s) => !!s.carcasses?.some((c) => s.tick - c.born > secs(ROT.grace)), text: '<b>Meat spoils.</b> A carcass left too long rots away: put more hands on it, or research <b>Drying Racks</b> at the Town Center to keep it on your own land. Out in the open, turning meat draws <b>wolves</b> from dens nearby.' },
  { id: 'huntcamp', when: (s, me) => !s.scenario && !!s.carcasses?.some((c) => s.tick - c.born > secs(ROT.grace)) && !has(s, me, 'huntcamp'), text: '<b>A Hunting Camp</b> (economy menu, N) takes in food and holds a little land round it: raise one by a far kill or the herd, and the meat is safe from wolves and kept by your Drying Racks.' },
  { id: 'seasons', when: (s) => secsIn(s) > 150, text: '<b>The year turns</b> every 2½ minutes (the icon by the clock). <b>Summer</b> berries are heavy but meat spoils fast; in <b>winter</b> berries fail, meat keeps and hungry wolves range further: hunt, and dry your meat, before the cold.' },
  { id: 'wolves', when: (s, me) => sighted(s, me, 'wolf'), text: '<b>Wolves</b> keep a den out here, often by wild gold, and fall on anyone who comes near. A lone citizen won\'t survive them: send a few soldiers, or a band of citizens, to clear the den first.' },
  { id: 'army', when: (s) => secsIn(s) > 200, text: 'Rivals will come. Build a <b>Barracks</b> (<kbd>V</kbd> <kbd>B</kbd>) and train soldiers. Infantry beat cavalry, archers beat infantry, cavalry beat archers.' },
  { id: 'farm', when: (s, me) => secsIn(s) > 260 && !has(s, me, 'farm'), text: 'Berries and deer run out. <b>Farms</b> (<kbd>B</kbd> <kbd>F</kbd>) give food forever; build them near your Town Center.' },
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
    id: 'ruins',
    when: (s, me) => !!s.ruins?.some((r) => r.by < 0 && s.players[me].seen[Math.floor(r.y) * s.w + Math.floor(r.x)] === 1),
    text: 'You have found <b>ancient ruins</b> (two pale columns on the map). Select a few <b>citizens</b> and right-click them to dig: whoever finishes the dig takes what lies beneath, a hoard of gold, lost knowledge, an old map of the land or a relic. Excavation can also reveal a new road for your people. It\'s a long way from home, so send an escort.',
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
    // Some worlds hold bog iron (#39): a cheap question at the Storehouse, asked while the Stone Age lasts.
    when: (s, me) => !s.scenario && ageOf(s.players[me]) === 'stone' && secsIn(s) > 140 && has(s, me, 'storehouse') && !s.players[me].techs.includes('survey'),
    text: 'Some worlds hold <b>bog iron</b> and some don\'t. A Storehouse can <b>Survey the Land</b> (🧭) for a little food and wood: the answer is yes or no, never where.',
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
      return ageOf(p) === 'middle' && roadKnown(s, p, PILGRIM_ROAD) && !deedsDone(p, PILGRIM_ROAD);
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
      return ageOf(p) === 'middle' && roadKnown(s, p, SAIL_ROAD) && !deedsDone(p, SAIL_ROAD);
    },
    text: `The sea is a road. Land ${SAIL_ROAD.deed!.n} fish with your boats, and the Town Center (🔀) can turn your people into the <b>${AGES.sail.name}</b>: fishing is half again as quick, ships cost less and have sturdier hulls, but the fields yield less. The road shuts once you advance.`,
  },
  {
    id: 'fairs',
    // The hybrid (#49): a merchant or pilgrim people with the other system's building in view.
    when: (s, me) => {
      const p = s.players[me];
      return roadsFrom(p).some((r) => r.to === 'fair' && roadKnown(s, p, r) && !deedsDone(p, r));
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


