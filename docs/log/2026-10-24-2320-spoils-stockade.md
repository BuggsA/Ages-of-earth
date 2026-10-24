# The Warband gets a building of its own: the Spoils Stockade (#727, step 2)

Chain 1024-2000, session 8 of 8. Merged `main` into the open Bloom Hearth branch (PR #732) and added the Age of the Warband's building.

The **Spoils Stockade** (`stockade`, key Y, Warband only, one at a time: `stockadeLimit`, `thralls.ts`): a finished, awake one banks a laden soldier's pack within `SPOILS.bank` tiles, as a Town Center does (`homeNear`, `spoils.ts`). Kept as the age's keepsake (`AGES.warband.keepsake`), it goes on taking rival citizens slain within `THRALL.pen` (14) tiles as thralls on any road (`penNear`, `takeCaptive`). Computer: `raiseStockade` (`ai.ts`) puts one `STOCKADE.out` tiles toward the rival once it has four soldiers. Model `stockade`, tip `stockade`, README line, `tests/stockade.test.ts`.

**Decision it gives the player:** bank plunder at a forward post a rival can burn (and fight over), or walk it home; and whether to keep the pen when leaving. Numbers (`data.ts`): hp 1000, cost 120 wood 30 stone, `STOCKADE = { max: 1, out: 16 }`, `THRALL.pen = 14`.

Unseen in a browser; the model is built by `tests/models.test.ts`. The Warband's door (a host that hurries home gives up the front) is softened by the post: watch whether raiding gets too safe.

Still open on #727: the shared-keepsake ages (tests pin them; see the comment on the issue), Merchants, Sappers, Chariots, Steppe, Horde and the rest of `scripts/unlocks.ts`'s `keepsake -` rows.
