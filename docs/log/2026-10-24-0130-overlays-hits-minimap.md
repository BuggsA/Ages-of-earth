# 2026-10-24 01:30 — overlays step 2: hit blink, fallen rings, minimap dot edges (#626, #617)

Chain 1024-0012-overlays, 2 of 8. Built on PR #634's branch.

- `view.ts` `hit`: a 0.12 s white blink at the wound on units, so a blow reads when the sparks are small.
- `view.ts` `die` (ordinary land units): a small ring in the fallen's colour, so a battle shows whose people are dying.
- `minimap.ts`: each unit dot gets a dark edge so it reads on any ground.
- The "under attack" minimap ping already existed (`view.ts` alert, `main.ts` tide); nothing to add.
- No numbers in `src/sim/data.ts` changed. Decision it gives the player: none: look.
- Not seen in a browser (typecheck and `tests/health-bars.test.ts` only): unverified. The `battle` team rings (`unitsView.ts`) still belong to area:units.
