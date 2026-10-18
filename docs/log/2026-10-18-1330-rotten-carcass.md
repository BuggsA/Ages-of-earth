# Rotten carcass look

A carcass that has begun to turn (past `ROT.grace`, the same test the crows use) is drawn as `carcassRotten` in `natureModels.ts`: greyed hide, ribs showing, darker pool. `resourcesView.ts` swaps the kind and checks once a second for a carcass crossing the line, since the turn raises no event. No `src/sim/` change, no `data.ts` numbers.

Decision it gives the player: none: look. It makes the spoilage clock readable (butcher it before it turns, or wolves come).

Tried: typecheck, `tests/models.test.ts`. Not seen in a browser.
