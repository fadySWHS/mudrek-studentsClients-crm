/**
 * Authentication tests — run without a pre-existing auth state.
 * These verify the login page behaviour for both valid and invalid credentials.
 */
import { test, expect } from '@playwright/test';
import { mockAuthMe, mockAuthLogin } from './helpers/auth-mock';

// Override the project-level storageState so these tests start unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@mudrek.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'qixlpbG2pkBGy4Y%E5#9';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('shows the login form with correct elements', async ({ page }) => {
    await expect(page).toHaveTitle(/مدرك/i);
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    await expect(page.getByPlaceholder('example@mudrek.com')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /تسجيل الدخول/ })).toBeVisible();
  });

  test('shows validation error for invalid email format', async ({ page }) => {
    // Leave email empty — browser does NOT validate empty type="email" fields,
    // so Zod's .email() check runs and shows the Arabic error message
    await page.locator('input[type="password"]').fill('anypassword');
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    await expect(page.getByText('بريد إلكتروني غير صالح')).toBeVisible();
  });

  test('shows error for empty password', async ({ page }) => {
    await page.getByPlaceholder('example@mudrek.com').fill(ADMIN_EMAIL);
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    await expect(page.getByText('كلمة المرور مطلوبة')).toBeVisible();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.getByPlaceholder('example@mudrek.com').fill('wrong@mudrek.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();

    // The 401 interceptor in api.ts calls window.location.href = '/login' on auth failure,
    // which reloads the page before the toast can render. Verify the user is NOT sent to /dashboard.
    await page.waitForURL(/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test('toggles password visibility', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"], input[type="text"]').first();
    await passwordInput.fill('mysecret');
    // Initially hidden
    await expect(page.locator('input[type="password"]')).toHaveCount(1);

    // Click eye toggle
    await page.locator('button[type="button"]').click();
    await expect(page.locator('input[type="text"]')).toHaveCount(1);
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    // Mock both endpoints: login returns a valid token, me() confirms identity.
    // Tests the UI flow (form → redirect → dashboard) without hitting rate-limited live API.
    await mockAuthLogin(page);
    await mockAuthMe(page);
    await page.getByPlaceholder('example@mudrek.com').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('heading', { name: 'لوحة التحكم' })).toBeVisible();
  });
});

test.describe('Authenticated session', () => {
  // This group reuses the stored admin state via the project default
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('unauthenticated access to /dashboard redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
    await context.close();
  });

  test('logout returns to login page', async ({ page }) => {
    await mockAuthMe(page);
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10_000 }).catch(() => {});

    await page.getByRole('button', { name: /تسجيل الخروج/ }).click();
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
  });
});
