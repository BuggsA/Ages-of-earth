# The Sea-Raiders get a building of their own: the Raiders' Strand (#727)

Chain 1025-1752, session 4. The **Raiders' Strand** (`strand`, key Y, Sea-Raiders only, 100 wood 30 stone, 700 hp, 2 tiles, on a shore): a ship within `SEA_RAID.dock` (6) tiles of a finished one banks its whole hold there, keeping `STRAND.cut` (75%) of it, so a raid far from home need not sail back to a Dock. A Dock beside it still wins (the whole hold). It also arms foot soldiers on the beach. It sleeps when the people leaves the age (the age's keepsake stays the Dock). The computer, with a Dock and a ship, raises one `STRAND.away` (18) tiles toward the middle of the map (or any shore near home) and sails laden ships to the nearest bank (`raiseStrand`, `raidShips` in `ai.ts`).

**Decision:** sail home with a full hold (all of it, a long trip, the ship at risk) or plant a strand on a far beach (a quarter lost, a building to guard).

**Verbs:** verb: bank plunder on the far shore instead of at home; door: a quarter to the jarl, and 130 resources; two players: a deep strand vs a safe Dock; answer: a rival razes the beach camp or sinks the ship before it arrives.

New model (own silhouette: longship hauled up on rollers, dragon prow, sail slung as a tent, shield row). Button glyph not drawn.

**Owner follow-up (1) done:** `siloWorth` now subtracts what a blast would take from the computer's own buildings and soldiers and its allies' (`AI_SILO.own`, 1x), so it won't nuke its own town; test `tests/ai-silo-own.test.ts`.

**Not done:** (2) toast stacking (the `#notices` column already stacks to 4; the pile-up is probably with the tiding/banner at the top, needs a browser to see) and (3) the 26 px icon audit (needs `scripts/age-sheet.ts` and a browser). Left for the next session.

Unseen: no browser. Numbers are guesses (cut, away, cost).
