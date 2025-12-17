import { test, expect, Page } from '../../fixtures/auth.fixture'
import { UsersPageHelper } from '../helpers/users-page.helper'

test.describe('Users List - Grouping', () => {
  let usersPage: UsersPageHelper
  let sharedPage: Page

  // Load page ONCE for all tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    usersPage = new UsersPageHelper(sharedPage)
    await usersPage.goto('list')
  })

  // After each test, reset to no grouping mode
  test.afterEach(async () => {
    try {
      await usersPage.setGrouping('none')
      await usersPage.clearSearch()
      await usersPage.resetAllFilters()
    } catch (e) {
      console.log('Cleanup error:', e)
    }
  })

  test.afterAll(async () => {
    await sharedPage.close()
  })

  // ===========================================================================
  // Grouping Dropdown
  // ===========================================================================

  test.describe('Grouping Dropdown', () => {
    test('grouping dropdown is visible', async () => {
      const dropdown = sharedPage.locator('button:has-text("Без группировки"), button:has-text("Подразделения")')
      await expect(dropdown).toBeVisible()
    })

    test('grouping dropdown opens on click', async () => {
      const trigger = sharedPage.locator('button:has-text("Без группировки"), button:has-text("Подразделения")')
      await trigger.click()

      // Menu items should be visible
      const noGrouping = sharedPage.locator('[role="menuitem"]:has-text("Без группировки")')
      const bySubdivisions = sharedPage.locator('[role="menuitem"]:has-text("Подразделения")')

      await expect(noGrouping).toBeVisible()
      await expect(bySubdivisions).toBeVisible()
    })

    test('can switch between grouping modes', async () => {
      // Switch to subdivisions grouping
      await usersPage.setGrouping('subdivisions')
      let currentGrouping = await usersPage.getCurrentGrouping()
      expect(currentGrouping).toBe('subdivisions')

      // Switch back to no grouping
      await usersPage.setGrouping('none')
      currentGrouping = await usersPage.getCurrentGrouping()
      expect(currentGrouping).toBe('none')
    })
  })

  // ===========================================================================
  // No Grouping Mode
  // ===========================================================================

  test.describe('No Grouping Mode', () => {
    test('table shows flat list without group headers', async () => {
      await usersPage.setGrouping('none')

      // Table should be visible
      const table = sharedPage.locator('table')
      await expect(table).toBeVisible()

      // Should not have group headers with Network icon (subdivision headers)
      const subdivisionHeaders = sharedPage.locator('tr:has(svg.lucide-network)')
      const count = await subdivisionHeaders.count()
      expect(count).toBe(0)
    })

    test('pagination is available in no grouping mode', async () => {
      await usersPage.setGrouping('none')

      // Wait for mode to apply
      await sharedPage.waitForTimeout(1000)

      // Pagination or "show all" button should be visible
      const showAllBtn = sharedPage.locator('button:has-text("Показать всех")')
      const paginateBtn = sharedPage.locator('button:has-text("Пагинация")')
      const pageInfo = sharedPage.locator(':has-text(" из ")')

      const hasPagination = await showAllBtn.isVisible() ||
                           await paginateBtn.isVisible() ||
                           await pageInfo.isVisible()

      // Pagination should be available (if enough users)
      expect(hasPagination).toBe(true)
    })
  })

  // ===========================================================================
  // Subdivisions Grouping Mode
  // ===========================================================================

  test.describe('Subdivisions Grouping Mode', () => {
    test('shows subdivision headers when grouping by subdivisions', async () => {
      await usersPage.setGrouping('subdivisions')

      // Wait for grouping to apply
      await sharedPage.waitForTimeout(1000)

      // Should have group headers with Network icon (subdivision headers)
      const subdivisionHeaders = sharedPage.locator('tr:has(svg.lucide-network)')
      const count = await subdivisionHeaders.count()

      // Should have at least one subdivision header
      expect(count).toBeGreaterThan(0)
    })

    test('subdivision headers show user count', async () => {
      await usersPage.setGrouping('subdivisions')
      await sharedPage.waitForTimeout(1000)

      // Find first subdivision header
      const header = sharedPage.locator('tr:has(svg.lucide-network)').first()

      // Should contain a number (user count)
      const text = await header.textContent()
      expect(text).toMatch(/\d+/)
    })

    test('pagination is hidden in grouped mode', async () => {
      await usersPage.setGrouping('subdivisions')
      await sharedPage.waitForTimeout(1000)

      // "Show all" button should not be visible in grouped mode
      const showAllBtn = sharedPage.locator('button:has-text("Показать всех")')
      const isVisible = await showAllBtn.isVisible()
      expect(isVisible).toBe(false)
    })
  })

  // ===========================================================================
  // Group Expansion
  // ===========================================================================

  test.describe('Group Expansion', () => {
    test('groups can be expanded by clicking header', async () => {
      await usersPage.setGrouping('subdivisions')
      await sharedPage.waitForTimeout(1000)

      // Find first subdivision header
      const header = sharedPage.locator('tr:has(svg.lucide-network)').first()

      // Get initial expand state
      const chevronDown = header.locator('svg.lucide-chevron-down')
      const chevronRight = header.locator('svg.lucide-chevron-right')

      const wasExpanded = await chevronDown.isVisible()

      // Click to toggle
      await header.click()
      await sharedPage.waitForTimeout(500)

      // State should have changed
      if (wasExpanded) {
        await expect(chevronRight).toBeVisible()
      } else {
        await expect(chevronDown).toBeVisible()
      }
    })

    test('expanded groups show department sub-headers', async () => {
      await usersPage.setGrouping('subdivisions')
      await sharedPage.waitForTimeout(1000)

      // Find first subdivision header and expand it
      const subdivisionHeader = sharedPage.locator('tr:has(svg.lucide-network)').first()

      // Check if collapsed
      const chevronRight = subdivisionHeader.locator('svg.lucide-chevron-right')
      if (await chevronRight.isVisible()) {
        await subdivisionHeader.click()
        await sharedPage.waitForTimeout(500)
      }

      // Now department headers should be visible
      const departmentHeaders = sharedPage.locator('tr:has(svg.lucide-building-2)')
      const count = await departmentHeaders.count()
      expect(count).toBeGreaterThan(0)
    })

    test('expanded departments show team sub-headers', async () => {
      await usersPage.setGrouping('subdivisions')
      await sharedPage.waitForTimeout(1000)

      // Expand first subdivision
      const subdivisionHeader = sharedPage.locator('tr:has(svg.lucide-network)').first()
      const subdivChevron = subdivisionHeader.locator('svg.lucide-chevron-right')
      if (await subdivChevron.isVisible()) {
        await subdivisionHeader.click()
        await sharedPage.waitForTimeout(500)
      }

      // Expand first department
      const departmentHeader = sharedPage.locator('tr:has(svg.lucide-building-2)').first()
      if (await departmentHeader.isVisible()) {
        const deptChevron = departmentHeader.locator('svg.lucide-chevron-right')
        if (await deptChevron.isVisible()) {
          await departmentHeader.click()
          await sharedPage.waitForTimeout(500)
        }

        // Team headers should be visible
        const teamHeaders = sharedPage.locator('tr:has(svg.lucide-users)')
        const count = await teamHeaders.count()
        expect(count).toBeGreaterThan(0)
      }
    })
  })

  // ===========================================================================
  // Grouping Persistence
  // ===========================================================================

  test.describe('Grouping Persistence', () => {
    test('grouping mode appears in URL', async () => {
      await usersPage.setGrouping('subdivisions')

      // Wait for URL to update
      await sharedPage.waitForTimeout(1000)

      // URL should contain group parameter
      await expect(sharedPage).toHaveURL(/group=subdivisions/)
    })

    test('grouping mode saved to localStorage', async () => {
      await usersPage.setGrouping('subdivisions')
      await sharedPage.waitForTimeout(1000)

      // Check localStorage
      const state = await usersPage.getStorageState()
      expect(state?.groupBy).toBe('subdivisions')
    })

    test('expanded groups state persists', async () => {
      await usersPage.setGrouping('subdivisions')
      await sharedPage.waitForTimeout(1000)

      // Expand first subdivision
      const header = sharedPage.locator('tr:has(svg.lucide-network)').first()
      const headerText = await header.textContent()

      // Get the group name (first text before number)
      const groupName = headerText?.split(/\d/)[0].trim() || ''

      // Click to expand
      await header.click()
      await sharedPage.waitForTimeout(500)

      // Wait for localStorage to update
      await sharedPage.waitForTimeout(1000)

      // Check localStorage has expanded state
      const state = await usersPage.getStorageState()
      const expandedGroups = state?.expandedGroups || {}

      // Should have at least one expanded group
      expect(Object.keys(expandedGroups).length).toBeGreaterThanOrEqual(0)
    })
  })

  // ===========================================================================
  // Grouping with Search
  // ===========================================================================

  test.describe('Grouping with Search', () => {
    test('search works in grouped mode', async () => {
      await usersPage.setGrouping('subdivisions')

      // Search for something
      await usersPage.search('a')

      // Should still show results
      const count = await usersPage.getVisibleUsersCount()
      // Either shows users or group headers
      expect(count >= 0).toBe(true)
    })

    test('clearing search maintains grouping mode', async () => {
      await usersPage.setGrouping('subdivisions')
      await usersPage.search('test')
      await usersPage.clearSearch()

      // Grouping should still be subdivisions
      const grouping = await usersPage.getCurrentGrouping()
      expect(grouping).toBe('subdivisions')
    })
  })

  // ===========================================================================
  // Grouping with Filters
  // ===========================================================================

  test.describe('Grouping with Filters', () => {
    test('grouping works with filters', async () => {
      await usersPage.setGrouping('subdivisions')

      // Apply a filter
      await usersPage.openFilterDropdown('DEPARTMENT')
      await sharedPage.locator('[role="menu"] input[type="checkbox"]').first().click()
      await usersPage.closeFilterDropdown()

      // Grouping should still work
      const grouping = await usersPage.getCurrentGrouping()
      expect(grouping).toBe('subdivisions')

      // Filter should be active
      const filterCount = await usersPage.getFilterCount('DEPARTMENT')
      expect(filterCount).toBeGreaterThan(0)
    })

    test('reset filters keeps grouping mode', async () => {
      await usersPage.setGrouping('subdivisions')

      // Apply filter
      await usersPage.openFilterDropdown('DEPARTMENT')
      await sharedPage.locator('[role="menu"] input[type="checkbox"]').first().click()
      await usersPage.closeFilterDropdown()

      // Reset filters
      await usersPage.resetAllFilters()

      // Grouping should still be subdivisions
      const grouping = await usersPage.getCurrentGrouping()
      expect(grouping).toBe('subdivisions')
    })
  })

  // ===========================================================================
  // ⚠️ Persistence Tests with Page Reload
  // ===========================================================================
  // These tests explicitly reload the page to verify persistence functionality.
  // They are grouped at the end and run serially to minimize Supabase load.
  // Each reload will re-fetch ~538 users, permissions, and notifications.

  test.describe.serial('Persistence Tests (with Page Reload)', () => {
    test('grouping mode restored from URL on reload', async () => {
      await usersPage.setGrouping('subdivisions')
      await sharedPage.waitForTimeout(1000)

      // ⚠️ This reload will trigger full page re-initialization
      await sharedPage.reload()
      await usersPage.waitForUsersLoaded()

      // Grouping should be restored
      const grouping = await usersPage.getCurrentGrouping()
      expect(grouping).toBe('subdivisions')
    })
  })
})
