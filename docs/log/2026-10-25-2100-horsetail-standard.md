# The Horde gets a building of its own: the Horsetail Standard (#727)

Chain 1025-1752, session 3. Merged first: Mine Gallery (#833, with the friendly-fire nuclear change) and Hire Hall (#808, after merging `main` into it: README, models, scales, `ai.ts`, `data.ts`, `stats.ts`, `types.ts`, `tips.ts` conflicted; the Hall's AI step, building entry and numbers were re-added by hand and its tests pass).

The **Horsetail Standard** (`standard`, key Z, Horde only, 80 wood 30 stone, 500 hp, 1 tile): riders standing within `STANDARD.reach` (5) of your own working standard take tribute at 0.3 gold a second from the nearest rival whose land lies within `STANDARD.border` (8) tiles of it, as though they stood in that land (`tribute.ts`; same `TRIBUTE.most` cap). Keepsake: kept (J), it pays on any road. The computer plants one `AI_STANDARD.past` (4) tiles beyond the nearest gold-holding rival's border once it has a Stable and a band, and its band stands by it (`raiseStandard`, `exactTribute`).

**Decision:** stand in the rival's land (no pole to guard, but under its Town Center's arrows) or plant a standard at the border (safe, but cut it down and the income stops).

**Verbs:** verb: take tribute from the border instead of inside it; door: a pole to build and guard, and 110 resources; two players: border pole vs. deep ride; answer: a rival sees the pole and razes it.

New model (own silhouette: cairn, tall pole, crossbar of horse-tails, gilt crescent, pennant). Button glyph not drawn.

Unseen: no browser. Numbers are guesses (reach 5, border 8, cost).
