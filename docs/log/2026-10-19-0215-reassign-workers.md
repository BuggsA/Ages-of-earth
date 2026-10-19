# Moving workers between jobs from the Workers panel (2026-10-19, Claude Code)

Owner ask: move 10 woodcutters to 5 food and 5 building without selecting anyone, in one central place; and a quick way to put people on a resource you are short of.

**Built (step 1):** a `reassign { from, to, n }` command (`src/sim/labor.ts`, `case 'reassign'` in `commands.ts`). It takes the idle first, then citizens carrying nothing, in id order, and sends each to the nearest free node of the new job within `LABOR.reach` (30) tiles, two to a node. Food is berries, then a free field, then game within 8 tiles. People and legionaries obey the same limits as `gather` (`mineable`, `legionKind`). `citizenJob` and `workforce` moved from `src/ui/workforce.ts` into `labor.ts` (the UI re-exports them) because the rules can't import from `ui/`. The Workers panel got a **+** on Food, Wood, Stone and Gold (Shift: five) and a "Move N from A to B" form. The panel's skeleton is built once so the form keeps its values while the counts refresh.

**Numbers:** `LABOR` (new) in `data.ts`; none changed.
**Tests:** `tests/reassign.test.ts` (new). `tests/command-ownership.test.ts` got one line for the new command, as its comment asks.

**Step 2:** Building is a destination (`to: 'build'`: nearest unfinished building, `LABOR.crew` 5 to a site, the old gather order kept in `resume` as `assignBuilders` does; "Nothing is being built" when no site). Clicking a button you can't pay for now shows a notice with the shortfall and a **Send N** button per missing resource (`shortageCard` in `hud.ts`, `shortages` in `commands.ts`, `handsFor` in `labor.ts`: N = ceil(need / (rate x `LABOR.window` 30 s)), a field's pace for food). Tests added to `tests/reassign.test.ts`; seen in Chromium: "Need 25 more wood | Send 2" put two idle citizens on wood.

**Not done:**
- A first-game tip.
- The card shows only for buttons with a cost shown (build and train, research); Way and tiding costs aren't covered.
- Legion towns (Romans) and online play unseen.
