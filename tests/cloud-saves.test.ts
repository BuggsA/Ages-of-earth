import { describe, expect, it, vi } from 'vitest';
import { MAX_CLOUD_SAVE, readVaultKey, showVaultKey, validVaultKey, VAULT_KEY_LENGTH } from '../src/net/vault';

// Load through Vitest so Worker globals do not leak into the browser's typecheck (as in worker-routes).
const worker = (await vi.importActual<{ default: { fetch(req: Request, env: unknown): Promise<Response> } }>('../worker/index')).default;
type VaultLike = { fetch(req: Request): Promise<Response>; alarm(): Promise<void> };
const { Vault } = await vi.importActual<{ Vault: new (state: unknown, env: unknown) => VaultLike }>('../worker/vault');

/** Durable Object storage enough for a vault: a map, transactions that apply at once, an alarm. */
function fakeStorage() {
  const data = new Map<string, unknown>();
  let alarm: number | null = null;
  const put = async (entries: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(entries)) data.set(k, v);
  };
  const storage = {
    data,
    alarmAt: () => alarm,
    get: async (k: string | string[]) => (Array.isArray(k) ? new Map(k.filter((x) => data.has(x)).map((x) => [x, data.get(x)])) : data.get(k)),
    put,
    delete: async (k: string) => data.delete(k),
    deleteAll: async () => data.clear(),
    transaction: async (fn: (tx: unknown) => Promise<void>) => fn({ put, delete: async (k: string) => data.delete(k) }),
    setAlarm: async (t: number) => {
      alarm = t;
    },
    deleteAlarm: async () => {
      alarm = null;
    },
  };
  return storage;
}

const KEY = 'ABCDEFGHJKLMNPQR';
const at = (method: string, body?: string) => new Request(`https://ages.test/api/vaults/${KEY}`, { method, body });
const save = (state: string) => JSON.stringify({ v: 3, setup: { seed: 1 }, at: 1, state, record: [] });

describe('vault keys', () => {
  it('are long, drawn from the unmistakable letters, and read back however they are typed', () => {
    expect(validVaultKey(KEY)).toBe(true);
    expect(validVaultKey(KEY.slice(1))).toBe(false);
    expect(validVaultKey(`${KEY.slice(1)}O`)).toBe(false);
    expect(showVaultKey(KEY)).toBe('ABCD-EFGH-JKLM-NPQR');
    expect(readVaultKey(' abcd-efgh jklm-npqr ')).toBe(KEY);
    expect(readVaultKey('ABCD-EFGH')).toBeNull();
  });
});

describe('the Worker routes cloud saves', () => {
  function env() {
    const named: string[] = [];
    const seen: string[] = [];
    return {
      named,
      seen,
      ASSETS: { fetch: async () => new Response('asset') },
      ROOMS: { idFromName: (n: string) => n, get: () => ({ fetch: async () => new Response('room') }) },
      VAULTS: {
        idFromName: (n: string) => {
          named.push(n);
          return n;
        },
        get: () => ({
          fetch: async (req: Request) => {
            seen.push(req.method);
            return new Response('vault');
          },
        }),
      },
    };
  }

  it('hands out fresh keys', async () => {
    const res = await worker.fetch(new Request('https://ages.test/api/vaults', { method: 'POST' }), env());
    const { key } = (await res.json()) as { key: string };
    expect(key).toHaveLength(VAULT_KEY_LENGTH);
    expect(validVaultKey(key)).toBe(true);
  });

  it('sends a valid key to its own vault, and nothing else anywhere', async () => {
    const e = env();
    for (const m of ['GET', 'PUT', 'DELETE']) await worker.fetch(new Request(`https://ages.test/api/vaults/${KEY}`, { method: m, body: m === 'PUT' ? '{}' : undefined }), e);
    expect(e.named).toEqual([KEY, KEY, KEY]);
    expect(e.seen).toEqual(['GET', 'PUT', 'DELETE']);
    for (const path of ['/api/vaults/ABCD', `/api/vaults/${KEY.toLowerCase()}`, `/api/vaults/${KEY}/x`]) {
      expect((await worker.fetch(new Request(`https://ages.test${path}`), e)).status).toBe(404);
    }
    expect((await worker.fetch(new Request(`https://ages.test/api/vaults/${KEY}`, { method: 'POST' }), e)).status).toBe(404);
    expect(e.named).toHaveLength(3);
  });
});

describe('a vault', () => {
  it('keeps the latest save whole, however many pieces it takes, and forgets a longer old one', async () => {
    const storage = fakeStorage();
    const vault = new Vault({ storage }, {});
    expect((await vault.fetch(at('GET'))).status).toBe(404);

    const big = save('x'.repeat(1_300_000));
    expect((await vault.fetch(at('PUT', big))).status).toBe(200);
    expect(storage.data.get('pieces')).toBe(3);
    expect(await (await vault.fetch(at('GET'))).text()).toBe(big);

    const small = save('small');
    expect((await vault.fetch(at('PUT', small))).status).toBe(200);
    expect(storage.data.get('pieces')).toBe(1);
    expect(storage.data.has('p1')).toBe(false);
    expect(storage.data.has('p2')).toBe(false);
    expect(await (await vault.fetch(at('GET'))).text()).toBe(small);
  });

  it('refuses what is not a saved game, or too big a one, and keeps what it had', async () => {
    const storage = fakeStorage();
    const vault = new Vault({ storage }, {});
    await vault.fetch(at('PUT', save('kept')));
    expect((await vault.fetch(at('PUT', 'not json'))).status).toBe(400);
    expect((await vault.fetch(at('PUT', '{"v":3}'))).status).toBe(400);
    expect((await vault.fetch(at('PUT', save('y'.repeat(MAX_CLOUD_SAVE))))).status).toBe(413);
    expect(await (await vault.fetch(at('GET'))).text()).toBe(save('kept'));
  });

  it('empties itself when told to, and once nobody has opened it for a long while', async () => {
    const storage = fakeStorage();
    const vault = new Vault({ storage }, {});
    const before = Date.now();
    await vault.fetch(at('PUT', save('a')));
    expect(storage.alarmAt()).toBeGreaterThan(before + 100 * 24 * 3600 * 1000);
    await vault.alarm();
    expect((await vault.fetch(at('GET'))).status).toBe(404);

    await vault.fetch(at('PUT', save('b')));
    expect((await vault.fetch(at('DELETE'))).status).toBe(200);
    expect((await vault.fetch(at('GET'))).status).toBe(404);
    expect(storage.alarmAt()).toBeNull();
  });
});
