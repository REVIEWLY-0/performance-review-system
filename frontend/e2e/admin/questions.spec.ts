import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from '../helpers/auth';

test.describe('Admin — Question Builder', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await page.goto('/admin/questions');
    await page.waitForLoadState('networkidle');
  });

  test('shows question builder with tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /self review/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /manager review/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /peer review/i })).toBeVisible();
  });

  test('shows rating scale callout with configure link', async ({ page }) => {
    // The amber callout showing current scale should be present
    await expect(page.locator('text=/rating.*scale|scale.*rating/i').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('link', { name: /configure rating scale/i })).toBeVisible();
  });

  test('New Question button opens the form', async ({ page }) => {
    await page.getByRole('button', { name: /new question/i }).click();
    await expect(page.locator('form')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('textarea#text, textarea[id="text"]')).toBeVisible();
  });

  test('switching tabs resets preview', async ({ page }) => {
    // Click Show Preview
    const previewBtn = page.getByRole('button', { name: /show preview/i });
    if (await previewBtn.isVisible()) {
      await previewBtn.click();
      // Switch to Manager tab — preview should hide
      await page.getByRole('button', { name: /manager review/i }).click();
      // Preview button should be back to "Show Preview"
      await expect(page.getByRole('button', { name: /show preview/i })).toBeVisible({
        timeout: 3_000,
      });
    }
  });

  test('can switch between review type tabs', async ({ page }) => {
    await page.getByRole('button', { name: /manager review/i }).click();
    // Active tab styling — just ensure the tab is clickable and no crash
    await expect(page.getByRole('button', { name: /manager review/i })).toBeVisible();

    await page.getByRole('button', { name: /peer review/i }).click();
    await expect(page.getByRole('button', { name: /peer review/i })).toBeVisible();
  });
});
