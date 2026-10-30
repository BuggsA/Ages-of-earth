import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the build works from any static host path.
  base: './',
  // Online rooms only let in browsers running the same build (the rules must match exactly).
  define: { __BUILD__: JSON.stringify(process.env.AGES_BUILD ?? Date.now().toString(36)) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    // Three.js in a file of its own: its name only changes when the library does, so a returning
    // player's browser keeps it across our many deploys and fetches just the game's own code.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: (id: string) => (id.includes('node_modules/three/') ? 'three' : null) }] } } },
  },
  // In development, rooms are served by `wrangler dev` on port 8787.
  server: { proxy: { '/api': { target: 'http://localhost:8787', ws: true } } },
  // Two test tiers (AGENTS.md, "Checks"): `npm test` runs the quick tests in tests/, and
  // `npm run test:slow` (mode "slow") the long ones in tests/slow/, which CI runs on a schedule.
  // 15 s per test, not vitest's 5 s: a test taking ~3 s alone (trading posts on 18 maps) timed
  // out when the whole quick tier ran in parallel on a loaded machine. The slow tier gets 60 s: its
  // tests are long by definition, and `periodic` runs them side by side on a runner whose speed varies
  // twofold from day to day, so the 54-map sweeps (~8 s alone) timed out at 15 s (#540).
  test: {
    include: [mode === 'slow' ? 'tests/slow/**/*.test.ts' : 'tests/*.test.ts'],
    environment: 'node',
    testTimeout: mode === 'slow' ? 60_000 : 30_000,
    // Each world is generated once per test file and copied after (tests/setup/map-cache.ts).
    setupFiles: ['tests/setup/map-cache.ts'],
  },
}));
