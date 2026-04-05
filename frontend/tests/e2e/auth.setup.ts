/**
 * Auth setup — runs once before all tests.
 * Logs in as admin and saves browser storage state so other test files
 * start already authenticated.
 *
 * Credentials come from environment variables:
 *   TEST_ADMIN_EMAIL    (default: admin@mudrek.com)
 *   TEST_ADMIN_PASSWORD (default: change-me)
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/admin.json');

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@mudrek.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'qixlpbG2pkBGy4Y%E5#9';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  // Fill login form
  await page.getByPlaceholder('example@mudrek.com').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click();

  // Wait for successful redirect to /dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page).toHaveURL(/dashboard/);

  // Persist cookies + localStorage
  await page.context().storageState({ path: authFile });
});
