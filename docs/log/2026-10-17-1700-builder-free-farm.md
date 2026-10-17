# Builders take a free field after a worked farm (#344), 2026-10-17

Follow-up to `2026-10-17-0510-gather-far.md`. Builders after far builds are already covered: a builder resumes the gathering it was pulled off, and `gatherStep` now looks 18 tiles before idling. Farms never deplete, so that part is moot.

- `units.ts` (`afterBuilding`): when a human player's builder finishes a farm that someone already works, it takes a free farm within 10 tiles instead of standing idle. The computer is unchanged.

Tested: `tests/builder-free-farm.test.ts` (fails without the change), `npm run check`. Browser: not tried. No save bump.
Not done: a real playtest of where else people go idle; Steppe camp creeping (#331, #322), Age of Lightning sweep (#231 s4).
