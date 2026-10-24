import type { ClientMsg, ServerMsg } from './protocol';

/**
 * The browser's line to an online room: one WebSocket, messages in and out as JSON, a steady ping to
 * measure the round trip, and an automatic reconnect if the line drops during a match (the room
 * then replays the turns that were missed).
 */

declare const __BUILD__: string;

const CID_KEY = 'ages-cid';
const NAME_KEY = 'ages-name';

/** A lasting id for this browser, so the room knows a player who reloads the page. */
export function clientId(): string {
  try {
    let id = localStorage.getItem(CID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CID_KEY, id);
    }
    return id;
  } catch {
    return (window as unknown as { __cid?: string }).__cid ??= crypto.randomUUID();
  }
}

export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* Not remembered; no harm. */
  }
}

export async function newRoomCode(): Promise<string> {
  const res = await fetch('/api/rooms', { method: 'POST' });
  if (!res.ok) throw new Error(`The server said ${res.status}`);
  const body = (await res.json()) as { code: string };
  return body.code;
}

export class NetClient {
  onMessage: ((m: ServerMsg) => void) | null = null;
  /** The line dropped for good (`why` says why, if the room said). */
  onClosed: ((why: string) => void) | null = null;
  onStatus: ((status: 'connecting' | 'open' | 'retrying') => void) | null = null;
  /** Round trip to the room, in ms. */
  rtt = 0;
  private ws: WebSocket | null = null;
  private closed = false;
  private retries = 0;
  private pinger = 0;
  private retryTimer = 0;

  constructor(
    readonly code: string,
    private name: string,
    /** A watcher only receives: the room reads nothing from them, so nothing else is sent. */
    private watch = false,
  ) {}

  onVisible = (): void => {
    if (document.hidden || this.closed || !this.retryTimer) return;
    window.clearTimeout(this.retryTimer);
    this.retryTimer = 0;
    this.openSocket();
  };

  connect(): void {
    this.close();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisible);
    this.closed = false;
    this.retries = 0;
    this.openSocket();
  }

  private openSocket(): void {
    this.onStatus?.('connecting');
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const q = new URLSearchParams({ cid: clientId(), name: this.name, build: typeof __BUILD__ === 'string' ? __BUILD__ : 'dev' });
    if (this.watch) q.set('watch', '1');
    const ws = new WebSocket(`${proto}//${location.host}/api/rooms/${this.code}/ws?${q}`);
    this.ws = ws;
    let refused = '';
    ws.addEventListener('open', () => {
      if (this.closed || this.ws !== ws) return;
      this.retries = 0;
      this.onStatus?.('open');
      window.clearInterval(this.pinger);
      this.pinger = window.setInterval(() => this.send({ t: 'ping', at: performance.now() }), 2000);
    });
    ws.addEventListener('message', (e) => {
      if (this.closed || this.ws !== ws) return;
      let m: ServerMsg;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.t === 'pong') {
        this.rtt = Math.round(performance.now() - m.at);
        return;
      }
      if (m.t === 'error') refused = m.why;
      this.onMessage?.(m);
    });
    ws.addEventListener('close', (e) => {
      if (this.ws !== ws) return;
      window.clearInterval(this.pinger);
      this.ws = null;
      if (this.closed) return;
      // A policy refusal or an intentional replacement is final. A lobby validation error
      // alone is recoverable and must not poison a later reconnect.
      if (e.code === 1008 || e.code === 1000 || this.retries >= 6) {
        this.closed = true;
        this.onClosed?.(e.reason || (e.code === 1008 ? refused : '') || 'Lost the connection to the room.');
        return;
      }
      // Try again, a little later each time.
      this.retries++;
      this.onStatus?.('retrying');
      this.retryTimer = window.setTimeout(() => {
        this.retryTimer = 0;
        if (!this.closed) this.openSocket();
      }, 500 * 2 ** this.retries);
    });
  }

  send(m: ClientMsg): void {
    if (this.watch && m.t !== 'ping') return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  close(): void {
    this.closed = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible);
    window.clearTimeout(this.retryTimer);
    this.retryTimer = 0;
    window.clearInterval(this.pinger);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
