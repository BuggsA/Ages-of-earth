import { CODE_CHARS, CODE_LENGTH, validCode } from '../src/net/protocol';

/**
 * The Ages of Earth Worker: serves the built game, and online rooms under /api/:
 *   POST /api/rooms           a fresh room code
 *   GET  /api/rooms/CODE/ws   the room's WebSocket (a Durable Object per room keeps its clock)
 */

export { Room } from './room';

interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace;
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
    return json({ error: 'Not found.' }, 404);
  },
} satisfies ExportedHandler<Env>;
