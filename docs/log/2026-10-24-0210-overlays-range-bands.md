# Overlays step 4: range guides as bands (#626)

Builds on #634, #636 and #639 (merged into this branch; their author left no claim and no activity for ~1h45).

- `src/render/rangeGuides.ts`: each guide ring is drawn as three rings 0.07 tile apart (flanks at 60% brightness), so the 1 px WebGL line reads as a ~3 px band on grass. Buffer sized for it; dashes and clipping unchanged.
- Minimap territory colours: nothing drawn there today, so nothing changed.

Decision it gives the player: none: look.

Unverified: how the bands look in a browser (no scene in `shots.mjs` selects a ranged unit); the owner may tune `FLANK`.
