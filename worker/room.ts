import { CIVS_FOR_ROOMS, DIFFICULTIES, MAP_SIZES_FOR_ROOMS, MAP_TYPES_FOR_ROOMS } from './lists';
import { HASH_EVERY, MAX_SEATS, TURN_MS, type ClientMsg, type LobbyState, type RoomSetup, type Seat, type ServerMsg } from '../src/net/protocol';
import type { CivId, Command } from '../src/sim/types';

/**
 * One online room: the lobby where players gather and pick their peoples, then the clock of the match.
 * Every TURN_MS it sends everyone the commands that came in since the last turn. It never runs the
 * rules itself; it only keeps time, keeps order, keeps the record (so a dropped player can rejoin by
 * replaying it) and compares the browsers' checksums.
 */

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

export class Room {
  private conns: Conn[] = [];
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

  constructor(_state: DurableObjectState, _env: unknown) {}

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket.', { status: 426 });
    const url = new URL(req.url);
    const code = url.searchParams.get('code') ?? '';
    const cid = (url.searchParams.get('cid') ?? '').slice(0, 40);
    const name = clean(url.searchParams.get('name') ?? 'Player', 18) || 'Player';
    const build = (url.searchParams.get('build') ?? '').slice(0, 40);
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    this.join(server, code, cid, name, build);
    return new Response(null, { status: 101, webSocket: client });
  }

  private join(ws: WebSocket, code: string, cid: string, name: string, build: string): void {
    if (!this.code) this.code = code;
    if (!this.build) this.build = build;
    const refuse = (why: string) => {
      ws.send(JSON.stringify({ t: 'error', why } satisfies ServerMsg));
      ws.close(1008, why);
    };
    if (build !== this.build) return refuse('This room is running a different version of the game. Reload the page to update.');
    if (!cid) return refuse('Missing player id.');
    // Back again (a reload, a dropped connection)?
    let seat = this.holders.indexOf(cid);
    if (seat < 0) {
      if (this.started) return refuse('That match has already started.');
      if (this.seats.length >= MAX_SEATS) return refuse('That room is full.');
      seat = this.seats.length;
      const used = new Set(this.seats.map((s) => s.color));
      const color = [0, 1, 2, 3, 4, 5].find((c) => !used.has(c)) ?? 0;
      this.seats.push({ kind: 'human', name, civ: 'random', color, team: this.nextTeam(), online: true });
      this.holders.push(cid);
      if (this.conns.length === 0 && !this.seats.some((s, i) => i !== seat && s.kind === 'human')) this.host = seat;
    }
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
      this.send(conn, { t: 'start', match: { seats: this.seats, setup: this.setup, civs: this.civs }, you: seat });
      this.send(conn, { t: 'catchup', turns: this.turns });
      this.send(conn, { t: 'paused', on: this.paused, by: '' });
      this.chatSystem(`${this.seats[seat].name} is back`);
    }
    this.sendLobby();
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
    this.chatSystem(`${this.seats[seat].name} lost connection`);
    this.dropTimers.set(
      seat,
      setTimeout(() => {
        this.dropTimers.delete(seat);
        if (this.seats[seat].online) return;
        this.buffer.push({ t: 'leave', p: seat });
        this.chatSystem(`${this.seats[seat].name} left; the computer takes over`);
      }, GRACE_MS),
    );
    if (!this.conns.length) this.emptySince = Date.now();
    this.sendLobby();
  }

  private message(conn: Conn, data: string | ArrayBuffer): void {
    // Closing a socket is asynchronous; already queued messages from a replaced or departed
    // connection must never act on the seat now held by someone else.
    if (!this.conns.includes(conn)) return;
    if (typeof data !== 'string' || data.length > MAX_MSG) return;
    let m: ClientMsg;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
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
        if (!isHost || this.started || this.seats.length >= MAX_SEATS || !DIFFICULTIES.includes(m.level)) return;
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
        if (DIFFICULTIES.includes(m.level)) s.level = m.level;
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
        // Everyone commands only their own people.
        this.buffer.push({ ...m.c, p: conn.seat } as Command);
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
          this.broadcast({ t: 'desync', n });
        }
        break;
      }
      case 'pause':
        if (!this.started || this.paused === !!m.on) return;
        this.paused = !!m.on;
        this.broadcast({ t: 'paused', on: this.paused, by: this.seats[conn.seat].name });
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
    if (u.mode === 'conquest' || u.mode === 'regicide' || u.mode === 'deathmatch') this.setup.mode = u.mode;
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
    const msg = JSON.stringify({ t: 'turn', n, c } satisfies ServerMsg);
    for (const conn of this.conns) this.raw(conn, msg);
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
