import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  workers: 1,
  use: {
    ...devices['iPhone 13'],
    defaultBrowserType: 'chromium',
    channel: 'chrome',
    baseURL: process.env.ARRIVE_TEST_URL || 'http://127.0.0.1:8093',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: 'list',
  timeout: 30000,
});
