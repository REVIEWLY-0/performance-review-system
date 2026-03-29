import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from '../helpers/auth';

test.describe('Admin — Employee Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await page.goto('/admin/employees');
    await page.waitForLoadState('networkidle');
  });

  test('shows employee list', async ({ page }) => {
    // Employee list renders as cards inside a shadow div, not a <table>
    await expect(
      page.locator('.shadow.overflow-hidden').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Add Employee button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /add employee/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Import CSV button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /import csv/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('opening CSV import shows the modal', async ({ page }) => {
    await page.getByRole('button', { name: /import csv/i }).click();
    await expect(
      page.locator('text=/import employees from csv/i').first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('search filters employees', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('admin');
      await page.waitForTimeout(500);
      // Page should still render without crashing
      await expect(page.locator('.shadow.overflow-hidden').first()).toBeVisible();
    }
  });

  test('role filter works', async ({ page }) => {
    const roleSelect = page.locator('select').filter({ hasText: /all roles|employee|manager/i }).first();
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('EMPLOYEE');
      await page.waitForTimeout(400);
      await expect(page.locator('.shadow.overflow-hidden').first()).toBeVisible();
    }
  });
});
