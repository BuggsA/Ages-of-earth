# Site: faster repeat visits, invite-link previews, listing copy

Follows #897 (search tags and the link card). The live site is ages.tycoon-universe.com.

- **Speed.** Live assets came with `cache-control: max-age=0`, so every visit revalidated the whole 2.2 MB script. `public/_headers` marks `/assets/*` immutable for a year (Vite names them by content). `vite.config.ts` puts Three.js in a chunk of its own (601 kB, 150 kB gzipped) whose name only changes with the library, so a deploy no longer makes players re-fetch it. The Google Fonts stylesheet no longer blocks the first paint.
- **Invite previews.** `?room=CODE` links now preview as "Join my Ages of Earth room: CODE" (or "Watch my match" with `&watch=1`), and shared-world links (`?seed=…&map=…`) name the map from `MAP_TYPES`. The canonical link stays `/`.
- **`docs/listing.md`**: Web Analytics and Search Console steps for the owner, and ready-to-paste words for itch.io, Newgrounds and Reddit.

Next: guide pages for search (peoples, ages, how to play), then the end-screen share card, offline play and a phone welcome.
