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
    // Page title
    await expect(
      page.locator('h1, h2').filter({ hasText: /review cycle/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('New Cycle button is present', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /new cycle|create cycle/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking New Cycle opens the creation form', async ({ page }) => {
    await page.getByRole('button', { name: /new cycle|create cycle/i }).click();
    await page.waitForURL('**/admin/review-cycles/new**', { timeout: 5_000 }).catch(() => {
      // Some impls open inline — check for a form
    });
    // Either navigated to /new or a form appeared
    const hasForm = await page.locator('form').isVisible();
    const isNewUrl = page.url().includes('/new');
    expect(hasForm || isNewUrl).toBe(true);
  });

  test('existing cycles show status badges', async ({ page }) => {
    // If there are cycles, they should show a status badge (ACTIVE, DRAFT, COMPLETED)
    const hasCycles = await page.locator('table tbody tr, [data-testid="cycle-item"]').count();
    if (hasCycles > 0) {
      await expect(
        page.locator('text=/active|draft|completed/i').first(),
      ).toBeVisible();
    }
  });
});
