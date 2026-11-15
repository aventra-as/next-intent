import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1280, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run demo:start',
    url: 'http://127.0.0.1:3100' + (process.env.DEMO_BASE_PATH || ''),
    reuseExistingServer: !process.env.CI,
  },
});
