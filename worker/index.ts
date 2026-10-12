/**
 * The Ages of Earth Worker: serves the built game. Online rooms (a Durable Object per room relaying
 * each player's commands for every tick, lockstep style) will join it under /api/.
 */

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return new Response('Not found.', { status: 404 });
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
