# 2026-10-17 04:30 · #355 s1: blood and the Drain Rig

Blood is `Player.blood` (optional, so saves load), with `stats.blood` and `stats.levied`. The Drain Rig (`BUILDINGS.drainrig`, Iron and Blood and Total War, military menu **H**) draws a fifth of a living enemy's price as blood when it falls within 14 tiles of the killer's finished rig (`drawBlood` in `src/sim/blood.ts`, called from `combat.ts` beside plunder). The levy reuses the `callUp` command on a rig (`commands.ts`), so `tests/command-ownership.test.ts` (read-only) needed no new line. HUD: 🩸 readout and a Levy button; model, `blood` event with toast, spray and sound; tip; README line; designers' note.

- Numbers (all new, `BLOOD` in `data.ts`): reach 14, share 0.2, levy 30, levyReach 6, levyMost 3, rest 15 s. Drain Rig costs 120 wood, 60 gold, 600 hp.
- Tests: `tests/blood.test.ts`.
- Not done: spending blood (s3), the computer using it (s5), animals and captives as sources. Unseen in a browser.
