# Periodic: the browser smoke test runs on its own (#415)

The 2026-10-17 `periodic` run failed only in `tests/slow/browser-smoke.test.ts`: `page.screenshot` timed out at 30 s on the title page while the campaign proofs held the CPU (software GL). The same file passes alone (68 s here). The workflow already ran the Seed Atlas file apart for the same reason, so the smoke test now gets its own step after the main slow run. No test or limit changed.

Unverified: the next scheduled run is the proof. Earlier red runs (10-15, 10-16) were not read in detail; if one stays red, look there.
