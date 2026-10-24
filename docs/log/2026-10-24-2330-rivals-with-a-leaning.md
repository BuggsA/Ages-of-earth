# Rivals with a leaning (#749, s4a of #724)

`settleLean` in `src/sim/ai.ts`: on a clever skirmish seat's first turn, `AI_TEMPER.lean` (0.6) of seats pick a route on coins of their own (`0x7e4a`, `0x7e4b`), navy and water only on lakes or sea maps, and mark that route's suitable side ages (`fit >= 0`) as chosen in `mem.roads`, where nothing chose them yet. `leanOf` reads it; `shownLean` (`src/ui/rivalRoad.ts`) names it on the rival card once the rival has walked an age on the route; the end screen always names it. `windowOpen`: while an enemy's `backAt` is under `STEP_BACK.time` old, a clever computer sends a wave of `max(least, strike × wave)` at its Town Center. Both are gated by `AI_LEVELS[*].lean` / `.strike` for `scripts/ai-ab.ts`.

Tried and dropped: also turning down every other side age (as the route sweeps do). It made the leaning far more readable, but broke three AI tests that pin roads a leaning seat would then refuse (`ai-heirlooms`, `ai-horde`, `ai-steppe`). Tests are read-only and those roads are others' design, so the leaning only adds roads and never forbids one.

Measured: `npx tsx scripts/ai-ab.ts 21 8 30 '{"lean":false,"strike":false}'` → new 3, old 5 of 16, undecided 4–4, gathered ×0.964 (se 0.196). Mirrored pairs walked the same roads by seat, so in 30-minute matches the leaning seldom changed a road: its effect lies mostly past minute 30, and the result reads as noise rather than harm. Slow AI tests (web, opponent, rival heirlooms, blood, sail, dykes, rivers, water line): 34 passed.

Seen in headless Chromium: the Rivals card's "Favours the horse route" line, with the leaning planted. Not seen: a strike on a real step back in play.
