# Periodic: the browser smoke test runs alone (#415)

**Failure:** run 5 (`0088b30`): `tests/slow/browser-smoke.test.ts` timed out in `page.screenshot` (30 s) on the title page. The software-rendered (SwiftShader) page was starved while three campaign proofs of ~250 s each ran beside it. Every other slow test passed, including the Seed Atlas.

**Fix:** `.github/workflows/periodic.yml` runs the smoke test as its own step after the other slow tests, the same way the Seed Atlas is already isolated. No test or limit changed.

**Verified:** `npx vitest run --mode slow tests/slow/browser-smoke.test.ts` passes alone (1 test, 81 s). **Unverified:** the next scheduled `periodic` run (06:23 UTC) is the real proof; a `workflow_dispatch` run on `main` after merge would show it sooner.
