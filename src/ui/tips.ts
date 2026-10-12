import { BUILDINGS, EPOCHS, LAST_EPOCH } from '../sim/data';
import type { Building, GameState, Unit } from '../sim/types';
import { R_FISH } from '../sim/types';

/**
 * Advice for a first game, one tip at a time in a corner: what to do next, given how the match is
 * going. Each tip shows once; the player can close them for good.
 */

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

const TIPS: Tip[] = [
  { id: 'gather', when: (s) => secsIn(s) > 2, text: 'Drag a box around your <b>citizens</b>, then <b>right-click</b> berry bushes, trees or a deer to gather food and wood.' },
  { id: 'train', when: (s) => secsIn(s) > 25, text: 'More citizens mean a faster economy. Click your <b>Town Center</b> and press <kbd>Q</kbd> to train one (you can queue several).' },
  { id: 'house', when: (s, me) => s.players[me].pop >= s.players[me].cap - 2, text: 'You are nearly out of room. Select a citizen, press <kbd>B</kbd> then <kbd>E</kbd> to build a <b>house</b> (5 more people each).' },
  { id: 'idle', when: (s, me) => secsIn(s) > 60 && units(s, me).some((u) => u.type === 'citizen' && u.order.k === 'idle'), text: 'Someone is standing around: press <kbd>.</kbd> to find idle citizens and put them to work.' },
  { id: 'store', when: (s) => secsIn(s) > 110, text: 'Long walks waste time. Build a <b>Storehouse</b> (<kbd>B</kbd> <kbd>S</kbd>) next to the woods or a mine. It also teaches better tools.' },
  { id: 'army', when: (s) => secsIn(s) > 200, text: 'Rivals will come. Build a <b>Barracks</b> (<kbd>V</kbd> <kbd>B</kbd>) and train soldiers. Infantry beat cavalry, archers beat infantry, cavalry beat archers.' },
  { id: 'farm', when: (s, me) => secsIn(s) > 260 && !has(s, me, 'farm'), text: 'Berries and deer run out. <b>Farms</b> (<kbd>B</kbd> <kbd>F</kbd>) give food forever; build them near your Town Center.' },
  {
    id: 'epoch',
    when: (s, me) => {
      const p = s.players[me];
      if (p.epoch >= LAST_EPOCH) return false;
      const c = EPOCHS[p.epoch + 1].cost;
      return (p.res.food >= (c.food ?? 0)) && (p.res.gold >= (c.gold ?? 0)) && (p.res.wood >= (c.wood ?? 0)) && (p.res.stone >= (c.stone ?? 0));
    },
    text: 'You can afford the next epoch! Select the Town Center and press <kbd>W</kbd>. New epochs bring stronger units and new buildings.',
  },
  { id: 'bell', when: (s, me) => s.players[me].alert > 0 && s.tick - s.players[me].alert < 40, text: 'Under attack? Ring the <b>town bell</b> (Town Center, <kbd>R</kbd>): citizens shelter inside and the Town Center shoots more arrows. <kbd>T</kbd> sends them back to work.' },
  { id: 'forge', when: (s, me) => s.players[me].epoch >= 1 && secsIn(s) > 30 && !has(s, me, 'forge'), text: `A <b>Forge</b> (<kbd>V</kbd> <kbd>R</kbd>) makes every soldier hit harder and take less damage. The <b>${BUILDINGS.market.name}</b> trades surplus goods for gold.` },
  { id: 'queue', when: (s) => secsIn(s) > 420, text: 'Hold <kbd>Shift</kbd> while giving orders to queue them: walk here, then there, then attack. <kbd>,</kbd> selects your whole army.' },
  { id: 'wonder', when: (s, me) => s.players[me].epoch >= 2, text: 'Rich? Build a <b>Wonder</b> (<kbd>B</kbd> <kbd>X</kbd>). If it stands long enough, you win, but everyone will come for it.' },
  { id: 'dock', when: (s, me) => secsIn(s) > 150 && !has(s, me, 'dock') && waterNear(s, me), text: 'Water nearby! A <b>Dock</b> (<kbd>B</kbd> <kbd>D</kbd>) on the shore trains <b>fishing boats</b>: fish shoals feed you for a long time. Later, warships and transports.' },
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
