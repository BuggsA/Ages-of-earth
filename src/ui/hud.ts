import { seasonOf } from '../sim/seasons';
import { scenarioById } from '../sim/campaign';
import { objectivesHtml } from './campaignUi';
import { rankOf } from '../sim/combat';
import { heroBusy, shortfall, MAX_QUEUE } from '../sim/commands';
import { AGES, AMOUNT, BEACON, BOAR, RALLY, STEP_BACK, stepBackCost, VETERANCY, BUILDINGS, BUILDING_TYPES, CIVS, WORK, WORKS, SIGNATURES, EPOCHS, MARKET, RELIC, ROT, REPAIR_SHARE, RUINS, LANDMARKS, TRADE, RES_LABEL, TECHS, TECH_IDS, TICK_HZ, domainOf, secs, unitEpoch } from '../sim/data';
import { scoreOf } from '../sim/game';
import { carriedBy, keptIn, relicAt } from '../sim/relics';
import { homeMarket, marketOf, postAt, tripGold } from '../sim/trade';
import { RUIN_FINDS, digWork, ruinAt } from '../sim/ruins';
import { LANDMARK_KINDS, claimWork, claimants, favours, landmarkAt } from '../sim/landmarks';
import { workProblem } from '../sim/works';
import { beaconProblem, lit } from '../sim/beacon';
import { rallyProblem } from '../sim/rally';
import { stirred as stirredNow } from '../sim/combat';
import { sees } from '../sim/vision';
import { buildingCostFor, buildingMaxHp, modsOf, statsFor, techCostFor, techProblem, trainCostFor, trainTimeFor } from '../sim/stats';
import { ageDef, ageOf, backProblem, backTo, barred, deedsProgress, ironTradeShare, isHire, isSideRoad, journeyOf, suspendedBelow, mainRoad, relicTradeShare, roadKnown, roadProblem, roadsFrom, shutRoads, surveyFinds, suspendedTechs, trainsAt, windowsOf } from '../sim/ages';
import type { Building, BuildingType, Command, Cost, Ent, GameState, Landmark, Player, Ruin, Stance, TechId, TradePost, Unit } from '../sim/types';
import { RES, R_BERRY, R_BOG, R_FISH, R_GOLD, R_MEAT, R_STONE, R_TREE } from '../sim/types';
import { costHtml, icon } from './icons';
import { buildingPicture, unitPicture } from './thumbs';
import { idleCitizens } from './idle';
import { workforce, WORKFORCE_JOBS } from './workforce';

/**
 * The heads-up display: resources and population along the top with the epoch and the clock, and along
 * the bottom what is selected (a portrait and its numbers, a training queue, or a whole army as
 * portraits) beside a command card whose buttons change with the selection and answer to hotkeys.
 */

export interface HudActions {
  issue(c: Command): void;
  /** Start placing a building with the selected citizens. */
  place(type: BuildingType): void;
  /** Wait for a left click to attack-move to. */
  attackMove(): void;
  /** Wait for a left click on a building to shelter in (or a transport to board). */
  garrisonMode(): void;
  /** Wait for a left click on a shore to land a transport's passengers. */
  unloadMode(): void;
  select(ids: number[]): void;
  focus(x: number, y: number): void;
  sound(name: 'click' | 'error' | 'queue' | 'open'): void;
}

interface Cmd {
  key: string;
  pic: string;
  glyph?: string;
  title: string;
  desc: string;
  cost?: Cost;
  ok: boolean;
  why?: string;
  count?: number;
  on?: boolean;
  run: () => void;
}

/** Explain the shared quote without implying that the automatic drift is a forecast. */
function marketTrend(price: number, res: 'food' | 'wood' | 'stone'): string {
  const base = MARKET.start[res];
  return price < base ? `↑ recovering toward ${base}` : price > base ? `↓ recovering toward ${base}` : `→ steady at ${base}`;
}

const ACT_WORDS: Record<string, string> = {
  idle: 'Standing by',
  walk: 'Walking',
  attack: 'Fighting',
  chop: 'Cutting wood',
  mine: 'Mining',
  forage: 'Gathering berries',
  farm: 'Farming',
  build: 'Building',
  chant: 'Chanting',
  fish: 'Fishing',
};

function orderWords(s: GameState, u: Unit): string {
  const o = u.order;
  if (u.inside && s.byId.get(u.inside)?.kind === 'unit') return 'Aboard a ship';
  switch (o.k) {
    case 'gather': {
      const kind = s.res[o.tile];
      if (kind === R_FISH || u.type === 'fisher') return o.phase === 'drop' ? 'Bringing the catch to the dock' : o.phase === 'work' ? 'Fishing' : 'Sailing to the fishing grounds';
      const what = o.res === 'food' ? (kind === R_MEAT ? 'meat' : 'berries') : o.res === 'wood' ? 'wood' : kind === R_BOG || o.bog ? 'bog iron' : o.res;
      if (o.phase === 'drop') return `Carrying ${what} home`;
      if (o.phase === 'work') return kind === R_TREE ? 'Cutting wood' : kind === R_BERRY ? 'Gathering berries' : kind === R_MEAT ? 'Butchering a deer' : kind === R_GOLD ? 'Mining gold' : kind === R_BOG ? 'Digging bog iron' : kind === R_STONE ? 'Quarrying stone' : 'Gathering';
      return `Going to gather ${what}`;
    }
    case 'farm':
      return o.phase === 'drop' ? 'Carrying grain home' : o.phase === 'work' ? 'Farming' : 'Going to the fields';
    case 'build': {
      const target = s.byId.get(o.target);
      if (target?.kind === 'building' && target.built) return u.act === 'build' ? 'Repairing' : 'Going to repair';
      return u.act === 'build' ? 'Building' : 'Going to build';
    }
    case 'attack':
      return u.act === 'attack' ? 'Fighting' : 'Charging';
    case 'move':
      return o.amove ? 'Marching to attack' : 'Moving';
    case 'deliver':
      return 'Carrying resources home';
    case 'hunt':
      return 'Hunting';
    case 'convert':
      return u.act === 'chant' ? 'Converting' : 'Going to convert';
    case 'heal':
      return 'Healing';
    case 'garrison':
      return u.inside ? 'Sheltering inside' : 'Going to shelter';
    case 'board':
      return 'Going aboard';
    case 'unload':
      return u.cargo.length ? 'Sailing to land passengers' : 'Moving';
    case 'relic':
      return carriedBy(s, u) ? 'Carrying a relic to the Temple' : 'Going for a relic';
    case 'dig':
      return u.act === 'mine' ? 'Digging at the ruins' : 'Going to dig at the ruins';
    case 'trade':
      if (u.type === 'cog') return o.phase === 'back' ? (u.carry > 0 ? 'Sailing gold home to the Dock' : 'Going home to the Dock') : 'Sailing goods to the port';
      return o.phase === 'back' ? (u.carry > 0 ? 'Bringing gold home to the Market' : 'Going home to the Market') : 'Taking goods to the trading post';
    default:
      if (carriedBy(s, u)) return 'Holding a relic';
      if (u.type === 'trader' && u.carry > 0) return 'Waiting with gold: right-click a Market';
      if (u.type === 'cog' && u.carry > 0) return 'Waiting with gold: right-click a Dock';
      return ACT_WORDS[u.act] ?? 'Standing by';
  }
}

const fmtTime = (ticks: number) => {
  const sec = Math.floor(ticks / TICK_HZ);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};

export class Hud {
  /** Showing a build menu for citizens. */
  buildMenu: 'eco' | 'mil' | null = null;
  private cmds: Cmd[] = [];
  private resEl = document.getElementById('res-bar')!;
  private epochEl = document.getElementById('epoch-chip')!;
  private clockEl = document.getElementById('clock')!;
  private idleEl = document.getElementById('idle-btn')!;
  private workforceBtn = document.getElementById('workforce-btn') as HTMLButtonElement;
  private workforcePanel = document.getElementById('workforce-panel')!;
  private selEl = document.getElementById('selection')!;
  private cmdEl = document.getElementById('commands')!;
  private tipEl = document.getElementById('tooltip')!;
  private noticeEl = document.getElementById('notices')!;
  private bannerEl = document.getElementById('banner')!;
  private timerEl = document.getElementById('timers')!;
  private timerHtml = '';
  private selSig = '';
  private cmdSig = '';
  private topSig = '';
  private bannerTimer = 0;
  private recent = new Map<string, number>();
  private tipFor: HTMLElement | null = null;
  private state: GameState | null = null;
  private viewer = 0;

  constructor(private act: HudActions) {
    this.workforceBtn.addEventListener('click', () => {
      const open = this.workforcePanel.classList.toggle('hidden');
      this.workforceBtn.setAttribute('aria-expanded', String(!open));
      if (!open && this.state) this.drawWorkforce(this.state, this.viewer);
    });
    this.workforcePanel.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-job]');
      if (!row || !this.state) return;
      const job = row.dataset.job;
      const ids = workforce(this.state, this.viewer).get(job ?? '') ?? [];
      if (ids.length) {
        this.act.select(ids);
        this.act.sound('click');
      }
      this.workforcePanel.classList.add('hidden');
      this.workforceBtn.setAttribute('aria-expanded', 'false');
    });
    this.cmdEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
      if (!b) return;
      const c = this.cmds[Number(b.dataset.i)];
      if (c) this.runCmd(c);
    });
    this.cmdEl.addEventListener('contextmenu', (e) => e.preventDefault());
    this.timerEl.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-focus]');
      if (t) {
        const [x, y] = t.dataset.focus!.split(',').map(Number);
        this.act.focus(x, y);
      }
    });
    this.selEl.addEventListener('click', (e) => {
      const q = (e.target as HTMLElement).closest<HTMLElement>('[data-cancel]');
      if (q && this.state) {
        const [b, i] = q.dataset.cancel!.split(':').map(Number);
        this.act.issue({ t: 'cancel', p: this.viewer, building: b, index: i });
        this.act.sound('click');
        return;
      }
      const m = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
      if (m) {
        const ids = m.dataset.pick!.split(',').map(Number);
        if ((e as MouseEvent).shiftKey) this.act.select(this.lastIds.filter((id) => !ids.includes(id)));
        else this.act.select(ids);
      }
    });
    // Tooltips for anything with data-tip (or a command button).
    document.getElementById('hud')!.addEventListener('mousemove', (e) => this.hover(e));
    document.getElementById('hud')!.addEventListener('mouseleave', () => this.hideTip());
  }

  private lastIds: number[] = [];

  private runCmd(c: Cmd): void {
    if (!c.ok) {
      this.toast(c.why ?? "Can't do that now", 'bad');
      this.act.sound('error');
      return;
    }
    c.run();
  }

  /** Press a command's hotkey. Returns whether one was found. */
  hotkey(key: string): boolean {
    const k = key.toUpperCase();
    const c = this.cmds.find((x) => x.key === k);
    if (!c) return false;
    this.runCmd(c);
    return true;
  }

  toast(msg: string, kind: 'bad' | 'good' | 'info' | 'alert' = 'info'): void {
    const now = performance.now();
    if ((this.recent.get(msg) ?? 0) > now - 2500) return;
    this.recent.set(msg, now);
    const el = document.createElement('div');
    el.className = `notice ${kind}`;
    el.textContent = msg;
    this.noticeEl.appendChild(el);
    while (this.noticeEl.children.length > 4) this.noticeEl.firstChild!.remove();
    setTimeout(() => (el.style.opacity = '0'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  banner(title: string, sub = '', ms = 3200): void {
    this.bannerEl.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    this.bannerEl.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('show'), ms);
  }

  /** Bring every part of the HUD up to date. */
  /** `selectedRuin`: a ruin picked out, and whether the viewer last saw it dug out (#64). */
  /** `selectedLandmark`: a landmark picked out, and who the viewer last saw keep it. */
  update(s: GameState, viewer: number, ids: number[], speed: number, selectedTile: number | null, selectedRelic: number | null = null, selectedPost: number | null = null, selectedRuin: { id: number; dug: boolean } | null = null, selectedLandmark: { id: number; keeper: number } | null = null): void {
    this.state = s;
    this.viewer = viewer;
    this.lastIds = ids;
    this.top(s, viewer, speed);
    if (!this.workforcePanel.classList.contains('hidden')) this.drawWorkforce(s, viewer);
    const ents = ids.map((id) => s.byId.get(id)).filter((e): e is Ent => !!e && e.hp > 0);
    this.selection(s, viewer, ents, selectedTile, selectedRelic, selectedPost, selectedRuin, selectedLandmark);
    this.commands(s, viewer, ents);
  }

  private drawWorkforce(s: GameState, viewer: number): void {
    const jobs = workforce(s, viewer);
    const total = WORKFORCE_JOBS.reduce((n, job) => n + (jobs.get(job.key)?.length ?? 0), 0);
    this.workforcePanel.innerHTML = `<div class="workforce-head">Workforce <span>${total} citizens</span></div>` +
      WORKFORCE_JOBS.map((job) => {
        const n = jobs.get(job.key)?.length ?? 0;
        return `<button type="button" data-job="${job.key}" ${n ? '' : 'disabled'} title="Select ${job.label.toLowerCase()} citizens"><span>${job.icon} ${job.label}</span><strong>${n}</strong></button>`;
      }).join('') + '<div class="workforce-note">Choose a row to select its citizens. No orders are changed.</div>';
  }

  private top(s: GameState, viewer: number, speed: number): void {
    const p = s.players[viewer];
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === viewer && e.advance >= 0);
    const idle = idleCitizens(s, viewer).length;
    const road = tc ? journeyOf(p, tc) : undefined;
    const adv = road ? Math.floor((tc!.advance / secs(road.time)) * 100) : -1;
    const age = ageDef(p);
    const idleTechs = suspendedTechs(p).map((t) => TECHS[t].name);
    const scores = s.players.map((q) => scoreOf(s, q));
    const sig = `${RES.map((r) => Math.floor(p.res[r])).join(',')}|${p.pop}/${p.cap}|${ageOf(p)}|${adv}|${idleTechs.length}|${idle}|${speed}|${scores.join(',')}`;
    const sn = seasonOf(s);
    this.clockEl.textContent = `${sn.icon} ${fmtTime(s.tick)}`;
    this.clockEl.title = `${sn.name}: ${sn.blurb}`;
    this.timers(s, viewer);
    this.objectives(s);
    if (sig === this.topSig) return;
    this.topSig = sig;
    this.resEl.innerHTML =
      RES.map((r) => `<div class="res" data-tip="<b>${RES_LABEL[r]}</b>${resHint(r)}">${icon(r)}${Math.floor(p.res[r])}</div>`).join('') +
      `<div class="res pop ${p.pop >= p.cap ? 'full' : ''}" data-tip="<b>Population</b>People and soldiers you have, and room for. Houses add 5 each, a Town Center 10 (150 at most).">${icon('pop')}${p.pop}/${p.cap}</div>`;
    const civ = CIVS[p.civ];
    const board = s.players
      .map((q, i) => `<div><span class='swatch' style='background:${q.color}'></span>${q.name}${q.defeated ? ' (out)' : ''}: ${q.id === viewer || q.team === p.team ? scores[i] : '?'}</div>`)
      .join('');
    this.resEl.innerHTML += `<div class="res civ" data-tip="<b>${civ.name}</b>${civ.blurb}<br><i>${SIGNATURES[p.civ].blurb}</i>">${civ.name}</div><div class="res score" data-tip="<b>Score</b>Gathering, fighting, building, research and epochs.${board}">⭐${scores[viewer]}</div>`;
    this.epochEl.innerHTML = road
      ? `${age.name} <span class="bar" data-tip="<b>${road.back ? 'Stepping back' : 'Advancing'} to the ${AGES[road.to].name}</b>${adv}%"><i style="width:${adv}%"></i></span>`
      : `<span data-tip="<b>${age.name}</b>${age.blurb}${idleTechs.length ? `<br>Suspended until you climb again: ${idleTechs.join(', ')}.` : ''}${mainRoad(p) ? `<br><span class='hint'>Advance at a Town Center.</span>` : ''}">${age.name}</span>`;
    this.idleEl.textContent = `Idle ${idle}`;
    this.idleEl.classList.toggle('alert', idle > 0);
    document.getElementById('speed-btn')!.textContent = `${speed}×`;
  }

  private objEl = document.getElementById('objectives')!;
  private objHtml = '';

  /** A campaign scenario's goals, in the corner. */
  private objectives(s: GameState): void {
    const sc = s.scenario ? scenarioById(s.scenario.id) : undefined;
    const html = sc ? objectivesHtml(s, sc) : '';
    if (html === this.objHtml) return;
    this.objHtml = html;
    this.objEl.innerHTML = html;
    this.objEl.classList.toggle('hidden', !html);
  }

  /** Peace time and wonder countdowns under the top bar. */
  private timers(s: GameState, viewer: number): void {
    const parts: string[] = [];
    if (s.tick < s.peaceUntil) parts.push(`<div class="timer peace">🕊 Peace for ${fmtTime(s.peaceUntil - s.tick)}</div>`);
    for (const e of s.ents) {
      if (e.kind !== 'building' || e.type !== 'wonder' || e.timer < 0 || e.hp <= 0) continue;
      const q = s.players[e.owner];
      const ours = q.team === s.players[viewer].team;
      parts.push(`<div class="timer ${ours ? 'good' : 'bad'}" data-focus="${e.x},${e.y}"><span class="swatch" style="background:${q.color}"></span>${q.id === viewer ? 'Your' : `${q.name}'s`} Wonder: ${fmtTime(e.timer)}${ours ? '' : ' (destroy it!)'}</div>`);
    }
    if (s.relicTeam >= 0 && s.relicTimer >= 0) {
      const ours = s.relicTeam === s.players[viewer].team;
      const keepers = s.players.filter((q) => q.team === s.relicTeam);
      const who = ours ? (keepers.length > 1 ? 'Your side keeps' : 'You keep') : `${keepers.map((q) => q.name).join(' and ')} ${keepers.length > 1 ? 'keep' : 'keeps'}`;
      const shrine = s.relics[0] ? s.byId.get(s.relics[0].temple) : undefined;
      const focus = shrine ? ` data-focus="${shrine.x},${shrine.y}"` : '';
      parts.push(`<div class="timer ${ours ? 'good' : 'bad'}"${focus}>⚱ ${who} every relic: ${fmtTime(s.relicTimer)}${ours ? '' : ' (take one back!)'}</div>`);
    }
    const html = parts.join('');
    if (html !== this.timerHtml) {
      this.timerHtml = html;
      this.timerEl.innerHTML = html;
    }
  }

  private selection(s: GameState, viewer: number, ents: Ent[], tile: number | null, relicId: number | null, postId: number | null, ruinSel: { id: number; dug: boolean } | null = null, markSel: { id: number; keeper: number } | null = null): void {
    let html = '';
    let sig = '';
    const relic = !ents.length && relicId !== null ? relicAt(s, relicId) : undefined;
    const post = !ents.length && postId !== null ? postAt(s, postId) : undefined;
    const ruin = !ents.length && ruinSel ? ruinAt(s, ruinSel.id) : undefined;
    const mark = !ents.length && markSel ? landmarkAt(s, markSel.id) : undefined;
    if (mark) [html, sig] = this.landmarkPanel(s, viewer, mark, markSel!.keeper);
    else if (ruin) [html, sig] = this.ruinPanel(s, viewer, ruin, ruinSel!.dug);
    else if (relic) [html, sig] = this.relicPanel(s, viewer, relic);
    else if (post) [html, sig] = this.postPanel(s, viewer, post);
    else if (!ents.length && tile !== null && s.res[tile]) {
      const kind = s.res[tile];
      const name = kind === R_TREE ? 'Tree' : kind === R_BERRY ? 'Berry bush' : kind === R_MEAT ? (s.amount[tile] > BOAR.meat ? 'Mammoth carcass' : s.amount[tile] > AMOUNT.meat ? 'Boar carcass' : 'Carcass') + (s.carcasses?.some((c) => c.tile === tile && s.tick - c.born >= secs(ROT.grace)) ? ' (spoiling)' : '') : kind === R_FISH ? 'Fish shoal' : kind === R_GOLD ? 'Gold mine' : kind === R_BOG ? 'Bog iron' : 'Stone quarry';
      const res = kind === R_TREE ? 'wood' : kind === R_BERRY || kind === R_MEAT || kind === R_FISH ? 'food' : kind === R_GOLD || kind === R_BOG ? 'gold' : 'stone';
      sig = `res:${tile}:${s.amount[tile]}`;
      html = `<div class="sel-portrait"><span style="font-size:54px">${kind === R_TREE ? '🌳' : kind === R_BERRY ? '🫐' : kind === R_MEAT ? '🍖' : kind === R_FISH ? '🐟' : kind === R_GOLD ? icon('gold', 64) : kind === R_BOG ? '🟤' : icon('stone', 64)}</span></div>
        <div class="sel-info"><div class="sel-name">${name}</div><div class="stats"><span>${icon(res as 'wood')}${s.amount[tile]} left</span></div>
        <div class="blurb">${kind === R_FISH ? 'Select fishing boats (from a Dock) and right-click it to fish.' : kind === R_BOG ? 'Rust-red ore in the wetland mud, smelted into iron bars and paid in as gold. Digging it opens the Iron Age to a people who have surveyed the land (Storehouse), in the Stone Age.' : 'Select citizens and right-click it to gather.'}</div></div>`;
    } else if (!ents.length) {
      const p = s.players[viewer];
      sig = `none:${ageOf(p)}`;
      html = `<div class="empty-sel"><div class="sel-name">${ageDef(p).name}</div>
        <div>Left-click to select, drag to select many. Right-click to give orders.</div>
        <div><kbd>.</kbd> finds an idle citizen, <kbd>Shift</kbd> + <kbd>.</kbd> selects all idle citizens, <kbd>,</kbd> your army, <kbd>H</kbd> your Town Center; <kbd>B</kbd> and <kbd>V</kbd> build with citizens selected.</div>
        <div>Hold <kbd>Shift</kbd> while giving orders to queue them up.</div></div>`;
    } else if (ents.length === 1) {
      const e = ents[0];
      if (e.kind === 'unit') [html, sig] = this.unitPanel(s, viewer, e);
      else [html, sig] = this.buildingPanel(s, viewer, e);
    } else {
      // Many: portraits grouped by kind, each with its health.
      const groups = new Map<string, Ent[]>();
      for (const e of ents) {
        const k = `${e.owner}:${e.kind}:${e.type}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(e);
      }
      const items: string[] = [];
      for (const list of groups.values()) {
        for (const e of list.slice(0, 60)) {
          const max = e.kind === 'unit' ? statsFor(s, e.owner, e.type).hp : buildingMaxHp(s, e.owner, e.type);
          const pic = e.kind === 'unit' ? unitPicture(e.type, s.players[e.owner].epoch, s.players[e.owner].color) : buildingPicture(e.type, s.players[e.owner].epoch, s.players[e.owner].color);
          items.push(`<div class="mitem" data-pick="${e.id}" data-tip="<b>${nameOf(s, e)}</b>Click to pick only this one; shift-click to drop it."><img src="${pic}" alt=""><div class="mhp"><i style="width:${Math.round((e.hp / max) * 100)}%"></i></div></div>`);
        }
      }
      const counts = [...groups.values()].map((l) => `${l.length} ${l.length > 1 ? plural(nameOf(s, l[0])) : nameOf(s, l[0])}`).join(', ');
      sig = `multi:${ents.map((e) => `${e.id}:${Math.ceil(e.hp)}`).join(',')}`;
      html = `<div class="sel-info" style="flex:0 0 150px"><div class="sel-name">${ents.length} selected</div><div class="sel-sub">${counts}</div></div><div class="multi">${items.join('')}</div>`;
    }
    if (sig !== this.selSig) {
      this.selSig = sig;
      this.selEl.innerHTML = html;
    }
  }

  private relicPanel(s: GameState, viewer: number, r: NonNullable<ReturnType<typeof relicAt>>): [string, string] {
    const holder = r.carrier ? s.byId.get(r.carrier) : r.temple ? s.byId.get(r.temple) : undefined;
    const q = holder ? s.players[holder.owner] : null;
    const status = !q ? 'Lying in the open' : r.carrier ? (q.id === viewer ? 'Carried by your priest' : `Carried by ${q.name}'s priest`) : q.id === viewer ? 'Kept in your Temple' : `Kept in ${q.name}'s Temple`;
    const perMin = Math.round((60 / RELIC.every) * RELIC.gold);
    const html = `<div class="sel-portrait"><span style="font-size:54px">⚱</span></div>
      <div class="sel-info"><div class="sel-name">Relic</div><div class="sel-sub">${status}</div>
      <div class="stats"><span data-tip="<b>Gold</b>Brings in gold while kept in a Temple.">${icon('gold')}${perMin}<em>a minute</em></span><span data-tip="<b>Relics</b>How many lie on this map.">⚱<em>On the map</em> ${s.relics.length}</span></div>
      <div class="blurb">Select a priest and right-click it to carry it to your Temple, where it brings in ${perMin} gold a minute. Keep every relic on the map for ${fmtTime(s.wonderTime)} and you win.</div></div>`;
    return [html, `relic:${r.id}:${status}:${s.relics.length}`];
  }

  /** A contested landmark: who keeps it, how the claim stands (when in sight), and what it gives. */
  private landmarkPanel(s: GameState, viewer: number, m: Landmark, keeperAsSeen: number): [string, string] {
    const inSight = sees(s, viewer, m.x, m.y);
    const keeper = inSight ? m.owner : keeperAsSeen;
    const def = LANDMARK_KINDS[m.kind];
    const who = (p: number) => (p === viewer ? 'you' : s.players[p].name);
    const pct = Math.floor((100 * m.claim) / claimWork());
    let status = keeper < 0 ? 'Nobody keeps it' : `Kept by ${who(keeper)}`;
    if (inSight) {
      const there = claimants(s, m);
      if (there.size > 1) status += ' · contested!';
      else if (m.owner < 0 && m.by >= 0 && m.claim > 0) status += ` · ${m.by === viewer ? 'your' : `${s.players[m.by].name}'s`} claim ${pct}%`;
      else if (m.owner >= 0 && m.claim < claimWork()) status += ` · held ${pct}%`;
    }
    const portrait = m.kind === 'spring' ? '⛲' : m.kind === 'crag' ? '⛰' : m.kind === 'flint' ? '🔶' : m.kind === 'grove' ? '🌳' : '🪨';
    const html = `<div class="sel-portrait"><span style="font-size:54px">${portrait}</span></div>
      <div class="sel-info"><div class="sel-name">${def.name}</div><div class="sel-sub">${status}</div>
      <div class="stats"><span data-tip="<b>Claiming</b>How long one person standing on it alone takes to claim it. Up to ${LANDMARKS.crowd} claim faster; rivals there too stop the claim.">⚑<em>One person</em> ${LANDMARKS.claim}s</span><span data-tip="<b>Land</b>Its keeper holds the land round it: their soldiers are supplied there, and rivals can't build in it.">🗺<em>Land</em> ${LANDMARKS.border} tiles</span></div>
      <div class="blurb">${def.blurb}${favours(s, viewer, m.kind) ? ` It is your people's own: its gift is ${LANDMARKS.kinMul} times as strong for you.` : ''} Send anyone there (citizens too) and keep rivals off it to claim it; a rival standing on it alone pulls it back down to nobody's, then takes it.</div></div>`;
    return [html, `mark:${m.id}:${status}`];
  }

  /** An ancient ruin (#64): what might lie beneath (never what does, until it's dug), and how the dig goes. */
  private ruinPanel(s: GameState, viewer: number, r: Ruin, dugAsSeen: boolean): [string, string] {
    const inSight = sees(s, viewer, r.x, r.y);
    const dug = inSight ? r.by >= 0 : dugAsSeen;
    const ours = r.by >= 0 && s.players[r.by].team === s.players[viewer].team;
    const pct = Math.floor((100 * r.dug) / digWork());
    const mine = s.ents.filter((e) => e.kind === 'unit' && e.owner === viewer && e.order.k === 'dig' && e.order.target === r.id).length;
    const status = dug
      ? ours ? `Dug out by ${r.by === viewer ? 'your people' : s.players[r.by].name}: ${RUIN_FINDS[r.find].name.toLowerCase()}` : 'Dug out: whatever lay here is gone'
      : inSight && r.dug > 0 ? `${pct}% dug${mine ? ` · ${mine} of your citizens at work` : ''}` : mine ? `${mine} of your citizens on the way` : 'Undisturbed';
    const finds = (Object.keys(RUIN_FINDS) as (keyof typeof RUIN_FINDS)[]).map((k) => `<b>${RUIN_FINDS[k].name}</b>: ${RUIN_FINDS[k].blurb}`).join('<br>');
    const html = `<div class="sel-portrait"><span style="font-size:54px">${dug ? '⛏' : '🏛'}</span></div>
      <div class="sel-info"><div class="sel-name">Ancient Ruins</div><div class="sel-sub">${status}</div>
      <div class="stats"><span data-tip="<b>The dig</b>How long one citizen takes to dig it out. More dig quicker.">⛏<em>One citizen</em> ${RUINS.dig}s</span><span data-tip="<b>What may lie beneath</b>${finds}">❔<em>Beneath</em> ${dug && ours ? RUIN_FINDS[r.find].name : dug ? 'gone' : 'unknown'}</span></div>
      <div class="blurb">${dug ? 'Only an open pit and spoil heaps now.' : 'Stones of a people older than any here. Select citizens and right-click to dig: whoever strikes the last spade takes what lies beneath. It might be a hoard of gold, lost knowledge, an old map of the land, or a relic. Diggers far from home want an escort.'}</div></div>`;
    return [html, `ruin:${r.id}:${status}:${dug}`];
  }

  private postPanel(s: GameState, viewer: number, post: TradePost): [string, string] {
    const m = homeMarket(s, viewer, post.x, post.y);
    const pay = m ? tripGold(s, viewer, m, post) : 0;
    const mine = s.ents.filter((e) => e.kind === 'unit' && e.owner === viewer && (e.type === 'trader' || e.type === 'cog') && e.order.k === 'trade' && e.order.post === post.id).length;
    const status = m ? `From your nearest Market: ${icon('gold', 14)}${pay} a trip` : 'Build a Market to trade here';
    const html = `<div class="sel-portrait"><span style="font-size:54px">🐪</span></div>
      <div class="sel-info"><div class="sel-name">Trading Post</div><div class="sel-sub">${status}</div>
      <div class="stats"><span data-tip="<b>Your traders</b>On the road to this post.">🐪<em>Your traders</em> ${mine}</span><span data-tip="<b>Most a trip</b>The farthest roads pay up to this.">${icon('gold')}<em>At most</em> ${TRADE.max}</span></div>
      <div class="blurb">Neutral ground where anyone may trade. Train traders at a Market, select them and right-click here: they carry goods out and bring back gold, the more the farther their Market stands from the post. Where water lies within ${TRADE.sea.reach} tiles it is a port too: merchant ships from a Dock sail here for ${Math.round((TRADE.sea.mul - 1) * 100)}% more. Nothing is paid until they are home, so guard the road.</div></div>`;
    return [html, `post:${post.id}:${status}:${mine}`];
  }

  private unitPanel(s: GameState, viewer: number, u: Unit): [string, string] {
    const p = s.players[u.owner];
    const st = statsFor(s, u.owner, u.type);
    const frac = u.hp / st.hp;
    const mine = u.owner === viewer;
    const queued = mine && u.queue.length ? ` <span class="hint">(+${u.queue.length} queued)</span>` : '';
    const status = mine ? orderWords(s, u) + queued : p.name;
    const carry = mine && u.carry > 0 && u.carryRes ? `<span>${icon(u.carryRes)}${u.carry}<em>carried</em></span>` : '';
    const cargo = u.type === 'transport' ? `<span data-tip="<b>Aboard</b>Soldiers and citizens carried. Right-click a shore (or press U) to land them.">⛵<em>Aboard</em> ${u.cargo.length}/${st.capacity ?? 0}</span>` : '';
    const stance = st.attack > 0 && u.type !== 'citizen' && mine ? `<span data-tip="<b>Stance</b>Z aggressive, X defensive, C stand ground.">${u.stance === 'stand' ? '⚓ Stand' : u.stance === 'defensive' ? '🛡 Defend' : '🔥 Aggressive'}</span>` : '';
    const aura = s.tick - u.aura < 5 && u.type !== 'hero' ? `<span data-tip="<b>Inspired</b>A hero nearby: hits harder and heals.">✨<em>Inspired</em></span>` : '';
    const rank = rankOf(u);
    const vet = rank ? `<span data-tip="<b>${VETERANCY.names[rank - 1]}</b>${u.vet} enemy soldiers defeated: blows ${Math.round((VETERANCY.attack[rank - 1] - 1) * 100)}% harder${VETERANCY.armor[rank - 1] ? `, +${VETERANCY.armor[rank - 1]} armor` : ''}.">${'▲'.repeat(rank)}<em>${VETERANCY.names[rank - 1]}</em></span>` : '';
    const o = u.order;
    const route = mine && o.k === 'trade' ? postAt(s, o.post) : undefined;
    const home = route && o.k === 'trade' ? (marketOf(s, u.owner, o.market) ?? homeMarket(s, u.owner, route.x, route.y)) : null;
    const trip = route && home ? `<span data-tip="<b>A trip</b>What one trip between its Market and the post pays, once home.">${icon('gold')}${tripGold(s, u.owner, home, route)}<em>a trip</em></span>` : '';
    const held = u.type === 'priest' && carriedBy(s, u) ? `<span data-tip="<b>Relic</b>Carried to a Temple, it brings in gold. Hands full: no healing or converting until it is set down (D).">⚱<em>Relic</em></span>` : '';
    const sig = `u:${u.id}:${Math.ceil(u.hp)}:${status}:${u.carry}:${p.epoch}:${p.statsVersion}:${u.stance}:${s.tick - u.aura < 5}:${u.cargo.length}:${rank}`;
    const html = `<div class="sel-portrait"><img src="${unitPicture(u.type, p.epoch, p.color)}" alt=""></div>
      <div class="sel-info">
        <div class="sel-name">${s.kings.includes(u.id) ? `👑 King (${st.name})` : st.name}</div>
        <div class="sel-sub">${mine ? status : `<span class="swatch" style="background:${p.color}"></span>${p.name}`}</div>
        ${hpBar(u.hp, st.hp, frac)}
        <div class="stats">
          ${st.attack ? `<span data-tip="<b>Attack</b>Damage per blow or shot, before armor and the counter bonus.">⚔<em>Attack</em> ${st.attack}</span>` : ''}
          <span data-tip="<b>Armor</b>Melee / missile armor: taken off every blow or shot.">🛡<em>Armor</em> ${st.armor}/${st.parmor}</span>
          ${st.range ? `<span data-tip="<b>Range</b>How far it shoots, in tiles.">🏹<em>Range</em> ${st.range}</span>` : ''}
          <span data-tip="<b>Speed</b>Tiles per second.">👣<em>Speed</em> ${Math.round(st.speed * 100) / 100}</span>
          ${carry}${cargo}${stance}${vet}${aura}${held}${trip}
        </div>
        <div class="blurb">${st.blurb}</div>
      </div>`;
    return [html, sig];
  }

  private buildingPanel(s: GameState, viewer: number, b: Building): [string, string] {
    const p = s.players[b.owner];
    const def = BUILDINGS[b.type];
    const max = buildingMaxHp(s, b.owner, b.type);
    const mine = b.owner === viewer;
    let status = '';
    let queue = '';
    if (!b.built) status = `Under construction: ${Math.floor(b.progress * 100)}%`;
    else if (b.advance >= 0 && journeyOf(p, b)) {
      const road = journeyOf(p, b)!;
      const pct = Math.floor((b.advance / secs(road.time)) * 100);
      status = `${road.back ? 'Stepping back' : 'Advancing'} to the ${AGES[road.to].name}: ${pct}%`;
      if (mine) queue = `<div class="queue"><div class="qitem" data-cancel="${b.id}:-1" data-tip="<b>${AGES[road.to].name}</b>Click to cancel (full refund)."><span class="qglyph">${road.back ? '⏬' : '⏫'}</span><div class="prog"><i style="width:${pct}%"></i></div></div></div>`;
    } else if (b.queue.length) {
      const it = b.queue[0];
      const need = it.tech ? secs(TECHS[it.tech].time) : secs(trainTimeFor(s, b.owner, it.unit!, b.type));
      const pct = Math.min(100, Math.floor((it.done / need) * 100));
      status = it.tech ? `Researching ${TECHS[it.tech].name}: ${pct}%` : it.done > need ? 'Waiting for room: build houses' : `Training ${statsFor(s, b.owner, it.unit!).name}: ${pct}%`;
      if (mine)
        queue = `<div class="queue">${b.queue
          .map((q, i) => {
            const qp = i === 0 ? pct : 0;
            const name = q.tech ? TECHS[q.tech].name : statsFor(s, b.owner, q.unit!).name;
            const face = q.tech ? `<span class="qglyph">${TECHS[q.tech].icon}</span>` : `<img src="${unitPicture(q.unit!, p.epoch, p.color)}" alt="">`;
            return `<div class="qitem" data-cancel="${b.id}:${i}" data-tip="<b>${name}</b>Click to cancel (full refund).">${face}<div class="prog"><i style="width:${qp}%"></i></div></div>`;
          })
          .join('')}</div>`;
    } else if (b.type === 'farm' && b.built) {
      const f = b.farmer ? s.byId.get(b.farmer) : undefined;
      status = f && f.kind === 'unit' && f.order.k === 'farm' && f.order.target === b.id ? 'Worked by a citizen' : 'Waiting for a farmer';
    } else if (b.type === 'wonder' && b.timer >= 0) status = `Stands ${fmtTime(b.timer)} more for victory`;
    else if (b.type === 'market') {
      const traders = s.ents.filter((e) => e.kind === 'unit' && e.owner === b.owner && e.type === 'trader' && e.order.k === 'trade' && e.order.market === b.id).length;
      const fair = relicTradeShare(s, b.owner);
      const wares = ironTradeShare(s, b.owner);
      status = `Prices: ${(['food', 'wood', 'stone'] as const).map((r) => `${icon(r, 14)}${s.market[r]} ${s.market[r] < MARKET.start[r] ? '↑' : s.market[r] > MARKET.start[r] ? '↓' : '→'}`).join(' ')}${traders ? ` · 🐪 ${traders} on the road` : ''}${fair > 1 ? ` · ⚱ trade +${Math.round((fair - 1) * 100)}% for relics kept` : ''}${wares > 1 ? ` · ⛓ trade +${Math.round((wares - 1) * 100)}% for iron dug` : ''}`;
    }
    else if (b.type === 'dock') status = 'Fishing boats bring their catch here';
    else if (b.type === 'storehouse' && p.techs.includes('survey')) status = surveyFinds(s, 'survey') ? '🧭 Bog iron lies somewhere in this world' : '🧭 No bog iron in this world';
    else if (b.type === 'temple' && keptIn(s, b)) status = `Keeps ${keptIn(s, b)} relic${keptIn(s, b) > 1 ? 's' : ''}: ${icon('gold', 14)}${Math.round((60 / RELIC.every) * Math.round(RELIC.gold * modsOf(s, b.owner).relicGold) * keptIn(s, b))} a minute`;
    else status = def.drop.length ? 'Drop-off for every resource' : def.pop ? `Room for ${def.pop}` : 'Ready';
    if (!mine) status = `<span class="swatch" style="background:${p.color}"></span>${p.name}${b.type === 'wonder' && b.timer >= 0 ? `: wins in ${fmtTime(b.timer)}` : ''}${b.type === 'temple' && keptIn(s, b) ? `: keeps ${keptIn(s, b)} relic${keptIn(s, b) > 1 ? 's' : ''}` : ''}`;
    const inside = def.garrison && b.built ? `<div class="stats"><span data-tip="<b>Sheltering</b>Units inside are safe, heal slowly and add arrows.">🏰<em>Inside</em> ${b.garrison.length}/${def.garrison}</span></div>` : '';
    const sig = `b:${b.id}:${Math.ceil(b.hp)}:${status}:${b.queue.length}:${p.epoch}:${queue.length}:${b.garrison.length}`;
    const html = `<div class="sel-portrait"><img src="${buildingPicture(b.type, p.epoch, p.color)}" alt=""></div>
      <div class="sel-info">
        <div class="sel-name">${def.name}</div>
        <div class="sel-sub">${status}</div>
        ${hpBar(b.hp, max, b.hp / max)}
        ${mine && b.type === 'market' && b.built ? `<div class="blurb">Prices shared by all players. ↑ recovers upward, ↓ downward, → steady. Drift: ${MARKET.recover} gold every ${MARKET.every}s toward the starting quote; trades move it immediately.</div>` : ''}
        ${mine && b.built && b.hp < max ? `<div class="blurb">Select citizens and right-click to repair (a full repair costs ${Math.round(REPAIR_SHARE * 100)}% of its price).${def.garrison ? ' Press G to shelter instead.' : ''}</div>` : ''}
        ${inside}
        ${queue || `<div class="blurb">${def.blurb}${def.guns ? ` Shoots ${def.guns.range} tiles.` : ''}</div>`}
      </div>`;
    return [html, sig];
  }

  private commands(s: GameState, viewer: number, ents: Ent[]): void {
    const p = s.players[viewer];
    const mine = ents.filter((e) => e.owner === viewer);
    const units = mine.filter((e): e is Unit => e.kind === 'unit');
    const citizens = units.filter((u) => u.type === 'citizen');
    const soldiers = units.filter((u) => u.type !== 'citizen' && u.type !== 'fisher' && u.type !== 'transport' && u.type !== 'trader' && u.type !== 'cog');
    const walkers = units.filter((u) => domainOf(u.type) === 'land');
    const transports = units.filter((u) => u.type === 'transport');
    const cmds: Cmd[] = [];
    if (!citizens.length) this.buildMenu = null;

    if (citizens.length && this.buildMenu) {
      for (const type of BUILDING_TYPES) {
        const def = BUILDINGS[type];
        if (def.menu !== this.buildMenu) continue;
        const locked = def.epoch > p.epoch;
        const cost = buildingCostFor(s, viewer, type);
        const short = shortfall(p, cost);
        const wonderUp = type === 'wonder' && s.ents.some((e) => e.kind === 'building' && e.owner === viewer && e.type === 'wonder');
        cmds.push({
          key: def.key,
          pic: buildingPicture(type, p.epoch, p.color),
          title: def.name,
          desc: def.blurb + (type === 'wall' ? ' Click and drag to lay out a line.' : ''),
          cost,
          ok: !locked && !short && !wonderUp,
          why: locked ? `Needs the ${EPOCHS[def.epoch].name}` : wonderUp ? 'You already have a wonder' : (short ?? undefined),
          run: () => this.act.place(type),
        });
      }
      cmds.push({ key: 'ESCAPE', pic: '', glyph: '↩', title: 'Back', desc: 'Back to the commands.', ok: true, run: () => (this.buildMenu = null) });
    } else if (units.length) {
      if (citizens.length) {
        cmds.push({ key: 'B', pic: '', glyph: '🏠', title: 'Build (economy)', desc: 'Houses, farms, storehouses, markets, temples, walls and wonders.', ok: true, run: () => ((this.buildMenu = 'eco'), this.act.sound('open')) });
        cmds.push({ key: 'V', pic: '', glyph: '🛡', title: 'Build (military)', desc: 'Barracks, ranges, stables, forges, siege workshops and towers.', ok: true, run: () => ((this.buildMenu = 'mil'), this.act.sound('open')) });
      }
      if (soldiers.length) cmds.push({ key: 'A', pic: '', glyph: '⚔', title: 'Attack-move', desc: 'Then click on the map: march there, fighting every enemy met on the way.', ok: true, run: () => this.act.attackMove() });
      cmds.push({ key: 'S', pic: '', glyph: '✋', title: 'Stop', desc: 'Stop what they are doing (and forget queued orders).', ok: true, run: () => this.act.issue({ t: 'stop', p: viewer, ids: units.map((u) => u.id) }) });
      const holding = units.filter((u) => u.type === 'priest' && carriedBy(s, u));
      if (holding.length) cmds.push({ key: 'D', pic: '', glyph: '⚱', title: 'Set down relic', desc: 'Lay the relic down where the priest stands, to have their hands free for healing and converting.', ok: true, run: () => this.act.issue({ t: 'dropRelic', p: viewer, ids: holding.map((u) => u.id) }) });
      if (walkers.length) cmds.push({ key: 'G', pic: '', glyph: '🏰', title: 'Garrison / board', desc: 'Then click a Town Center or tower to shelter inside (safe, and they add arrows), or your transport to go aboard.', ok: true, run: () => this.act.garrisonMode() });
      if (transports.length) {
        const aboard = transports.reduce((n, t) => n + t.cargo.length, 0);
        cmds.push({ key: 'U', pic: '', glyph: '⚓', title: 'Unload', desc: 'Then click a shore: sail there and put everyone aboard on land. (Right-clicking land does the same.)', ok: aboard > 0, why: 'Nobody is aboard', count: aboard || undefined, run: () => this.act.unloadMode() });
        cmds.push({ key: 'Y', pic: '', glyph: '🏖', title: 'Unload here', desc: 'Land everyone aboard on the nearest shore.', ok: aboard > 0, why: 'Nobody is aboard', run: () => transports.forEach((t) => this.act.issue({ t: 'unload', p: viewer, ids: [t.id], x: t.x, y: t.y })) });
      }
      const kings = units.filter((u) => u.type === 'hero');
      if (kings.length === 1) {
        const why = rallyProblem(s, p, kings[0]);
        cmds.push({ key: 'R', pic: '', glyph: '📯', title: 'Rallying Cry', desc: `Soldiers within ${RALLY.radius} tiles strike ${Math.round((RALLY.attack - 1) * 100)}% harder, take ${RALLY.armor} less damage a blow and are mended ${RALLY.heal} for ${RALLY.duration} seconds. The hero needs ${RALLY.cooldown} seconds to draw breath. Call it when the lines meet.`, ok: !why, why: why ?? undefined, on: stirredNow(s, kings[0]), run: () => this.act.issue({ t: 'cry', p: viewer, id: kings[0].id }) });
      }
      if (soldiers.length) {
        const stances: [string, Stance, string, string][] = [
          ['Z', 'aggressive', '🔥', 'Aggressive: chase any enemy that comes into sight.'],
          ['X', 'defensive', '🛡', 'Defensive: fight what comes near, but return to their post.'],
          ['C', 'stand', '⚓', 'Stand ground: never move from the spot; strike what is in reach.'],
        ];
        for (const [key, stance, glyph, desc] of stances) {
          const all = soldiers.every((u) => u.stance === stance);
          cmds.push({ key, pic: '', glyph, title: `${stance === 'stand' ? 'Stand ground' : stance[0].toUpperCase() + stance.slice(1)} stance`, desc, ok: true, on: all, run: () => this.act.issue({ t: 'stance', p: viewer, ids: soldiers.map((u) => u.id), stance }) });
        }
      }
      cmds.push({ key: 'DELETE', pic: '', glyph: '💀', title: 'Delete', desc: 'Dismiss the selected units for good (Del).', ok: true, run: () => this.act.issue({ t: 'delete', p: viewer, ids: units.map((u) => u.id) }) });
    } else if (mine.length === 1 && mine[0].kind === 'building') {
      const b = mine[0];
      const def = BUILDINGS[b.type];
      const busy = b.advance >= 0;
      const full = b.queue.length >= MAX_QUEUE;
      if (b.built) {
        // The Market's Q W E and A S D buy and sell: its trader and technologies go on T and R F.
        // Soldiers an age hires here (the merchants' Market) go on Z X C.
        const unitKeys = b.type === 'towncenter' ? ['Q', 'E'] : b.type === 'market' ? ['T', 'Z', 'X', 'C'] : ['Q', 'W', 'E'];
        trainsAt(p, b.type).forEach((unit, i) => {
          const st = statsFor(s, viewer, unit);
          const hired = isHire(p, b.type, unit);
          const cost = trainCostFor(s, viewer, unit, b.type);
          const time = trainTimeFor(s, viewer, unit, b.type);
          const age = ageDef(p);
          const levied = !hired && !!age.levy && JSON.stringify(cost) !== JSON.stringify(st.cost);
          const priced = !hired && age.price?.[st.cls];
          const locked = unitEpoch(unit) > p.epoch;
          const no = barred(p, unit);
          const short = shortfall(p, cost);
          const hero = unit === 'hero' && (heroBusy(s, viewer) || b.queue.some((q) => q.unit === 'hero'));
          cmds.push({
            key: unitKeys[i],
            pic: unitPicture(unit, Math.max(p.epoch, unitEpoch(unit)), p.color),
            title: `${hired ? 'Hire' : 'Train'} ${st.name}`,
            desc: hired
              ? `A mercenary, paid in gold alone and ready in ${Math.round(time)}s. ${st.blurb}`
              : `${st.blurb} Takes ${Math.round(time)}s.${levied ? ` Levies cost ${Math.round((age.levy! - 1) * 100)}% more in the ${age.name}.` : ''}${priced ? ` ${Math.round(Math.abs(1 - priced) * 100)}% ${priced < 1 ? 'cheaper' : 'dearer'} in the ${age.name}.` : ''}`,
            cost,
            ok: !locked && !no && !short && !full && !busy && !hero,
            why: locked ? `Needs the ${EPOCHS[unitEpoch(unit)].name}` : no ? no : busy ? busyWhy(p, b) : hero ? 'You can lead with one hero at a time' : full ? 'The queue is full' : (short ?? undefined),
            count: b.queue.filter((q) => q.unit === unit).length || undefined,
            run: () => {
              this.act.issue({ t: 'train', p: viewer, building: b.id, unit });
              this.act.sound('queue');
            },
          });
        });
        if (b.type === 'towncenter') {
          // Every known road out of this age (#37): the main road on W, side roads on Y, X and C.
          const advancing = s.ents.some((e) => e.kind === 'building' && e.owner === viewer && e.advance >= 0);
          const main = mainRoad(p);
          const sideKeys = ['Y', 'X', 'C'];
          for (const road of roadsFrom(p)) {
            if (!roadKnown(s, p, road)) continue;
            const to = AGES[road.to];
            const isMain = road === main;
            const problem = roadProblem(s, p, road);
            const short = shortfall(p, road.cost);
            const deeds = deedsProgress(p, road);
            const toward = to.tier > p.epoch ? 'Advance to' : to.tier < p.epoch ? 'Step back to' : 'Turn to';
            const back = suspendedTechs(p).filter((t) => TECHS[t].epoch <= to.tier);
            cmds.push({
              key: isMain ? 'W' : (sideKeys.shift() ?? ''),
              pic: '',
              glyph: isMain ? '⏫' : '🔀',
              title: `${toward} the ${to.name}`,
              desc: `${road.blurb ?? to.blurb}${isSideRoad(road) ? ` Opens only from ${windowsOf(road.to).map((a) => `the ${AGES[a].name}`).join(' or ')}.` : ''}${deeds.map((d) => `<br>${d.have >= d.need ? '✔' : '…'} ${d.deed.text}: ${Math.min(d.have, d.need)}/${d.need}.`).join('')}${back.length ? `<br>Brings back ${back.map((t) => TECHS[t].name).join(', ')}.` : ''} Takes ${road.time}s. Every unit re-arms and every building is rebuilt in the new style.`,
              cost: road.cost,
              ok: !advancing && !problem && !short && b.queue.length === 0,
              on: b.advance >= 0 && !b.back && journeyOf(p, b)?.to === road.to,
              why: advancing ? 'Already advancing' : b.queue.length ? 'Finish training first' : (problem ?? short ?? undefined),
              run: () => {
                this.act.issue({ t: 'advance', p: viewer, building: b.id, to: road.to });
                this.act.sound('queue');
              },
            });
          }
          // Stepping back (#47) on Z: down to the trunk age one tier below, with what that reopens.
          const down = backTo(p);
          if (down) {
            const cost = stepBackCost(p.epoch);
            const problem = backProblem(s, p);
            const short = shortfall(p, cost);
            const idle = suspendedBelow(p, AGES[down].tier);
            const opens = roadsFrom({ ...p, age: down, epoch: AGES[down].tier }).filter((r) => isSideRoad(r) && roadKnown(s, p, r));
            cmds.push({
              key: 'Z',
              pic: '',
              glyph: '⏬',
              title: `Step back to the ${AGES[down].name}`,
              desc:
                `Return to the older ways. Every unit falls back to its ${AGES[down].name} form and every building to its style.` +
                (idle.length ? ` Suspended, not lost, until you climb again: ${idle.map((t) => TECHS[t].name).join(', ')}.` : ' Technologies above it are suspended, not lost, until you climb again.') +
                (opens.length ? `<br>Reopens the road to the ${opens.map((r) => AGES[r.to].name).join(' and the ')}.` : '') +
                `<br>Takes ${STEP_BACK.time}s; climbing again costs the full price. Then ${Math.round(STEP_BACK.cooldown / 60)} minutes before you may step back again.`,
              cost,
              ok: !advancing && !problem && !short && b.queue.length === 0,
              on: b.advance >= 0 && !!b.back,
              why: advancing ? 'Already advancing' : b.queue.length ? 'Finish training first' : (problem ?? short ?? undefined),
              run: () => {
                this.act.issue({ t: 'stepBack', p: viewer, building: b.id });
                this.act.sound('queue');
              },
            });
          }
          // Side roads whose window this age is outside of (#47): shown shut, with the way to them.
          for (const road of shutRoads(s, p)) {
            const from = AGES[road.from];
            const windows = windowsOf(road.to).map((a) => `the ${AGES[a].name}`).join(' or ');
            cmds.push({
              key: '',
              pic: '',
              glyph: '🔒',
              title: `The ${AGES[road.to].name}`,
              desc: `${road.blurb ?? AGES[road.to].blurb}<br>This road opens only from ${windows}.`,
              cost: road.cost,
              ok: false,
              why: from.tier < p.epoch ? `Shut: step back to the ${from.name} to take it` : `Shut: it opens only from ${windows}`,
              run: () => {},
            });
          }
        }
        // Technologies: the next step of each line this building teaches.
        const techKeys = b.type === 'market' ? ['R', 'F'] : def.trains.length ? ['A', 'S', 'D', 'F', 'G'] : ['Q', 'W', 'E', 'R', 'T'];
        let ti = 0;
        for (const tech of nextTechs(p, b.type)) {
          const t = TECHS[tech];
          const cost = techCostFor(s, viewer, tech);
          const problem = techProblem(s, viewer, tech);
          const queued = b.queue.some((q) => q.tech === tech);
          const short = shortfall(p, cost);
          cmds.push({
            key: techKeys[ti++] ?? '',
            pic: '',
            glyph: t.icon,
            title: `Research ${t.name}`,
            desc: `${t.blurb} Takes ${Math.round(t.time)}s.`,
            cost,
            ok: !problem && !short && !full && !busy,
            on: queued,
            why: queued ? 'Being researched' : (problem ?? (busy ? busyWhy(p, b) : full ? 'The queue is full' : (short ?? undefined))),
            run: () => {
              this.act.issue({ t: 'research', p: viewer, building: b.id, tech });
              this.act.sound('queue');
            },
          });
        }
        if (b.type === 'market') {
          const goods: ['food' | 'wood' | 'stone', string, string][] = [['food', 'Q', 'A'], ['wood', 'W', 'S'], ['stone', 'E', 'D']];
          for (const [res, buyKey] of goods) {
            const price = s.market[res];
            cmds.push({
              key: buyKey,
              pic: '',
              glyph: `<span class="trade">${icon(res, 22)}<b>+</b></span>`,
              title: `Buy ${MARKET.lot} ${RES_LABEL[res].toLowerCase()}`,
              desc: `Pay ${price} gold. Shared price: ${marketTrend(price, res)}. Each purchase raises it. Recovery is ${MARKET.recover} gold every ${MARKET.every}s; other players’ trades can change it.`,
              cost: { gold: price },
              ok: p.res.gold >= price,
              why: `Need ${Math.ceil(price - p.res.gold)} more gold`,
              run: () => (this.act.issue({ t: 'trade', p: viewer, res, buy: true }), this.act.sound('click')),
            });
          }
          for (const [res, , sellKey] of goods) {
            const gets = Math.floor(s.market[res] * MARKET.sellRate);
            cmds.push({
              key: sellKey,
              pic: '',
              glyph: `<span class="trade">${icon(res, 22)}<b>−</b></span>`,
              title: `Sell ${MARKET.lot} ${RES_LABEL[res].toLowerCase()}`,
              desc: `Get ${gets} gold. Shared price: ${marketTrend(s.market[res], res)}. Each sale lowers it. Recovery is ${MARKET.recover} gold every ${MARKET.every}s; other players’ trades can change it.`,
              cost: { [res]: MARKET.lot },
              ok: p.res[res] >= MARKET.lot,
              why: `Need ${MARKET.lot} ${RES_LABEL[res].toLowerCase()} to sell`,
              run: () => (this.act.issue({ t: 'trade', p: viewer, res, buy: false }), this.act.sound('click')),
            });
          }
        }
        if (b.type === 'towncenter') {
          cmds.push({ key: 'R', pic: '', glyph: '🔔', title: 'Ring the town bell', desc: 'Every citizen runs to shelter in the nearest Town Center or tower, which shoot more arrows for each one inside.', ok: true, run: () => this.act.issue({ t: 'bell', p: viewer, ring: true }) });
          const sheltering = s.ents.some((e) => e.kind === 'unit' && e.owner === viewer && e.type === 'citizen' && (e.inside || e.order.k === 'garrison'));
          cmds.push({ key: 'T', pic: '', glyph: '🕊', title: 'All clear', desc: 'Citizens come out of shelter and go back to work.', ok: sheltering, why: 'Nobody is sheltering', run: () => this.act.issue({ t: 'bell', p: viewer, ring: false }) });
        }
        if (b.type === 'towncenter') {
          const w = WORKS[p.civ];
          const why = workProblem(s, p);
          cmds.push({ key: 'W', pic: '', glyph: w.icon, title: w.name, desc: `${w.blurb} Free; lasts ${WORK.duration} seconds, once in each epoch.`, ok: !why, why: why ?? undefined, run: () => this.act.issue({ t: 'greatWork', p: viewer }) });
        }
        if (b.type === 'tower') {
          const why = beaconProblem(s, p, b);
          cmds.push({ key: 'F', pic: '', glyph: '🔥', title: 'Light the beacon', desc: `A fire on the roof: this tower sees ${BEACON.sight} tiles farther for ${BEACON.duration} seconds, but every rival sees the ground around it. Costs ${BEACON.cost.wood} wood; it can be lit again after ${BEACON.cooldown} seconds.`, ok: !why, why: why ?? undefined, on: lit(s, b), run: () => this.act.issue({ t: 'beacon', p: viewer, building: b.id }) });
        }
        if (def.garrison) {
          cmds.push({ key: 'U', pic: '', glyph: '🚪', title: 'Let them out', desc: `Everyone sheltering here comes out (${b.garrison.length}/${def.garrison}).`, ok: b.garrison.length > 0, why: 'Nobody is inside', count: b.garrison.length || undefined, run: () => this.act.issue({ t: 'ungarrison', p: viewer, building: b.id }) });
        }
      }
      cmds.push({ key: 'DELETE', pic: '', glyph: '💀', title: b.built ? 'Delete' : 'Cancel', desc: b.built ? 'Tear this building down (Del).' : 'Give up this building site (Del). Refunded if no work was done.', ok: true, run: () => this.act.issue({ t: 'delete', p: viewer, ids: [b.id] }) });
    } else if (mine.length > 1 && mine.every((e) => e.kind === 'building')) {
      cmds.push({ key: 'DELETE', pic: '', glyph: '💀', title: 'Delete', desc: 'Tear these buildings down (Del).', ok: true, run: () => this.act.issue({ t: 'delete', p: viewer, ids: mine.map((e) => e.id) }) });
    }
    this.cmds = cmds;
    const sig = cmds.map((c) => `${c.key}${c.ok ? 1 : 0}${c.count ?? ''}${c.on ? 1 : 0}${c.pic.length}${c.title}${c.desc}${JSON.stringify(c.cost)}${c.why}`).join('|');
    if (sig === this.cmdSig) return;
    this.cmdSig = sig;
    this.cmdEl.innerHTML = cmds
      .map((c, i) => {
        const key = c.key === 'ESCAPE' ? 'Esc' : c.key === 'DELETE' ? 'Del' : c.key;
        const tip = `<b>${c.title}</b>${c.cost ? `<div class='cost'>${costHtml(c.cost, s.players[viewer].res).replace(/"/g, "'")}</div>` : ''}${c.desc}${!c.ok && c.why ? `<br><span style='color:#ff9a8a'>${c.why}</span>` : ''}${key ? `<br><span class='hint'>Hotkey: ${key}</span>` : ''}`;
        return `<button class="cmd ${c.ok ? '' : 'off'} ${c.on ? 'on' : ''}" data-i="${i}" data-tip="${tip.replace(/"/g, '&quot;')}">${c.pic ? `<img src="${c.pic}" alt="">` : `<span class="glyph">${c.glyph ?? ''}</span>`}<span class="key">${key}</span>${c.count ? `<span class="count">${c.count}</span>` : ''}</button>`;
      })
      .join('');
  }

  private hover(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (!el) {
      this.hideTip();
      return;
    }
    if (el !== this.tipFor) {
      this.tipFor = el;
      this.tipEl.innerHTML = el.dataset.tip!;
      this.tipEl.classList.remove('hidden');
    }
    const r = this.tipEl.getBoundingClientRect();
    let x = e.clientX + 14;
    let y = e.clientY - r.height - 12;
    if (x + r.width > window.innerWidth - 6) x = window.innerWidth - r.width - 6;
    if (y < 46) y = e.clientY + 18;
    this.tipEl.style.left = `${x}px`;
    this.tipEl.style.top = `${y}px`;
  }

  hideTip(): void {
    this.tipFor = null;
    this.tipEl.classList.add('hidden');
  }

  /** Forget cached panels (after a new match starts). */
  reset(): void {
    this.selSig = '';
    this.cmdSig = '';
    this.topSig = '';
    this.timerHtml = '';
    this.timerEl.innerHTML = '';
    this.buildMenu = null;
    this.noticeEl.innerHTML = '';
  }
}

function hpBar(hp: number, max: number, frac: number): string {
  return `<div class="hp ${frac < 0.3 ? 'low' : frac < 0.6 ? 'mid' : ''}"><i style="width:${Math.max(0, Math.min(100, frac * 100))}%"></i><span>${Math.ceil(hp)} / ${max}</span></div>`;
}

function resHint(r: string): string {
  return {
    food: 'From berry bushes, hunting, farms and fishing. Feeds new citizens and soldiers and pays for the epochs.',
    wood: 'From trees. Buildings, bows and spears.',
    stone: 'From stone quarries. Town Centers, towers and the later epochs.',
    gold: 'From gold mines. Cavalry, later soldiers and the later epochs.',
  }[r]!;
}

export function nameOf(s: GameState, e: Ent): string {
  if (e.kind === 'unit' && s.kings.includes(e.id)) return 'King';
  return e.kind === 'unit' ? statsFor(s, e.owner, e.type).name : BUILDINGS[e.type].name;
}

/** Chains of technologies: each building offers the next unresearched step of each. */
const TECH_LINES: TechId[][] = (() => {
  const lines: TechId[][] = [];
  for (const id of TECH_IDS) {
    const t = TECHS[id];
    const line = t.needs ? lines.find((l) => l[l.length - 1] === t.needs) : undefined;
    if (line) line.push(id);
    else lines.push([id]);
  }
  return lines;
})();

function nextTechs(p: Player, at: BuildingType): TechId[] {
  const out: TechId[] = [];
  for (const line of TECH_LINES) {
    if (TECHS[line[0]].at !== at) continue;
    // A suspended step (#47) shows greyed, with when it returns.
    const next = line.find((t) => !p.techs.includes(t));
    if (next) out.push(next);
  }
  return out;
}

function plural(name: string): string {
  return name.endsWith('man') ? `${name.slice(0, -3)}men` : name.endsWith('ry') ? `${name.slice(0, -1)}ies` : `${name}s`;
}

/** Why a Town Center's other buttons wait while it is busy changing age. */
function busyWhy(p: Player, b: Building): string {
  return journeyOf(p, b)?.back ? 'Busy stepping back an age' : 'Busy advancing to the next epoch';
}
