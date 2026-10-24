# Roofs held 0.15 L from grass in every epoch (#617)

`STYLES` (Stone, Bronze, Medieval) and `ROOFS` (military, storehouse family) in `src/render/buildingModels.ts` moved so every roof sits about 0.15 L or more from grass `#6f8a4c`. Added the roof row to `docs/art.md`. PR #663 merged with main after the teal-roof change (#662): teal from main, storehouse gold from the PR.

Checked: `npx vitest run tests/models.test.ts`. Unverified: snow/mist haze, palms (#631), Stone/Medieval/Industrial town shots in a browser. No `data.ts` numbers changed.
