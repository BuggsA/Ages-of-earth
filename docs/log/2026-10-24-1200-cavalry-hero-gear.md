# 2026-10-24: cavalry and hero gear per people (#267)

- `src/render/unitModels.ts`: `cavalryGear` (epochs 1-3: a cap or helm per people, and a saddle blanket with a trim stripe down each flank in the people's colours) and `heroGear` (epoch 1 warlord, 2-3 mounted champions: a horsehair brush, transverse crest, twin plumes, uraeus, horsetail banner or golden wings). No rule changes; `src/sim/` untouched.
- Gallery: `node scripts/gallery/shoot-units.mjs <dir> gear` also writes `gear-cavalry` and `gear-hero` (`units.ts` takes `?g=gear&k=cavalry|hero`).
- Seen in swiftshader close-ups: blankets and caps read well on both views; the epoch 2 great helm hides the Greek and Roman hero brushes partly. Not seen: in motion, at game distance, epoch 0 riders (none) and epoch 4+ (unchanged).
