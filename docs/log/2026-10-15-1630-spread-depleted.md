# Depleted nodes: the crowd fans out (#266 leftover), 2026-10-15

When a node runs dry, the player's workers used to all pick the same nearest next node. `gatherStep` (`units.ts`) now counts who works each tile and, if the nearest is at `SPREAD.perNode`, takes the nearest one that isn't (`findResource` gained an optional `skip`). Human players only: the computer is unchanged (the coil-layout test is sensitive to it). Meat is not spread. No number changed; no save bump.

Tested: `tests/spread-orders.test.ts` (new case fails without the fix), `npm run check` (446 pass). Browser: not tried. Next: let the player's right-click on a farm field spread across fields.
