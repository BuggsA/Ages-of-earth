import { afterEach, describe, expect, it, vi } from 'vitest';

// The room keeps a started match in its storage (#owner ask, 2026-10-24): everyone can leave and come back with the code.
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

/** A Durable Object's storage, in memory. */
function storage() {
  const data = new Map<string, unknown>();
  let alarm = 0;
  return {
    data,
    get alarm() { return alarm; },
    storage: {
      get: async (k: string) => structuredClone(data.get(k)),
      put: async (k: string, v: unknown) => void data.set(k, structuredClone(v)),
      deleteAll: async () => data.clear(),
      setAlarm: async (at: number) => void (alarm = at),
    },
  };
}

function join(room: unknown, socket: RoomSocket, cid: string, build = 'test'): void {
  (room as any).join(socket, 'ROOM', cid, cid, build);
}

const turns = (s: RoomSocket) => s.sent.filter((m) => m.t === 'turn');
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('a room keeps its match', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('reopens the match from storage after the room leaves memory, with each seat for its browser', async () => {
    const st = storage();
    const room = new Room({ storage: st.storage }, {});
    await (room as any).ready;
    const host = new RoomSocket();
    const guest = new RoomSocket();
    join(room, host, 'host');
    vi.useFakeTimers();
    join(room, guest, 'guest');
    host.message({ t: 'start' });
    host.message({ t: 'cmd', c: { t: 'stop', p: 0, ids: [1] } });
    vi.advanceTimersByTime(1000);
    host.emit('close');
    guest.emit('close');
    vi.useRealTimers();
    await flush();
    const played = turns(guest).length;
    expect(st.alarm).toBeGreaterThan(Date.now() + 35 * 3600 * 1000);

    // A fresh object, as after an eviction or a deploy: everything comes from storage.
    const again = new Room({ storage: st.storage }, {});
    await (again as any).ready;
    const back = new RoomSocket();
    join(again, back, 'guest', 'newer');
    const start = back.sent.find((m) => m.t === 'start');
    expect(start.you).toBe(1);
    const catchup = back.sent.find((m) => m.t === 'catchup');
    expect(catchup.turns).toHaveLength(played);
    expect(catchup.turns.flat()).toContainEqual({ t: 'stop', p: 0, ids: [1] });
  });

  it('runs no turns and hands nobody to the computer while the room is empty', () => {
    vi.useFakeTimers();
    const room = new Room({}, {});
    const host = new RoomSocket();
    const guest = new RoomSocket();
    join(room, host, 'host');
    join(room, guest, 'guest');
    host.message({ t: 'start' });
    host.emit('close');
    guest.emit('close');
    vi.advanceTimersByTime(10 * 60000);
    const back = new RoomSocket();
    join(room, back, 'host');
    const seen = back.sent.find((m) => m.t === 'catchup').turns.length;
    vi.advanceTimersByTime(100);
    expect(turns(back).length).toBe(1);
    expect(turns(back)[0].n).toBe(seen);
    // The guest is still away: now someone is in, they have the usual grace before the computer takes over.
    vi.advanceTimersByTime(29000);
    expect(turns(back).flatMap((m) => m.c).some((c) => c.t === 'leave')).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(turns(back).flatMap((m) => m.c)).toContainEqual({ t: 'leave', p: 1 });
  });

  it('never hands a seat to the computer while the match is paused, and gives a taken seat back', () => {
    vi.useFakeTimers();
    const room = new Room({}, {});
    const host = new RoomSocket();
    const guest = new RoomSocket();
    join(room, host, 'host');
    join(room, guest, 'guest');
    host.message({ t: 'start' });
    host.message({ t: 'pause', on: true });
    guest.emit('close');
    vi.advanceTimersByTime(120000);
    host.message({ t: 'pause', on: false });
    vi.advanceTimersByTime(1000);
    expect(turns(host).flatMap((m) => m.c).some((c) => c.t === 'leave')).toBe(false);
    vi.advanceTimersByTime(31000);
    expect(turns(host).flatMap((m) => m.c)).toContainEqual({ t: 'leave', p: 1 });
    const back = new RoomSocket();
    join(room, back, 'guest');
    vi.advanceTimersByTime(100);
    expect(turns(host).flatMap((m) => m.c)).toContainEqual({ t: 'leave', p: 1, back: true });
  });

  it('lets a new browser pick the seat of a player who is away, and nothing else', () => {
    vi.useFakeTimers();
    const room = new Room({}, {});
    const host = new RoomSocket();
    const guest = new RoomSocket();
    join(room, host, 'host');
    join(room, guest, 'guest');
    host.message({ t: 'start' });
    guest.emit('close');
    const phone = new RoomSocket();
    join(room, phone, 'phone');
    const open = phone.sent.find((m) => m.t === 'open');
    expect(open.seats.map((s: any) => s.seat)).toEqual([1]);
    // Before a seat is claimed, nothing it sends reaches the match.
    phone.message({ t: 'cmd', c: { t: 'stop', p: 0, ids: [1] } });
    phone.message({ t: 'claim', seat: 0 });
    expect(phone.sent.some((m) => m.t === 'start')).toBe(false);
    phone.message({ t: 'claim', seat: 1 });
    expect(phone.sent.find((m) => m.t === 'start').you).toBe(1);
    phone.message({ t: 'cmd', c: { t: 'stop', p: 0, ids: [2] } });
    vi.advanceTimersByTime(100);
    expect(turns(host).flatMap((m) => m.c)).toEqual([{ t: 'stop', p: 1, ids: [2] }]);
    // Every seat taken: a further browser is turned away.
    const late = new RoomSocket();
    join(room, late, 'late');
    expect(late.sent[0].t).toBe('error');
    expect(late.closed).not.toBe('');
  });

  it('lets only the room give a people back', () => {
    vi.useFakeTimers();
    const room = new Room({}, {});
    const host = new RoomSocket();
    const guest = new RoomSocket();
    join(room, host, 'host');
    join(room, guest, 'guest');
    host.message({ t: 'start' });
    guest.message({ t: 'cmd', c: { t: 'leave', p: 1, back: true } });
    vi.advanceTimersByTime(100);
    expect(turns(host).flatMap((m) => m.c)).toEqual([]);
  });
});

describe('a people taken back from the computer', async () => {
  const { createGame } = await import('../src/sim/game');
  const { applyCommand } = await import('../src/sim/commands');
  it('is led by its player again only after it left', () => {
    const s = createGame({ seed: 3, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    applyCommand(s, { t: 'leave', p: 1, back: true });
    expect(s.players[1].ai).toBe(null);
    applyCommand(s, { t: 'leave', p: 1 });
    expect(s.players[1].ai).toBe('normal');
    applyCommand(s, { t: 'leave', p: 1, back: true });
    expect(s.players[1].ai).toBe(null);
    expect(s.players[1].left).toBeUndefined();
  });
});
