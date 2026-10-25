# The computer's gate reads bait (#796, s6h of #701)

Chain 1024-1330, session 8 of 8, lane rules, area:tides (hard). Follows #792 (PR #795).

- **Reading:** `gateRead(s, owner, gate, m)` (exported, `ai.ts`), called from `gateWork` once a second (timestamp `mem.tide.gate`). Null: unloaded, under `AI_GATE.threat` rivals on the reach, or no more than its own. 'hold': under `full` on the reach and rival soldiers (land, not citizens, priests, traders, wagons) within `near` tiles of a reach tile, off it, with `army`× the health on it. 'fire' otherwise, or while holding: `rise` more ids seen on the reach than at the start (`mem.tide.hold.seen`), or `gateFading(s, gate, lose)`.
- **`gateFading`** (`tides.ts`): the head at `tick + sec` (by `tideLevel(s, tick)`) under `TIDE_GATE.least`.
- **Guard:** `gateGuard` (every look, gate built): a lit rival keg within `KEG.reach + 1` of the gate → the guard (or the nearest foot soldier within `call`) moves onto it; else a Sapper rival's citizen or infantry within `watch` and none of ours within `AI_KEG.guard` → the nearest foot soldier within `call` amoves to the dry or causeway tile beside the gate nearest that rival, off the reach. `mem.tide.guard`; `gatePost` keeps it out of the army's orders (the `guards` set in the army step) for `again` s.
- **Numbers:** `AI_GATE_READ = { full: 6, near: 9, army: 2, rise: 2, lose: 2, watch: 14, call: 40, again: 15 }` (new).
- **Tip** `gateHolds`; `tipWhen(id)` exported from `src/ui/tips.ts` for headless tip tests. README line under the Tide Gate.
- **Tests:** `tests/tide-gate-read.test.ts` (9): fires with no army behind; holds; fires on fresh feet; fires when the army leaves; fires before the head fades; deterministic; in play (holds 5 s, scours the army crossing); the guard (the gate stands a Sapper keg); the tip.
- **Probe:** `scripts/gate-probe.ts` gains a guarded keg trial and keg counts. 4 min, 8 seeds, before → after: straight 19 → 19 dead; bait 14 → 26; keg with guards near, blown 7 → 2, stamped out 0 → 4.
- **Save:** no `v` bump: new optional fields in the computer's memory only.
