# Props shot scene, relic pennon (#625)

- `scripts/look/shots.mjs` has a `props` scene: ruins (standing, dug), finds (fresh, taken), a ground relic, a trading post and the six landmarks, in rows near the start. Take it at midday: `SHOT_QUERY="&hour=12" node scripts/look/shots.mjs <dir> props`.
- Viewed once: posts, ruins and landmark rings read apart from the land at the default zoom; the finds rows sit behind the landmarks' beams, so shoot them alone if you tune them.
- Ground relic pennon went from gold (a player's colour) to ivory; the casket stays gold (0.3 m, glows).
- Not done: ruins and finds colours were checked by eye only; later-epoch same-box types (range/stable/workshop) have the `stone-town` and `bronze-town` scenes but no new fixes.
