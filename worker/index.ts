import { CODE_CHARS, CODE_LENGTH, validCode } from '../src/net/protocol';
import { VAULT_KEY_LENGTH, validVaultKey } from '../src/net/vault';

/**
 * The Ages of Earth Worker: serves the built game, and online rooms under /api/:
 *   POST /api/rooms           a fresh room code
 *   GET  /api/rooms/CODE/ws   the room's WebSocket (a Durable Object per room keeps its clock)
 *   POST /api/vaults          a fresh vault key for cloud saves
 *   GET, PUT, DELETE /api/vaults/KEY   the save kept under that key (a Durable Object per key)
 */

export { Room } from './room';
export { Vault } from './vault';

interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace;
  VAULTS: DurableObjectNamespace;
}

function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      return json({ code: randomCode(CODE_LENGTH) });
    }
    if (url.pathname === '/api/vaults' && req.method === 'POST') return json({ key: randomCode(VAULT_KEY_LENGTH) });
    const v = url.pathname.match(/^\/api\/vaults\/([A-Z0-9]+)$/);
    if (v && validVaultKey(v[1]) && ['GET', 'PUT', 'DELETE'].includes(req.method)) {
      return env.VAULTS.get(env.VAULTS.idFromName(v[1])).fetch(req);
    }
    const m = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/ws$/);
    if (m && validCode(m[1])) {
      const room = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      const fwd = new URL(req.url);
      fwd.searchParams.set('code', m[1]);
      return room.fetch(new Request(fwd.toString(), req));
    }
    return json({ error: 'Not found.' }, 404);
  },
} satisfies ExportedHandler<Env>;
