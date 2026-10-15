import { CODE_CHARS, CODE_LENGTH, validCode } from '../src/net/protocol';
import { MAX_CLOUD_SAVE, MAX_PROGRESS_BODY, validSlot, validVaultKey } from '../src/net/vault';

/**
 * The Ages of Earth Worker: serves the built game, and online rooms under /api/:
 *   POST /api/rooms           a fresh room code
 *   GET  /api/rooms/CODE/ws   the room's WebSocket (a Durable Object per room keeps its clock)
 *   /api/vault/KEY[/SLOT]     cloud saves (a Durable Object per save key: src/net/vault.ts)
 */

export { Room } from './room';
export { Vault } from './vault';

interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace;
  VAULTS?: DurableObjectNamespace;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
      const code = [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
      return json({ code });
    }
    const m = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/ws$/);
    if (m && validCode(m[1])) {
      const room = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      const fwd = new URL(req.url);
      fwd.searchParams.set('code', m[1]);
      return room.fetch(new Request(fwd.toString(), req));
    }
    const v = url.pathname.match(/^\/api\/vault\/([A-Z0-9]+)(?:\/(\d+|progress))?$/);
    if (v && validVaultKey(v[1])) {
      // Previews carry no Durable Objects, so no vaults.
      if (!env.VAULTS) return json({ error: 'Cloud saves are not available here.' }, 503);
      const progress = v[2] === 'progress';
      const slot = v[2] === undefined || progress ? 0 : Number(v[2]);
      if (v[2] !== undefined && !progress && !validSlot(slot)) return json({ error: 'No such slot.' }, 404);
      if (progress ? !['GET', 'PUT'].includes(req.method) : !slot && req.method !== 'GET') return json({ error: 'Not allowed.' }, 405);
      if (slot && !['GET', 'PUT', 'DELETE'].includes(req.method)) return json({ error: 'Not allowed.' }, 405);
      if (req.method === 'PUT' && Number(req.headers.get('content-length') ?? 0) > (progress ? MAX_PROGRESS_BODY : MAX_CLOUD_SAVE)) return json({ error: progress ? 'Too large.' : 'This match is too large to keep in the cloud.' }, 413);
      // The vault measures the body itself, for a request that doesn't say its length.
      const vault = env.VAULTS.get(env.VAULTS.idFromName(`vault:${v[1]}`));
      const fwd = new URL(req.url);
      fwd.search = progress ? '?progress=1' : slot ? `?slot=${slot}` : '';
      return vault.fetch(new Request(fwd.toString(), req));
    }
    return json({ error: 'Not found.' }, 404);
  },
} satisfies ExportedHandler<Env>;
