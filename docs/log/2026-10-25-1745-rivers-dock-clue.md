# The Age of Rivers shows at a Dock too (#794)

- **Problem:** Rivers' clue was a Farm. The Britons, a camp on the move (Mongols) and the Hunters' Way raise none, so a computer bound to the Water Road never saw Rivers on seeds 203 and 405 (`docs/age-roads.md` §1).
- **Built:** `Road.clueAlt` (second building that shows a road) and `cluesOf(road)` in `src/sim/ages.ts`; Rivers is `clue: 'farm', clueAlt: 'dock'`. Used by `roadKnown`, `roadProblem` ("Needs a Farm or a Dock"), the road label (`webMap.ts`), the "Another road" banner (`main.ts`), and the computer's `clueDue`/`clueRising`, which raises the first clue its people may build now (Farm unless barred or shut by the Hunters' Way, else Dock).
- **Test:** `tests/rivers-dock-clue.test.ts` (two clues, panel text, a Briton computer raises a Dock and no Farm and then knows the road).
- **Sweep** (`npx tsx scripts/routes.ts water --seeds 6 -j 2 --detail`, before → after): seeds 203 and 405 on lakes and sea go Stone → Rivers → Dykes (before: Bronze → Middle → Dykes). Wins lakes 5/6 → 5/6, sea 5/6 → 6/6, continental 5/6 → 4/6 (seed 102 unfinished at 40 min; the other seeds are unchanged, so likely butterfly noise from a different mid-game, not seen to be caused by this).
- **Not done:** a map with no shore (continental) still shuts these peoples out of Rivers; the door says "Needs a Farm or a Dock". A clue that needs no shore (a spring-side one) would close it.
- Decision it gives the player: a people that tills no field can still take the Water Road, if it works the shore.
