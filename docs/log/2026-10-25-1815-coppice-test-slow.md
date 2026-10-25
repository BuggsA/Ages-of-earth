# Coppice AI test moved to the slow tier (#819)

`tests/coppice.test.ts` "is played by the computer" (a 9-minute Hard match) timed out at 15 s on the CI runner, turning `ci` red on `main`. Moved it unchanged to `tests/slow/coppice-ai.test.ts` (AGENTS.md §5). Quick file: 6 pass; slow file: passes in ~7 s locally.
