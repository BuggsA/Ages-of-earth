# The Age of Lightning (#231)

2026-10-15, chain 1015-1000 position 0 (the owner, in chat: "start building an age after the industrial age. Could you make it not so cliche. I feel like sci and historical sci fi movies are creative about it in a way games like this are not"). Grows seed #136.

- **What:** a side age off the Industrial. Watch Towers become Coil Towers: a field that speeds work (1.35×) and slows work outside it (0.75×), and a bolt that leaps through crowds. No aircraft. The road's deed is 6 beacons lit.
- **Why not a sixth epoch:** every epoch-indexed number (unit forms, building styles, technologies, walls) would need a sixth column. A tier-4 side age keeps pace with the Industrial's armies, and the web (`docs/vision.md`, #197) wants alternatives, not a taller ladder.
- **Determinism:** the field's speed is carried as integer hundredths in `Building.spark`; at the usual rate nothing changes, so other ages play exactly as before.
- **Checks:** `npm run check` (438 tests, 94 files); `tests/lightning.test.ts`; 6 headless Hard-vs-Hard Industrial matches (3 took the road); headless Chromium screenshots of the Coil Tower and a bolt.
- **Numbers added:** `LIGHTNING = { reach: 10, lit: 135, dark: 75, strikes: 4, leap: 2.5, keep: 0.7 }`, `AI_LIGHTNING = { towers: 2, every: 40, gap: 45, most: 6 }`, road costs in `ROADS`.
