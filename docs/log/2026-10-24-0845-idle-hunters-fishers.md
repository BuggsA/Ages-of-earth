# 2026-10-24 · #344 step 8: idle hunters and fishing boats

**Decision it gives the player:** none: fix (a one-click answer when game or shoal runs out).

Two more idle cards beside the foragers' and miners' (`src/ui/hud.ts`), HUD only:
- **Hunters** (citizens last seen on a `hunt` order, idle 5 s, not already counted as foragers): "N hunters stand idle: the game is gone" → "Find more food" (`reassign` idle→food: berries, a free field, meat, else lays a field).
- **Fishing boats** (not citizens, so `idleCitizens` never saw them): "N fishing boats lie idle: their shoal is spent" → "Find more fish" sends them to the nearest shoal anywhere on the map (`findResource`, then a `gather` with `spread`); a toast says so if none is left.

Browser (headless Chromium, `window.ages.game`): put 3 citizens on a hunt and 3 boats on a shoal, then idled them. Both cards appeared after ~5 s; the hunter button put 3 idle hands on `gather`, the fish button put the 3 boats on `gather` at shoal tiles. No page errors. Not tried: a real hunt running dry, a real mouse path to the shoal across a map, sound.
`scripts/sim.ts 3 medium 30` checksum still 1591387014.
