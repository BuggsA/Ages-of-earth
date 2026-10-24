# The computer answers a rival's Tide Gate (#792, s6g of #701)

Chain 1024-1330, session 7 of 8, lane rules, area:tides (hard). Follows #785 (the Tide Gate, PR #790).

- **Reading the way:** `gateAhead(s, owner, x, y, pts, from)` (the first tile of a rival loaded gate's reach a walk steps onto, and the gate) and `gateOnWay(s, owner, team, from, to)` (a plain `findPath` from muster to target that steps onto a reach, with no way round vetoing every reach tile within `round` times its length). `gateZones` now keeps each zone's gate id.
- **Answering:** `gateAnswer` (exported, `ai.ts`), checked first in the attack's low-water step (before `ebbWait`). Looks every `look` s (`mem.tide.onWay`, timestamped; a cached gate is checked with `gateLoaded` between looks). Answers in `mem.tide.answer` (`how`, `at`, `ids`): `kegRun` → `baitRun` → wait → `mem.tide.dare` (goes past that gate). The gate gone after an answer: `mem.tide.sprung`; for `baitWait` s a wave short by up to `bait` still launches. The muster leaves the bait on the flats (`baitIds` in the strays filter). The answer is dropped when the wave breaks up.
- **On the march:** `gateBack` (in `tideWork`, every second by timestamp `mem.tide.back`): marching land soldiers whose path ahead runs under a rival gate (not one dared, not one already turned from: `mem.tide.turned`) turn back to the muster; all of them, and the attack is off.
- **Breach fix:** `breachAt` measures a blast to the whole of a gate's tile (`distToTile`), so a keg laid by the gate breaches the causeway under it and wrecks it.
- **Numbers:** `AI_GATE_ANSWER = { look: 2, search: 12000, round: 1.6, keg: 45, bait: 3, spare: 4, baitWait: 20, wait: 90 }` (new).
- **Tip** `gateRead`; README line under the Tide Gate.
- **Tests:** `tests/tide-gate-ai.test.ts` (6): reading the way (and not for the owner, nor once fired); bait; keg (the gate wrecked); wait; determinism; a marching wave turning back.
- **Probe:** `scripts/gate-probe.ts` (new). 8 of 16 seeds: straight 18 dead, bait 10, keg 4.
- **Save:** no `v` bump: new optional fields in the computer's memory only.
