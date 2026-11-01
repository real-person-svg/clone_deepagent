import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:14317',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
  },
  webServer: {
    command: `"${process.execPath}" --import tsx scripts/serve-test.ts`,
    url: 'http://127.0.0.1:14317/api/health',
    reuseExistingServer: false,
  },
});
