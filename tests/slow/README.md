# Slow tests

Tests that take more than about 10 seconds live here: browser runs, long computer-vs-computer matches, sweeps over many seeds. `npm test` skips them; `npm run test:slow` runs them, and the `periodic` workflow runs them daily on `main` (`AGENTS.md` §5). Name files `*.test.ts`.

`browser-smoke.test.ts` drives the built game in headless Chromium (`playwright-core`; locally it uses `/opt/pw-browsers/chromium`, or set `CHROMIUM_PATH`) and fails on any page or console error; screenshots go to `test-results/smoke/` (`SMOKE_SHOTS`), and `periodic` uploads them as the `smoke-shots` artifact.
