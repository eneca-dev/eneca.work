import { test, expect } from '@playwright/test'
import { ROUTES, SELECTORS } from './constants/selectors'

/**
 * Smoke Test - Basic page load verification
 */
test.describe('Resource Graph - Smoke Test', () => {
  test('should load resource graph page with filters', async ({ page }) => {
    // Navigate to resource graph page
    await page.goto(ROUTES.RESOURCE_GRAPH)

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded')

    // Additional wait for React hydration and rendering
    await page.waitForTimeout(5000)

    // Debug: take a screenshot to see what's on the page
    await page.screenshot({ path: 'tests/debug-resource-graph.png', fullPage: true })

    // Verify page URL
    await expect(page).toHaveURL(ROUTES.RESOURCE_GRAPH)

    // Try to find page heading first (less strict)
    const heading = page.getByRole('heading', { name: /график/i })
    await expect(heading).toBeVisible({ timeout: 30000 })

    // Now try filters container
    const filtersContainer = page.locator(SELECTORS.PAGE.FILTERS_CONTAINER)
    await expect(filtersContainer).toBeVisible({ timeout: 30000 })

    // Verify tags container is visible
    const tagsContainer = page.locator(SELECTORS.TAGS.CONTAINER)
    await expect(tagsContainer).toBeVisible()

    // Verify at least some filter selects are present
    const managerFilter = page.locator(SELECTORS.FILTERS.MANAGER)
    await expect(managerFilter).toBeVisible()

    const projectFilter = page.locator(SELECTORS.FILTERS.PROJECT)
    await expect(projectFilter).toBeVisible()
  })
})
