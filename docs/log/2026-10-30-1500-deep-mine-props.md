# The deep mine m2: props, cave-ins, blasting, the pithead as a target (#929, umbrella #924)

- `STRATA` gained `prop` (wood to shore), `rush` (faster unshored), `fall` (cave-in chance a full basket), `blast` (gold to blast open). `SHAFT` gained `shut`, `blastAge`, `firedamp`, `firedampShored`, `strandHurt`, `winchDepth/Hurt/Slow`, and the computer's `aiProp`, `aiBlast`, `aiRaid*`.
- `shafts.ts`: `safeAt`, `shutAt`, `propProblem`/`prop`, `caveIn`, `riskLoad` (rolls `s.rng` via `animals.roll`, in the units' id order), `blastProblem`/`blast` (rolls at the command), `strand` (called by the first miner to find its pithead fallen, and in `removeDead`), `winchHurt` in `digAt`. A shut layer takes no miners.
- Commands: `prop` (new, a line in `tests/command-ownership.test.ts`), `deepen` with `blast: true`. `toLayer` refuses a shut layer.
- The computer shores before it sinks, blasts from the Gunpowder Age with gold to spare, draws its bombers/delves to deep pitheads (`enemyTarget`), and between waves sends a band at a seen deep pithead (`rivalPithead`, not in campaign chapters).
- Look/sound: cracks, props and rubble in the cut-away; pit-props on the pithead model (variant + 64); a `caveIn` sound (a dull thud) and dust; the blast's muffled boom. One toast: a cave-in on your own shaft.
- Saves: new optional fields `propped`, `shut`; no `v` bump. Old shafts load unshored.
- Tests: `tests/deep-mine-props.test.ts`.
