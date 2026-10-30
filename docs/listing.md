# Getting the game seen

Ready-to-paste words for the places players find browser games, and the one-time settings that let the owner see what works. Agents can't post from the owner's accounts; this page is for the owner (or any agent asked to update the words). Address: **https://ages.tycoon-universe.com/**

## Measuring it: Cloudflare Web Analytics (free, no cookies, no banner needed)

Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site** → `ages.tycoon-universe.com` → **Automatic setup**. Cloudflare injects the beacon itself because the domain is proxied through it, so nothing changes in the code. Visits, where they came from, and page speed (Core Web Vitals) show up a few hours later.

## Search engines

- **Google Search Console** → Add property → Domain `tycoon-universe.com` (verify by DNS TXT record in Cloudflare) → Sitemaps → `https://ages.tycoon-universe.com/sitemap.xml`.
- **Bing Webmaster Tools** → Import from Google Search Console (one click once Google is set up). This also covers DuckDuckGo and Yahoo.

## Short description (≤ 150 characters)

> A free real-time strategy game in your browser: lead your people from the Stone Age to the age of steam, against the computer or online.

## Long description (itch.io, Newgrounds, game portals)

> **Ages of Earth** is a free real-time strategy game you play right in the browser, in the spirit of Age of Empires and Empire Earth. No download, no account.
>
> Lead one of six peoples (Egyptians, Greeks, Romans, Mongols, Chinese or Britons) from the first fire to the age of steam. Gather food, wood, stone and gold, build a town, and raise armies, navies and aircraft. The ages are a web, not a ladder: the land you wake in opens roads of its own, and sometimes stepping back is how you get ahead.
>
> - Skirmish against computer rivals that each lean to a strategy and give it away if you watch them
> - A campaign of chapters from history
> - Online rooms for you and your friends: share a link and they're in
> - Every sound made live in your browser; every model made in code
>
> Best on a laptop or desktop with a mouse.

Tags: `strategy`, `real-time-strategy`, `rts`, `browser`, `multiplayer`, `historical`, `base-building`, `low-poly`, `free`.

**itch.io:** Kind of project → HTML, then either upload `dist/` as a zip (single-player only: online rooms need the Worker) or, better, set the page up as an external link to the address above. Cover image: `public/og-card.jpg` (630×500 crop works); screenshots: `docs/screenshots/town-*.jpg`, `battle.jpg`, `sea-battle.jpg`, `air-raid.jpg`.

## Reddit (r/WebGames, r/RealTimeStrategy)

Title: *I've been building a free browser RTS in the spirit of Age of Empires / Empire Earth: Stone Age to the age of steam, with online rooms*

> Ages of Earth runs in the browser (TypeScript + Three.js), no download or account. Six peoples, five epochs, economy, armies, navies and aircraft, computer rivals with their own strategies, and online rooms you join by link. All the sound is synthesized live. Feedback very welcome, especially on balance and the early game. https://ages.tycoon-universe.com/

Read each subreddit's self-promotion rules first; reply to comments for the first few hours.
