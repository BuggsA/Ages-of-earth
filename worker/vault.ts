import { MAX_CLOUD_SAVE, MAX_PROGRESS_BODY, MAX_SAVE_TITLE, MAX_WEB_BODY, VAULT_KEEP_DAYS, VAULT_SLOTS, cleanProgress, cleanWeb, mergeProgress, mergeWeb, validSlot, type CloudSlot } from '../src/net/vault';

/**
 * One player's cloud saves (#290): a Durable Object per save key, holding up to VAULT_SLOTS gzipped
 * saves. The Worker has already checked the key, the slot and the size; the vault never reads a save,
 * it only keeps the bytes. Every visit pushes back an alarm that empties a vault left alone for
 * VAULT_KEEP_DAYS.
 */

interface Store {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  setAlarm(at: number): Promise<void>;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const KEEP_MS = VAULT_KEEP_DAYS * 24 * 3600 * 1000;

export class Vault {
  private store: Store;

  constructor(state: DurableObjectState, _env: unknown) {
    this.store = state.storage as unknown as Store;
  }

  async fetch(req: Request): Promise<Response> {
    const params = new URL(req.url).searchParams;
    const slot = Number(params.get('slot') ?? '0');
    await this.store.setAlarm(Date.now() + KEEP_MS);
    if (params.get('web')) {
      const kept = cleanWeb(await this.store.get<unknown>('web'));
      if (req.method === 'GET') return json({ web: kept });
      if (req.method !== 'PUT') return json({ error: 'Not allowed.' }, 405);
      const text = await req.text();
      if (text.length > MAX_WEB_BODY) return json({ error: 'Too large.' }, 413);
      let sent: unknown;
      try {
        sent = (JSON.parse(text) as { web?: unknown }).web;
      } catch {
        return json({ error: 'Not discoveries.' }, 400);
      }
      const merged = mergeWeb(kept, cleanWeb(sent));
      await this.store.put('web', merged);
      return json({ web: merged });
    }
    if (params.get('progress')) {
      const kept = cleanProgress(await this.store.get<unknown>('progress'));
      if (req.method === 'GET') return json({ progress: kept });
      if (req.method !== 'PUT') return json({ error: 'Not allowed.' }, 405);
      const text = await req.text();
      if (text.length > MAX_PROGRESS_BODY) return json({ error: 'Too large.' }, 413);
      let sent: unknown;
      try {
        sent = (JSON.parse(text) as { progress?: unknown }).progress;
      } catch {
        return json({ error: 'Not progress.' }, 400);
      }
      const merged = mergeProgress(kept, cleanProgress(sent));
      await this.store.put('progress', merged);
      return json({ progress: merged });
    }
    if (!slot) {
      if (req.method !== 'GET') return json({ error: 'Not allowed.' }, 405);
      const slots: (CloudSlot | null)[] = [];
      for (let i = 1; i <= VAULT_SLOTS; i++) slots.push((await this.store.get<CloudSlot>(`meta:${i}`)) ?? null);
      return json({ slots });
    }
    if (!validSlot(slot)) return json({ error: 'No such slot.' }, 404);
    if (req.method === 'GET') {
      const bytes = await this.store.get<ArrayBuffer>(`save:${slot}`);
      if (!bytes) return json({ error: 'That slot is empty.' }, 404);
      return new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } });
    }
    if (req.method === 'PUT') {
      const bytes = await req.arrayBuffer();
      if (!bytes.byteLength) return json({ error: 'Nothing to save.' }, 400);
      if (bytes.byteLength > MAX_CLOUD_SAVE) return json({ error: 'This match is too large to keep in the cloud.' }, 413);
      let title = 'Saved game';
      try {
        title = decodeURIComponent(req.headers.get('x-save-title') ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, MAX_SAVE_TITLE) || title;
      } catch {
        /* A malformed title: keep the plain one. */
      }
      const meta: CloudSlot = { at: Date.now(), title, bytes: bytes.byteLength };
      await this.store.put(`save:${slot}`, bytes);
      await this.store.put(`meta:${slot}`, meta);
      return json({ ok: true, slot: meta });
    }
    if (req.method === 'DELETE') {
      await this.store.delete(`save:${slot}`);
      await this.store.delete(`meta:${slot}`);
      return json({ ok: true });
    }
    return json({ error: 'Not allowed.' }, 405);
  }

  /** Left alone for a year: empty it. */
  async alarm(): Promise<void> {
    await this.store.deleteAll();
  }
}
