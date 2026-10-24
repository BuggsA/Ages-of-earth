# #267: a soldier on each people's tile, and a title skirt that stays lit

- **Your match sheet:** each people's tile now shows a soldier in your colour wearing that people's mark (Egyptian archer with the gold cone, Greek and Roman and Chinese foot with their crests, Mongol rider with the horse-tail standard, Briton with the white feather), rendered from the real unit models by `thumbs.ts` (`unitPicture` takes an optional people). Drawn the first time the sheet opens, not while the title loads. The crest stays as a small banner on each tile.
- **Fix:** the title's edge-melts-into-sky tint (`skirtTint`) ran only when the hour changed, so a fixed hour (`?hour=`, screenshots) left a near-black band of "unexplored" ground along the horizon. It now runs every frame. The live title (moving hour) never showed it.
- Decision added for the player: none: look.
- Seen in headless Chromium (swiftshader), seed 7: `docs/screenshots/267-*-before/after.png`. Not seen: other window sizes (narrow 4-column tiles), real GPU, the Random tile's vertical alignment next to the taller figures (it sits a few pixels lower).
- Honest limit: Greek, Roman and Chinese soldiers share one body and differ only in plume, so at tile size they look alike. Next: a distinct helmet or shield per people, then the chosen title shots (a dock at dusk, an army at a ford).
