/**
 * Mocks the /api/auth/me endpoint for page-functionality tests.
 *
 * When Playwright tests run sequentially against the live site, multiple
 * GET /api/auth/me requests can trigger Cloudflare rate-limiting after ~15 calls.
 * By intercepting this one endpoint we skip the network round-trip while keeping
 * the rest of the app behaviour real (data APIs, navigation, etc.).
 */
import { Page } from '@playwright/test';

const ADMIN_USER = {
  id: 'cmnm5zrf00000ijo3z3eevrc9',
  name: 'Admin',
  email: 'admin@mudrek.com',
  role: 'ADMIN',
  active: true,
};

export async function mockAuthMe(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: ADMIN_USER }),
    })
  );
}

/**
 * Also mocks the login endpoint — use when the test validates the UI login
 * flow (form → redirect → dashboard) but not the actual credentials check.
 * Avoids Cloudflare rate-limiting on real login requests.
 */
export async function mockAuthLogin(page: Page) {
  const TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJ1c2VySWQiOiJjbW5tNXpyZjAwMDAwaWpvM3ozZWV2cmM5Iiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzc1NDE5Nzk1LCJleHAiOjE3NzYwMjQ1OTV9.' +
    'c7UNVFFlhdUS7hJcT2JGx9CQU_P9093cyjVmkz93cQ0';

  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        data: { token: TOKEN, user: ADMIN_USER },
      }),
    })
  );
}
