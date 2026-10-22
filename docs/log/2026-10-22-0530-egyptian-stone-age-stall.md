# #517: why the Egyptian seat stalls on seeds 2 and 7 (measured, nothing shipped)

Setup: Egyptian Hard vs Romans (odd seeds) / Britons (even), seeds 1-8, small, 20 min, seats swapped. Baseline on `main` (84b03c7): 34 epochs, 2 won, 0 lost, as in the larder log.

**Why the food sits at 0.** Not berries or the hunt, and not the flood: seed 7 seat 0 and seed 2 seat 0 are in the Stone Age at 20 min because the rival's first wave (Hard `firstAttack` 330 s) lands at about 5.5-6.5 min on a town whose army is a handful of infantry. Food is 0 because every think spends it on the next citizen or soldier.
- Seed 2 seat 0: the bell rings at 6.1 min with 0-1 defenders; 15 of ~25 citizens are sheltered until 9.7 min (3 rival soldiers stand 0.4-7 tiles from a building the whole time), then a second siege at 15 min. The bell logic works as written (`t.count <= quiet` is the release); making it release on a stale siege at any distance changed nothing (34 epochs, same results).
- Seed 7 seat 0: raids at 6.5 and 11.5 min take the town from 26 citizens to 6; seat 1 of the same seed (other side of the map) reaches epoch 2.

**Tried, each alone, reverted:**
| Idea | Epochs | Won/lost |
| --- | --- | --- |
| Ruin diggers (`excavate`) keep off ruins with a visible wolf/boar/raider within 12 tiles | 27 | 2 / 0 |
| Army does not hunt wolf packs or raider camps before `firstAttack + 180 s` (`wildWork`) | 36 | 1 / 0 |

The second moved seed 2 seat 0 from epoch 1 to 2 but lost a win on seed 5; 16 matches is chaotic (any change reshuffles every later think), so +2 epochs and -1 win is noise, not a result. Seed 7 seat 0 stayed at epoch 0 in both.

Side finding: citizens on `dig` orders (ruins) walk 40-60 tiles to the nearest unguarded ruin and several died to wolves and raiders by 2-3 min on seed 7; guarding against beasts did not pay in this measure, but the walk is long.

**Next, if anyone takes it:** the stall is defence in the Stone Age against a 5.5-min rush, not the economy. Look at what the Egyptian army is at 5.5 min (`AI_LEVELS.hard.wave`, tower timing, whether citizens are better spent on soldiers when the Roman legion is a Hard rival), judged on more than 16 matches (`scripts/ai-ab.ts` with many seeds). Nothing in `src/` changed.
