# Flood larder, measured (#517)

Branch `claude/517-flood-granary`. Nothing in the rules changed; this records a dropped idea.

**Tried:** the spring before the flood, a clever Egyptian computer keeps 150 food out of its spending (a larder), so the river's dry months find stock in the store. Same A/B as `2026-10-21-1700-flood-rhythm-measured.md`: Egyptian Hard vs Romans/Britons Hard, seeds 1–8, small, 20 min, seats swapped (16 matches), Egyptian epochs summed.

**Result:** baseline (`main`) 34 (2 won, 0 lost: reproduces the earlier number); larder 33 (2 won, 2 lost). No gain, two more losses, so dropped.

**Why it can't help much:** there are no granaries in the game, and food is only spent, never eaten, so a larder just delays the same spending. Autumn fields already exist: `coldComing` adds `AI_WINTER.fields` from autumn. The real drag is earlier: in several baseline matches (seeds 2 and 7 on one seat) the Stone Age food stays near 0 all game, flood or not, so those towns never advance. Next idea for #517: look at why the Stone Age food starves on those seeds (berries/hunt vs the first flood), not the stock before the river.

Not seen in a browser; headless matches only.
