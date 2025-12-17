import { test, expect } from '../../fixtures/auth.fixture'
import { FiltersHelper } from '../helpers/filters.helper'

test.describe('Resource Graph - Reset Filters', () => {
  let filters: FiltersHelper

  test.beforeEach(async ({ page }) => {
    filters = new FiltersHelper(page)
    await filters.clearFiltersStorage()
    await filters.goto()
  })

  // ===========================================================================
  // Reset All
  // ===========================================================================

  test('reset all button clears all filters', async ({ page }) => {
    // Apply multiple filters
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

    // Select tags
    const tagIds = await filters.getAllTagIds()
    if (tagIds.length > 0) {
      await filters.toggleTag(tagIds[0])
    }

    // Reset all
    await filters.resetAllFilters()

    // Verify all cleared
    await filters.expectFilterCleared('MANAGER')
    await filters.expectFilterCleared('PROJECT')
    await filters.expectFilterCleared('SUBDIVISION')
    await filters.expectFilterCleared('DEPARTMENT')

    // Tags should be deselected
    if (tagIds.length > 0) {
      expect(await filters.isTagSelected(tagIds[0])).toBe(false)
    }
  })

  // ===========================================================================
  // Reset Project Filters
  // ===========================================================================

  test('reset project filters clears only project hierarchy', async ({ page }) => {
    // Apply project filters
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    await page.waitForTimeout(1000)
    const projectSelect = page.locator('[data-testid="filter-project"]')
    const firstProject = await projectSelect.locator('option').nth(1).getAttribute('value')
    if (firstProject) {
      await filters.selectFilter('PROJECT', firstProject)
    }

    // Apply org filter
    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
    }

    // Reset project filters
    await filters.resetProjectFilters()

    // Project filters should be cleared
    await filters.expectFilterCleared('MANAGER')
    await filters.expectFilterCleared('PROJECT')

    // Org filter should remain
    if (firstSubdiv) {
      await filters.expectFilterValue('SUBDIVISION', firstSubdiv)
    }
  })

  // ===========================================================================
  // Reset Org Filters
  // ===========================================================================

  test('reset org filters clears only organizational hierarchy', async ({ page }) => {
    // Apply project filter
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    // Apply org filters
    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
      await page.waitForTimeout(1000)

      const deptSelect = page.locator('[data-testid="filter-department"]')
      const firstDept = await deptSelect.locator('option').nth(1).getAttribute('value')
      if (firstDept) {
        await filters.selectFilter('DEPARTMENT', firstDept)
      }
    }

    // Reset org filters
    await filters.resetOrgFilters()

    // Org filters should be cleared
    await filters.expectFilterCleared('SUBDIVISION')
    await filters.expectFilterCleared('DEPARTMENT')
    await filters.expectFilterCleared('TEAM')
    await filters.expectFilterCleared('EMPLOYEE')

    // Project filter should remain
    if (firstManager) {
      await filters.expectFilterValue('MANAGER', firstManager)
    }
  })

  // ===========================================================================
  // Sequential Resets
  // ===========================================================================

  test('sequential resets work correctly', async ({ page }) => {
    // Apply all types of filters
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

    // Reset project
    await filters.resetProjectFilters()
    await filters.expectFilterCleared('MANAGER')
    if (firstSubdiv) await filters.expectFilterValue('SUBDIVISION', firstSubdiv)

    // Reset org
    await filters.resetOrgFilters()
    await filters.expectFilterCleared('SUBDIVISION')

    // Re-apply filters
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
      await filters.expectFilterValue('MANAGER', firstManager)
    }

    // Final reset all
    await filters.resetAllFilters()
    await filters.expectFilterCleared('MANAGER')
  })

  // ===========================================================================
  // Reset on Empty Filters
  // ===========================================================================

  test('reset with no active filters is no-op', async ({ page }) => {
    // Verify all filters are initially empty
    await filters.expectFilterCleared('MANAGER')
    await filters.expectFilterCleared('PROJECT')
    await filters.expectFilterCleared('SUBDIVISION')
    await filters.expectFilterCleared('DEPARTMENT')

    // Click reset buttons - should not cause errors
    // Note: buttons might not be visible when no filters are active
    const resetAllButton = page.locator('[data-testid="reset-all-filters"]')
    if (await resetAllButton.isVisible()) {
      await resetAllButton.click()
    }

    // Page should remain stable
    await filters.expectNoConsoleErrors()
  })
})
