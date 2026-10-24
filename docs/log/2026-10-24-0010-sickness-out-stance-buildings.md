# The Sickness removed; Attack and destroy goes after buildings (owner's ask)

The owner asked for both in chat (`docs/rulings.md`, 2026-10-24).

- **The Sickness (#541) removed:** `src/sim/sickness.ts`, `SICKNESS`, the taint, fever, quarantine and foul-post fields and events, the ☣ chip, the Quarantine button, the tip, the README line, and the computer's sick-Temple, nursing and quarantine. The Stone Age "Fever in the camp" tiding is a separate thing and stays. Old saves still load: the removed fields are optional and are now ignored.
- **Attack and destroy:** once its target falls, a soldier on the aggressive stance picks its next target from buildings in sight as well as soldiers, as an attack-move already did (`src/sim/units.ts`). An idle soldier doesn't start on a building by itself, so tests for Horde tribute and sapper kegs stay green. `tests/stance-buildings.test.ts` checks all three cases. Its first two cases failed on the old code.
- Checks: `npm run check`: 221 files, 1,020 tests. `tests/slow/ai-opponent.test.ts` passes.

Numbers removed from `data.ts`: `SICKNESS`. Decision for the player: when to keep a winning army on Attack and destroy, so it razes the town, or on a defensive stance, so it holds once the field is clear.
