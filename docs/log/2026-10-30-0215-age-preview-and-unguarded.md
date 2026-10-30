# The age preview, "here, because", and why no interceptor rose

The owner's three notes (2026-10-30, in chat): an age should give a reason to pick it that depends on the map, the rival and the moment; a choice should be understood before it is made; and chance should be readable.

- **Here, because**: `FITS`/`FIT` in `src/sim/data.ts`, `fitsOf` in `src/sim/fit.ts`. Land read within a radius per kind of tile the player has seen (water 24, stone/woods/gold 20; beasts 26, seen now); rival ages are public; pressure is rival soldiers seen within 20 tiles of the start, 4 or more. Thresholds tuned on small maps eight minutes in, Normal computers, seeds 1 to 3 (water 0 to 4 tiles by a dry continental town, 60 to 300 by a lake or shore).
- **Four parts**: `agePanel` in `src/ui/hud.ts` (What it opens / When it helps / What it costs / Where it leads); the advance button's deeds and time moved into What it costs.
- **Why no interceptor rose**: `unguarded` in `src/sim/silo.ts` and the `unguarded` event; toasts in `src/main.ts`; hit/miss toasts name the odds.
- Tests: `tests/fit.test.ts`, `tests/unguarded.test.ts`. Browser shots: `scripts/look/age-preview.mjs`.

Numbers added (all new, none changed): `FIT.near` 20, `FIT.press` 4, `FIT.land` radii and thresholds above.

Next: the computer weighing `FITS` when it picks a road; the same lines in the road planner and the web map.
