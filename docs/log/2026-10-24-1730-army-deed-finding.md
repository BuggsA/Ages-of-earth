# Army route: the 600-plunder deed is not what stops Iron and Blood (#555 s0)

Chain 1024-0610 s5. Tried the deed at 300 and at 150 (`ROADS` gunpowder→ironblood, `src/sim/data.ts`); `npx tsx scripts/routes.ts army --seeds 4 -j 4 --minutes 30` gave the same result both times, and the same as at 600: `W-WW 3/4; 0/1/1/1 route ages walked; ended atomic,warband,warband,warband`. The number was reverted (no evidence for it).

Why: a headless trace (seeds 102, 203) shows the bound Hard computer reaches the Warband only at minute 14–17, banks 25–37 plunder in the next 12 minutes (64 slain, so most plunder never gets home), and is still in the Warband at 30 with gold near 50, so the climb to Gunpowder (1000 food, 500 gold, 300 stone) is never paid. The deed sits two steps beyond where the seat gets to.

Next (not done): the lever is tempo and banking, not the deed: (1) why the seat is in the Middle Ages at 15 min; (2) why 64 slain pay 37 gold (soldiers dying laden, or `haulHome` rarely firing); (3) whether `bloodHold` waiting 480 s in the Warband starves the climb's gold.
Note: `scripts/routes.ts` has no `--start` or `--detail`, and unknown words are read as route ids (they print junk rows or crash).
