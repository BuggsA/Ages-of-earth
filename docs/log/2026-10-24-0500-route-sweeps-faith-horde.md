# Route sweeps: faith and horde (#555 s0, lane ai)

`npx tsx scripts/route-ab.ts <route> 1 8 30`, as in `2026-10-23-0300-route-sweeps.md`: 8 seeds, seats swapped (16 matches), 30 minutes, medium map. No code changed.

| Route | Won–lost | Undecided (ahead/behind) | Gathered | Ages ahead | Entered first side age | Reached goal |
| --- | --- | --- | --- | --- | --- | --- |
| Faith (Pilgrim → Fair) | 3–3 | 4 / 6 | ×0.99 | −0.44 | 7 of 16 | 0 |
| Horde (Steppe → Horde) | 1–2 | 5 / 8 | ×0.83 | −0.44 | 9 of 16 | 3 |

Reading it (16 matches is noise-sized):
- **Faith** splits its decided matches evenly and gathers as much as the trunk; the computer enters the Pilgrim age in 7 of 16 but never reaches the Fair inside 30 minutes. Several seats wander Pilgrim → Medieval → Sail → Missions (the crossing planner) instead of the Fair, so "the computer walks Faith to its goal" is not yet true.
- **Horde** is the one route that reaches its goal (3 of 16) but it gathers 17% less and mostly ends undecided and behind; two seats stay in Stone or the Steppe for the whole match (seed 6 seat 0 stops at "Steppe@7m"; seed 8 seat 1 never leaves Stone), which looks like a stall in the leave-the-Steppe step, not a balance point.
- Economy was not rerun (a parallel `npx` start collided); the 2–6 from the last log stands.

Next for an AI session: why a Steppe seat sits in the Steppe for 20+ minutes (`AI_STEPPE.stay`, ai.ts ~662), and why Faith never reaches the Fair.
