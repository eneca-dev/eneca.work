import { test, expect } from '../../fixtures/auth.fixture'
import { FiltersHelper } from '../helpers/filters.helper'

test.describe('Resource Graph - LocalStorage Persistence', () => {
  let filters: FiltersHelper

  test.beforeEach(async ({ page }) => {
    filters = new FiltersHelper(page)
    await filters.clearFiltersStorage()
  })

  // ===========================================================================
  // Persistence on Page Reload
  // ===========================================================================

  test('filters persist after page reload', async ({ page }) => {
    await filters.goto()

    // Apply filters
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
    }

    // Select a tag
    const tagIds = await filters.getAllTagIds()
    if (tagIds.length > 0) {
      await filters.toggleTag(tagIds[0])
    }

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify filters are restored
    if (firstManager) {
      await filters.expectFilterValue('MANAGER', firstManager)
    }
    if (firstSubdiv) {
      await filters.expectFilterValue('SUBDIVISION', firstSubdiv)
    }
    if (tagIds.length > 0) {
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)
    }
  })

  // ===========================================================================
  // Restoration After Tab Close/Reopen
  // ===========================================================================

  test('filters restore after navigation away and back', async ({ page }) => {
    await filters.goto()

    // Apply filters
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
    }

    // Navigate away
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Navigate back
    await filters.goto()

    // Verify filters are restored
    if (firstManager) {
      await filters.expectFilterValue('MANAGER', firstManager)
    }
    if (firstSubdiv) {
      await filters.expectFilterValue('SUBDIVISION', firstSubdiv)
    }
  })

  // ===========================================================================
  // LocalStorage Clear on Reset
  // ===========================================================================

  test('localStorage clears when filters are reset', async ({ page }) => {
    await filters.goto()

    // Apply filters
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    // Verify saved to localStorage
    await filters.expectFilterInStorage('managerId', firstManager!)

    // Reset all filters
    await filters.resetAllFilters()

    // Verify localStorage is cleared
    const storage = await filters.getFiltersFromStorage()
    if (storage) {
      const state = storage as { state?: { filters?: Record<string, unknown> } }
      // Either storage is null or managerId is cleared
      expect(state.state?.filters?.managerId).toBeUndefined()
    }

    // Reload and verify filters are not restored
    await page.reload()
    await page.waitForLoadState('networkidle')

    await filters.expectFilterCleared('MANAGER')
  })
})
