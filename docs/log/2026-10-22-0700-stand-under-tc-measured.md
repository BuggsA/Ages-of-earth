# #517: standing under the Town Center against the rush (measured, not shipped)

Setup: Egyptian Hard vs Romans (odd seeds) / Britons (even), seeds 1-16, small, 20 min, seats swapped (32 matches a row). Baseline = `main`.

What the trace showed (seed 2, seat 0): the rival's rush at ~5.5 min is ~4-6 archers plus foot; the Egyptian army of ~7 chases them out of Town Center range (7 tiles) and dies piecemeal by 6.25 min.

Tried: when the army has fewer than `ratio` soldiers per foe at its buildings, stay within `leash` tiles of the Town Center instead of a-moving at the threat (in the `if (threat)` block of `src/sim/ai.ts`).

| Variant | Epochs (32 matches) | Won / lost | Stalled (epoch ≤ 1) |
| --- | --- | --- | --- |
| baseline | 73 | 6 / 0 | 4 |
| ratio 1.5, leash 9 | 68 | 3 / 1 | 7 |
| ratio 1, leash 16 | 71 | 1 / 0 | 6 |

Both worse: standing off lets the archers raze the outer houses and farms unopposed, which costs more than the lost soldiers. Reverted; nothing in `src/` changed.

Left for whoever takes it: the lever is probably more soldiers sooner (Hard `firstAttack` 330 s means the rival's wave is ready when ours is), or archers of our own in the Stone Age, not where the army stands. #517 released.
