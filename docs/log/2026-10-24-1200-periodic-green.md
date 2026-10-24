# periodic green again (#720)

The daily full check on `main` (97ea107) failed five slow tests in three files. Bisected over `main`'s merges since the last green run (9e83849):

- `trade.test.ts` (B never trades by minute 14): first bad at #688, the tower line. `raiseTowers` spent 100 wood on a Guard Tower at minute 11 of a 30-minute peace, the wood that had built the Market at minute 11; the Market slipped to 12 and no trader finished a run. Fix: no tower raising while the peace has more than `AI_TOWER_PEACE` (90 s) to run.
- `ai-sail.test.ts` "waits on the catch": since the Water Road (#711), a town set on the Sail (`roads.sail`) turned into the Dykes. Fix: such a town asks no Dykes coin; one water plan at a time.
- `openings-part.test.ts` (3 homelands): first bad at #614, the Britons' managed wood. Their seats keep no fields, so "the Hearth eats from fields" can't hold. Owner ruling (`docs/rulings.md`, 2026-10-24): those claims count only Chinese and Egyptian seats, seeds 4 to 7.

#712 (Iron and Gold lost on all maps) passed in the same periodic run, so it was already fixed on `main`.
