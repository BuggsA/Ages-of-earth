# A keepsake for the Chariots (#555 s12)

- **Built:** the Age of Chariots names a Stable as its keepsake. The kept Stable (J) trains cavalry at the age's price (a tenth less) on any road. `trainCostFor` now reads the kept age's `price` when the building is that age's keepsake, so the Sea-Raiders' Dock uses the same rule. Eleven ages name a keepsake.
- **Decision it gives:** which Stable to keep; a chariot yard stays cheap after you rejoin the main road.
- **Checked:** `tests/keepsakes.test.ts` (kept Stable cheaper; an unkept one, or a Barracks, pays full). J button and tooltip are the shared keepsake text, unseen in a browser.
- **Still missing a keepsake:** Iron, Sail, Merchants, Aeronauts, Reclaimers, Warband, Steppe, Horde, Sappers.
