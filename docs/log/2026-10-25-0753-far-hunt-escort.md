# The far-mammoth escort is sent again (#798)

The slow tier's `tests/slow/wild.test.ts` failed 2 of 12: the computer never filled `huntEscort` within 60 seconds.

- **Bisected** over `main`'s merges: green at #730 (614a8a5), red from #734 (the Age of Rivers, 0889861) on.
- **Cause:** #734 nudged the Roman computer's early build order, so at the moment the far hunt is weighed its soldiers are on a muster walk (`move`, not an attack-move) rather than standing idle. The far hunt counted only idle soldiers and legion hands at the axe, so it waited until 65 s. The wolf and raider hunts just below already count a plain walk as free.
- **Fix** (`src/sim/ai.ts`, `wilds`): the escort is picked from the same pool as the wolf hunt: idle, at the axe, or on a plain walk. No numbers changed.
- Decision it gives the player: none: fix.
