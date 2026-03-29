import { Page } from '@playwright/test';

export const TEST_USERS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'test-admin@company.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'password123',
    role: 'ADMIN' as const,
    dashboardPath: '/admin',
  },
  manager: {
    email: process.env.TEST_MANAGER_EMAIL || 'sarah.johnson@company.com',
    password: process.env.TEST_MANAGER_PASSWORD || 'password123',
    role: 'MANAGER' as const,
    dashboardPath: '/manager',
  },
  employee: {
    email: process.env.TEST_EMPLOYEE_EMAIL || 'john.smith@company.com',
    password: process.env.TEST_EMPLOYEE_PASSWORD || 'password123',
    role: 'EMPLOYEE' as const,
    dashboardPath: '/employee',
  },
};

export type TestUser = (typeof TEST_USERS)[keyof typeof TEST_USERS];

/**
 * Log in as a specific user and wait for the dashboard to load.
 */
export async function loginAs(page: Page, user: TestUser) {
  await page.goto('/login');

  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');

  // Wait for redirect to the correct dashboard
  await page.waitForURL(`**${user.dashboardPath}**`, { timeout: 20_000 });
}

/**
 * Log out from any dashboard page.
 */
export async function logout(page: Page) {
  const signOutBtn = page.getByRole('button', { name: /sign out/i });
  await signOutBtn.click();
  await page.waitForURL('**/login', { timeout: 10_000 });
}
