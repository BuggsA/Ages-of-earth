import { MAX_CLOUD_SAVE, VAULT_KEEP_DAYS } from '../src/net/vault';

/**
 * One cloud save: a Durable Object per vault key holds the latest save written to it. It never reads
 * the match; it keeps the text as sent, in pieces small enough for storage, and empties itself once
 * nobody has opened it for VAULT_KEEP_DAYS.
 */

/** Stored pieces, well under the 2 MB a stored value may hold. */
const PIECE = 512 * 1024;
const KEEP_MS = VAULT_KEEP_DAYS * 24 * 3600 * 1000;

const text = (body: string, status: number) => new Response(body, { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export class Vault {
  constructor(private state: DurableObjectState, _env: unknown) {}

  async fetch(req: Request): Promise<Response> {
    const storage = this.state.storage;
    if (req.method === 'GET') {
      const pieces = (await storage.get<number>('pieces')) ?? 0;
      if (!pieces) return text('{"error":"Nothing is saved under that key."}', 404);
      const keys = Array.from({ length: pieces }, (_, i) => `p${i}`);
      const got = await storage.get<string>(keys);
      await storage.setAlarm(Date.now() + KEEP_MS);
      return text(keys.map((k) => got.get(k) ?? '').join(''), 200);
    }
    if (req.method === 'PUT') {
      const declared = Number(req.headers.get('content-length') ?? 0);
      if (declared > MAX_CLOUD_SAVE * 2) return text('{"error":"That save is too big."}', 413);
      const body = await req.text();
      if (body.length > MAX_CLOUD_SAVE) return text('{"error":"That save is too big."}', 413);
      try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.v !== 'number' || typeof parsed.state !== 'string') throw new Error();
      } catch {
        return text('{"error":"That is not a saved game."}', 400);
      }
      const old = (await storage.get<number>('pieces')) ?? 0;
      const entries: Record<string, string | number> = {};
      let n = 0;
      for (let i = 0; i < body.length; i += PIECE) entries[`p${n++}`] = body.slice(i, i + PIECE);
      entries.pieces = n;
      entries.at = Date.now();
      // Written together, so a reader never sees half of one save and half of another.
      await storage.transaction(async (tx) => {
        await tx.put(entries);
        for (let i = n; i < old; i++) await tx.delete(`p${i}`);
      });
      await storage.setAlarm(Date.now() + KEEP_MS);
      return text(JSON.stringify({ ok: true, at: entries.at }), 200);
    }
    if (req.method === 'DELETE') {
      await storage.deleteAll();
      await storage.deleteAlarm();
      return text('{"ok":true}', 200);
    }
    return text('{"error":"Not allowed."}', 405);
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}
