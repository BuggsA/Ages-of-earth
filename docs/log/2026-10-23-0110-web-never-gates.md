# Shown, never gating: a guard on the web of reached ages (#555 s6)

Branch `claude/laughing-dirac-7hqpek`.

- **Already true:** the main menu's web (`src/ui/webMap.ts`) records the ages a browser has stood in and the roads it has known, in browser storage, from the main loop. Nothing in `src/sim/` reads it, so no age is locked between matches.
- **Added:** `tests/web-never-gates.test.ts`. No file in `src/sim/` mentions storage, `ages-web`, `webMap` or `loadDiscovery`; and every road's `roadProblem` on a fresh game is the same with a browser record that has reached every age as with none.
- **New decision for the player:** none: a guard on the owner's ruling (ages are never locked by past matches).
- **Not done:** s0's sweeps, s7–s9 (the start), the Chariots and Missions crossings, a Sea-Raiders keepsake (its Dock has no work left to keep once plunder stops being packed by ship; it wants a design that does not start a second hauling loop).
