import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from '../helpers/auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await page.waitForLoadState('networkidle');
  });

  test('loads admin dashboard with KPI cards', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin/);
    const statCards = page.locator('[class*="rounded"]').filter({
      hasText: /employee|cycle|review|completion/i,
    });
    await expect(statCards.first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows Quick Management section', async ({ page }) => {
    await expect(
      page.locator('h3, h2').filter({ hasText: /quick management/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Manage Employees quick action exists', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /manage employees/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Manage Employees navigates to employees page', async ({ page }) => {
    await page.getByRole('button', { name: /manage employees/i }).click();
    await page.waitForURL('**/admin/employees**');
    await expect(page).toHaveURL(/\/admin\/employees/);
  });

  test('clicking Start New Cycle navigates to new cycle page', async ({ page }) => {
    await page.getByRole('button', { name: /start new cycle/i }).click();
    await page.waitForURL('**/admin/review-cycles/new**');
    await expect(page).toHaveURL(/\/admin\/review-cycles\/new/);
  });

  test('clicking Edit Questions navigates to questions page', async ({ page }) => {
    await page.getByRole('button', { name: /edit questions/i }).click();
    await page.waitForURL('**/admin/questions**');
    await expect(page).toHaveURL(/\/admin\/questions/);
  });
});
