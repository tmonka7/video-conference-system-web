import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/tests/**/*.test.js'],
    setupFiles: ['src/tests/setup.js'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // One process, so the in-memory MongoDB is started once for the whole run.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
