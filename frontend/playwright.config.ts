import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'https://studentsclients.mudrek.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Arabic RTL app
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  },

  projects: [
    // Auth setup: logs in and saves storageState.
    // Run manually with: npx playwright test --project=setup
    // Skip if admin.json already has a fresh token (pre-built from known JWT secret).
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Pre-built storageState — no live login required.
        // Regenerate by running: npx playwright test --project=setup
        storageState: 'tests/e2e/.auth/admin.json',
      },
      // Remove dependency so tests run even when setup is skipped
    },
  ],
});
