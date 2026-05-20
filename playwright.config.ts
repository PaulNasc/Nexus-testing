import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
    headless: true,
    baseURL: 'http://localhost:5173',
  },
  projects: [
    {
      name: 'msedge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge'
      },
    },
  ],
  webServer: {
    command: 'npm run dev:all',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
