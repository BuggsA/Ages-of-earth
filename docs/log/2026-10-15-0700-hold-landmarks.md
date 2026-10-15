# Holding landmarks (#191, lane ai)

- `markToTake` divides distance by `AI_MARK.worth` per kind (cairn 1.6 when pop is within 4 of cap, spring 1.5 when a citizen or soldier is under 70% health, flint 1.25).
- Soldiers' target set now includes a landmark of ours or an ally's that rivals stand on alone (`pulledDown`); the guard stays until they leave.
- Tests: `tests/ai-landmarks.test.ts` (fails without the change). `npm run check` 375 pass. Headless `scripts/sim.ts 3 medium 30` runs, Hard wins.
- Not done: win-rate sweep, browser.
