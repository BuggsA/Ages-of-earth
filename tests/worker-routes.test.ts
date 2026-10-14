import { describe, expect, it, vi } from 'vitest';
import { CODE_CHARS, CODE_LENGTH, MAX_SEATS, validCode } from '../src/net/protocol';
import { CIVS, MAP_SIZES, MAP_TYPES } from '../src/sim/data';
import type { CivId, MapSize, MapType } from '../src/sim/types';

// Load through Vitest so Worker globals do not leak into the browser's typecheck (as in room-connections).
const lists = await vi.importActual<{
  CIVS_FOR_ROOMS: CivId[];
  DIFFICULTIES: string[];
  MAP_SIZES_FOR_ROOMS: MapSize[];
  MAP_TYPES_FOR_ROOMS: MapType[];
}>('../worker/lists');
const worker = (await vi.importActual<{ default: { fetch(req: Request, env: unknown): Promise<Response> } }>('../worker/index')).default;

function env() {
  const rooms: string[] = [];
  const forwarded: string[] = [];
  return {
    rooms,
    forwarded,
    ASSETS: { fetch: async (req: Request) => new Response(`asset ${new URL(req.url).pathname}`) },
    ROOMS: {
      idFromName: (name: string) => {
        rooms.push(name);
        return name;
      },
      get: () => ({
        fetch: async (req: Request) => {
          forwarded.push(req.url);
          return new Response('room');
        },
      }),
    },
  };
}

describe('room codes', () => {
  it('accepts codes of the right length drawn from the unmistakable letters only', () => {
    expect(validCode('ABCDE')).toBe(true);
    expect(validCode('XY234')).toBe(true);
    expect(validCode('ABCD')).toBe(false);
    expect(validCode('ABCDEF')).toBe(false);
    expect(validCode('abcde')).toBe(false);
    // O, I, 0 and 1 are left out so a code read aloud can't be misheard.
    for (const c of ['O', 'I', '0', '1']) expect(validCode(`ABCD${c}`)).toBe(false);
    expect(validCode('')).toBe(false);
  });

  it('seats at most as many peoples as the game has', () => {
    expect(MAX_SEATS).toBeGreaterThanOrEqual(2);
    expect(MAX_SEATS).toBeLessThanOrEqual(lists.CIVS_FOR_ROOMS.length);
  });
});

describe('the lists a room accepts', () => {
  it('match the game: every people, land and map size, and only real ones', () => {
    expect([...lists.CIVS_FOR_ROOMS].sort()).toEqual(Object.keys(CIVS).sort());
    expect([...lists.MAP_TYPES_FOR_ROOMS].sort()).toEqual(Object.keys(MAP_TYPES).sort());
    expect([...lists.MAP_SIZES_FOR_ROOMS].sort()).toEqual(Object.keys(MAP_SIZES).sort());
    expect(lists.DIFFICULTIES).toEqual(['easy', 'normal', 'hard']);
  });
});

describe('the Worker', () => {
  it('serves the game itself for anything outside /api/', async () => {
    const e = env();
    const res = await worker.fetch(new Request('https://ages.example/index.html'), e);
    expect(await res.text()).toBe('asset /index.html');
    expect(e.rooms).toEqual([]);
  });

  it('hands out fresh, valid room codes', async () => {
    const e = env();
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const res = await worker.fetch(new Request('https://ages.example/api/rooms', { method: 'POST' }), e);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      const { code } = (await res.json()) as { code: string };
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((c) => CODE_CHARS.includes(c))).toBe(true);
      expect(validCode(code)).toBe(true);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(15);
  });

  it("sends a room's socket to that room's own Durable Object, with the code attached", async () => {
    const e = env();
    const res = await worker.fetch(new Request('https://ages.example/api/rooms/KQ7ZP/ws?name=Ada'), e);
    expect(await res.text()).toBe('room');
    expect(e.rooms).toEqual(['KQ7ZP']);
    const url = new URL(e.forwarded[0]);
    expect(url.searchParams.get('code')).toBe('KQ7ZP');
    expect(url.searchParams.get('name')).toBe('Ada');
  });

  it('turns away bad codes, other paths and the wrong method', async () => {
    const e = env();
    for (const [path, method] of [
      ['/api/rooms/KQ7Z0/ws', 'GET'],
      ['/api/rooms/TOOLONG/ws', 'GET'],
      ['/api/rooms/kq7zp/ws', 'GET'],
      ['/api/rooms', 'GET'],
      ['/api/elsewhere', 'GET'],
    ]) {
      const res = await worker.fetch(new Request(`https://ages.example${path}`, { method }), e);
      expect(res.status, path).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not found.' });
    }
    expect(e.rooms).toEqual([]);
  });
});
