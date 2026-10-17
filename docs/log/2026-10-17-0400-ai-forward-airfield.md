# 2026-10-17 04:00 · #379 s4: the computer's forward Airfield

A clever computer (Hard/Expert) now raises its Airfield `AI_AIRFIELD.share` (0.3) of the way toward the nearest enemy target it knows of, at most `most` (16) tiles from home, so Sorties fuel (`SORTIE.turn`/`reach`) carries its planes further. No target known: the old spot at home. Normal/Easy unchanged.

- Code: `forwardField` in `src/sim/ai.ts`; numbers `AI_AIRFIELD` in `src/sim/data.ts` (new, nothing existing changed).
- Not gated on the Aeronaut age: the Airfield must stand before that road starts.
- Test: `tests/ai-airfields.test.ts`. `scripts/sim.ts 3 medium 30` checksum unchanged (2804626271).
- Unseen in a browser. Not done: convoy pennant, fairground banners.
