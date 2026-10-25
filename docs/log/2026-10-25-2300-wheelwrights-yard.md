# The Chariots get a building of their own: the Wheelwright's Yard (#727)

Chain 1025-1752, session 5. The **Wheelwright's Yard** (`wheelyard`, key N, Age of Chariots only, 90 wood 30 stone, 700 hp, 2 tiles): riders (cavalry) of its owner's team within `WHEELYARD.rest` (5) tiles are mended `WHEELYARD.heal` (4) health a second (`src/sim/wheelyard.ts`). It sleeps when the people leaves the age; the age's keepsake (J) keeps it mending on any road. The computer, with a Stable and four riders, raises one `AI_YARD.out` (22) tiles toward its nearest rival Town Center (`raiseYard`, `ai.ts`).

**Decision:** the chariot age has no walls, so a fight is a ride out and back: plant a forward yard to strike, fall back and strike again, or ride deep and gamble on one charge. A rival who burns the yard leaves the chariots to limp home.

**Verbs:** verb: mend riders in the field; door: no walls to hide behind, so the yard is the only shelter and it can burn; two players: a forward yard vs a safe one at home; answer: a rival raids and burns it, or catches riders away from it.

New model (own silhouette: a chariot on trestles, a rack of wheels, spare spokes and iron tyres). Seen in the gallery (`scripts/gallery/index.html?e=1&t=wheelyard`). Button glyph not drawn.

**Owner follow-ups (chat 2026-10-25):** (2) the banner (`#banner`, 22% of the height) drew on top of the tiding card and the notices stacked under it: it now sits below them (`top: max(22%, 250px)`; with a tiding, 420 px, smaller). Seen in a headless browser with fake cards. (3) 26 px icon audit with `GLYPH=26 npx tsx scripts/age-sheet.ts out.html`: the Wild Hunt emblem (hawk over wolf) was a white blob; now a single wolf's head. Of the rest, Rivers and Locks emblems are busy but read; the Hemocraft, Fusion and Golden plates are low-contrast (a stamp pass, not an emblem fix), left.

Unseen: the yard in a real match, the button look, sound. Numbers are guesses (rest, heal, cost).
