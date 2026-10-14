# 2026-10-14 00:20 UTC: agents without a browser can still ship

The owner reported an agent that couldn't run Chromium and so couldn't meet "Done means" (`AGENTS.md` §6). Changed §6: a missing or broken browser never blocks; run the browser-free checks, mark browser claims `unverified`, merge on green `ci`. Added `tests/models.test.ts` (every unit and building model builds in every epoch, no NaN, sane size), so a model change is covered without a GPU. No game rules touched.
