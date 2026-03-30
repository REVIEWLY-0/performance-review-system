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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
// Must match the storageKey in frontend/lib/supabase.ts
const STORAGE_KEY = 'supabase.auth.token';

/**
 * Log in as a specific user by calling the backend API directly from Node.js
 * (not from the browser), then injecting the session into localStorage.
 *
 * This avoids hitting Supabase's browser-side rate limits that occur when
 * `supabase.auth.signInWithPassword` is called in the browser for every test.
 * The session is stored under the same key that the app reads (STORAGE_KEY),
 * so the app treats the user as authenticated without any extra network calls.
 */
export async function loginAs(page: Page, user: TestUser) {
  // 1. Get a valid session from the backend (Node.js fetch — no browser rate limits)
  const res = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`loginAs: backend sign-in failed for ${user.email}: ${err.message || res.status}`);
  }
  const { session } = await res.json();
  if (!session?.access_token) {
    throw new Error(`loginAs: no session returned for ${user.email}`);
  }

  // 2. Navigate to establish the domain context for localStorage writes
  await page.goto('/login');

  // 3. Inject the session directly into localStorage (bypasses Supabase SDK lock)
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: session },
  );

  // 4. Navigate to the dashboard — the app reads localStorage and considers the user logged in
  await page.goto(user.dashboardPath);
  await page.waitForURL(`**${user.dashboardPath}**`, { timeout: 15_000 });
}

/**
 * Log out from any dashboard page.
 */
export async function logout(page: Page) {
  const signOutBtn = page.getByRole('button', { name: /sign out/i });
  await signOutBtn.click();
  await page.waitForURL('**/login', { timeout: 10_000 });
}
