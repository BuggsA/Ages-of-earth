import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works from any static host path.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
