# The Warband gets a building of its own: the Spoils Stockade (#727)

Chain 1025-1752, session 1. Built on `claude/tender-faraday-wknqwv` (#814, age looks for the interface) so the new building wears the age's palette (`stockade` is in `ageLooks.ts`' TOWN list; stakes, platform and hide take the Warband's raw-hide and blood-dark colours).

The **Spoils Stockade** (`stockade`, key X, Warband only, 120 wood 40 stone): a laden soldier within 5 tiles banks its pack there, but at 75% (`SPOILS.stockadeCut`); Town Center and Barracks still pay all. It arms foot soldiers 10% cheaper (`STOCKADE.price`) and is the age's keepsake. The computer raises one 15 tiles toward the map centre once it has a Barracks and 8 soldiers (`raiseStockade`), and sends laden soldiers to the nearest bank (`haulHome`).

**Decision:** bank at the front for a quarter's cut (and a building to defend), or walk it home whole and give up the front.

Unseen: no browser; model built by `tests/models.test.ts` only. Cut 0.75, price 0.9, cost are guesses.
