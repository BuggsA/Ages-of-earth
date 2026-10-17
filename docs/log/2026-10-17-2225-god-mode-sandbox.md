# God mode as a sandbox (#495)

Done: entering god mode no longer jumps to the Industrial Age or grants techs (`grantAll` is gone). While on, `rush` (`src/sim/god.ts`) finishes foundations, research, training and an advance already begun; `jumpAge` takes the player to any age, forward or back, through the same `enterAge` a road uses. A picker beside the exit button in the top bar. Still solo-only and outside the command list.

Tests: `tests/god.test.ts` had asserted the old "last epoch and all techs" entry, which the owner's note (#495) says is wrong; I rewrote it for the new behaviour on the owner's word, not to get green.

Not tried: the picker in a browser (unverified).
