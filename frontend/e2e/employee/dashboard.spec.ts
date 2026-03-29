import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from '../helpers/auth';

test.describe('Employee Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.employee);
    await page.waitForLoadState('networkidle');
  });

  test('reaches employee dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/employee/);
  });

  test('shows dashboard heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2').filter({ hasText: /dashboard|welcome|review/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('nav is visible with sign out button', async ({ page }) => {
    await expect(page.locator('nav').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('employee cannot access admin routes', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(3_000);
    // Should be redirected away from /admin
    expect(page.url()).not.toMatch(/\/admin$/);
  });
});
