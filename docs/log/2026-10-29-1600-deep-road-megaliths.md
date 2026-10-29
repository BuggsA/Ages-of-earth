# The Deep Road s1: the Age of Megaliths (#876, #877)

The owner asked for a new trunk that ends stronger than Fission and Fusion, is easy to reach, and never starves for its resource. Pitched the Deep Road (#876, `docs/deep-road.md`) and built its first age.

- Rules: `src/sim/henge.ts`; `MEGALITH`, `HENGE`, the `deep` route, the age, its three roads and the Henge in `data.ts`; the cost hook in `buildingCostFor`, the `hallowed` placement rule, the shaft grade in `shaftShare`, `hengeStep` in `game.ts`.
- The road's clue is a House (or a Storehouse): `tests/iron-age.test.ts` holds that a fresh Stone Age town knows only the Bronze road, and every town raises a House in its first minutes.
- Computer: asks the road last of the turns off the Stone Age (it is last in `ROADS`), on its own coin (0.7), so it takes only towns bound for the plain Bronze Age (4 seats of 40 over 20 seeds); not leaned to yet; `megalithWork` sets aside the first Henge's stone and looks farther out in a crowded town; keeps the age until its first Henge stands (120 s at most), then climbs as usual; moves hands from wood to stone in the age.
- Look: palette, touches, hat, ground, air, the new `trilithon` plate, the emblem, the Henge model (`src/render/deepModels.ts`), the web map's eighth lane, sounds `gathering` and `solstice`.
- Seen in Chromium (screenshots in `docs/screenshots/megaliths/`): the Henge and the town, the Henge's panel, a solstice gathering paying 312. Not heard: the sounds' levels.
