# #517: the flood, not the rush, stalls the Egyptian computer (hard attempts 1 and 2)

Branch `claude/517-stone-age-defence`. Measure: `scripts/egypt-ab.ts` (new, committed so nobody rebuilds it): Egyptian Hard vs Romans (odd seeds) / Britons (even), small, 20 min, seats swapped, **seeds 1–48 (96 matches)**. Seeds 1–16 alone swing ±5 epochs between harmless variants, so every row below is 96 matches.

| Variant | Egyptian epochs | Rival epochs | Won / lost | Stalled (epoch ≤ 1) |
| --- | --- | --- | --- | --- |
| `main` | 218 | 187 | 15 / 2 | 18 |
| **no Nile flood** (`egypt-ab.ts … off`) | **284** | 163 | 21 / 2 | **5** |
| Attempt 1: Stone Age slingers (Range at 8 hands, slingers before foot, slingers answer slingers) | 216 | 162 | 11 / 1 | 19 |
| Attempt 2: farmers back to the fields after the flood (**shipped**) | 217 | 177 | 14 / 2 | 16 |
| Attempt 2 + scratch silt: fields ×1.5 in the season after the flood (not shipped, rules) | 239 | 174 | 12 / 0 | 12 |
| Attempt 2 + scratch silt ×2 (not shipped, rules) | 237 | 170 | 20 / 0 | 13 |

**What this says.** The Egyptian computer already stalls less than its rivals (18 vs 33 of 96) and beats them 15–2. Its stall isn't an Egyptian weakness against the rush; it's the flood. With the flood off it gains 66 epochs and stalls in 5 matches instead of 18. The first flood (2.5–5 min) lands while the Stone Age town is growing, and the rush (5.5–7 min) finishes off towns it has already starved.

**Attempt 1, dropped:** Stone Age slingers. Traces showed the army was all clubmen when the rush landed (the Range came at ~6.5 min), against 11 British slingers or 8 legionaries + hero. Slingers earlier made the rival climb 25 epochs less, but the Egyptian didn't climb more and won fewer. The change plays for both seats.

**Attempt 2, shipped as a fix:** `floodWork` said "when the river falls they go back to the fields", but nothing sent them. Food workers take game and berries before fields, and no field is raised while two stand empty. So after the first flood the Egyptian fields stood empty all year (seed 2 seat 0: 2 fields, both empty, at 10 min; without the flood: 9 fields, 8 farmers). Now up to `FLOOD.back` berry pickers a think go back to the empty fields (seed 2 seat 0: 12 fields worked by 10 min, Bronze Age at 9.5 min instead of never). Over 96 matches it's level (217 vs 218, stalls 16 vs 18), so it fixes what the computer does without closing the gap. Once a town lives on its fields, the flood stops all field food for a quarter of every year, and the corvée's ×2 building doesn't pay that back.

**Left for the owner (#517, `owner-decision`):** the lever is the flood rule, not the computer. Silt (the real Nile's gift: the flood brought the fields their wealth) closed about a third of the gap in a scratch run. It's a rules change (`gatherRate` in `src/sim/units.ts`), and lane rules is held by #555.

Not seen in a browser; headless matches only.
