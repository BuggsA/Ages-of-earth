// Offline play (#896). Pages come from the network first, so a player online always gets the newest build
// (online rooms only let in matching builds), and from the cache when there is no network. The files in
// /assets are named by their content and never change, so they come from the cache first. Each fresh page
// prunes the cached assets it no longer names. Rooms and cloud saves (/api/) are never cached.
const CACHE = 'ages-of-earth-v1';

// On install, keep the page and the files it names, so the very first visit already works offline next time.
self.addEventListener('install', (e) =>
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch(self.registration.scope, { cache: 'no-cache' });
      if (!res.ok) return;
      const html = await res.clone().text();
      await cache.put(self.registration.scope, res);
      const files = [...html.matchAll(/(?:src|href)="\.?\/?((?:assets\/)[^"]+|[\w-]+\.(?:svg|png|webmanifest))"/g)].map((m) => new URL(m[1], self.registration.scope).href);
      await cache.addAll([...new Set(files)]);
    })()
      .catch(() => {})
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function prune(html) {
  const keep = new Set([...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map((m) => new URL(m[1], self.registration.scope).href));
  if (!keep.size) return;
  const cache = await caches.open(CACHE);
  for (const req of await cache.keys()) if (req.url.includes('/assets/') && !keep.has(req.url)) await cache.delete(req);
}

async function page(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) {
      // One copy per page, whatever its query (?room=, ?seed=), so the cache doesn't grow with every link.
      await cache.put(new URL(req.url).origin + new URL(req.url).pathname, res.clone());
      if (new URL(req.url).pathname === new URL(self.registration.scope).pathname) await prune(await res.clone().text());
    }
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true, ignoreVary: true })) ?? (await cache.match(self.registration.scope, { ignoreVary: true })) ?? Response.error();
  }
}

async function asset(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

async function other(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreVary: true })) ?? Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') e.respondWith(page(req));
  else if (url.pathname.includes('/assets/')) e.respondWith(asset(req));
  else e.respondWith(other(req));
});
