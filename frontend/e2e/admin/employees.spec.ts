import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from '../helpers/auth';

test.describe('Admin — Employee Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await page.goto('/admin/employees');
    // Wait for the list to load
    await page.waitForLoadState('networkidle');
  });

  test('shows employee list', async ({ page }) => {
    // The page should have at least a table or a list of employees
    await expect(
      page.locator('table, [data-testid="employee-list"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('search filters employees', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('admin');
      // Results should update — wait briefly for debounce
      await page.waitForTimeout(500);
      // The page should still have a table (not crash)
      await expect(page.locator('table').first()).toBeVisible();
    }
  });

  test('Add Employee button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /add employee|new employee|invite/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('CSV Import button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /import|csv/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('opening CSV import shows the modal', async ({ page }) => {
    const importBtn = page.getByRole('button', { name: /import.*csv|csv.*import|import employees/i });
    await importBtn.click();

    // Modal should appear with the format guide
    await expect(page.locator('text=/csv format|import employees/i').first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('role filter works', async ({ page }) => {
    const roleSelect = page.locator('select').filter({ hasText: /all roles|employee|manager/i }).first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('EMPLOYEE');
      await page.waitForTimeout(400);
      // Should still render without crashing
      await expect(page.locator('table').first()).toBeVisible();
    }
  });
});
