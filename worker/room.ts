import { CIVS_FOR_ROOMS, MAP_SIZES_FOR_ROOMS, MAP_TYPES_FOR_ROOMS, ROOM_LEVELS } from './lists';
import { HASH_EVERY, MAX_SEATS, ROOM_KEEP_HOURS, TURN_MS, type ClientMsg, type LobbyState, type OpenSeat, type RoomSetup, type Seat, type ServerMsg } from '../src/net/protocol';
import type { CivId, Command } from '../src/sim/types';

/**
 * One online room: the lobby where players gather and pick their peoples, then the clock of the match.
 * Every TURN_MS it sends everyone the commands that came in since the last turn. It never runs the
 * rules itself; it only keeps time, keeps order, keeps the record (so a dropped player can rejoin by
 * replaying it) and compares the browsers' checksums.
 *
 * A started match is kept in the room's storage (its seats, setup and every turn), so it outlives the room's memory: everyone
 * can leave, a deploy can restart the Worker, and the same code still opens the match for ROOM_KEEP_HOURS after the last player
 * left. An alarm then empties it. Nothing runs while the room is empty, and a paused match never hands a seat to the computer.
 */

interface Store {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  deleteAll(): Promise<void>;
  setAlarm(at: number): Promise<void>;
}

/** What the room keeps of a started match, besides its turns (stored `TURN_CHUNK` to a key, as `turns:N`). */
interface Kept {
  code: string;
  build: string;
  seats: Seat[];
  holders: (string | null)[];
  host: number;
  setup: RoomSetup;
  civs: CivId[];
  paused: boolean;
  desynced: boolean;
  /** Seats the computer took over, given back when their player returns. */
  gone: number[];
  turnCount: number;
}

interface Conn {
  ws: WebSocket;
  cid: string;
  seat: number;
  /** Commands this turn, to stop one browser flooding the room. */
  sent: number;
}

/** A player who drops out of a match has this long to come back before the computer takes over. */
const GRACE_MS = 30000;
const MAX_CMDS_PER_TURN = 40;
const MAX_MSG = 8192;
/** People who may watch a match under way. They only receive; the room never reads a command from them. */
const MAX_WATCHERS = 8;
const KEEP_MS = ROOM_KEEP_HOURS * 3600 * 1000;
/** Turns kept to a storage key, and how often (in turns) the newest are written: 20 s and 10 s of play. Two writes a flush keep a
 * room well inside the free plan's daily writes. */
const TURN_CHUNK = 200;
const FLUSH_EVERY = 100;

export class Room {
  private conns: Conn[] = [];
  /** Watchers: seat -1, never in `seats`, `holders` or `conns`, so nothing they send can act on a player. */
  private watchers: Conn[] = [];
  private code = '';
  private build = '';
  private seats: Seat[] = [];
  /** Which browser (client id) holds each human seat. */
  private holders: (string | null)[] = [];
  private host = 0;
  private setup: RoomSetup = { seed: 1 + Math.floor(Math.random() * 999999), size: 'medium', mapType: 'continental', startEpoch: 0, peaceMinutes: 0, mode: 'conquest' };
  private started = false;
  private civs: CivId[] = [];
  private turns: Command[][] = [];
  private buffer: Command[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private hashes = new Map<number, number>();
  private desynced = false;
  private dropTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private emptySince = 0;
  /** Browsers back at a match under way, picking which seat to take (`offerSeats`). */
  private choosing: Conn[] = [];
  private gone = new Set<number>();
  /** Seats whose players have asked for a rematch; the match starts over when every person connected is in it. */
  private rematchVotes = new Set<number>();
  /** The room's storage; absent in tests, where the room lives in memory only. */
  private store: Store | null;
  private ready: Promise<void>;
  /** Turns already written to storage. */
  private flushed = 0;

  constructor(state: DurableObjectState, _env: unknown) {
    this.store = ((state as { storage?: unknown }).storage as Store | undefined) ?? null;
    this.ready = this.store ? this.load() : Promise.resolve();
    const block = (state as { blockConcurrencyWhile?: (f: () => Promise<void>) => Promise<void> }).blockConcurrencyWhile;
    if (block) void block.call(state, () => this.ready);
  }

  /** A match kept from before the room last left memory. */
  private async load(): Promise<void> {
    const kept = await this.store!.get<Kept>('room').catch(() => undefined);
    if (!kept) return;
    Object.assign(this, { code: kept.code, build: kept.build, seats: kept.seats, holders: kept.holders, host: kept.host, setup: kept.setup, civs: kept.civs, paused: kept.paused, desynced: kept.desynced });
    this.gone = new Set(kept.gone);
    for (const s of this.seats) if (s.kind === 'human') s.online = false;
    const turns: Command[][] = [];
    for (let k = 0; k * TURN_CHUNK < kept.turnCount; k++) turns.push(...((await this.store!.get<Command[][]>(`turns:${k}`)) ?? []));
    this.turns = turns.slice(0, kept.turnCount);
    this.flushed = this.turns.length;
    this.started = true;
  }

  /**
   * Write the turns not yet kept, and the match around them. Writes are queued in order; a failed one is retried next time. With
   * `alarm` (the room has just emptied, or the match began), the room forgets the match ROOM_KEEP_HOURS from now unless someone comes back.
   */
  private save(alarm = false): void {
    const store = this.store;
    if (!store || !this.started) return;
    const n = this.turns.length;
    for (let k = Math.floor(this.flushed / TURN_CHUNK); k * TURN_CHUNK < n; k++) void store.put(`turns:${k}`, this.turns.slice(k * TURN_CHUNK, (k + 1) * TURN_CHUNK)).catch(() => (this.flushed = Math.min(this.flushed, k * TURN_CHUNK)));
    this.flushed = n;
    const kept: Kept = { code: this.code, build: this.build, seats: this.seats, holders: this.holders, host: this.host, setup: this.setup, civs: this.civs, paused: this.paused, desynced: this.desynced, gone: [...this.gone], turnCount: n };
    void store.put('room', kept).catch(() => undefined);
    if (alarm) void store.setAlarm(Date.now() + KEEP_MS).catch(() => undefined);
  }

  /** ROOM_KEEP_HOURS after the room last emptied: if it is still empty, it forgets its match. */
  async alarm(): Promise<void> {
    await this.ready;
    if (this.conns.length || this.watchers.length) return void this.store?.setAlarm(Date.now() + KEEP_MS);
    await this.store?.deleteAll();
    if (this.timer) clearInterval(this.timer);
    Object.assign(this, { conns: [], watchers: [], choosing: [], code: '', build: '', seats: [], holders: [], host: 0, setup: { ...this.setup, seed: 1 + Math.floor(Math.random() * 999999) }, started: false, civs: [], turns: [], buffer: [], timer: null, paused: false, desynced: false, emptySince: 0, flushed: 0 });
    this.hashes.clear();
    this.gone.clear();
    this.rematchVotes.clear();
    for (const d of this.dropTimers.values()) clearTimeout(d);
    this.dropTimers.clear();
  }

  async fetch(req: Request): Promise<Response> {
    await this.ready;
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket.', { status: 426 });
    const url = new URL(req.url);
    const code = url.searchParams.get('code') ?? '';
    const cid = (url.searchParams.get('cid') ?? '').slice(0, 40);
    const name = clean(url.searchParams.get('name') ?? 'Player', 18) || 'Player';
    const build = (url.searchParams.get('build') ?? '').slice(0, 40);
    const watch = url.searchParams.get('watch') === '1';
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    this.join(server, code, cid, name, build, watch);
    return new Response(null, { status: 101, webSocket: client });
  }

  private join(ws: WebSocket, code: string, cid: string, name: string, build: string, watch = false): void {
    if (!this.code) this.code = code;
    if (!this.build) this.build = build;
    const refuse = (why: string) => {
      ws.send(JSON.stringify({ t: 'error', why } satisfies ServerMsg));
      ws.close(1008, why);
    };
    // A newer game, back to an empty room (a deploy while everyone was away): the room moves to it, and everyone replays the
    // match on it. While someone is in, the versions must match, or the browsers would disagree.
    if (build !== this.build && !this.conns.length && !this.watchers.length) {
      this.build = build;
      this.desynced = false;
      this.hashes.clear();
    }
    if (build !== this.build) return refuse('This room is running a different version of the game. Reload the page to update.');
    if (!cid) return refuse('Missing player id.');
    if (watch) return this.watch(ws, cid, name, refuse);
    // Back again (a reload, a dropped connection)?
    let seat = this.holders.indexOf(cid);
    if (seat < 0) {
      if (this.started) return this.offerSeats(ws, cid, refuse);
      if (this.seats.length >= MAX_SEATS) return refuse('That room is full.');
      seat = this.seats.length;
      const used = new Set(this.seats.map((s) => s.color));
      const color = [0, 1, 2, 3, 4, 5].find((c) => !used.has(c)) ?? 0;
      this.seats.push({ kind: 'human', name, civ: 'random', color, team: this.nextTeam(), online: true });
      this.holders.push(cid);
      if (this.conns.length === 0 && !this.seats.some((s, i) => i !== seat && s.kind === 'human')) this.host = seat;
    }
    this.attach(ws, cid, seat);
  }

  /** The people seats whose players are away: anyone coming back with the code may take one. */
  private openSeats(): OpenSeat[] {
    const open: OpenSeat[] = [];
    this.seats.forEach((s, seat) => {
      if (s.kind === 'human' && !s.online) open.push({ seat, name: s.name, civ: this.civs[seat], color: s.color });
    });
    return open;
  }

  /**
   * A browser that holds no seat in the match under way (another device, cleared storage): it is shown the seats whose players are
   * away and picks one (`claim`), which becomes its seat. It can do nothing else meanwhile. With no seat open, it is turned away.
   */
  private offerSeats(ws: WebSocket, cid: string, refuse: (why: string) => void): void {
    if (!this.openSeats().length) return refuse('That match is under way and every player is in it. You can watch it instead.');
    const conn: Conn = { ws, cid, seat: -1, sent: 0 };
    this.choosing.push(conn);
    const done = () => (this.choosing = this.choosing.filter((c) => c !== conn));
    ws.addEventListener('message', (e) => {
      if (!this.choosing.includes(conn) || typeof e.data !== 'string' || e.data.length > MAX_MSG) return;
      let m: ClientMsg;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m?.t === 'ping') return this.send(conn, { t: 'pong', at: Number(m.at) || 0 });
      if (m?.t !== 'claim') return;
      const seat = Number(m.seat);
      if (!this.openSeats().some((o) => o.seat === seat)) {
        // Taken a moment ago by someone else: offer what is left.
        if (!this.openSeats().length) {
          done();
          return refuse('That seat was just taken, and no other is free.');
        }
        return this.send(conn, { t: 'open', code: this.code, seats: this.openSeats() });
      }
      done();
      this.holders[seat] = cid;
      this.attach(ws, cid, seat);
    });
    ws.addEventListener('close', done);
    ws.addEventListener('error', done);
    this.send(conn, { t: 'open', code: this.code, seats: this.openSeats() });
  }

  /** A browser takes up its seat: in the lobby, or back in the match. */
  private attach(ws: WebSocket, cid: string, seat: number): void {
    // Only one connection per seat: a new one replaces the old.
    const replaced = this.conns.filter((c) => c.seat === seat);
    this.conns = this.conns.filter((c) => c.seat !== seat);
    for (const c of replaced) {
      try {
        c.ws.close(1000, 'Opened elsewhere');
      } catch {
        /* Already gone. */
      }
    }
    const conn: Conn = { ws, cid, seat, sent: 0 };
    this.conns.push(conn);
    this.seats[seat].online = true;
    this.emptySince = 0;
    const drop = this.dropTimers.get(seat);
    if (drop) {
      clearTimeout(drop);
      this.dropTimers.delete(seat);
    }
    ws.addEventListener('message', (e) => this.message(conn, e.data));
    ws.addEventListener('close', () => this.leave(conn));
    ws.addEventListener('error', () => this.leave(conn));
    if (this.started) {
      // The computer led this people while its player was away: hand it back.
      if (this.gone.delete(seat)) this.buffer.push({ t: 'leave', p: seat, back: true });
      if (!this.timer) this.timer = setInterval(() => this.tick(), TURN_MS);
      this.armDrops();
      this.save();
      this.send(conn, { t: 'start', match: { seats: this.seats, setup: this.setup, civs: this.civs }, you: seat });
      this.send(conn, { t: 'catchup', turns: this.turns });
      this.send(conn, { t: 'paused', on: this.paused, by: '' });
      this.chatSystem(`${this.seats[seat].name} is back`);
      this.tallyRematch();
    }
    this.sendLobby();
  }

  /** A watcher sees the match from its first turn but can do nothing in it. */
  private watch(ws: WebSocket, cid: string, name: string, refuse: (why: string) => void): void {
    if (!this.started) return refuse('That match has not started yet. Ask for the room link to join it.');
    if (this.watchers.length >= MAX_WATCHERS) return refuse('That match has all the watchers it can hold.');
    const conn: Conn = { ws, cid, seat: -1, sent: 0 };
    this.watchers.push(conn);
    ws.addEventListener('message', (e) => this.message(conn, e.data));
    ws.addEventListener('close', () => this.unwatch(conn, name));
    ws.addEventListener('error', () => this.unwatch(conn, name));
    this.send(conn, { t: 'start', match: { seats: this.seats, setup: this.setup, civs: this.civs }, you: -1 });
    this.send(conn, { t: 'catchup', turns: this.turns });
    this.send(conn, { t: 'paused', on: this.paused, by: '' });
    this.chatSystem(`${name} is watching`);
  }

  private unwatch(conn: Conn, name: string): void {
    if (!this.watchers.includes(conn)) return;
    this.watchers = this.watchers.filter((c) => c !== conn);
    this.chatSystem(`${name} stopped watching`);
  }

  private nextTeam(): number {
    const used = new Set(this.seats.map((s) => s.team));
    for (let t = 1; t <= MAX_SEATS; t++) if (!used.has(t)) return t;
    return 1;
  }

  private leave(conn: Conn): void {
    if (!this.conns.includes(conn)) return;
    this.conns = this.conns.filter((c) => c !== conn);
    const seat = conn.seat;
    if (this.conns.some((c) => c.seat === seat)) return;
    if (!this.started) {
      // Gone from the lobby: free the seat.
      this.seats.splice(seat, 1);
      this.holders.splice(seat, 1);
      for (const c of this.conns) if (c.seat > seat) c.seat--;
      if (this.host === seat || this.host >= this.seats.length || this.seats[this.host]?.kind !== 'human') {
        this.host = this.seats.findIndex((s) => s.kind === 'human');
        if (this.host < 0) this.host = 0;
      } else if (this.host > seat) this.host--;
      this.sendLobby();
      return;
    }
    this.seats[seat].online = false;
    this.rematchVotes.delete(seat);
    this.chatSystem(`${this.seats[seat].name} lost connection`);
    if (!this.conns.length) {
      // Everyone gone: the match waits for them as it is, and nobody is handed to the computer.
      this.emptySince = Date.now();
      this.clearDrops();
      this.save(true);
    } else {
      this.armDrops();
      this.save();
      // Those left may all have voted already: the one who went was the last to be waited for.
      this.tallyRematch();
    }
    this.sendLobby();
  }

  /** Each player away from a running match has GRACE_MS to come back before the computer takes over; never while paused or empty. */
  private armDrops(): void {
    if (this.paused || !this.conns.length) return;
    this.seats.forEach((s, seat) => {
      if (s.kind !== 'human' || s.online || this.gone.has(seat) || this.dropTimers.has(seat)) return;
      this.dropTimers.set(
        seat,
        setTimeout(() => {
          this.dropTimers.delete(seat);
          if (this.seats[seat].online || this.paused || !this.conns.length || this.gone.has(seat)) return;
          this.buffer.push({ t: 'leave', p: seat });
          this.gone.add(seat);
          this.save();
          this.chatSystem(`${this.seats[seat].name} left; the computer takes over`);
        }, GRACE_MS),
      );
    });
  }

  private clearDrops(): void {
    for (const d of this.dropTimers.values()) clearTimeout(d);
    this.dropTimers.clear();
  }

  private message(conn: Conn, data: string | ArrayBuffer): void {
    // Closing a socket is asynchronous; already queued messages from a replaced or departed
    // connection must never act on the seat now held by someone else.
    const watcher = this.watchers.includes(conn);
    if (!watcher && !this.conns.includes(conn)) return;
    if (typeof data !== 'string' || data.length > MAX_MSG) return;
    let m: ClientMsg;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    // Watchers may only ping: no commands, chat, pausing, hashes or lobby changes.
    if (watcher && m.t !== 'ping') return;
    const isHost = conn.seat === this.host;
    switch (m.t) {
      case 'ping':
        this.send(conn, { t: 'pong', at: Number(m.at) || 0 });
        break;
      case 'seat': {
        if (this.started) return;
        const s = this.seats[conn.seat];
        this.editSeat(s, m);
        if (typeof m.name === 'string') s.name = clean(m.name, 18) || s.name;
        this.sendLobby();
        break;
      }
      case 'setup':
        if (!isHost || this.started || !m.setup) return;
        this.editSetup(m.setup);
        this.sendLobby();
        break;
      case 'addAi': {
        if (!isHost || this.started || this.seats.length >= MAX_SEATS || !ROOM_LEVELS.includes(m.level)) return;
        const used = new Set(this.seats.map((s) => s.color));
        const color = [0, 1, 2, 3, 4, 5].find((c) => !used.has(c)) ?? 0;
        this.seats.push({ kind: 'ai', name: 'Computer', civ: 'random', color, team: this.nextTeam(), level: m.level });
        this.holders.push(null);
        this.sendLobby();
        break;
      }
      case 'removeSeat': {
        const i = Number(m.seat);
        if (!isHost || this.started || this.seats[i]?.kind !== 'ai') return;
        this.seats.splice(i, 1);
        this.holders.splice(i, 1);
        for (const c of this.conns) if (c.seat > i) c.seat--;
        if (this.host > i) this.host--;
        this.sendLobby();
        break;
      }
      case 'aiLevel': {
        const s = this.seats[Number(m.seat)];
        if (!isHost || this.started || !s || s.kind !== 'ai') return;
        if (ROOM_LEVELS.includes(m.level)) s.level = m.level;
        // The host also sets the computer's people, color and team through this seat.
        this.editSeat(s, m as unknown as { civ?: string; color?: number; team?: number });
        this.sendLobby();
        break;
      }
      case 'start':
        if (!isHost || this.started) return;
        this.start(conn);
        break;
      case 'cmd': {
        if (!this.started || !m.c || typeof m.c !== 'object' || typeof m.c.t !== 'string') return;
        if (++conn.sent > MAX_CMDS_PER_TURN) return;
        // Only the room gives a people back from the computer.
        if (m.c.t === 'leave' && m.c.back) return;
        // Everyone commands only their own people.
        this.buffer.push({ ...m.c, p: conn.seat } as Command);
        // Leaving on purpose: the people goes to the computer, and comes back if its player does.
        if (m.c.t === 'leave') this.gone.add(conn.seat);
        break;
      }
      case 'hash': {
        const n = Number(m.n);
        const h = Number(m.h);
        if (!Number.isFinite(n) || !Number.isFinite(h)) return;
        const known = this.hashes.get(n);
        if (known === undefined) {
          this.hashes.set(n, h);
          if (this.hashes.size > 40) this.hashes.delete(this.hashes.keys().next().value!);
        } else if (known !== h && !this.desynced) {
          this.desynced = true;
          this.save();
          this.broadcast({ t: 'desync', n });
        }
        break;
      }
      case 'pause':
        if (!this.started || this.paused === !!m.on) return;
        this.paused = !!m.on;
        if (this.paused) this.clearDrops();
        else this.armDrops();
        this.save();
        this.broadcast({ t: 'paused', on: this.paused, by: this.seats[conn.seat].name });
        break;
      case 'rematch':
        if (!this.started) return;
        if (m.on === false) this.rematchVotes.delete(conn.seat);
        else this.rematchVotes.add(conn.seat);
        this.tallyRematch();
        break;
      case 'chat': {
        const text = clean(String(m.text ?? ''), 200);
        if (!text) return;
        const s = this.seats[conn.seat];
        this.broadcast({ t: 'chat', from: s.name, color: s.color, text });
        break;
      }
    }
  }

  private editSeat(s: Seat, m: { civ?: string; color?: number; team?: number }): void {
    if (typeof m.civ === 'string' && (m.civ === 'random' || CIVS_FOR_ROOMS.includes(m.civ as CivId))) s.civ = m.civ as Seat['civ'];
    if (typeof m.color === 'number' && m.color >= 0 && m.color < 6 && !this.seats.some((o) => o !== s && o.color === m.color)) s.color = m.color;
    if (typeof m.team === 'number' && m.team >= 1 && m.team <= MAX_SEATS) s.team = Math.floor(m.team);
  }

  private editSetup(u: Partial<RoomSetup>): void {
    if (typeof u.seed === 'number' && u.seed >= 1 && u.seed < 1e9) this.setup.seed = Math.floor(u.seed);
    if (typeof u.size === 'string' && MAP_SIZES_FOR_ROOMS.includes(u.size)) this.setup.size = u.size;
    if (typeof u.mapType === 'string' && MAP_TYPES_FOR_ROOMS.includes(u.mapType)) this.setup.mapType = u.mapType;
    if (typeof u.startEpoch === 'number' && u.startEpoch >= 0 && u.startEpoch <= 4) this.setup.startEpoch = Math.floor(u.startEpoch);
    if (typeof u.peaceMinutes === 'number' && u.peaceMinutes >= 0 && u.peaceMinutes <= 30) this.setup.peaceMinutes = Math.floor(u.peaceMinutes);
    if (u.mode === 'conquest' || u.mode === 'regicide' || u.mode === 'deathmatch' || u.mode === 'lords') this.setup.mode = u.mode;
  }

  private start(conn: Conn): void {
    if (this.seats.length < 2) return this.send(conn, { t: 'error', why: 'Add another player or a computer opponent first.' });
    if (new Set(this.seats.map((s) => s.team)).size < 2) return this.send(conn, { t: 'error', why: 'Everyone is on the same team: put someone on another.' });
    this.started = true;
    // Random peoples are picked now, differently for each seat where possible.
    const taken = new Set(this.seats.map((s) => s.civ).filter((c) => c !== 'random'));
    const free = CIVS_FOR_ROOMS.filter((c) => !taken.has(c));
    this.civs = this.seats.map((s) => {
      if (s.civ !== 'random') return s.civ;
      const pool = free.length ? free : CIVS_FOR_ROOMS;
      const c = pool[Math.floor(Math.random() * pool.length)];
      free.splice(free.indexOf(c), 1);
      return c;
    });
    for (const c of this.conns) this.send(c, { t: 'start', match: { seats: this.seats, setup: this.setup, civs: this.civs }, you: c.seat });
    this.sendLobby();
    this.timer = setInterval(() => this.tick(), TURN_MS);
    this.save(true);
  }

  /**
   * Count the rematch votes of the people connected (a player away is not waited for) and, when every one has voted, start the match
   * over. A vote only ever counts in the room whose seat it came from, and the room needs every person in it, so one player cannot
   * throw the others out of a match under way.
   */
  private tallyRematch(): void {
    if (!this.rematchVotes.size) return;
    const here = new Set(this.conns.map((c) => c.seat));
    const voted = [...this.rematchVotes].filter((s) => here.has(s)).length;
    if (here.size && voted === here.size) return this.rematch();
    for (const c of this.conns) this.send(c, { t: 'rematch', voted, need: here.size, mine: this.rematchVotes.has(c.seat) });
  }

  /** The same seats, peoples and seed, from the first turn: the record is wiped, so a player coming back later replays only this match. */
  private rematch(): void {
    this.clearDrops();
    this.rematchVotes.clear();
    this.turns = [];
    this.buffer = [];
    this.flushed = 0;
    this.hashes.clear();
    this.desynced = false;
    this.paused = false;
    this.gone.clear();
    for (const c of this.conns) c.sent = 0;
    this.chatSystem('Rematch: the same land and peoples, from the start');
    for (const c of this.conns) this.send(c, { t: 'start', match: { seats: this.seats, setup: this.setup, civs: this.civs }, you: c.seat });
    for (const c of this.watchers) this.send(c, { t: 'start', match: { seats: this.seats, setup: this.setup, civs: this.civs }, you: -1 });
    this.armDrops();
    this.save(true);
  }

  /** One turn of the clock. */
  private tick(): void {
    if (!this.conns.length) {
      // Everyone gone for a while: the room winds down.
      if (this.emptySince && Date.now() - this.emptySince > 5 * 60000 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      return;
    }
    if (this.paused) return;
    const c = this.buffer;
    this.buffer = [];
    for (const conn of this.conns) conn.sent = 0;
    const n = this.turns.length;
    this.turns.push(c);
    if (this.turns.length - this.flushed >= FLUSH_EVERY) this.save();
    const msg = JSON.stringify({ t: 'turn', n, c } satisfies ServerMsg);
    for (const conn of this.conns) this.raw(conn, msg);
    for (const conn of this.watchers) this.raw(conn, msg);
    void HASH_EVERY;
  }

  private chatSystem(text: string): void {
    this.broadcast({ t: 'chat', from: '', color: -1, text });
  }

  private lobby(): LobbyState {
    return { code: this.code, seats: this.seats, setup: this.setup, host: this.host, started: this.started };
  }

  private sendLobby(): void {
    const lobby = this.lobby();
    for (const c of this.conns) this.send(c, { t: 'lobby', lobby, you: c.seat });
  }

  private broadcast(m: ServerMsg): void {
    const text = JSON.stringify(m);
    for (const c of this.conns) this.raw(c, text);
    for (const c of this.watchers) this.raw(c, text);
  }

  private send(c: Conn, m: ServerMsg): void {
    this.raw(c, JSON.stringify(m));
  }

  private raw(c: Conn, text: string): void {
    try {
      c.ws.send(text);
    } catch {
      /* Closing; its close handler tidies up. */
    }
  }
}

/** Plain text only, trimmed to a length. */
function clean(text: string, max: number): string {
  return text.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}
