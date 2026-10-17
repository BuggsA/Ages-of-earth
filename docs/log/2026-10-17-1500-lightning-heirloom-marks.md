# Marks for the Lightning heirlooms (#240)

Lane look. The three Age of Lightning heirlooms now show on their buildings (`HEIRLOOM_FIELD` in `buildingModels.ts`, picked up by `heirloomsFor` and so `heirloomOn`): St. Elmo's Fire a copper rod with a blue glow on the Temple roof, Wireless Telegraphy a lattice mast and signal hut on the Dock, Galvanic Revival a copper coil beside the Workshop.

- Test: new block in `tests/heirloom-looks.test.ts` (each gains vertices in every epoch). No assertion changed.
- No numbers changed, no save bump. How they look in a browser: unseen.
- Dropped from #240's leftovers: "merchant ships reporting pirates" (the game has no pirates).
