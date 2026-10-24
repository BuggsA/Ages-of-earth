# Food without fields on the Workers panel (#344)

**What:** the Workers panel's **+Food** knew bushes, fields and carcasses only, so for the Britons (snares, no Farm) and the Mongols (a flock, no fields) it answered "No free food within reach" (730× and 1544× in `scripts/town-audit.ts`, 3 seeds × 15 min, before the audit learned to fall back to the next job). Now it sends a hand to a finished snare nobody walks, then to a ewe with milk, one hand to each. The ledger counted snare tenders and milkers as "Traveling & other"; they count as Food now. A builder called off milking goes back to it after.

**Audit:** `town-audit.ts` now plays a sensible player: a hand the panel can't place on the job furthest behind goes on to the next one, and a Briton lays snares among trees. After both #344 steps, all six peoples: 229 idles after a picker's bushes run dry, 96 for the starting five, 34 and 15 after stone and gold run out, 2 after milk; Mongol "No free food" 6 → 2.

**Computer unchanged:** `labor.ts` is the player's panel only; `units.ts` takes a milk order back only from a resume, which the computer never sets to milking.

**Not seen:** in a browser.
