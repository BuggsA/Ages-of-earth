# Moving workers between jobs from the Workers panel (2026-10-19, Claude Code)

Owner ask: move 10 woodcutters to 5 food and 5 building without selecting anyone, in one central place; and a quick way to put people on a resource you are short of.

**Built (step 1):** a `reassign { from, to, n }` command (`src/sim/labor.ts`, `case 'reassign'` in `commands.ts`). It takes the idle first, then citizens carrying nothing, in id order, and sends each to the nearest free node of the new job within `LABOR.reach` (30) tiles, two to a node. Food is berries, then a free field, then game within 8 tiles. People and legionaries obey the same limits as `gather` (`mineable`, `legionKind`). `citizenJob` and `workforce` moved from `src/ui/workforce.ts` into `labor.ts` (the UI re-exports them) because the rules can't import from `ui/`. The Workers panel got a **+** on Food, Wood, Stone and Gold (Shift: five) and a "Move N from A to B" form. The panel's skeleton is built once so the form keeps its values while the counts refresh.

**Numbers:** `LABOR` (new) in `data.ts`; none changed.
**Tests:** `tests/reassign.test.ts` (new). `tests/command-ownership.test.ts` got one line for the new command, as its comment asks.

**Not done:**
- Building as a destination: it needs a site, so it isn't offered yet.
- The "Get 40 wood" button on a button you can't afford.
- A tip for first-time players.
- Browser unseen unless the pull request says otherwise.
