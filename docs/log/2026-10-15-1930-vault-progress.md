# 2026-10-15 19:30 UTC: campaign stars follow the save key (#292, lane online)

Chain 1015-1905, session 1. The vault gained a `progress` document: chapter → best stars, merged by the best of old and new on the server (`cleanProgress`, `mergeProgress` in `src/net/vault.ts`). `syncProgress` (`src/ui/campaignUi.ts`) merges this browser's stars both ways when the Cloud saves panel opens, and after that each win is pushed on its own.

Evidence: `npm run check` → 99 files, 470 tests passed (new: 3 in `tests/cloud-saves.test.ts`). Not run: a browser, `wrangler dev`.
Next: Web of Ages discoveries in the vault; a QR code of the key.
