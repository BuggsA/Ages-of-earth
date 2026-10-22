# Survey the Land retired from the Storehouse (#563)

Chain 1022-1508, session 2. Branch `claude/562-prospector` (harness-set, restarted from `main`).

- The owner chose option 1 on #563 ("Sure lets go with your rec", recorded in `docs/rulings.md`). The `survey` helper in `tests/slow/iron-age.test.ts` now raises a Prospector's Lodge with the town's citizens and reads the `prospect` event's answer about bog iron; nothing else in that file changed.
- `TECHS.survey` is never researched: `legacy` now means granted only, and `techProblem` refuses it ("Learned when a Prospector's Lodge is raised"); it stands at the lodge with no price, so a `research` command at a Storehouse is refused too. It stays a technology because the iron road's `found: 'survey'`, saves and the computer read it.
- Gone: the research-time `survey` event, its type and its banner in `main.ts` (the lodge's `prospect` banner replaces them). An older save still holding a survey in a Storehouse's queue finishes it as before (the queue doesn't check the building).
