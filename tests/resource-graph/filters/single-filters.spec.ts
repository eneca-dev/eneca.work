import { test, expect } from '../../fixtures/auth.fixture'
import { FiltersHelper } from '../helpers/filters.helper'

test.describe('Resource Graph - Single Filters', () => {
  let filters: FiltersHelper

  test.beforeEach(async ({ page }) => {
    filters = new FiltersHelper(page)
    await filters.goto()
    await filters.clearFiltersStorage()
  })

  // ===========================================================================
  // 2.1 Manager Filter (managerId)
  // ===========================================================================

  test('manager filter applies correctly', async ({ page }) => {
    // Get available options
    const options = await filters.getFilterOptions('MANAGER')
    expect(options.length).toBeGreaterThan(0)

    // Select first manager
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstOption = await managerSelect.locator('option').nth(1).getAttribute('value')

    if (firstOption) {
      await filters.selectFilter('MANAGER', firstOption)

      // Verify filter is applied
      await filters.expectFilterValue('MANAGER', firstOption)

      // Verify saved to localStorage
      await filters.expectFilterInStorage('managerId', firstOption)
    }
  })

  // ===========================================================================
  // 2.2 Project Filter (projectId)
  // ===========================================================================

  test('project filter applies independently', async ({ page }) => {
    const options = await filters.getFilterOptions('PROJECT')
    expect(options.length).toBeGreaterThan(0)

    const projectSelect = page.locator('[data-testid="filter-project"]')
    const firstOption = await projectSelect.locator('option').nth(1).getAttribute('value')

    if (firstOption) {
      await filters.selectFilter('PROJECT', firstOption)

      await filters.expectFilterValue('PROJECT', firstOption)
      await filters.expectFilterInStorage('projectId', firstOption)
    }
  })

  // ===========================================================================
  // 2.3 Subdivision Filter (subdivisionId)
  // ===========================================================================

  test('subdivision filter applies correctly', async ({ page }) => {
    const options = await filters.getFilterOptions('SUBDIVISION')
    expect(options.length).toBeGreaterThan(0)

    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstOption = await subdivisionSelect.locator('option').nth(1).getAttribute('value')

    if (firstOption) {
      await filters.selectFilter('SUBDIVISION', firstOption)

      await filters.expectFilterValue('SUBDIVISION', firstOption)
      await filters.expectFilterInStorage('subdivisionId', firstOption)
    }
  })

  // ===========================================================================
  // 2.4 Department Filter (departmentId)
  // ===========================================================================

  test('department filter applies correctly', async ({ page }) => {
    const options = await filters.getFilterOptions('DEPARTMENT')
    expect(options.length).toBeGreaterThan(0)

    const departmentSelect = page.locator('[data-testid="filter-department"]')
    const firstOption = await departmentSelect.locator('option').nth(1).getAttribute('value')

    if (firstOption) {
      await filters.selectFilter('DEPARTMENT', firstOption)

      await filters.expectFilterValue('DEPARTMENT', firstOption)
      await filters.expectFilterInStorage('departmentId', firstOption)
    }
  })

  // ===========================================================================
  // 2.5 Team Filter (teamId) - requires departmentId
  // ===========================================================================

  test('team filter requires department selection', async () => {
    // Initially team filter should be disabled
    await filters.expectFilterDisabled('TEAM')

    // Select a department first
    const departmentSelect = await filters.getFilterOptions('DEPARTMENT')
    if (departmentSelect.length > 0) {
      const deptSelect = filters['page'].locator('[data-testid="filter-department"]')
      const firstDept = await deptSelect.locator('option').nth(1).getAttribute('value')

      if (firstDept) {
        await filters.selectFilter('DEPARTMENT', firstDept)

        // Now team filter should be enabled
        await filters.expectFilterEnabled('TEAM')
      }
    }
  })

  test('team filter applies after department selection', async ({ page }) => {
    // Select department first
    const deptSelect = page.locator('[data-testid="filter-department"]')
    const firstDept = await deptSelect.locator('option').nth(1).getAttribute('value')

    if (firstDept) {
      await filters.selectFilter('DEPARTMENT', firstDept)

      // Wait for teams to load
      await page.waitForTimeout(1000)

      const teamOptions = await filters.getFilterOptions('TEAM')
      if (teamOptions.length > 0) {
        const teamSelect = page.locator('[data-testid="filter-team"]')
        const firstTeam = await teamSelect.locator('option').nth(1).getAttribute('value')

        if (firstTeam) {
          await filters.selectFilter('TEAM', firstTeam)
          await filters.expectFilterValue('TEAM', firstTeam)
          await filters.expectFilterInStorage('teamId', firstTeam)
        }
      }
    }
  })

  // ===========================================================================
  // 2.6 Employee Filter (employeeId) - requires teamId
  // ===========================================================================

  test('employee filter requires team selection', async () => {
    // Initially employee filter should be disabled
    await filters.expectFilterDisabled('EMPLOYEE')
  })

  test('employee filter applies after team selection', async ({ page }) => {
    // Select department first
    const deptSelect = page.locator('[data-testid="filter-department"]')
    const firstDept = await deptSelect.locator('option').nth(1).getAttribute('value')

    if (firstDept) {
      await filters.selectFilter('DEPARTMENT', firstDept)
      await page.waitForTimeout(1000)

      // Select team
      const teamSelect = page.locator('[data-testid="filter-team"]')
      const firstTeam = await teamSelect.locator('option').nth(1).getAttribute('value')

      if (firstTeam) {
        await filters.selectFilter('TEAM', firstTeam)
        await page.waitForTimeout(1000)

        // Now employee should be enabled
        await filters.expectFilterEnabled('EMPLOYEE')

        const employeeOptions = await filters.getFilterOptions('EMPLOYEE')
        if (employeeOptions.length > 0) {
          const empSelect = page.locator('[data-testid="filter-employee"]')
          const firstEmp = await empSelect.locator('option').nth(1).getAttribute('value')

          if (firstEmp) {
            await filters.selectFilter('EMPLOYEE', firstEmp)
            await filters.expectFilterValue('EMPLOYEE', firstEmp)
            await filters.expectFilterInStorage('employeeId', firstEmp)
          }
        }
      }
    }
  })

  // ===========================================================================
  // 2.7 Tags Multi-select (tagIds)
  // ===========================================================================

  test('tags multi-select works correctly', async () => {
    const tagIds = await filters.getAllTagIds()
    expect(tagIds.length).toBeGreaterThan(0)

    // Select multiple tags
    if (tagIds.length >= 2) {
      await filters.toggleTag(tagIds[0])
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)

      await filters.toggleTag(tagIds[1])
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)

      // Verify both are selected
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)

      // Verify in localStorage
      await filters.expectFilterInStorage('tagIds', [tagIds[0], tagIds[1]])
    }
  })
})
