import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_CLOUD_SAVE, VAULT_KEY_LENGTH, VAULT_SLOTS, formatVaultKey, newVaultKey, normalizeVaultKey, validVaultKey } from '../src/net/vault';
import { deleteCloud, listCloud, loadCloud, saveCloud } from '../src/net/cloud';

// Load through Vitest so Worker globals do not leak into the browser's typecheck (as in worker-routes).
const { Vault } = await vi.importActual<{ Vault: new (state: object, env: unknown) => { fetch(req: Request): Promise<Response>; alarm(): Promise<void> } }>('../worker/vault');
const worker = (await vi.importActual<{ default: { fetch(req: Request, env: unknown): Promise<Response> } }>('../worker/index')).default;

/** A Durable Object's storage, in memory. */
function storage() {
  const data = new Map<string, unknown>();
  let alarm = 0;
  return {
    data,
    alarmAt: () => alarm,
    get: async (k: string) => data.get(k),
    put: async (k: string, v: unknown) => void data.set(k, v),
    delete: async (k: string) => data.delete(k),
    deleteAll: async () => data.clear(),
    setAlarm: async (at: number) => void (alarm = at),
  };
}

/** The Worker's environment with real vaults, one per name, as Cloudflare would keep them. */
function env() {
  const vaults = new Map<string, { vault: InstanceType<typeof Vault>; store: ReturnType<typeof storage> }>();
  return {
    vaults,
    ASSETS: { fetch: async () => new Response('asset') },
    ROOMS: { idFromName: (n: string) => n, get: () => ({ fetch: async () => new Response('room') }) },
    VAULTS: {
      idFromName: (n: string) => n,
      get: (id: string) => {
        if (!vaults.has(id)) {
          const store = storage();
          vaults.set(id, { vault: new Vault({ storage: store }, {}), store });
        }
        return vaults.get(id)!.vault;
      },
    },
  };
}

const KEY = 'ABCDEFGHJKLMNPQRSTUV';
const at = (path: string, init?: RequestInit) => new Request(`https://ages.example/api/vault/${path}`, init);
const put = (bytes: Uint8Array<ArrayBuffer> | string, title = 'A match') => ({ method: 'PUT', body: bytes, headers: { 'x-save-title': encodeURIComponent(title) } });

describe('save keys', () => {
  it('are 20 of the unmistakable letters, fresh each time', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const k = newVaultKey();
      expect(k).toHaveLength(VAULT_KEY_LENGTH);
      expect(validVaultKey(k)).toBe(true);
      keys.add(k);
    }
    expect(keys.size).toBe(50);
  });

  it('read back however they are typed, and refuse anything else', () => {
    expect(formatVaultKey(KEY)).toBe('ABCD-EFGH-JKLM-NPQR-STUV');
    expect(normalizeVaultKey(' abcd-efgh jklm-npqr-stuv ')).toBe(KEY);
    expect(normalizeVaultKey('ABCD-EFGH-JKLM-NPQR-STU')).toBe('');
    expect(normalizeVaultKey('ABCD-EFGH-JKLM-NPQR-STU0')).toBe('');
    expect(normalizeVaultKey('')).toBe('');
  });
});

describe('the vault routes', () => {
  it('start empty, keep a save in a slot, give it back byte for byte, and empty it', async () => {
    const e = env();
    let res = await worker.fetch(at(KEY), e);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(((await res.json()) as { slots: unknown[] }).slots).toEqual(Array(VAULT_SLOTS).fill(null));

    const bytes = new Uint8Array([31, 139, 8, 0, 1, 2, 3, 250]);
    res = await worker.fetch(at(`${KEY}/2`, put(bytes, 'Romans, Bronze Age · 12 min')), e);
    expect(res.status).toBe(200);

    const { slots } = (await (await worker.fetch(at(KEY), e)).json()) as { slots: ({ title: string; bytes: number; at: number } | null)[] };
    expect(slots[0]).toBeNull();
    expect(slots[1]).toMatchObject({ title: 'Romans, Bronze Age · 12 min', bytes: bytes.length });
    expect(slots[1]!.at).toBeGreaterThan(0);

    res = await worker.fetch(at(`${KEY}/2`), e);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);

    expect((await worker.fetch(at(`${KEY}/2`, { method: 'DELETE' }), e)).status).toBe(200);
    expect((await worker.fetch(at(`${KEY}/2`), e)).status).toBe(404);
  });

  it('keep each key in its own vault', async () => {
    const e = env();
    const other = 'VUTSRQPNMLKJHGFEDCBA';
    await worker.fetch(at(`${KEY}/1`, put('mine')), e);
    expect(e.vaults.size).toBe(1);
    expect((await worker.fetch(at(`${other}/1`), e)).status).toBe(404);
    expect(e.vaults.size).toBe(2);
    expect((await worker.fetch(at(`${KEY}/1`), e)).status).toBe(200);
  });

  it('refuse a malformed key or slot before touching any vault', async () => {
    const e = env();
    for (const path of [`${KEY.slice(1)}`, `${KEY}0`, `${KEY.toLowerCase()}/1`, `ABCDEFGHJKLMNPQRSTUO/1`, `${KEY}/0`, `${KEY}/${VAULT_SLOTS + 1}`, `${KEY}/1/x`, `${KEY}/-1`]) {
      const res = await worker.fetch(at(path), e);
      expect(res.status, path).toBeGreaterThanOrEqual(400);
    }
    expect(e.vaults.size).toBe(0);
  });

  it('refuse the wrong verbs, empty saves and saves over the size limit', async () => {
    const e = env();
    expect((await worker.fetch(at(KEY, { method: 'PUT', body: 'x' }), e)).status).toBe(405);
    expect((await worker.fetch(at(`${KEY}/1`, { method: 'POST', body: 'x' }), e)).status).toBe(405);
    expect((await worker.fetch(at(`${KEY}/1`, put('')), e)).status).toBe(400);
    const big = new Uint8Array(MAX_CLOUD_SAVE + 1);
    expect((await worker.fetch(at(`${KEY}/1`, put(big)), e)).status).toBe(413);
    // Even when the request doesn't say how long it is.
    const vault = e.VAULTS.get(KEY);
    expect((await vault.fetch(new Request('https://x/?slot=1', put(big)))).status).toBe(413);
    expect(e.vaults.get(KEY)!.store.data.size).toBe(0);
  });

  it('tidy a title: no control characters, never too long, never empty', async () => {
    const e = env();
    await worker.fetch(at(`${KEY}/1`, put('x', `bad\u0007title${'!'.repeat(200)}`)), e);
    await worker.fetch(at(`${KEY}/3`, { method: 'PUT', body: 'x', headers: { 'x-save-title': '%E0%A4%A' } }), e);
    const { slots } = (await (await worker.fetch(at(KEY), e)).json()) as { slots: ({ title: string } | null)[] };
    expect(slots[0]!.title.startsWith('badtitle!')).toBe(true);
    expect(slots[0]!.title.length).toBeLessThanOrEqual(80);
    expect(slots[2]!.title).toBe('Saved game');
  });

  it('push back the clock that empties a forgotten vault on every visit, and empty it when it rings', async () => {
    const e = env();
    await worker.fetch(at(`${KEY}/1`, put('x')), e);
    const { vault, store } = e.vaults.get(`vault:${KEY}`)!;
    expect(store.alarmAt()).toBeGreaterThan(Date.now() + 300 * 24 * 3600 * 1000);
    await vault.alarm();
    expect(store.data.size).toBe(0);
  });

  it('say so plainly where there are no vaults (a preview)', async () => {
    const e = { ...env(), VAULTS: undefined };
    const res = await worker.fetch(at(KEY), e);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(/not available/);
  });
});

describe('the browser side', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gzips a save on the way up and gives back the same text', async () => {
    const e = env();
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => worker.fetch(new Request(new URL(url, 'https://ages.example'), init), e));
    const text = JSON.stringify({ v: 3, state: { tiles: 'grass '.repeat(20000) } });
    await saveCloud(KEY, 1, 'Britons, Stone Age · 3 min', text);
    const [slot] = await listCloud(KEY);
    expect(slot!.title).toBe('Britons, Stone Age · 3 min');
    expect(slot!.bytes).toBeLessThan(text.length / 10);
    expect(await loadCloud(KEY, 1)).toBe(text);
    await deleteCloud(KEY, 1);
    expect((await listCloud(KEY))[0]).toBeNull();
    await expect(loadCloud(KEY, 1)).rejects.toThrow(/empty/);
  });

  it('tells the player when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    await expect(listCloud(KEY)).rejects.toThrow(/could not be reached/);
    vi.stubGlobal('fetch', async () => new Response('<html>dev server</html>', { status: 404 }));
    await expect(listCloud(KEY)).rejects.toThrow(/not available/);
  });
});
