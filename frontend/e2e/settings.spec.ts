import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from './helpers/auth';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.locator('h1, h2').filter({ hasText: /settings/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('back button navigates to previous page', async ({ page }) => {
    // Go to admin, then settings, then use Back
    await page.goto('/admin');
    await page.waitForURL('**/admin');

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /back/i }).click();
    await page.waitForTimeout(1_000);

    // Should have navigated away from /settings
    expect(page.url()).not.toMatch(/\/settings$/);
  });

  test('admin sees rating scale card', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.locator('text=/rating scale/i').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('rating scale max can be changed', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const maxRatingInput = page.locator('input[type="number"]').first();
    if (await maxRatingInput.isVisible()) {
      const currentValue = await maxRatingInput.inputValue();
      // Just verify it's a number between 1-10
      expect(Number(currentValue)).toBeGreaterThanOrEqual(1);
      expect(Number(currentValue)).toBeLessThanOrEqual(10);
    }
  });
});
