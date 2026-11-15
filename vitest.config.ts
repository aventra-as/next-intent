import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://example.com/' } },
    include: ['test/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});
