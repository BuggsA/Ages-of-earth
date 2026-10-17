# Periodic: run the browser smoke test on its own (#415)

`periodic` failed on `main` three days running, each time on a load timeout, not a rule break:
run 4 (`seed-atlas`, 15 s test budget), run 5 (`browser-smoke`, `page.screenshot` 30 s). Both
files ran beside the CPU-heavy campaign proofs. `seed-atlas` was already split out for this.

Done: `.github/workflows/periodic.yml` now runs `browser-smoke` as its own step too, after the
rest and the atlas. No test was edited; every limit is unchanged. The browser env
(`CHROMIUM_PATH`, `SMOKE_SHOTS`) moved to that step.

Checked: `npx vitest list --mode slow --filesOnly` with both `--exclude` flags lists 13 files; the
two isolated ones make the 15 in total.

Not checked: the fix itself needs a `periodic` run (workflow_dispatch) on `main` after merge.
If the smoke test still times out alone, the 30 s screenshot budget is the next thing to look at.
