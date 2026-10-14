import { afterEach, describe, expect, it, vi } from 'vitest';

const { Room } = await vi.importActual<{ Room: new (state: object, env: unknown) => unknown }>('../worker/room');

class RoomSocket {
  sent: any[] = [];
  closed = '';
  private listeners = new Map<string, ((event: any) => void)[]>();
  addEventListener(type: string, callback: (event: any) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  emit(type: string, event = {}): void {
    for (const callback of this.listeners.get(type) ?? []) callback(event);
  }
  send(text: string): void { this.sent.push(JSON.parse(text)); }
  close(_code?: number, why?: string): void { this.closed = why ?? 'closed'; }
  message(message: unknown): void { this.emit('message', { data: JSON.stringify(message) }); }
}

function join(room: unknown, socket: RoomSocket, cid: string, watch = false): void {
  (room as any).join(socket, 'ROOM', cid, cid, 'test', watch);
}

function startedRoom() {
  const room = new Room({}, {});
  const host = new RoomSocket();
  const guest = new RoomSocket();
  join(room, host, 'host');
  join(room, guest, 'guest');
  host.message({ t: 'start' });
  return { room, host, guest };
}

describe('watching a match', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('turns a watcher away before the match starts', () => {
    const room = new Room({}, {});
    join(room, new RoomSocket(), 'host');
    const w = new RoomSocket();
    join(room, w, 'eve', true);
    expect(w.sent[0].t).toBe('error');
    expect(w.closed).not.toBe('');
  });

  it('sends a watcher the start, the turns so far and every turn after', () => {
    vi.useFakeTimers();
    const { room, host } = startedRoom();
    host.message({ t: 'cmd', c: { t: 'stop', p: 0, ids: [1] } });
    vi.advanceTimersByTime(300);
    const w = new RoomSocket();
    join(room, w, 'eve', true);
    expect(w.sent.map((m) => m.t).slice(0, 3)).toEqual(['start', 'catchup', 'paused']);
    expect(w.sent[0].you).toBe(-1);
    expect(w.sent[1].turns.length).toBeGreaterThanOrEqual(3);
    const before = w.sent.filter((m) => m.t === 'turn').length;
    vi.advanceTimersByTime(200);
    expect(w.sent.filter((m) => m.t === 'turn').length).toBe(before + 2);
  });

  it('never lets a watcher command, pause, chat or change anything', () => {
    vi.useFakeTimers();
    const { room, host, guest } = startedRoom();
    const w = new RoomSocket();
    join(room, w, 'eve', true);
    w.message({ t: 'cmd', c: { t: 'stop', p: 0, ids: [666] } });
    w.message({ t: 'pause', on: true });
    w.message({ t: 'chat', text: 'hello' });
    w.message({ t: 'hash', n: 1, h: 7 });
    w.message({ t: 'setup', setup: { seed: 5 } });
    w.message({ t: 'seat', name: 'Hijacked' });
    host.sent = [];
    vi.advanceTimersByTime(100);
    expect(host.sent.filter((m) => m.t === 'turn').flatMap((m) => m.c)).toEqual([]);
    expect(host.sent.some((m) => m.t === 'paused' || (m.t === 'chat' && m.from))).toBe(false);
    expect(guest.sent.some((m) => m.t === 'desync')).toBe(false);
    w.message({ t: 'ping', at: 3 });
    expect(w.sent.at(-1)).toEqual({ t: 'pong', at: 3 });
  });

  it('takes no seat and does not stop the grace timer or hold the room open', () => {
    vi.useFakeTimers();
    const { room, host } = startedRoom();
    const w = new RoomSocket();
    join(room, w, 'host', true); // Same id as the host: still only a watcher.
    expect((room as any).seats).toHaveLength(2);
    expect((room as any).conns).toHaveLength(2);
    w.emit('close');
    expect((room as any).conns).toHaveLength(2);
    host.message({ t: 'cmd', c: { t: 'stop', p: 1, ids: [1] } });
    vi.advanceTimersByTime(100);
    expect(host.sent.filter((m) => m.t === 'turn').at(-1).c).toEqual([{ t: 'stop', p: 0, ids: [1] }]);
  });

  it('caps the watchers', () => {
    const { room } = startedRoom();
    const socks = Array.from({ length: 9 }, () => new RoomSocket());
    socks.forEach((s, i) => join(room, s, `w${i}`, true));
    expect(socks[8].sent[0].t).toBe('error');
    expect((room as any).watchers).toHaveLength(8);
  });
});
