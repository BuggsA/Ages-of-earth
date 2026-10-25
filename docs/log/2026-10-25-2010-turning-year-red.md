# Turning-year slow test red again (#851)

**Bisect:** `tests/slow/ai-turning-year.test.ts` "Deep Wood … yarded deer" (seed 8 P1, 103 < 140) was green at 11529ca and first red at 0889861 (PR #734, the Age of Rivers). Skipping only P1's `wants(..., 'rivers')` coin made it green (P1 hunted 367), so #734 didn't break hunting; it shifted the match.

**Cause:** in that match P0's infantry besiege P1's town. With the Rivers decision the siege camp sits at x≈23, y≈66–75, within `AI_WINTER.shy` (8 tiles) of every yarded deer, so `huntTheYear` found none safe, P1's larder sat at 2–4 food for the whole winter and its people starved (35 → 2). Without it, the same siege sat on the far side of the town.

**Fix:** a town whose larder is under `AI_WINTER.hungry` (60) keeps only `AI_WINTER.shyHungry` (3) tiles from rival soldiers; starving beats being shy. Numbers added in `src/sim/data.ts`: `AI_WINTER.hungry: 60`, `AI_WINTER.shyHungry: 3`.

**Verified:** `npx vitest run --mode slow tests/slow/ai-turning-year.test.ts` → 2 passed; `ai-winter.test.ts` → 1 passed; `npm run check` → 301 files, 1513 tests passed (234 s, over budget as before). Hunted in the window now 265 / 275 for seed 8.
**Unverified:** a browser; AI-only change. Win rates over many seeds not compared.
