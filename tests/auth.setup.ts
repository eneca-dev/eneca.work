import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'tests/.auth/admin.json'
const LOGIN_ROUTE = '/auth/login'

/**
 * Authentication setup for admin user
 *
 * This runs once before all tests and saves the authenticated state
 * to be reused by all test files.
 *
 * Run this manually when:
 * - Session expires (usually after server restart)
 * - Credentials change
 * - First time setting up tests
 *
 * Command: npx playwright test --project=setup
 */
setup('authenticate as admin', async ({ page }) => {
  // Navigate to login page
  await page.goto(LOGIN_ROUTE, { waitUntil: 'load' })

  // Wait for DOM to be ready
  await page.waitForLoadState('domcontentloaded')

  // Additional wait for React hydration and rendering
  await page.waitForTimeout(5000)

  // Wait for login form to be visible
  // Using flexible selectors that work with any input type
  const emailInput = page.locator('input[type="email"], input[name="email"]').first()
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first()

  // Check if inputs are visible, if not - reload and try again
  const isVisible = await emailInput.isVisible().catch(() => false)

  if (!isVisible) {
    console.log('Inputs not found on first load, reloading page...')
    await page.reload({ waitUntil: 'load' })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(5000)
  }

  // Take a screenshot for debugging
  await page.screenshot({ path: 'tests/debug-login.png', fullPage: true })

  // Wait with longer timeout
  await expect(emailInput).toBeVisible({ timeout: 20000 })
  await expect(passwordInput).toBeVisible({ timeout: 20000 })

  // Fill in credentials from environment variables
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local\n' +
      'Example:\n' +
      'ADMIN_EMAIL=your_email@example.com\n' +
      'ADMIN_PASSWORD=your_password'
    )
  }

  console.log(`Logging in as: ${email}`)

  await emailInput.fill(email)
  await passwordInput.fill(password)

  // Submit form
  const submitButton = page.locator('button[type="submit"]')
  await submitButton.click()

  // Wait for redirect to dashboard (successful login)
  // Login process can be slow in dev mode, so we wait up to 2 minutes
  await page.waitForURL('**/dashboard**', { timeout: 120000 })

  // Verify we're logged in
  await expect(page).toHaveURL(/dashboard/)

  console.log('✓ Authentication successful, session saved to:', AUTH_FILE)

  // Save authentication state
  await page.context().storageState({ path: AUTH_FILE })
})
