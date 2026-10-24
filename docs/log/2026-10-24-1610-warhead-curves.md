# Warhead damage curves and the shared blast (#752, s1 of #751)

`blastDamage` and `strike` in `src/sim/silo.ts`; `WARHEADS` and `SILO.lift` in `data.ts`. `Launch.w` (absent in old saves = atomic) names the warhead, `GameState.blasts` holds the fog lifts (`vision.ts` stamps them for every player). `siloWorth` in `ai.ts` scores each target by weight × the share of its health the curve takes; `fleeWarhead` runs from the blast radius.

Numbers changed in `data.ts`: removed `SILO.building` (1500) and `SILO.unit` (400); added `WARHEADS` (peaks 12,000 / 20,000 / 40,000, radii 8 / 10 / 12) and `SILO.lift` 60.

Tests: `tests/warheads.test.ts` (curve samples, zero at R, edge distance, sheltered units, fallout radius apart from blast radius, Fusion clean, fog lift for all and expiry, save round trip). In `tests/silo.test.ts` two changes were forced by the new rule: `game()` adds a spare rival Town Center (a real strike now ends the match otherwise) and the "outside the ring" aim uses the blast radius.

Not seen: the blast in a browser (see the PR).
