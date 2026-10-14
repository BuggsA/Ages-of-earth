import { CIVS, CIV_IDS, MAP_SIZES, MAP_TYPES, PLAYER_COLORS } from '../sim/data';
import type { Difficulty, MapSize, MapType } from '../sim/types';
import { MAX_SEATS, type ClientMsg, type LobbyState } from '../net/protocol';

/**
 * The online screens: first a card to make a room or join one by its code, then the room itself, where
 * everyone picks a people, a color and a team, the host sets the map and adds computer players, and
 * the match starts. A small chat runs alongside.
 */

export interface LobbyActions {
  create(name: string): void;
  join(code: string, name: string): void;
  /** Join a match already under way, to look on. */
  watch(code: string, name: string): void;
  leave(): void;
  send(m: ClientMsg): void;
}

const COLOR_NAMES = ['Blue', 'Red', 'Gold', 'Green', 'Purple', 'Orange'];
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class Lobby {
  private el: HTMLElement;
  private chatLines: string[] = [];
  private state: LobbyState | null = null;
  private you = 0;

  constructor(
    private act: LobbyActions,
    private name: () => string,
  ) {
    this.el = document.getElementById('online')!;
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('change', (e) => this.change(e));
    this.el.addEventListener('keydown', (e) => {
      const t = e.target as HTMLInputElement;
      if (e.key !== 'Enter') return;
      if (t.id === 'lobby-chat') {
        this.sendChat();
        e.preventDefault();
      } else if (t.id === 'join-code') this.joinFromInput();
    });
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  /** The first card: a name, then make a room or join one. */
  showEntry(code = '', message = ''): void {
    this.state = null;
    this.chatLines = [];
    this.el.classList.remove('hidden');
    this.el.innerHTML = `<div class="title-card online-card">
      <h2>Play online</h2>
      <p class="tagline">Play with friends: one makes a room and shares its code or link, the others join.</p>
      ${message ? `<div class="lobby-error">${esc(message)}</div>` : ''}
      <label class="field">Your name <input id="online-name" maxlength="18" value="${esc(this.name())}" placeholder="Player"></label>
      <div class="online-choices">
        <div class="choice">
          <h3>New room</h3>
          <button class="btn primary" data-lobby="create">Make a room</button>
        </div>
        <div class="choice">
          <h3>Join a room</h3>
          <div class="seed-row"><input id="join-code" maxlength="5" placeholder="CODE" value="${esc(code)}" style="text-transform:uppercase"><button class="btn" data-lobby="join">Join</button><button class="btn" data-lobby="watch" title="Look in on a match already under way">Watch</button></div>
        </div>
      </div>
      <button class="btn small" data-lobby="back">Back</button>
    </div>`;
    if (code) (this.el.querySelector('#join-code') as HTMLInputElement).focus();
  }

  showConnecting(code: string): void {
    this.el.classList.remove('hidden');
    this.el.innerHTML = `<div class="title-card online-card"><h2>Room ${esc(code)}</h2><p class="tagline">Connecting…</p><button class="btn small" data-lobby="back">Cancel</button></div>`;
  }

  /** The room, as it is now. */
  showRoom(state: LobbyState, you: number): void {
    this.state = state;
    this.you = you;
    this.el.classList.remove('hidden');
    const host = you === state.host;
    const link = `${location.origin}${location.pathname}?room=${state.code}`;
    const colorOpts = (cur: number) =>
      PLAYER_COLORS.map((_, i) => `<option value="${i}" ${i === cur ? 'selected' : ''} ${state.seats.some((s) => s.color === i) && i !== cur ? 'disabled' : ''}>${COLOR_NAMES[i]}</option>`).join('');
    const civOpts = (cur: string) => `<option value="random">Random</option>` + CIV_IDS.map((c) => `<option value="${c}" ${c === cur ? 'selected' : ''}>${CIVS[c].name}</option>`).join('');
    const teamOpts = (cur: number) => Array.from({ length: MAX_SEATS }, (_, i) => `<option value="${i + 1}" ${i + 1 === cur ? 'selected' : ''}>Team ${i + 1}</option>`).join('');
    const levelOpts = (cur?: Difficulty) => (['easy', 'normal', 'hard'] as Difficulty[]).map((l) => `<option value="${l}" ${l === cur ? 'selected' : ''}>${l[0].toUpperCase() + l.slice(1)}</option>`).join('');
    const rows = state.seats
      .map((s, i) => {
        const mine = i === you;
        const edit = mine || (host && s.kind === 'ai');
        const dis = edit ? '' : 'disabled';
        const who = s.kind === 'ai'
          ? `🤖 Computer ${host ? `<select data-seat="${i}" data-field="level">${levelOpts(s.level)}</select>` : `(${s.level})`}`
          : `${i === state.host ? '👑 ' : ''}${esc(s.name)}${mine ? ' (you)' : ''}${s.online === false ? ' <span class="hint">(offline)</span>' : ''}`;
        return `<tr>
          <td><span class="swatch" style="background:${PLAYER_COLORS[s.color]}"></span>${who}</td>
          <td><select data-seat="${i}" data-field="civ" ${dis}>${civOpts(s.civ)}</select></td>
          <td><select data-seat="${i}" data-field="color" ${dis}>${colorOpts(s.color)}</select></td>
          <td><select data-seat="${i}" data-field="team" ${dis}>${teamOpts(s.team)}</select></td>
          <td>${host && s.kind === 'ai' ? `<button class="btn small" data-lobby="remove" data-seat="${i}" title="Remove">✕</button>` : ''}</td>
        </tr>`;
      })
      .join('');
    const st = state.setup;
    const hdis = host ? '' : 'disabled';
    const sel = (field: string, opts: [string, string][], cur: string) => `<select data-setup="${field}" ${hdis}>${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    this.el.innerHTML = `<div class="title-card online-card wide">
      <h2>Room <span class="code">${esc(state.code)}</span></h2>
      <div class="share"><input readonly value="${esc(link)}" id="room-link"><button class="btn small" data-lobby="copy">Copy link</button></div>
      <table class="seats"><tr><th>Player</th><th>People</th><th>Color</th><th>Team</th><th></th></tr>${rows}</table>
      ${host && state.seats.length < MAX_SEATS ? `<div class="add-ai"><button class="btn small" data-lobby="addAi">+ Add a computer player</button></div>` : ''}
      <div class="setup">
        <label>Map ${sel('mapType', (Object.keys(MAP_TYPES) as MapType[]).map((m) => [m, MAP_TYPES[m].label]), st.mapType)}</label>
        <label>Map size ${sel('size', (Object.keys(MAP_SIZES) as MapSize[]).map((m) => [m, MAP_SIZES[m].label]), st.size)}</label>
        <label>Start in ${sel('startEpoch', [['0', 'Stone Age'], ['1', 'Bronze Age'], ['2', 'Middle Ages'], ['3', 'Gunpowder Age'], ['4', 'Industrial Age']], String(st.startEpoch))}</label>
        <label>Game ${sel('mode', [['conquest', 'Conquest'], ['regicide', 'Regicide'], ['deathmatch', 'Deathmatch']], st.mode)}</label>
        <label>Peace treaty ${sel('peaceMinutes', [['0', 'None'], ['5', '5 minutes'], ['10', '10 minutes'], ['20', '20 minutes']], String(st.peaceMinutes))}</label>
      </div>
      <div class="lobby-chat"><div class="lines" id="lobby-lines">${this.chatLines.join('')}</div><input id="lobby-chat" maxlength="200" placeholder="Say something (Enter)"></div>
      <div class="title-buttons">
        ${host ? `<button class="btn primary big" data-lobby="start">Start the match</button>` : `<span class="hint">Waiting for the host to start…</span>`}
        <button class="btn" data-lobby="back">Leave</button>
      </div>
    </div>`;
    const lines = this.el.querySelector('#lobby-lines');
    if (lines) lines.scrollTop = lines.scrollHeight;
  }

  addChat(from: string, color: number, text: string): void {
    const who = from ? `<b style="color:${PLAYER_COLORS[color] ?? '#fff'}">${esc(from)}:</b> ` : '<i>';
    this.chatLines.push(`<div>${who}${esc(text)}${from ? '' : '</i>'}</div>`);
    if (this.chatLines.length > 60) this.chatLines.shift();
    const lines = this.el.querySelector('#lobby-lines');
    if (lines) {
      lines.innerHTML = this.chatLines.join('');
      lines.scrollTop = lines.scrollHeight;
    }
  }

  showError(text: string): void {
    const card = this.el.querySelector('.title-card');
    if (!card) return;
    card.querySelector('.lobby-error')?.remove();
    const div = document.createElement('div');
    div.className = 'lobby-error';
    div.textContent = text;
    card.insertBefore(div, card.children[1] ?? null);
  }

  private nameInput(): string {
    const v = (this.el.querySelector('#online-name') as HTMLInputElement | null)?.value.trim() ?? '';
    return v || 'Player';
  }

  private joinFromInput(watch = false): void {
    const code = ((this.el.querySelector('#join-code') as HTMLInputElement).value || '').trim().toUpperCase();
    if (code.length !== 5) return this.showError('A room code has 5 letters and numbers.');
    if (watch) this.act.watch(code, this.nameInput());
    else this.act.join(code, this.nameInput());
  }

  private sendChat(): void {
    const input = this.el.querySelector('#lobby-chat') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    this.act.send({ t: 'chat', text });
    input.value = '';
  }

  private click(e: Event): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-lobby]');
    if (!b) return;
    switch (b.dataset.lobby) {
      case 'create':
        this.act.create(this.nameInput());
        break;
      case 'join':
        this.joinFromInput();
        break;
      case 'watch':
        this.joinFromInput(true);
        break;
      case 'back':
        this.act.leave();
        break;
      case 'copy': {
        const input = this.el.querySelector('#room-link') as HTMLInputElement;
        input.select();
        void navigator.clipboard?.writeText(input.value).catch(() => document.execCommand('copy'));
        b.textContent = 'Copied!';
        break;
      }
      case 'addAi':
        this.act.send({ t: 'addAi', level: 'normal' });
        break;
      case 'remove':
        this.act.send({ t: 'removeSeat', seat: Number(b.dataset.seat) });
        break;
      case 'start':
        this.act.send({ t: 'start' });
        break;
    }
  }

  private change(e: Event): void {
    const t = e.target as HTMLSelectElement;
    if (!this.state) return;
    if (t.dataset.setup) {
      const v = t.dataset.setup === 'startEpoch' || t.dataset.setup === 'peaceMinutes' ? Number(t.value) : t.value;
      this.act.send({ t: 'setup', setup: { [t.dataset.setup]: v } });
      return;
    }
    if (t.dataset.seat === undefined) return;
    const seat = Number(t.dataset.seat);
    const field = t.dataset.field!;
    const value = field === 'civ' || field === 'level' ? t.value : Number(t.value);
    if (seat === this.you) this.act.send({ t: 'seat', [field]: value });
    else if (field === 'level') this.act.send({ t: 'aiLevel', seat, level: t.value as Difficulty });
    else this.act.send({ t: 'aiLevel', seat, level: this.state.seats[seat].level ?? 'normal', [field]: value } as ClientMsg);
  }
}
