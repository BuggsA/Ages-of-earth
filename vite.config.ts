import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the build works from any static host path.
  base: './',
  // Online rooms only let in browsers running the same build (the rules must match exactly).
  define: { __BUILD__: JSON.stringify(process.env.AGES_BUILD ?? Date.now().toString(36)) },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  // In development, rooms are served by `wrangler dev` on port 8787.
  server: { proxy: { '/api': { target: 'http://localhost:8787', ws: true } } },
  // Two test tiers (AGENTS.md, "Checks"): `npm test` runs the quick tests in tests/, and
  // `npm run test:slow` (mode "slow") the long ones in tests/slow/, which CI runs on a schedule.
  // 15 s per test, not vitest's 5 s: a test taking ~3 s alone (trading posts on 18 maps) timed
  // out when the whole quick tier ran in parallel on a loaded machine.
  test: {
    include: [mode === 'slow' ? 'tests/slow/**/*.test.ts' : 'tests/*.test.ts'],
    environment: 'node',
    testTimeout: 15000,
    // Each world is generated once per test file and copied after (tests/setup/map-cache.ts).
    setupFiles: ['tests/setup/map-cache.ts'],
  },
}));
