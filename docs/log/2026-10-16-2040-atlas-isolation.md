# Seed Atlas periodic timeout (#353)

Run 38894837784, job 116952713804: `surveys every map type, repeatably` exceeded 15000 ms while the full slow suite ran (309.46 s overall). The unchanged atlas file passed alone: 5 tests, 23.60 s total.

Periodic now excludes exactly `tests/slow/seed-atlas.test.ts` from the other slow files, then runs it separately. Tests and their 15 s limits are unchanged. Atlas still runs if another slow file fails; it skips when setup failed or the run is cancelled. Browser environment and screenshot upload stay on the existing smoke step.

Integrated with current main's map-generation optimizations and per-file map cache. Kept its shortened status and designer notes unchanged: this workflow fix belongs only in this log. No gameplay, balance, save or replay changes.

Verification is recorded in PR #363. The next full periodic run must confirm the CPU-contention diagnosis on the GitHub runner.
