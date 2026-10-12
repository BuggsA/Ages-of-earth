import { shortfall, MAX_QUEUE } from '../sim/commands';
import { BUILDINGS, BUILDING_TYPES, EPOCHS, LAST_EPOCH, RES_LABEL, TICK_HZ, buildingHp, secs, unitEpoch, unitStats } from '../sim/data';
import type { Building, BuildingType, Command, Cost, Ent, GameState, Unit, UnitType } from '../sim/types';
import { RES, R_BERRY, R_GOLD, R_STONE, R_TREE } from '../sim/types';
import { costHtml, icon } from './icons';
import { buildingPicture, unitPicture } from './thumbs';

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

const ACT_WORDS: Record<string, string> = {
  idle: 'Standing by',
  walk: 'Walking',
  attack: 'Fighting',
  chop: 'Cutting wood',
  mine: 'Mining',
  forage: 'Gathering berries',
  farm: 'Farming',
  build: 'Building',
};

function orderWords(s: GameState, u: Unit): string {
  const o = u.order;
  switch (o.k) {
    case 'gather': {
      const kind = s.res[o.tile];
      const what = o.res === 'food' ? 'berries' : o.res === 'wood' ? 'wood' : o.res;
      if (o.phase === 'drop') return `Carrying ${what} home`;
      if (o.phase === 'work') return kind === R_TREE ? 'Cutting wood' : kind === R_BERRY ? 'Gathering berries' : kind === R_GOLD ? 'Mining gold' : kind === R_STONE ? 'Quarrying stone' : 'Gathering';
      return `Going to gather ${what}`;
    }
    case 'farm':
      return o.phase === 'drop' ? 'Carrying grain home' : o.phase === 'work' ? 'Farming' : 'Going to the fields';
    case 'build':
      return u.act === 'build' ? 'Building' : 'Going to build';
    case 'attack':
      return u.act === 'attack' ? 'Fighting' : 'Charging';
    case 'move':
      return o.amove ? 'Marching to attack' : 'Moving';
    case 'deliver':
      return 'Carrying resources home';
    default:
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
  /** Showing the build menu for citizens. */
  buildMenu = false;
  private cmds: Cmd[] = [];
  private resEl = document.getElementById('res-bar')!;
  private epochEl = document.getElementById('epoch-chip')!;
  private clockEl = document.getElementById('clock')!;
  private idleEl = document.getElementById('idle-btn')!;
  private selEl = document.getElementById('selection')!;
  private cmdEl = document.getElementById('commands')!;
  private tipEl = document.getElementById('tooltip')!;
  private noticeEl = document.getElementById('notices')!;
  private bannerEl = document.getElementById('banner')!;
  private selSig = '';
  private cmdSig = '';
  private topSig = '';
  private bannerTimer = 0;
  private recent = new Map<string, number>();
  private tipFor: HTMLElement | null = null;
  private state: GameState | null = null;
  private viewer = 0;

  constructor(private act: HudActions) {
    this.cmdEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
      if (!b) return;
      const c = this.cmds[Number(b.dataset.i)];
      if (c) this.runCmd(c);
    });
    this.cmdEl.addEventListener('contextmenu', (e) => e.preventDefault());
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
  update(s: GameState, viewer: number, ids: number[], speed: number, selectedTile: number | null): void {
    this.state = s;
    this.viewer = viewer;
    this.lastIds = ids;
    this.top(s, viewer, speed);
    const ents = ids.map((id) => s.byId.get(id)).filter((e): e is Ent => !!e && e.hp > 0);
    this.selection(s, viewer, ents, selectedTile);
    this.commands(s, viewer, ents);
  }

  private top(s: GameState, viewer: number, speed: number): void {
    const p = s.players[viewer];
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === viewer && e.advance >= 0);
    const idle = s.ents.filter((e) => e.kind === 'unit' && e.owner === viewer && e.type === 'citizen' && e.order.k === 'idle').length;
    const adv = tc ? Math.floor((tc.advance / secs(EPOCHS[p.epoch + 1].time)) * 100) : -1;
    const sig = `${RES.map((r) => Math.floor(p.res[r])).join(',')}|${p.pop}/${p.cap}|${p.epoch}|${adv}|${idle}|${speed}`;
    this.clockEl.textContent = fmtTime(s.tick);
    if (sig === this.topSig) return;
    this.topSig = sig;
    this.resEl.innerHTML =
      RES.map((r) => `<div class="res" data-tip="<b>${RES_LABEL[r]}</b>${resHint(r)}">${icon(r)}${Math.floor(p.res[r])}</div>`).join('') +
      `<div class="res pop ${p.pop >= p.cap ? 'full' : ''}" data-tip="<b>Population</b>People and soldiers you have, and room for. Houses add 5 each, a Town Center 10 (150 at most).">${icon('pop')}${p.pop}/${p.cap}</div>`;
    this.epochEl.innerHTML = tc
      ? `${EPOCHS[p.epoch].name} <span class="bar" data-tip="<b>Advancing to the ${EPOCHS[p.epoch + 1].name}</b>${adv}%"><i style="width:${adv}%"></i></span>`
      : `<span data-tip="<b>${EPOCHS[p.epoch].name}</b>${EPOCHS[p.epoch].blurb}${p.epoch < LAST_EPOCH ? `<br><span class='hint'>Advance at a Town Center.</span>` : ''}">${EPOCHS[p.epoch].name}</span>`;
    this.idleEl.textContent = `Idle ${idle}`;
    this.idleEl.classList.toggle('alert', idle > 0);
    document.getElementById('speed-btn')!.textContent = `${speed}×`;
  }

  private selection(s: GameState, viewer: number, ents: Ent[], tile: number | null): void {
    let html = '';
    let sig = '';
    if (!ents.length && tile !== null && s.res[tile]) {
      const kind = s.res[tile];
      const name = kind === R_TREE ? 'Tree' : kind === R_BERRY ? 'Berry bush' : kind === R_GOLD ? 'Gold mine' : 'Stone quarry';
      const res = kind === R_TREE ? 'wood' : kind === R_BERRY ? 'food' : kind === R_GOLD ? 'gold' : 'stone';
      sig = `res:${tile}:${s.amount[tile]}`;
      html = `<div class="sel-portrait"><span style="font-size:54px">${kind === R_TREE ? '🌳' : kind === R_BERRY ? '🫐' : kind === R_GOLD ? icon('gold', 64) : icon('stone', 64)}</span></div>
        <div class="sel-info"><div class="sel-name">${name}</div><div class="stats"><span>${icon(res as 'wood')}${s.amount[tile]} left</span></div>
        <div class="blurb">Select citizens and right-click it to gather.</div></div>`;
    } else if (!ents.length) {
      const p = s.players[viewer];
      sig = `none:${p.epoch}`;
      html = `<div class="empty-sel"><div class="sel-name">${EPOCHS[p.epoch].name}</div>
        <div>Left-click to select, drag to select many. Right-click to give orders.</div>
        <div><kbd>.</kbd> finds an idle citizen, <kbd>H</kbd> your Town Center, <kbd>B</kbd> builds with citizens selected.</div></div>`;
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
          const max = e.kind === 'unit' ? unitStats(e.type, s.players[e.owner].epoch).hp : buildingHp(e.type, s.players[e.owner].epoch);
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

  private unitPanel(s: GameState, viewer: number, u: Unit): [string, string] {
    const p = s.players[u.owner];
    const st = unitStats(u.type, p.epoch);
    const frac = u.hp / st.hp;
    const mine = u.owner === viewer;
    const status = mine ? orderWords(s, u) : p.name;
    const carry = mine && u.carry > 0 && u.carryRes ? `<span>${icon(u.carryRes)}${u.carry}<em>carried</em></span>` : '';
    const sig = `u:${u.id}:${Math.ceil(u.hp)}:${status}:${u.carry}:${p.epoch}`;
    const html = `<div class="sel-portrait"><img src="${unitPicture(u.type, p.epoch, p.color)}" alt=""></div>
      <div class="sel-info">
        <div class="sel-name">${st.name}</div>
        <div class="sel-sub">${mine ? status : `<span class="swatch" style="background:${p.color}"></span>${p.name}`}</div>
        ${hpBar(u.hp, st.hp, frac)}
        <div class="stats">
          <span data-tip="<b>Attack</b>Damage per blow or shot, before armor and the counter bonus.">⚔<em>Attack</em> ${st.attack}</span>
          <span data-tip="<b>Armor</b>Melee / missile armor: taken off every blow or shot.">🛡<em>Armor</em> ${st.armor}/${st.parmor}</span>
          ${st.range ? `<span data-tip="<b>Range</b>How far it shoots, in tiles.">🏹<em>Range</em> ${st.range}</span>` : ''}
          <span data-tip="<b>Speed</b>Tiles per second.">👣<em>Speed</em> ${st.speed}</span>
          ${carry}
        </div>
        <div class="blurb">${st.blurb}</div>
      </div>`;
    return [html, sig];
  }

  private buildingPanel(s: GameState, viewer: number, b: Building): [string, string] {
    const p = s.players[b.owner];
    const def = BUILDINGS[b.type];
    const max = buildingHp(b.type, p.epoch);
    const mine = b.owner === viewer;
    let status = '';
    let queue = '';
    if (!b.built) status = `Under construction: ${Math.floor(b.progress * 100)}%`;
    else if (b.advance >= 0) {
      const pct = Math.floor((b.advance / secs(EPOCHS[p.epoch + 1].time)) * 100);
      status = `Advancing to the ${EPOCHS[p.epoch + 1].name}: ${pct}%`;
      if (mine) queue = `<div class="queue"><div class="qitem" data-cancel="${b.id}:-1" data-tip="<b>${EPOCHS[p.epoch + 1].name}</b>Click to cancel (full refund)."><span style="display:grid;place-items:center;height:100%;font-size:22px">⏫</span><div class="prog"><i style="width:${pct}%"></i></div></div></div>`;
    } else if (b.queue.length) {
      const it = b.queue[0];
      const need = secs(unitStats(it.unit, p.epoch).time);
      const pct = Math.min(100, Math.floor((it.done / need) * 100));
      status = `${it.done > need ? 'Waiting for room: build houses' : `Training ${unitStats(it.unit, p.epoch).name}: ${pct}%`}`;
      if (mine)
        queue = `<div class="queue">${b.queue
          .map((q, i) => {
            const qn = unitStats(q.unit, p.epoch);
            const qp = i === 0 ? pct : 0;
            return `<div class="qitem" data-cancel="${b.id}:${i}" data-tip="<b>${qn.name}</b>Click to cancel (full refund)."><img src="${unitPicture(q.unit, p.epoch, p.color)}" alt=""><div class="prog"><i style="width:${qp}%"></i></div></div>`;
          })
          .join('')}</div>`;
    } else if (b.type === 'farm' && b.built) {
      const f = b.farmer ? s.byId.get(b.farmer) : undefined;
      status = f && f.kind === 'unit' && f.order.k === 'farm' && f.order.target === b.id ? 'Worked by a citizen' : 'Waiting for a farmer';
    } else status = def.drop.length ? 'Drop-off for every resource' : def.pop ? `Room for ${def.pop}` : 'Ready';
    if (!mine) status = `<span class="swatch" style="background:${p.color}"></span>${p.name}`;
    const sig = `b:${b.id}:${Math.ceil(b.hp)}:${status}:${b.queue.length}:${p.epoch}:${queue.length}`;
    const html = `<div class="sel-portrait"><img src="${buildingPicture(b.type, p.epoch, p.color)}" alt=""></div>
      <div class="sel-info">
        <div class="sel-name">${def.name}</div>
        <div class="sel-sub">${status}</div>
        ${hpBar(b.hp, max, b.hp / max)}
        ${queue || `<div class="blurb">${def.blurb}${def.guns ? ` Shoots ${def.guns.range} tiles.` : ''}</div>`}
      </div>`;
    return [html, sig];
  }

  private commands(s: GameState, viewer: number, ents: Ent[]): void {
    const p = s.players[viewer];
    const mine = ents.filter((e) => e.owner === viewer);
    const units = mine.filter((e): e is Unit => e.kind === 'unit');
    const citizens = units.filter((u) => u.type === 'citizen');
    const soldiers = units.filter((u) => u.type !== 'citizen');
    const cmds: Cmd[] = [];
    if (!citizens.length) this.buildMenu = false;

    if (citizens.length && this.buildMenu) {
      for (const type of BUILDING_TYPES) {
        const def = BUILDINGS[type];
        const locked = def.epoch > p.epoch;
        const short = shortfall(p, def.cost);
        cmds.push({
          key: def.key,
          pic: buildingPicture(type, p.epoch, p.color),
          title: def.name,
          desc: def.blurb,
          cost: def.cost,
          ok: !locked && !short,
          why: locked ? `Needs the ${EPOCHS[def.epoch].name}` : (short ?? undefined),
          run: () => this.act.place(type),
        });
      }
      cmds.push({ key: 'ESCAPE', pic: '', glyph: '↩', title: 'Back', desc: 'Back to the commands.', ok: true, run: () => (this.buildMenu = false) });
    } else if (units.length) {
      if (citizens.length) cmds.push({ key: 'B', pic: '', glyph: '🔨', title: 'Build', desc: 'Choose a building to put up with the selected citizens.', ok: true, run: () => ((this.buildMenu = true), this.act.sound('open')) });
      if (soldiers.length) cmds.push({ key: 'A', pic: '', glyph: '⚔', title: 'Attack-move', desc: 'Then click on the map: march there, fighting every enemy met on the way.', ok: true, run: () => this.act.attackMove() });
      cmds.push({ key: 'S', pic: '', glyph: '✋', title: 'Stop', desc: 'Stop what they are doing.', ok: true, run: () => this.act.issue({ t: 'stop', p: viewer, ids: units.map((u) => u.id) }) });
      cmds.push({ key: 'DELETE', pic: '', glyph: '💀', title: 'Delete', desc: 'Dismiss the selected units for good (Del).', ok: true, run: () => this.act.issue({ t: 'delete', p: viewer, ids: units.map((u) => u.id) }) });
    } else if (mine.length === 1 && mine[0].kind === 'building') {
      const b = mine[0];
      const def = BUILDINGS[b.type];
      if (b.built) {
        for (const unit of def.trains) {
          const st = unitStats(unit, p.epoch);
          const locked = unitEpoch(unit) > p.epoch;
          const short = shortfall(p, st.cost);
          const full = b.queue.length >= MAX_QUEUE;
          const busy = b.advance >= 0;
          cmds.push({
            key: 'Q',
            pic: unitPicture(unit as UnitType, Math.max(p.epoch, unitEpoch(unit)), p.color),
            title: `Train ${st.name}`,
            desc: `${st.blurb} Takes ${st.time}s.`,
            cost: st.cost,
            ok: !locked && !short && !full && !busy,
            why: locked ? `Needs the ${EPOCHS[unitEpoch(unit)].name}` : busy ? 'Busy advancing to the next epoch' : full ? 'The queue is full' : (short ?? undefined),
            count: b.queue.filter((q) => q.unit === unit).length || undefined,
            run: () => {
              this.act.issue({ t: 'train', p: viewer, building: b.id, unit });
              this.act.sound('queue');
            },
          });
        }
        if (b.type === 'towncenter' && p.epoch < LAST_EPOCH) {
          const next = EPOCHS[p.epoch + 1];
          const advancing = s.ents.some((e) => e.kind === 'building' && e.owner === viewer && e.advance >= 0);
          const short = shortfall(p, next.cost);
          cmds.push({
            key: 'W',
            pic: '',
            glyph: '⏫',
            title: `Advance to the ${next.name}`,
            desc: `${next.blurb} Takes ${next.time}s. Every unit re-arms and every building is rebuilt in the new style.`,
            cost: next.cost,
            ok: !advancing && !short && b.queue.length === 0,
            on: b.advance >= 0,
            why: advancing ? 'Already advancing' : b.queue.length ? 'Finish training first' : (short ?? undefined),
            run: () => {
              this.act.issue({ t: 'advance', p: viewer, building: b.id });
              this.act.sound('queue');
            },
          });
        }
      }
      cmds.push({ key: 'DELETE', pic: '', glyph: '💀', title: b.built ? 'Delete' : 'Cancel', desc: b.built ? 'Tear this building down (Del).' : 'Give up this building site (Del). Refunded if no work was done.', ok: true, run: () => this.act.issue({ t: 'delete', p: viewer, ids: [b.id] }) });
    }
    this.cmds = cmds;
    const sig = cmds.map((c) => `${c.key}${c.ok ? 1 : 0}${c.count ?? ''}${c.on ? 1 : 0}${c.pic.length}`).join('|');
    if (sig === this.cmdSig) return;
    this.cmdSig = sig;
    this.cmdEl.innerHTML = cmds
      .map((c, i) => {
        const key = c.key === 'ESCAPE' ? 'Esc' : c.key === 'DELETE' ? 'Del' : c.key;
        const tip = `<b>${c.title}</b>${c.cost ? `<div class='cost'>${costHtml(c.cost, s.players[viewer].res).replace(/"/g, "'")}</div>` : ''}${c.desc}${!c.ok && c.why ? `<br><span style='color:#ff9a8a'>${c.why}</span>` : ''}<br><span class='hint'>Hotkey: ${key}</span>`;
        return `<button class="cmd ${c.ok ? '' : 'off'} ${c.on ? 'on' : ''}" data-i="${i}" data-tip="${tip}">${c.pic ? `<img src="${c.pic}" alt="">` : `<span class="glyph">${c.glyph ?? ''}</span>`}<span class="key">${key}</span>${c.count ? `<span class="count">${c.count}</span>` : ''}</button>`;
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
    this.buildMenu = false;
    this.noticeEl.innerHTML = '';
  }
}

function hpBar(hp: number, max: number, frac: number): string {
  return `<div class="hp ${frac < 0.3 ? 'low' : frac < 0.6 ? 'mid' : ''}"><i style="width:${Math.max(0, Math.min(100, frac * 100))}%"></i><span>${Math.ceil(hp)} / ${max}</span></div>`;
}

function resHint(r: string): string {
  return {
    food: 'From berry bushes and farms. Feeds new citizens and soldiers and pays for the epochs.',
    wood: 'From trees. Buildings, bows and spears.',
    stone: 'From stone quarries. Town Centers, towers and the later epochs.',
    gold: 'From gold mines. Cavalry, later soldiers and the later epochs.',
  }[r]!;
}

export function nameOf(s: GameState, e: Ent): string {
  return e.kind === 'unit' ? unitStats(e.type, s.players[e.owner].epoch).name : BUILDINGS[e.type].name;
}

function plural(name: string): string {
  return name.endsWith('man') ? `${name.slice(0, -3)}men` : name.endsWith('ry') ? `${name.slice(0, -1)}ies` : `${name}s`;
}
