# Slow tests

Tests that take more than about 10 seconds live here: browser runs, long computer-vs-computer matches, sweeps over many seeds. `npm test` skips them; `npm run test:slow` runs them, and the `periodic` workflow runs them daily on `main` (`AGENTS.md` §5). Name files `*.test.ts`.
