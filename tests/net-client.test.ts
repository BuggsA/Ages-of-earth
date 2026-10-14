import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetClient } from '../src/net/client';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  sent: string[] = [];
  private listeners = new Map<string, ((event: any) => void)[]>();
  constructor(readonly url: string) { Socket.instances.push(this); }
  addEventListener(type: string, callback: (event: any) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  emit(type: string, event = {}): void {
    for (const callback of this.listeners.get(type) ?? []) callback(event);
  }
  open(): void { this.readyState = Socket.OPEN; this.emit('open'); }
  message(message: unknown): void { this.emit('message', { data: JSON.stringify(message) }); }
  drop(code = 1006, reason = ''): void {
    this.readyState = 3;
    this.emit('close', { code, reason });
  }
  close(): void { this.readyState = 3; }
  send(text: string): void { this.sent.push(text); }
}

describe('online client connection lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Socket.instances = [];
    vi.stubGlobal('WebSocket', Socket);
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('location', { protocol: 'https:', host: 'game.test' });
    vi.stubGlobal('localStorage', { getItem: () => 'test-player' });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('ignores stale events without cancelling the replacement heartbeat', () => {
    const client = new NetClient('ROOM', 'Player');
    const onMessage = vi.fn();
    const onStatus = vi.fn();
    client.onMessage = onMessage;
    client.onStatus = onStatus;
    client.connect();
    const old = Socket.instances[0];
    old.open();
    client.connect();
    const current = Socket.instances[1];
    current.open();
    onStatus.mockClear();
    old.emit('open');
    old.message({ t: 'error', why: 'obsolete refusal' });
    old.message({ t: 'pong', at: -1000 });
    old.drop();
    expect(onMessage).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();
    expect(client.rtt).toBe(0);
    vi.advanceTimersByTime(2000);
    expect(current.sent.map(text => JSON.parse(text).t)).toEqual(['ping']);
    expect(old.sent).toEqual([]);
    current.message({ t: 'chat', from: 'Friend', text: 'hello', color: 0 });
    expect(onMessage).toHaveBeenCalledOnce();
    client.close();
  });

  it('cancels pending reconnects on both manual replacement and close', () => {
    const client = new NetClient('ROOM', 'Player');
    client.connect();
    Socket.instances[0].drop();
    client.connect();
    Socket.instances[1].open();
    vi.advanceTimersByTime(1000);
    expect(Socket.instances).toHaveLength(2);
    Socket.instances[1].drop();
    client.close();
    vi.advanceTimersByTime(64000);
    expect(Socket.instances).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries after a recoverable lobby error followed by a network drop', () => {
    const client = new NetClient('ROOM', 'Player');
    client.onClosed = vi.fn();
    client.connect();
    Socket.instances[0].open();
    Socket.instances[0].message({ t: 'error', why: 'Add another player first.' });
    Socket.instances[0].drop();
    vi.advanceTimersByTime(1000);
    expect(Socket.instances).toHaveLength(2);
    expect(client.onClosed).not.toHaveBeenCalled();
    client.close();
  });

  it.each([[1008, 'Room is full'], [1000, 'Opened elsewhere']])('does not retry terminal close %s', (code, reason) => {
    const client = new NetClient('ROOM', 'Player');
    client.onClosed = vi.fn();
    client.connect();
    Socket.instances[0].drop(code as number, reason as string);
    vi.advanceTimersByTime(64000);
    expect(Socket.instances).toHaveLength(1);
    expect(client.onClosed).toHaveBeenCalledWith(reason);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds consecutive failed connection attempts', () => {
    const client = new NetClient('ROOM', 'Player');
    client.onClosed = vi.fn();
    client.connect();
    for (let retry = 0; retry < 6; retry++) {
      Socket.instances[retry].drop();
      vi.advanceTimersByTime(500 * 2 ** (retry + 1));
    }
    Socket.instances[6].drop();
    vi.advanceTimersByTime(64000);
    expect(Socket.instances).toHaveLength(7);
    expect(client.onClosed).toHaveBeenCalledWith('Lost the connection to the room.');
    expect(vi.getTimerCount()).toBe(0);
  });
});
