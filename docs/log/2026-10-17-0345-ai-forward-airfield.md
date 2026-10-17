# The computer builds a forward Airfield (#379 s4)

- `forwardFieldSpot` / `forwardField` in `src/sim/ai.ts`; numbers in `AI_SORTIE` (`data.ts`, new).
- `tests/ai-forward-field.test.ts`: spot is nearer the enemy, none in reach, one ordered in play, none outside the age.
- Win rates not compared over many maps (`ai-ab`); behaviour only checked by unit test.
