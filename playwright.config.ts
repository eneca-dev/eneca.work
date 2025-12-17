import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

/**
 * Playwright Configuration for E2E Tests
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './tests',

  // Run tests sequentially (not parallel) to avoid auth conflicts
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if test.only is left in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    // Use TEST_URL env var for remote testing (e.g., https://dev.eneca.work/)
    baseURL: process.env.TEST_URL || 'http://localhost:3000',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',

    // Viewport
    viewport: { width: 1920, height: 1080 },

    // Timeout for actions
    actionTimeout: 10000,

    // Timeout for navigation
    navigationTimeout: 30000,
  },

  // Global timeout for each test (3 minutes for slow login in dev mode)
  timeout: 180000,

  // Expect timeout
  expect: {
    timeout: 20000,
  },

  // Projects configuration
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Main tests with authenticated session
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use stored auth state
        storageState: 'tests/.auth/admin.json',
      },
      // No dependencies - run setup manually once, then run tests independently
    },
  ],

  // Run local server before tests (only if not testing remote server)
  // Use production build for faster and more stable tests
  webServer: process.env.TEST_URL ? undefined : {
    command: process.env.TEST_MODE === 'dev'
      ? 'npm run dev'
      : 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
