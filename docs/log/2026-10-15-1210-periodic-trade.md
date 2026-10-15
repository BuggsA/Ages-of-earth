# Periodic red: trade.test.ts and the smoke hook (#253)

Run 38729243123 failed three ways in the slow tier:

- `trade.test.ts` "run the road": wolves (the wild, #171) killed the trader at 33.6 s, so it made 1 trip, not 2+. The test's `game()` now clears `s.animals`, as `wild.test.ts` and others do.
- `trade.test.ts` "easy prey for cavalry": the foe, a player-1 infantryman, stood in player 0's land and lost 1.7 hp every 5 s to border attrition (#132). The scene now sits in player 1's own land. The assertions are unchanged.
- `browser-smoke.test.ts`: `afterAll` hit the 10 s hook default closing Chromium on a loaded runner. It now has a 60 s limit.

Setup only; no assertion changed, no rules changed. The conflict was between old test scenes and later features, not a game bug. Not run: the full tier.
