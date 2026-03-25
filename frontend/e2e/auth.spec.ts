import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from './helpers/auth';

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle(/reviewly/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Error message should appear — don't assert the exact text since it comes from Supabase
    await expect(
      page.locator('text=/invalid|incorrect|error|credentials/i').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('admin can log in and reaches admin dashboard', async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await expect(page).toHaveURL(/\/admin/);
    // Nav should be visible
    await expect(page.locator('nav')).toBeVisible();
  });

  test('admin can log out', async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('after logout, protected route redirects to login', async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await logout(page);
    await page.goto('/admin');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
