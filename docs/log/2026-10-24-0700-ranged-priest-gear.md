# 2026-10-24: ranged and priest gear (#267)

- `src/render/unitModels.ts`: `rangedGear` (epoch 1 archers: a cap or hat per people; epoch 2 crossbowmen: a mantle colour per people) and `priestGear` (epochs 1-3: wreath, toga fold, scholar's cap, gold collar, fur collar, oak circlet). No rule changes.
- Gallery: `node scripts/gallery/shoot-units.mjs <dir> gear` now also writes `gear-ranged` and `gear-priest` close-ups (`docs/screenshots/gallery-units-gear-*.jpg`).
- Seen in swiftshader close-ups: caps and hats read from the front-left; mantles sit behind and show mostly from the rear. Priest plume/crown covers the Greek wreath. Not seen: in motion, at game distance, epoch 0 slingers and epoch 3 musketeers (unchanged).
