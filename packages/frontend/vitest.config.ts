import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx', 'src/**/*.property.ts', 'src/**/*.property.tsx', 'src/**/*.e2e.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Run tests sequentially to avoid DOM conflicts in property tests
    sequence: {
      concurrent: false,
    },
    // Increase timeout for property-based tests
    testTimeout: 30000,
  },
});
