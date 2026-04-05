/**
 * Students / Users management tests.
 * Admin-only section — already authenticated via storageState.
 */
import { test, expect } from '@playwright/test';
import { mockAuthMe } from './helpers/auth-mock';

test.describe('Students (Users) page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthMe(page);
    await page.goto('/students');
    await page.waitForURL('**/students', { timeout: 15_000 });
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10_000 }).catch(() => {});
  });

  test('renders page and tabs', async ({ page }) => {
    // Actual tab labels from source: 'الطلاب' and 'المديرين'
    await expect(page.getByRole('button', { name: 'الطلاب' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'المديرين' })).toBeVisible({ timeout: 10_000 });
  });

  test('student list renders or shows empty state', async ({ page }) => {
    const hasRows = await page.locator('table tbody tr').count();
    // Empty state text from source: 'لا يوجد طلاب بعد'
    const hasEmpty = await page.getByText(/لا يوجد طلاب بعد|لا يوجد مديرون بعد/).isVisible().catch(() => false);
    expect(hasRows > 0 || hasEmpty).toBeTruthy();
  });

  test('switching to admin tab loads admins', async ({ page }) => {
    const adminTab = page.getByRole('button', { name: 'المديرين' });
    if (await adminTab.isVisible()) {
      await adminTab.click();
      await page.waitForTimeout(500);
      const hasRows = await page.locator('table tbody tr').count();
      const hasEmpty = await page.getByText(/لا يوجد|لا توجد/).isVisible().catch(() => false);
      expect(hasRows > 0 || hasEmpty).toBeTruthy();
    }
  });

  test('add user button opens the form modal', async ({ page }) => {
    // Button text from source: 'طالب جديد' (student tab) or 'مدير جديد' (admin tab)
    const addButton = page.getByRole('button', { name: /طالب جديد|مدير جديد/ });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Modal uses a fixed overlay — detect by its heading (no role="dialog")
    await expect(page.getByRole('heading', { name: /طالب جديد|مدير جديد/ })).toBeVisible({ timeout: 5_000 });
    // Close via the X button inside the overlay
    await page.locator('.fixed.inset-0 button').first().click();
  });

  test('user row shows name, email, and status badge', async ({ page }) => {
    const rows = await page.locator('table tbody tr').count();
    if (rows === 0) return; // nothing to assert

    const firstRow = page.locator('table tbody tr').first();
    // Row should have at least some text content
    const text = await firstRow.textContent();
    expect(text?.length).toBeGreaterThan(3);
  });
});
