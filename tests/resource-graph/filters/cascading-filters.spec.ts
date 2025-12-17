import { test, expect } from '../../fixtures/auth.fixture'
import { FiltersHelper } from '../helpers/filters.helper'

test.describe('Resource Graph - Cascading Filters', () => {
  let filters: FiltersHelper

  test.beforeEach(async ({ page }) => {
    filters = new FiltersHelper(page)
    await filters.clearFiltersStorage()
    await filters.goto()
  })

  // ===========================================================================
  // 3.1 Cascading Clear - Project Filters
  // ===========================================================================

  test('changing manager clears project filter', async ({ page }) => {
    // Get managers
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const managers = await managerSelect.locator('option').allTextContents()

    if (managers.length > 2) {
      // Select first manager
      const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
      if (firstManager) {
        await filters.selectFilter('MANAGER', firstManager)
      }

      // Select a project
      await page.waitForTimeout(1000)
      const projectSelect = page.locator('[data-testid="filter-project"]')
      const firstProject = await projectSelect.locator('option').nth(1).getAttribute('value')
      if (firstProject) {
        await filters.selectFilter('PROJECT', firstProject)
        await filters.expectFilterValue('PROJECT', firstProject)
      }

      // Change manager
      const secondManager = await managerSelect.locator('option').nth(2).getAttribute('value')
      if (secondManager) {
        await filters.selectFilter('MANAGER', secondManager)

        // Project should be cleared
        await filters.expectFilterCleared('PROJECT')
      }
    }
  })

  // ===========================================================================
  // 3.1 Cascading Clear - Org Hierarchy
  // ===========================================================================

  test('changing subdivision clears department, team, employee', async ({ page }) => {
    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const subdivisions = await subdivisionSelect.locator('option').allTextContents()

    if (subdivisions.length > 2) {
      // Build up the hierarchy
      const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
      if (firstSubdiv) {
        await filters.selectFilter('SUBDIVISION', firstSubdiv)
        await page.waitForTimeout(1000)

        // Select department
        const deptSelect = page.locator('[data-testid="filter-department"]')
        const firstDept = await deptSelect.locator('option').nth(1).getAttribute('value')
        if (firstDept) {
          await filters.selectFilter('DEPARTMENT', firstDept)
          await page.waitForTimeout(1000)

          // Select team (if available)
          const teamSelect = page.locator('[data-testid="filter-team"]')
          const firstTeam = await teamSelect.locator('option').nth(1).getAttribute('value')
          if (firstTeam) {
            await filters.selectFilter('TEAM', firstTeam)

            // Now change subdivision
            const secondSubdiv = await subdivisionSelect.locator('option').nth(2).getAttribute('value')
            if (secondSubdiv) {
              await filters.selectFilter('SUBDIVISION', secondSubdiv)

              // All children should be cleared
              await filters.expectFilterCleared('DEPARTMENT')
              await filters.expectFilterCleared('TEAM')
              await filters.expectFilterCleared('EMPLOYEE')
            }
          }
        }
      }
    }
  })

  test('changing department clears team and employee', async ({ page }) => {
    // Select subdivision first
    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')

    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
      await page.waitForTimeout(1000)

      // Select first department
      const deptSelect = page.locator('[data-testid="filter-department"]')
      const departments = await deptSelect.locator('option').allTextContents()

      if (departments.length > 2) {
        const firstDept = await deptSelect.locator('option').nth(1).getAttribute('value')
        if (firstDept) {
          await filters.selectFilter('DEPARTMENT', firstDept)
          await page.waitForTimeout(1000)

          // Select team
          const teamSelect = page.locator('[data-testid="filter-team"]')
          const firstTeam = await teamSelect.locator('option').nth(1).getAttribute('value')
          if (firstTeam) {
            await filters.selectFilter('TEAM', firstTeam)

            // Change department
            const secondDept = await deptSelect.locator('option').nth(2).getAttribute('value')
            if (secondDept) {
              await filters.selectFilter('DEPARTMENT', secondDept)

              // Team and employee should be cleared
              await filters.expectFilterCleared('TEAM')
              await filters.expectFilterCleared('EMPLOYEE')
            }
          }
        }
      }
    }
  })

  test('changing team clears employee', async ({ page }) => {
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
        const teams = await teamSelect.locator('option').allTextContents()

        if (teams.length > 2) {
          const firstTeam = await teamSelect.locator('option').nth(1).getAttribute('value')
          if (firstTeam) {
            await filters.selectFilter('TEAM', firstTeam)
            await page.waitForTimeout(1000)

            // Select employee
            const empSelect = page.locator('[data-testid="filter-employee"]')
            const firstEmp = await empSelect.locator('option').nth(1).getAttribute('value')
            if (firstEmp) {
              await filters.selectFilter('EMPLOYEE', firstEmp)

              // Change team
              const secondTeam = await teamSelect.locator('option').nth(2).getAttribute('value')
              if (secondTeam) {
                await filters.selectFilter('TEAM', secondTeam)

                // Employee should be cleared
                await filters.expectFilterCleared('EMPLOYEE')
              }
            }
          }
        }
      }
    }
  })

  // ===========================================================================
  // 3.2 Disabled States
  // ===========================================================================

  test('team is disabled until department is selected', async ({ page }) => {
    // Initially disabled
    await filters.expectFilterDisabled('TEAM')

    // Select subdivision
    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
    }

    // Still disabled (need department)
    await filters.expectFilterDisabled('TEAM')

    // Select department
    await page.waitForTimeout(1000)
    const deptSelect = page.locator('[data-testid="filter-department"]')
    const firstDept = await deptSelect.locator('option').nth(1).getAttribute('value')
    if (firstDept) {
      await filters.selectFilter('DEPARTMENT', firstDept)

      // Now enabled
      await filters.expectFilterEnabled('TEAM')
    }
  })

  test('employee is disabled until team is selected', async ({ page }) => {
    // Initially disabled
    await filters.expectFilterDisabled('EMPLOYEE')

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

        // Still disabled (need team)
        await filters.expectFilterDisabled('EMPLOYEE')

        await page.waitForTimeout(1000)
        const teamSelect = page.locator('[data-testid="filter-team"]')
        const firstTeam = await teamSelect.locator('option').nth(1).getAttribute('value')
        if (firstTeam) {
          await filters.selectFilter('TEAM', firstTeam)

          // Now enabled
          await filters.expectFilterEnabled('EMPLOYEE')
        }
      }
    }
  })
})
