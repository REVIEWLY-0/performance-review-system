import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from '../helpers/auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
  });

  test('loads admin dashboard with KPI cards', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin/);

    // At least one of the KPI stat cards should be visible
    const statCards = page.locator('[class*="rounded"]').filter({
      hasText: /employee|cycle|review|completion/i,
    });
    await expect(statCards.first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows quick action buttons', async ({ page }) => {
    // Quick Actions section contains navigation buttons
    await expect(
      page.getByRole('link', { name: /manage employees/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to employees page', async ({ page }) => {
    await page.getByRole('link', { name: /manage employees/i }).click();
    await page.waitForURL('**/admin/employees**');
    await expect(page).toHaveURL(/\/admin\/employees/);
  });

  test('navigates to review cycles page', async ({ page }) => {
    await page.getByRole('link', { name: /review cycles/i }).click();
    await page.waitForURL('**/admin/review-cycles**');
    await expect(page).toHaveURL(/\/admin\/review-cycles/);
  });

  test('navigates to question builder', async ({ page }) => {
    await page.getByRole('link', { name: /question/i }).click();
    await page.waitForURL('**/admin/questions**');
    await expect(page).toHaveURL(/\/admin\/questions/);
  });
});
