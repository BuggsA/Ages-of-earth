# Health bar quarter marks — Codex

Issue #68; branch `codex/68-health-quarter-marks`.

Three fine dark divisions at 25%, 50% and 75% support judging health without relying on the red-to-green gradient. Camera-facing instanced planes use one additional draw, capped at 1,200 marks for the existing 400 bars. Marks clear when bars disappear. No simulation, balance, save, protocol or sound changes.

Validation: 173 tests pass in 28 files; the new cases cover rotated cameras, different health fractions, instance capacity and clearing. TypeScript 5.9 fallback checks pass for game and Worker. The pinned TypeScript 7 compiler crashes on `/proc/self/exe` in this container; CI checks the pinned version. Model checks: 2 passed. A one-minute headless match on seed 3 completed with checksum 1395043734.

Browser appearance unverified: `/opt/pw-browsers` is absent. No slow tests cover this rendering-only change. Owner playtesting at distant zoom is the next useful check.
