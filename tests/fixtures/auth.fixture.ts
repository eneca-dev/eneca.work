import { test as base } from '@playwright/test'

/**
 * Custom test fixture with authenticated admin session
 */
export const test = base.extend({
  // Authenticated page fixture
  page: async ({ page }, use) => {
    // Page is already authenticated via storageState in playwright.config.ts
    await use(page)
  },
})

export { expect } from '@playwright/test'
export type { Page, Browser } from '@playwright/test'
