# Site: guide pages, share card, offline play, phone welcome

Follows #897 and #899 (#896). The owner asked for the rest of the site list.

- **Guide pages** (`src/site/pages.ts`, emitted by a Vite plugin in `vite.config.ts`): `/guide/` (the in-game How to play list, read from `index.html`, plus the maps), `/peoples/` (each people's blurb, verb and price from `CIVS`) and `/ages/` (all 48 ages by tier from `AGES`). Static HTML, so search engines and phones read them; listed in `/sitemap.xml`, linked from the title ("Guide") and the noscript page. They never drift: a renamed age is renamed there on the next build.
- **Share** (`src/ui/shareCard.ts`): a button on the end screen draws a 1200×630 card (outcome, people, time, the road walked with steps back marked ↩, stats) and shares it with the text and a world link (`?seed=&size=&map=`), or downloads it and copies the text where there's no share sheet. No link for chapters or online rooms.
- **Offline** (`public/sw.js`, registered in production builds only): pages network-first, so a player online always gets the newest build (rooms need matching builds); `/assets/*` cache-first (content-named); old assets pruned when a fresh page arrives; `/api/` never cached. Precaches the page and its files on install so the first visit is enough.
- **Phone welcome** (`src/ui/phoneWelcome.ts`): touch-only devices get a card once per browser: made for a mouse, send me the link, or look around anyway.

Tried in headless Chromium: the share card drawn from a sample finished match; the welcome on an emulated Pixel 7 (shown, gone after dismissing and reloading) and not on desktop; offline reload, an offline `?seed=` link and starting a match offline. Also from a real end screen: a match resigned at once, Share clicked → `ages-of-earth-match.png` downloaded and the text and `?seed=…&size=medium&map=continental` link copied. Not tried: a real phone's share sheet, and iOS Safari.
