import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env file
config();

export default defineConfig({
  resolve: {
    alias: {
      '@thesis/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.property.ts', 'src/**/*.integration.test.ts'],
    testTimeout: 10000, // Increase timeout for integration tests
    // Run test files sequentially to avoid database conflicts
    // Tests within a file still run in parallel unless fileParallelism is also disabled
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single fork to avoid parallel DB access
      },
    },
    // Ensure tests within files run sequentially for DB-dependent tests
    sequence: {
      shuffle: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Use TEST_DATABASE_URL for tests and set proper env flags
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!,
      NODE_ENV: 'test',
      VITEST: 'true',
    },
  },
});
