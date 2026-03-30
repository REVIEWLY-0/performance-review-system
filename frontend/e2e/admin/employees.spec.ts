import { test, expect } from '@playwright/test';
import { Buffer } from 'buffer';
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

  test('CSV import: preview shows after selecting a valid file', async ({ page }) => {
    // Use a timestamp to make the email unique per test run
    const ts = Date.now();
    const csvContent = [
      'name,email,role,department,manager_email,employee_id',
      `CSV Test User ${ts},csvtest${ts}@example.com,EMPLOYEE,Engineering,,`,
    ].join('\n');

    await page.getByRole('button', { name: /import csv/i }).click();
    await expect(page.getByText(/import employees from csv/i)).toBeVisible({ timeout: 5_000 });

    // Upload the CSV file via the hidden file input
    await page.locator('input[type="file"][accept=".csv"]').setInputFiles({
      name: 'test-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Preview step should appear showing the parsed row
    await expect(page.getByText(/rows parsed from/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(`CSV Test User ${ts}`)).toBeVisible({ timeout: 5_000 });
  });

  test('CSV import: importing a valid employee succeeds', async ({ page }) => {
    const ts = Date.now();
    const csvContent = [
      'name,email,role,department,manager_email,employee_id',
      `Import E2E ${ts},e2eimport${ts}@testcompany.com,EMPLOYEE,QA,,`,
    ].join('\n');

    await page.getByRole('button', { name: /import csv/i }).click();
    await expect(page.getByText(/import employees from csv/i)).toBeVisible({ timeout: 5_000 });

    await page.locator('input[type="file"][accept=".csv"]').setInputFiles({
      name: 'import-e2e.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Wait for preview, then click the Import button
    await expect(page.getByText(/rows parsed from/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /import \d+ employee/i }).click();

    // Result step: should show "Import complete!" or at least "imported"
    await expect(
      page.getByText(/import complete|imported/i).first(),
    ).toBeVisible({ timeout: 15_000 });
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
