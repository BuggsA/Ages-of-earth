# Tactical Reach — #101

Alt retains health bars and adds selected owned weapons' reach. Defense placement previews future firing reach automatically. Cyan outer lines and dashed amber siege dead zones follow terrain and water and stop at current fog. Unit circles refer to a target's near edge; target size, combat tolerance and attack eligibility still matter. Building circles match buildingGuns' center radius.

One LineSegments mesh reuses fixed buffers for at most 24 guides, with placement priority. Visibility checks cover both endpoints and midpoint. Enemy stats, passengers, non-weapons and unfinished defenses are excluded. No simulation, data.ts balance, AI or save changes.

Integrated main 2c3a2c9 (Sail, harbor trade, moonlit nights), preserving their functions and documentation. Source obtained through GitHub because direct clone credentials are unavailable.

- npm run check → 45 files, 247 tests passed; local installed tsc command uses TypeScript 5.9.3 because native TS7 panics on missing /proc/self/exe. Pinned compiler remains unchanged in the repo and is checked by CI.
- npm run build → game and Worker typechecks passed, Vite built 78 modules in 387 ms (same local compiler fallback).
- Five new tests cover current stats, exclusions, placement consistency, terrain/water, fog, map bounds, dead-zone dashes, fixed buffers and unchanged game state. Existing tests were not edited.
- Browser smoke attempted once → build succeeded, launch failed: missing Chromium executable. Appearance and interactive Alt/placement behavior unverified.
- Headless match: esbuild bundled scripts/sim.ts, then node headless.mjs 3 medium 30 → completed 30 minutes, no winner yet, checksum 2807796726; 9142 ms total, worst tick 11.6 ms. tsx CLI was unavailable because its IPC pipe is forbidden here.

Exact-commit CI result is recorded in the PR. Next: owner can check line contrast on snow and overlapping defenses. Successor: none, the owner starts the next.
