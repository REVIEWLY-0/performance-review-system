import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test configuration.
 *
 * Prerequisites before running:
 *   1. Backend running: cd backend && npm run start:dev   (port 4000)
 *   2. Frontend running: cd frontend && npm run dev       (port 3000)
 *   3. Create a .env.test file (see .env.test.example) with test credentials.
 *
 * Run:
 *   npm run test:e2e          # headless
 *   npm run test:e2e:ui       # interactive UI
 *   npm run test:e2e:debug    # headed + slow-mo
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Sequential — tests share DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Give pages generous time — the app does several async fetches on load
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Do NOT auto-start dev server — assumes both servers are already running.
  // See README for setup instructions.
});
