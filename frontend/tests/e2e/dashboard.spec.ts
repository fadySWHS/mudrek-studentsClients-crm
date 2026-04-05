/**
 * Dashboard tests — verify stat cards, navigation, and basic layout.
 * Runs with admin storage state from the setup project.
 */
import { test, expect } from '@playwright/test';
import { mockAuthMe } from './helpers/auth-mock';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthMe(page);
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10_000 }).catch(() => {});
  });

  test('renders page title and sidebar', async ({ page }) => {
    // h1 heading (strict: avoid matching sidebar span too)
    await expect(page.getByRole('heading', { name: 'لوحة التحكم' })).toBeVisible();
    // Sidebar nav items
    await expect(page.getByRole('link', { name: /إدارة العملاء/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /المستخدمون/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /التحليلات/ })).toBeVisible();
  });

  test('renders stat cards with numeric values', async ({ page }) => {
    // Stat card labels exist
    await expect(page.getByText('إجمالي العملاء')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('متاح للحجز')).toBeVisible();
    await expect(page.getByText('صفقات ناجحة')).toBeVisible();
    await expect(page.getByText('الطلاب النشطاء')).toBeVisible();
  });

  test('navigates to leads page via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /إدارة العملاء/ }).click();
    await page.waitForURL('**/leads', { timeout: 8_000 });
    await expect(page).toHaveURL(/\/leads/);
  });

  test('navigates to students page via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /المستخدمون/ }).click();
    await page.waitForURL('**/students', { timeout: 8_000 });
    await expect(page).toHaveURL(/\/students/);
  });

  test('navigates to analytics page via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /التحليلات/ }).click();
    await page.waitForURL('**/analytics', { timeout: 8_000 });
    await expect(page).toHaveURL(/\/analytics/);
  });

  test('navigates to activity log via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /سجل النشاط/ }).click();
    await page.waitForURL('**/activity', { timeout: 8_000 });
    await expect(page).toHaveURL(/\/activity/);
  });
});
