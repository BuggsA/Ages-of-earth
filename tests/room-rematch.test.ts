import { afterEach, describe, expect, it, vi } from 'vitest';

// A rematch (#746): every person connected asks for it, and the room starts the same match over.
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
  close(): void { /* Nothing to tidy. */ }
  message(message: unknown): void { this.emit('message', { data: JSON.stringify(message) }); }
  of(t: string) { return this.sent.filter((m) => m.t === t); }
}

function join(room: unknown, socket: RoomSocket, cid: string): void {
  (room as any).join(socket, 'ROOM', cid, cid, 'test');
}

/** Two people on opposite teams, started, with a command played. */
function startedRoom() {
  vi.useFakeTimers();
  const room = new Room({}, {});
  const host = new RoomSocket();
  const guest = new RoomSocket();
  join(room, host, 'host');
  join(room, guest, 'guest');
  guest.message({ t: 'seat', team: 2, civ: 'romans' });
  host.message({ t: 'seat', civ: 'greeks' });
  host.message({ t: 'start' });
  host.message({ t: 'cmd', c: { t: 'stop', p: 0, ids: [1] } });
  vi.advanceTimersByTime(1000);
  return { room: room as any, host, guest };
}

describe('a rematch', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('waits for every person in the room, then starts the same match over', () => {
    const { room, host, guest } = startedRoom();
    const first = { setup: host.of('start')[0].match.setup, civs: host.of('start')[0].match.civs };
    expect(room.turns.length).toBeGreaterThan(5);

    host.message({ t: 'rematch', on: true });
    expect(host.of('start')).toHaveLength(1);
    expect(host.of('rematch').at(-1)).toEqual({ t: 'rematch', voted: 1, need: 2, mine: true });
    expect(guest.of('rematch').at(-1)).toEqual({ t: 'rematch', voted: 1, need: 2, mine: false });

    guest.message({ t: 'rematch', on: true });
    for (const [p, seat] of [[host, 0], [guest, 1]] as const) {
      expect(p.of('start')).toHaveLength(2);
      const again = p.of('start')[1];
      expect(again.you).toBe(seat);
      expect(again.match.setup).toEqual(first.setup);
      expect(again.match.civs).toEqual(first.civs);
    }
    // The record starts over, so the old match is not replayed and the clock begins at turn 0.
    expect(room.turns).toHaveLength(0);
    const seen = host.of('turn').length;
    vi.advanceTimersByTime(300);
    expect(host.of('turn').slice(seen).map((m) => m.n)).toEqual([0, 1, 2]);
    expect(room.rematchVotes.size).toBe(0);
  });

  it('lets a player take the vote back', () => {
    const { host, guest } = startedRoom();
    host.message({ t: 'rematch', on: true });
    host.message({ t: 'rematch', on: false });
    guest.message({ t: 'rematch', on: true });
    expect(host.of('start')).toHaveLength(1);
    expect(guest.of('rematch').at(-1)).toMatchObject({ voted: 1, need: 2 });
  });

  it('counts a vote once, however often it is sent', () => {
    const { host, guest } = startedRoom();
    for (let i = 0; i < 3; i++) host.message({ t: 'rematch', on: true });
    expect(host.of('start')).toHaveLength(1);
    expect(guest.of('rematch').at(-1)).toMatchObject({ voted: 1, need: 2 });
  });

  it('does not wait for a player who has left', () => {
    const { host, guest } = startedRoom();
    host.message({ t: 'rematch', on: true });
    guest.emit('close');
    expect(host.of('start')).toHaveLength(2);
  });

  it('forgets the vote of a player who leaves, so it cannot count for the next one to sit there', () => {
    const { room, host, guest } = startedRoom();
    guest.message({ t: 'rematch', on: true });
    guest.emit('close');
    expect(room.rematchVotes.has(1)).toBe(false);
    expect(host.of('start')).toHaveLength(1);
  });

  it('ignores a vote before the match has started, and from a watcher', () => {
    vi.useFakeTimers();
    const room = new Room({}, {}) as any;
    const host = new RoomSocket();
    join(room, host, 'host');
    host.message({ t: 'rematch', on: true });
    expect(room.rematchVotes.size).toBe(0);
    expect(host.of('rematch')).toHaveLength(0);

    const { room: live, host: h, guest } = startedRoom();
    const watcher = new RoomSocket();
    (live as any).join(watcher, 'ROOM', 'eye', 'eye', 'test', true);
    watcher.message({ t: 'rematch', on: true });
    h.message({ t: 'rematch', on: true });
    guest.message({ t: 'rematch', on: true });
    expect(watcher.of('start').at(-1).you).toBe(-1);
    expect(watcher.of('start')).toHaveLength(2);
  });

  it('a rematch is kept in storage as a fresh match, with none of the old turns', async () => {
    const data = new Map<string, unknown>();
    const storage = {
      get: async (k: string) => structuredClone(data.get(k)),
      put: async (k: string, v: unknown) => void data.set(k, structuredClone(v)),
      deleteAll: async () => data.clear(),
      setAlarm: async () => undefined,
    };
    vi.useFakeTimers();
    const room = new Room({ storage }, {}) as any;
    await room.ready;
    const host = new RoomSocket();
    const guest = new RoomSocket();
    join(room, host, 'host');
    join(room, guest, 'guest');
    guest.message({ t: 'seat', team: 2 });
    host.message({ t: 'start' });
    vi.advanceTimersByTime(1000);
    host.message({ t: 'rematch', on: true });
    guest.message({ t: 'rematch', on: true });
    await vi.advanceTimersByTimeAsync(0);
    expect((data.get('room') as any).turnCount).toBe(0);
  });
});
