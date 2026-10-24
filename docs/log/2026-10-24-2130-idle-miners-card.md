# Idle miners get a "Find more stone/gold" card (#344 step 6)

The HUD remembers what each citizen last dug. When three or more former miners have stood idle for 5 seconds, a notice offers **Find more stone** (or gold, whichever more of them dug), up to `AUTO_WORK.lay` hands. One click sends `reassign idle→stone|gold`: the nearest other seam in reach, else a free Mine Shaft. At most once per 30 seconds. HUD only: no rules change, `scripts/sim.ts 3 medium 30` checksum stays 1591387014.

Unseen: not tried in a browser; if no seam is in reach the click only gets the usual refusal. The 5 s / 3-hands / 30 s numbers are guesses.
Next: (a) a browser pass over both cards and the Workers panel; (b) starting-five idles.
