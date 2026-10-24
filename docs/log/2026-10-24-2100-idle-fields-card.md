# Idle pickers get a "Lay fields" card (#344 step 5)

When three or more of your citizens have stood idle for 5 seconds and no field of yours is going up, a notice offers **Lay N fields** (N up to `AUTO_WORK.lay`). One click sends `reassign idle→food`, which (since #710) lays fields near them, paid in wood. It shows at most once per 30 seconds and not to peoples who till no fields. HUD only: no rules change, `scripts/sim.ts 3 medium 30` checksum stays 1591387014.

Unseen: not tried in a browser; the 5 s / 3-hands / 30 s numbers are guesses to tune when played.
Next: starting-five idles; ~27 stone and 5 gold miners idle in `town-audit.ts`.
