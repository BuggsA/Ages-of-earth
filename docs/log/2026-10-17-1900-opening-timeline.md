# 2026-10-17: `scripts/opening.ts`, the Goal 1 measure

Chain 1017-1825, session 2 (tooling lane; rules and look held by other chains).

Goal 1's "done when" (`docs/goals.md`) asks for two computer players on one seed, with different opening choices, to show visibly different first-15-minute timelines. Nothing printed that, so I added it:

`npx tsx scripts/opening.ts [seed] [wayA] [wayB] [minutes] [size]` holds each seat to a Way (`takeWay` at tick 0) and prints a row a minute (citizens/soldiers/buildings, stockpile, meat hunted, kills), then when each building type first stood and when each age was reached.

First read, seed 3, `hunt` vs `hearth`, 15 min: both open alike until minute ~8 (same buildings in the same order, meat within a few percent of each other); then the Hearth's seat ages up three times by minute 13.6 while the Hunters' stays in the Stone Age. So today the Ways differ in pace, not in what people do: the case #467 and #473 are meant to fix. Use this script to check their work.

Not tried: browser (no player-facing change). `npx tsc --noEmit` passes. Quick tier not re-run (script only).

Decision it gives the player: none: tooling.
