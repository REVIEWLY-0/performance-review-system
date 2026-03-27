import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from '../helpers/auth';

test.describe('Admin — Review Cycles', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await page.goto('/admin/review-cycles');
    await page.waitForLoadState('networkidle');
  });

  test('shows review cycles page', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/review-cycles/);
    await expect(
      page.locator('h1').filter({ hasText: /review cycles/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('New Review Cycle link is present', async ({ page }) => {
    // It's a <Link> (renders as <a>), not a <button>
    // Page has two matching links (header + sidebar card) — check first one
    await expect(
      page.getByRole('link', { name: /new review cycle/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking New Review Cycle navigates to creation page', async ({ page }) => {
    await page.getByRole('link', { name: /new review cycle/i }).first().click();
    await page.waitForURL('**/admin/review-cycles/new**');
    await expect(page).toHaveURL(/\/admin\/review-cycles\/new/);
  });

  test('existing cycles show status badges', async ({ page }) => {
    const cycleRows = page.locator('table tbody tr, li[class*="bg-surface"]');
    const count = await cycleRows.count();
    if (count > 0) {
      await expect(
        page.locator('text=/active|draft|completed/i').first(),
      ).toBeVisible();
    }
  });
});
