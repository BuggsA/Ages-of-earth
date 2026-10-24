# Ground step 3: water, ore, crowns thinning near units (#623, #617)

- `water.ts`: shallow `#3a8690`, deep `#2c5b78` (cooler, L ~0.2 and ~0.09, was bright turquoise); less sky sheen and ripple glow, so foam is the one bright thing.
- `natureModels.ts`: gold's rock bases dark (`#4f4536`) with brighter ore, so ore is the bright spot; cave-mouth rock a step lighter against the ground.
- `resourcesView.ts`: trees within ~1.2 tiles of a unit draw their crowns in (to 0.6 wide, 0.5 tall) over ~0.2 s and grow back after, so a unit in a wood shows.
- Seen: `sea` and `stone-start` shots (software GL): water cooler and darker, gold reads. The crown thinning was not seen in a shot (no unit in a wood in the scenes); unverified. L not measured.
