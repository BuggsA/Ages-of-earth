# A rival's habit with going back (#758, s4b of #724)

`settleHabit` in `src/sim/ai.ts`, beside `settleLean`: on a clever skirmish seat's first turn, `AI_TEMPER.habit` (0.6) of seats take one of three habits, on coins `0x7e4c` and `0x7e4d`, thirds each (`mem.habit`). Numbers in `src/sim/data.ts` `AI_TEMPER`: `habit`, `hoardTake`, `hoardStay`, `holdShown`, `baitArmy`, `baitNear`, `baitFrom`, `baitEvery`.

- **hoard:** `crossPlanned` adds `hoardTake` to the odds; `seaTurn` keeps `hoardStay` of the stay in a sibling.
- **hold:** `crossPlanned` turns a planned crossing down; `seaTurn` never returns a step back. Heirloom detours are roads, not step backs, so they stand (this is why `ai-heirlooms`, `ai-horde`, `ai-steppe` stay green).
- **bait:** `baitBack`, taken before the other journeys: in a side age, from minute 15, with `baitArmy` soldiers within `baitNear` tiles of home, no foe near, the price in hand and the cooldown over, it steps back whatever the Town Center has queued; at most once per `baitEvery`.

`habitOf` (`mem.habitSeen`) gives the Rivals card its line once the habit has shown; a refusal shows only after `holdShown` seconds. Off with `AI_LEVELS[*].habit = false` for `scripts/ai-ab.ts`. Tests: `tests/ai-habit.test.ts`.

Measured: `scripts/ai-ab.ts {21,41,61} 8 40 '{"habit":false}'` (three batches, 48 matches, seats swapped) → new 19, old 15; gathered ×1.17 (se 0.18), ×1.00 (0.28), ×1.05 (0.18). No harm shown; most effect lies past the matches' reach. `npm run check` → 307 files, 1528 tests passed. Slow `ai-rival-heirlooms` and the five AI tests that pin crossings passed. Not seen: a baiter's trap in a browser, or the card line in one.
