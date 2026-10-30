import { CODE_CHARS, CODE_LENGTH, validCode } from '../src/net/protocol';
import { MAP_TYPES } from '../src/sim/data';
import { SITE_PAGES } from '../src/site/pages';
import type { MapType } from '../src/sim/types';
import { MAX_CLOUD_SAVE, MAX_PROGRESS_BODY, MAX_WEB_BODY, validSlot, validVaultKey } from '../src/net/vault';

/**
 * The Ages of Earth Worker: serves the built game, and online rooms under /api/:
 *   POST /api/rooms           a fresh room code
 *   GET  /api/rooms/CODE/ws   the room's WebSocket (a Durable Object per room keeps its clock)
 *   /api/vault/KEY[/SLOT]     cloud saves (a Durable Object per save key: src/net/vault.ts)
 * and the bits search engines and link previews read, made for whichever host serves the game:
 *   /robots.txt, /sitemap.xml, and absolute addresses in the page's canonical, og: and twitter: tags.
 */

export { Room } from './room';
export { Vault } from './vault';

interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace;
  VAULTS?: DurableObjectNamespace;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** What a shared link's preview says: a room invite and a shared world get their own words. */
function linkPreview(url: URL): { title: string; description: string } | null {
  const q = url.searchParams;
  const room = q.get('room')?.toUpperCase() ?? '';
  if (validCode(room)) {
    return q.get('watch') === '1'
      ? { title: `Watch my Ages of Earth match (room ${room})`, description: 'An online match of Ages of Earth, a free real-time strategy game in your browser. Open the link to watch it live, from the Stone Age to the age of steam. No download.' }
      : { title: `Join my Ages of Earth room: ${room}`, description: `You're invited to an online match of Ages of Earth, a free real-time strategy game in your browser. Open the link, pick a name and you're in room ${room}. No download.` };
  }
  const seed = Math.floor(Number(q.get('seed')));
  if (seed >= 1 && seed <= 2 ** 31 - 1) {
    const map = MAP_TYPES[q.get('map') as MapType] as { label: string; blurb: string } | undefined;
    const size = ['small', 'medium', 'large'].includes(q.get('size') ?? '') ? `${q.get('size')} ` : '';
    return {
      title: `A world to play in Ages of Earth: ${map ? `${map.label}, ` : ''}seed ${seed}`,
      description: `${map ? `${map.blurb} ` : ''}Someone shared this ${size}map with you in Ages of Earth, a free real-time strategy game in your browser: same land, same rivals. Open the link to play it. No download.`,
    };
  }
  return null;
}

/** The page's preview tags say "/" and "./og-card.jpg"; link previews and crawlers want them whole. */
async function siteMeta(req: Request, env: Env, url: URL): Promise<Response> {
  const res = await env.ASSETS.fetch(req);
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const origin = url.origin;
  const whole = (path: string | null) => new URL(path ?? '/', `${origin}/`).toString();
  const fix = (attr: string) => ({ element: (el: Element) => void el.setAttribute(attr, whole(el.getAttribute(attr))) });
  const preview = linkPreview(url);
  const set = (value: string) => ({ element: (el: Element) => void el.setAttribute('content', value) });
  const rw = new HTMLRewriter()
    // A canonical link can't be in index.html: Vite reads its href="/" as a file to bundle.
    .on('head', { element: (el) => void el.append(`<link rel="canonical" href="${origin}/" />`, { html: true }) })
    .on('meta[property="og:image"], meta[name="twitter:image"]', fix('content'))
    .on('meta[property="og:url"]', preview ? set(`${origin}/${url.search}`) : fix('content'));
  if (preview) {
    rw.on('meta[property="og:title"], meta[name="twitter:title"]', set(preview.title));
    rw.on('meta[property="og:description"], meta[name="twitter:description"]', set(preview.description));
  }
  return rw.transform(res);
}

const text = (body: string, type: string) => new Response(body, { headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'public, max-age=3600' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/robots.txt') return text(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${url.origin}/sitemap.xml\n`, 'text/plain');
    if (url.pathname === '/sitemap.xml') {
      const urls = [`<url><loc>${url.origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`, ...SITE_PAGES.map((p) => `<url><loc>${url.origin}/${p.path}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`)];
      return text(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls.join('\n  ')}\n</urlset>\n`, 'application/xml');
    }
    if (url.pathname === '/' || url.pathname === '/index.html') return siteMeta(req, env, url);
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
    const v = url.pathname.match(/^\/api\/vault\/([A-Z0-9]+)(?:\/(\d+|progress|web))?$/);
    if (v && validVaultKey(v[1])) {
      // Previews carry no Durable Objects, so no vaults.
      if (!env.VAULTS) return json({ error: 'Cloud saves are not available here.' }, 503);
      const progress = v[2] === 'progress' || v[2] === 'web';
      const slot = v[2] === undefined || progress ? 0 : Number(v[2]);
      if (v[2] !== undefined && !progress && !validSlot(slot)) return json({ error: 'No such slot.' }, 404);
      if (progress ? !['GET', 'PUT'].includes(req.method) : !slot && req.method !== 'GET') return json({ error: 'Not allowed.' }, 405);
      if (slot && !['GET', 'PUT', 'DELETE'].includes(req.method)) return json({ error: 'Not allowed.' }, 405);
      if (req.method === 'PUT' && Number(req.headers.get('content-length') ?? 0) > (progress ? Math.max(MAX_PROGRESS_BODY, MAX_WEB_BODY) : MAX_CLOUD_SAVE)) return json({ error: progress ? 'Too large.' : 'This match is too large to keep in the cloud.' }, 413);
      // The vault measures the body itself, for a request that doesn't say its length.
      const vault = env.VAULTS.get(env.VAULTS.idFromName(`vault:${v[1]}`));
      const fwd = new URL(req.url);
      fwd.search = progress ? `?${v[2]}=1` : slot ? `?slot=${slot}` : '';
      return vault.fetch(new Request(fwd.toString(), req));
    }
    return json({ error: 'Not found.' }, 404);
  },
} satisfies ExportedHandler<Env>;
