# Site: search, link previews and home-screen icons

The owner asked to improve the site's search ability, visibility and view. Before this the page had a bare title, one meta description and an emoji favicon: shared links showed no picture, and search engines had no sitemap, structured data or text without JavaScript.

- `index.html`: a descriptive title and description; Open Graph and Twitter card tags with a 1200×630 card; `VideoGame` structured data (JSON-LD); icon, apple-touch-icon and manifest links; a `<noscript>` page that says what the game is (crawlers and no-JS visitors).
- `public/`: `icon.svg` (the world in five bands, one per epoch, in the title's age-ribbon colours, gold rim), PNG icons at 192/512/180 and a maskable 512, `og-card.jpg`, `manifest.webmanifest` (installable, fullscreen, landscape), a static `robots.txt` for other hosts.
- `scripts/look/site-images.mjs` redraws every PNG and the card from `icon.svg` and `docs/screenshots/title-ford-morning.jpg`.
- `worker/index.ts`: serves `/robots.txt` and `/sitemap.xml` for whichever host it runs on, and rewrites the page's `og:url`, `og:image` and `twitter:image` to absolute addresses and adds the canonical link (Vite reads `href="/"` on a canonical link as a file and fails the build, so it can't sit in `index.html`). `wrangler.toml`'s `run_worker_first` gains `/`, `/index.html`, `/robots.txt`, `/sitemap.xml` (not a route or domain change).

Next: once the game has its own domain, submit `/sitemap.xml` to Google Search Console and Bing Webmaster Tools; a few real screenshots on a small `/about` page would give search more to index.
