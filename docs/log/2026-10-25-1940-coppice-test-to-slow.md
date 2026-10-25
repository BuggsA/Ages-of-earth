# Coppice computer test moved to the slow tier (#821)

`tests/coppice.test.ts` ran ~13 s of a 15 s timeout and flaked on `ci`. Per AGENTS.md §5 it moved unchanged to `tests/slow/coppice.test.ts` (only the import paths gain a `../`). Slow run: 6 tests pass in 2.8 s here.
