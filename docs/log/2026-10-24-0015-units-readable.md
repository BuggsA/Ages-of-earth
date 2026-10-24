# 2026-10-24 00:15 UTC: units you can tell apart (#624, step 1)

- Foot soldiers (infantry, ranged) wear a team-colour cape; infantry add a tall team crest. Citizens wear neither.
- Fighters drawn larger than workers (`FIGHTER_SCALE` in `unitsView.ts`): infantry 1.3x, ranged 1.22x, cavalry/priest 1.2x.
- Team ring thinner (inner radius 0.62 to 0.78) so crowds don't smear.
- Before/after: `battle` scene, `/tmp/before` and `/tmp/after`; blue and red armies now separate; workers stay brown. Not tried: other epochs' scenes, Low setting frame rate (no new draw calls; two small team boxes per soldier).
- Next: priest/hero/siege team read, citizen contrast against ground, shadow/rim with `area:light`.
