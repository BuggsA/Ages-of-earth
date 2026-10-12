import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works from any static host path.
  base: './',
  // Online rooms only let in browsers running the same build (the rules must match exactly).
  define: { __BUILD__: JSON.stringify(process.env.AGES_BUILD ?? Date.now().toString(36)) },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  // In development, rooms are served by `wrangler dev` on port 8787.
  server: { proxy: { '/api': { target: 'http://localhost:8787', ws: true } } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
