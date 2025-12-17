import { test, expect } from '../../fixtures/auth.fixture'
import { FiltersHelper } from '../helpers/filters.helper'

test.describe('Resource Graph - Combined Filters', () => {
  let filters: FiltersHelper

  test.beforeEach(async ({ page }) => {
    filters = new FiltersHelper(page)
    await filters.clearFiltersStorage()
    await filters.goto()
  })

  // ===========================================================================
  // Combination Tests
  // ===========================================================================

  test('project + org filters work together', async ({ page }) => {
    // Select manager
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    // Select subdivision
    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
    }

    // Verify both are applied
    if (firstManager) await filters.expectFilterValue('MANAGER', firstManager)
    if (firstSubdiv) await filters.expectFilterValue('SUBDIVISION', firstSubdiv)
  })

  test('tags + project filters work together', async ({ page }) => {
    // Select manager
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    // Select tags
    const tagIds = await filters.getAllTagIds()
    if (tagIds.length > 0) {
      await filters.toggleTag(tagIds[0])
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)
    }

    // Verify both are applied
    if (firstManager) await filters.expectFilterValue('MANAGER', firstManager)
  })

  test('tags + org filters work together', async ({ page }) => {
    // Select subdivision
    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
    }

    // Select tags
    const tagIds = await filters.getAllTagIds()
    if (tagIds.length > 0) {
      await filters.toggleTag(tagIds[0])
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)
    }

    // Verify both are applied
    if (firstSubdiv) await filters.expectFilterValue('SUBDIVISION', firstSubdiv)
  })

  test('all filters simultaneously', async ({ page }) => {
    // Select manager
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    // Select project
    await page.waitForTimeout(1000)
    const projectSelect = page.locator('[data-testid="filter-project"]')
    const firstProject = await projectSelect.locator('option').nth(1).getAttribute('value')
    if (firstProject) {
      await filters.selectFilter('PROJECT', firstProject)
    }

    // Select subdivision
    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
    }

    // Select department
    await page.waitForTimeout(1000)
    const deptSelect = page.locator('[data-testid="filter-department"]')
    const firstDept = await deptSelect.locator('option').nth(1).getAttribute('value')
    if (firstDept) {
      await filters.selectFilter('DEPARTMENT', firstDept)
    }

    // Select tags
    const tagIds = await filters.getAllTagIds()
    if (tagIds.length > 0) {
      await filters.toggleTag(tagIds[0])
    }

    // Verify all are applied
    if (firstManager) await filters.expectFilterValue('MANAGER', firstManager)
    if (firstProject) await filters.expectFilterValue('PROJECT', firstProject)
    if (firstSubdiv) await filters.expectFilterValue('SUBDIVISION', firstSubdiv)
    if (firstDept) await filters.expectFilterValue('DEPARTMENT', firstDept)
  })

  // ===========================================================================
  // Switching Tests
  // ===========================================================================

  test('switching between managers', async ({ page }) => {
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const options = await managerSelect.locator('option').all()

    if (options.length > 2) {
      // Select first
      const first = await options[1].getAttribute('value')
      if (first) {
        await filters.selectFilter('MANAGER', first)
        await filters.expectFilterValue('MANAGER', first)
      }

      // Switch to second
      const second = await options[2].getAttribute('value')
      if (second) {
        await filters.selectFilter('MANAGER', second)
        await filters.expectFilterValue('MANAGER', second)
      }

      // Switch back to first
      if (first) {
        await filters.selectFilter('MANAGER', first)
        await filters.expectFilterValue('MANAGER', first)
      }
    }
  })

  test('switching between projects', async ({ page }) => {
    const projectSelect = page.locator('[data-testid="filter-project"]')
    const options = await projectSelect.locator('option').all()

    if (options.length > 2) {
      const first = await options[1].getAttribute('value')
      if (first) {
        await filters.selectFilter('PROJECT', first)
        await filters.expectFilterValue('PROJECT', first)
      }

      const second = await options[2].getAttribute('value')
      if (second) {
        await filters.selectFilter('PROJECT', second)
        await filters.expectFilterValue('PROJECT', second)
      }
    }
  })

  test('switching between employees in hierarchy', async ({ page }) => {
    // Build up hierarchy
    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
      await page.waitForTimeout(1000)

      const deptSelect = page.locator('[data-testid="filter-department"]')
      const firstDept = await deptSelect.locator('option').nth(1).getAttribute('value')
      if (firstDept) {
        await filters.selectFilter('DEPARTMENT', firstDept)
        await page.waitForTimeout(1000)

        const teamSelect = page.locator('[data-testid="filter-team"]')
        const firstTeam = await teamSelect.locator('option').nth(1).getAttribute('value')
        if (firstTeam) {
          await filters.selectFilter('TEAM', firstTeam)
          await page.waitForTimeout(1000)

          const empSelect = page.locator('[data-testid="filter-employee"]')
          const employees = await empSelect.locator('option').all()

          if (employees.length > 2) {
            const first = await employees[1].getAttribute('value')
            if (first) {
              await filters.selectFilter('EMPLOYEE', first)
              await filters.expectFilterValue('EMPLOYEE', first)
            }

            const second = await employees[2].getAttribute('value')
            if (second) {
              await filters.selectFilter('EMPLOYEE', second)
              await filters.expectFilterValue('EMPLOYEE', second)
            }
          }
        }
      }
    }
  })

  // ===========================================================================
  // Dynamic Changes
  // ===========================================================================

  test('adding/removing tags with active filters', async ({ page }) => {
    // Select a manager first
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    const tagIds = await filters.getAllTagIds()
    if (tagIds.length >= 2) {
      // Add first tag
      await filters.toggleTag(tagIds[0])
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)

      // Add second tag
      await filters.toggleTag(tagIds[1])
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)

      // Remove first tag
      await filters.toggleTag(tagIds[0])
      expect(await filters.isTagSelected(tagIds[0])).toBe(false)
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)

      // Manager should still be selected
      if (firstManager) await filters.expectFilterValue('MANAGER', firstManager)
    }
  })

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  test('empty filter result (no matches)', async ({ page }) => {
    // This test depends on data - we select filters that might not have matching data
    // The test verifies the UI handles empty results gracefully

    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    // Select all tags (unlikely to match everything)
    const tagIds = await filters.getAllTagIds()
    for (const tagId of tagIds) {
      await filters.toggleTag(tagId)
    }

    // Page should not crash, no console errors
    await filters.expectNoConsoleErrors()
  })
})
