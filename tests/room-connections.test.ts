import { afterEach, describe, expect, it, vi } from 'vitest';

// Load through Vitest so Worker globals do not leak into the browser's typecheck.
// The Worker itself is typechecked separately by `tsc -p worker`.
const { Room } = await vi.importActual<{ Room: new (state: object, env: unknown) => unknown }>('../worker/room');

class RoomSocket {
  sent: any[] = [];
  private listeners = new Map<string, ((event: any) => void)[]>();
  addEventListener(type: string, callback: (event: any) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  emit(type: string, event = {}): void {
    for (const callback of this.listeners.get(type) ?? []) callback(event);
  }
  send(text: string): void { this.sent.push(JSON.parse(text)); }
  close(): void { /* A real socket can still have queued messages before close fires. */ }
  message(message: unknown): void { this.emit('message', { data: JSON.stringify(message) }); }
}

// Exercise the room's actual registered socket listeners without a Cloudflare runtime.
function join(room: unknown, socket: RoomSocket, cid: string): void {
  (room as any).join(socket, 'ROOM', cid, cid, 'test');
}

describe('room connection ownership', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('rejects all queued messages from a socket replaced in the lobby', () => {
    const room = new Room({}, {});
    const old = new RoomSocket();
    const current = new RoomSocket();
    join(room, old, 'host');
    join(room, current, 'host');
    current.sent = [];
    old.message({ t: 'setup', setup: { seed: 987 } });
    old.message({ t: 'seat', name: 'Hijacked' });
    old.message({ t: 'addAi', level: 'easy' });
    old.message({ t: 'chat', text: 'stale' });
    old.emit('close');
    old.emit('error');
    expect(current.sent).toEqual([]);
    current.message({ t: 'setup', setup: { seed: 123 } });
    const lobby = current.sent.at(-1).lobby;
    expect(lobby.setup.seed).toBe(123);
    expect(lobby.seats).toHaveLength(1);
    expect(lobby.seats[0].name).toBe('host');
  });

  it('does not let a departed host act on a seat reassigned to another player', () => {
    const room = new Room({}, {});
    const old = new RoomSocket();
    const next = new RoomSocket();
    join(room, old, 'host');
    join(room, next, 'next');
    old.emit('close');
    next.sent = [];
    old.message({ t: 'seat', name: 'Hijacked' });
    old.message({ t: 'setup', setup: { seed: 987 } });
    expect(next.sent).toEqual([]);
    next.message({ t: 'seat', name: 'Still next' });
    expect(next.sent.at(-1).lobby.seats[0].name).toBe('Still next');
  });

  it('keeps replacement commands stamped with the rightful seat during a match', () => {
    vi.useFakeTimers();
    const room = new Room({}, {});
    const old = new RoomSocket();
    const guest = new RoomSocket();
    const current = new RoomSocket();
    join(room, old, 'host');
    join(room, guest, 'guest');
    old.message({ t: 'start' });
    join(room, current, 'host');
    old.message({ t: 'cmd', c: { t: 'stop', p: 1, ids: [999] } });
    old.message({ t: 'pause', on: true });
    old.emit('close');
    current.message({ t: 'cmd', c: { t: 'stop', p: 1, ids: [1] } });
    vi.advanceTimersByTime(100);
    expect(guest.sent.filter(m => m.t === 'turn').at(-1).c).toEqual([{ t: 'stop', p: 0, ids: [1] }]);
    vi.advanceTimersByTime(30000);
    expect(guest.sent.filter(m => m.t === 'turn').flatMap(m => m.c).some(c => c.t === 'leave')).toBe(false);
  });
});
