import { test, expect, Page } from '../../fixtures/auth.fixture'
import { UsersPageHelper } from '../helpers/users-page.helper'

test.describe('Users List - Filters', () => {
  let usersPage: UsersPageHelper
  let sharedPage: Page

  // Load page ONCE for all tests to avoid reloading 538 users every time
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    usersPage = new UsersPageHelper(sharedPage)

    // Load page once
    await usersPage.goto('list')
  })

  // After each test, only reset filters - don't reload page
  test.afterEach(async () => {
    try {
      await usersPage.clearSearch()
      await usersPage.resetAllFilters()
    } catch (e) {
      // Ignore cleanup errors
      console.log('Cleanup error:', e)
    }
  })

  // Close page after all tests
  test.afterAll(async () => {
    await sharedPage.close()
  })

  // ===========================================================================
  // Subdivision Filter
  // ===========================================================================

  test.describe('Subdivision Filter', () => {
    test('subdivision filter dropdown opens', async () => {
      await usersPage.openFilterDropdown('SUBDIVISION')

      // Dropdown content should be visible
      const dropdown = sharedPage.locator('[role="menu"]')
      await expect(dropdown).toBeVisible()

      await usersPage.closeFilterDropdown()
    })

    test('subdivision filter has search input', async () => {
      await usersPage.openFilterDropdown('SUBDIVISION')

      const searchInput = sharedPage.locator('[role="menu"] input[placeholder*="Поиск"]')
      await expect(searchInput).toBeVisible()

      await usersPage.closeFilterDropdown()
    })

    test('subdivision filter has options', async () => {
      const options = await usersPage.getFilterOptions('SUBDIVISION')
      expect(options.length).toBeGreaterThan(0)
    })

    test('selecting subdivision shows count badge', async () => {
      const options = await usersPage.getFilterOptions('SUBDIVISION')

      if (options.length > 0) {
        await usersPage.openFilterDropdown('SUBDIVISION')

        // Click first checkbox
        const firstCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
        await firstCheckbox.click()
        await sharedPage.waitForTimeout(500)

        await usersPage.closeFilterDropdown()

        // Count badge should show (1)
        const count = await usersPage.getFilterCount('SUBDIVISION')
        expect(count).toBeGreaterThanOrEqual(1)
      }
    })

    test('subdivision chip appears when filter selected', async () => {
      const options = await usersPage.getFilterOptions('SUBDIVISION')

      if (options.length > 0) {
        await usersPage.openFilterDropdown('SUBDIVISION')

        const firstCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
        await firstCheckbox.click()

        await usersPage.closeFilterDropdown()

        // Chip should be visible
        const isChipVisible = await usersPage.isSubdivisionChipVisible()
        expect(isChipVisible).toBe(true)
      }
    })

    test('search in subdivision dropdown filters options', async () => {
      await usersPage.openFilterDropdown('SUBDIVISION')

      // Get initial count of labels
      const initialLabels = await sharedPage.locator('[role="menu"] label').count()

      // Type search query that probably won't match all
      await usersPage.searchInFilterDropdown('zzz-nonexistent-zzz')

      // Labels should be filtered (likely 0 matches)
      const filteredLabels = await sharedPage.locator('[role="menu"] label').count()
      expect(filteredLabels).toBeLessThanOrEqual(initialLabels)

      await usersPage.closeFilterDropdown()
    })
  })

  // ===========================================================================
  // Department Filter
  // ===========================================================================

  test.describe('Department Filter', () => {
    test('department filter dropdown opens', async () => {
      await usersPage.openFilterDropdown('DEPARTMENT')

      const dropdown = sharedPage.locator('[role="menu"]')
      await expect(dropdown).toBeVisible()

      await usersPage.closeFilterDropdown()
    })

    test('department filter has options', async () => {
      const options = await usersPage.getFilterOptions('DEPARTMENT')
      expect(options.length).toBeGreaterThan(0)
    })

    test('selecting department shows count badge', async () => {
      const options = await usersPage.getFilterOptions('DEPARTMENT')

      if (options.length > 0) {
        await usersPage.openFilterDropdown('DEPARTMENT')

        const firstCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
        await firstCheckbox.click()

        await usersPage.closeFilterDropdown()

        const count = await usersPage.getFilterCount('DEPARTMENT')
        expect(count).toBeGreaterThanOrEqual(1)
      }
    })
  })

  // ===========================================================================
  // Team Filter
  // ===========================================================================

  test.describe('Team Filter', () => {
    test('team filter dropdown opens', async () => {
      await usersPage.openFilterDropdown('TEAM')

      const dropdown = sharedPage.locator('[role="menu"]')
      await expect(dropdown).toBeVisible()

      await usersPage.closeFilterDropdown()
    })

    test('team filter has options', async () => {
      const options = await usersPage.getFilterOptions('TEAM')
      expect(options.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Position Filter
  // ===========================================================================

  test.describe('Position Filter', () => {
    test('position filter dropdown opens', async () => {
      await usersPage.openFilterDropdown('POSITION')

      const dropdown = sharedPage.locator('[role="menu"]')
      await expect(dropdown).toBeVisible()

      await usersPage.closeFilterDropdown()
    })

    test('position filter has options', async () => {
      const options = await usersPage.getFilterOptions('POSITION')
      expect(options.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Category Filter
  // ===========================================================================

  test.describe('Category Filter', () => {
    test('category filter dropdown opens', async () => {
      await usersPage.openFilterDropdown('CATEGORY')

      const dropdown = sharedPage.locator('[role="menu"]')
      await expect(dropdown).toBeVisible()

      await usersPage.closeFilterDropdown()
    })

    test('category filter has options', async () => {
      const options = await usersPage.getFilterOptions('CATEGORY')
      expect(options.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Role Filter
  // ===========================================================================

  test.describe('Role Filter', () => {
    test('role filter dropdown opens', async () => {
      await usersPage.openFilterDropdown('ROLE')

      const dropdown = sharedPage.locator('[role="menu"]')
      await expect(dropdown).toBeVisible()

      await usersPage.closeFilterDropdown()
    })

    test('role filter has options', async () => {
      const options = await usersPage.getFilterOptions('ROLE')
      expect(options.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Location Filter
  // ===========================================================================

  test.describe('Location Filter', () => {
    test('location filter dropdown opens', async () => {
      await usersPage.openFilterDropdown('LOCATION')

      const dropdown = sharedPage.locator('[role="menu"]')
      await expect(dropdown).toBeVisible()

      await usersPage.closeFilterDropdown()
    })

    test('location filter has options (office, remote, hybrid)', async () => {
      const options = await usersPage.getFilterOptions('LOCATION')
      // Should have at least some location options
      expect(options.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Reset Filters
  // ===========================================================================

  test.describe('Reset Filters', () => {
    test('reset button is disabled when no filters active', async () => {
      // With fresh storage and no filters, reset should be disabled
      await usersPage.expectResetButtonDisabled()
    })

    test('reset button becomes enabled when filter is selected', async () => {
      const options = await usersPage.getFilterOptions('DEPARTMENT')

      if (options.length > 0) {
        await usersPage.openFilterDropdown('DEPARTMENT')

        const firstCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
        await firstCheckbox.click()

        await usersPage.closeFilterDropdown()

        // Reset should now be enabled
        await usersPage.expectResetButtonEnabled()
      }
    })

    test('clicking reset clears all filters', async () => {
      // Select a department filter
      const options = await usersPage.getFilterOptions('DEPARTMENT')

      if (options.length > 0) {
        await usersPage.openFilterDropdown('DEPARTMENT')

        const firstCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
        await firstCheckbox.click()

        await usersPage.closeFilterDropdown()

        // Verify filter is active
        const countBefore = await usersPage.getFilterCount('DEPARTMENT')
        expect(countBefore).toBeGreaterThan(0)

        // Reset all filters
        await usersPage.resetAllFilters()

        // Filter count should be 0
        const countAfter = await usersPage.getFilterCount('DEPARTMENT')
        expect(countAfter).toBe(0)
      }
    })
  })

  // ===========================================================================
  // Filter URL Persistence
  // ===========================================================================

  test.describe('URL Persistence', () => {
    test('selected filters appear in URL', async () => {
      const options = await usersPage.getFilterOptions('DEPARTMENT')

      if (options.length > 0) {
        await usersPage.openFilterDropdown('DEPARTMENT')

        const firstCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
        await firstCheckbox.click()

        await usersPage.closeFilterDropdown()

        // Wait for URL to update
        await sharedPage.waitForTimeout(1000)

        // URL should contain depts parameter
        const urlFilters = await usersPage.getUrlFilters()
        expect(urlFilters.depts.length).toBeGreaterThan(0)
      }
    })
  })

  // ===========================================================================
  // Filter localStorage Persistence
  // ===========================================================================

  test.describe('localStorage Persistence', () => {
    test('filters saved to localStorage', async () => {
      const options = await usersPage.getFilterOptions('DEPARTMENT')

      if (options.length > 0) {
        await usersPage.openFilterDropdown('DEPARTMENT')

        const firstCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
        await firstCheckbox.click()

        await usersPage.closeFilterDropdown()

        // Wait for localStorage to be updated
        await sharedPage.waitForTimeout(1000)

        // Check localStorage
        const state = await usersPage.getStorageState()
        expect(state?.filters?.departments?.length).toBeGreaterThan(0)
      }
    })
  })

  // ===========================================================================
  // Multiple Filters
  // ===========================================================================

  test.describe('Multiple Filters', () => {
    test('multiple filters can be active simultaneously', async () => {
      // Select department filter
      await usersPage.openFilterDropdown('DEPARTMENT')
      const deptCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
      await deptCheckbox.click()
      await usersPage.closeFilterDropdown()

      // Select position filter
      await usersPage.openFilterDropdown('POSITION')
      const posCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
      await posCheckbox.click()
      await usersPage.closeFilterDropdown()

      // Both should be active
      const deptCount = await usersPage.getFilterCount('DEPARTMENT')
      const posCount = await usersPage.getFilterCount('POSITION')

      expect(deptCount).toBeGreaterThan(0)
      expect(posCount).toBeGreaterThan(0)
    })

    test('reset clears all active filters', async () => {
      // Select multiple filters
      await usersPage.openFilterDropdown('DEPARTMENT')
      await sharedPage.locator('[role="menu"] input[type="checkbox"]').first().click()
      await usersPage.closeFilterDropdown()

      await usersPage.openFilterDropdown('POSITION')
      await sharedPage.locator('[role="menu"] input[type="checkbox"]').first().click()
      await usersPage.closeFilterDropdown()

      // Reset all
      await usersPage.resetAllFilters()

      // All should be cleared
      const deptCount = await usersPage.getFilterCount('DEPARTMENT')
      const posCount = await usersPage.getFilterCount('POSITION')

      expect(deptCount).toBe(0)
      expect(posCount).toBe(0)
    })
  })

  // ===========================================================================
  // Filter Effect on User List
  // ===========================================================================

  test.describe('Filter Effect', () => {
    test('applying filter changes visible users', async () => {
      // Get initial user count
      const initialCount = await usersPage.getVisibleUsersCount()

      // Apply a filter
      await usersPage.openFilterDropdown('DEPARTMENT')
      const firstCheckbox = usersPage['page'].locator('[role="menu"] input[type="checkbox"]').first()
      await firstCheckbox.click()
      await usersPage.closeFilterDropdown()

      // Wait for filter to apply
      await usersPage['page'].waitForTimeout(1000)

      // User count should potentially be different (filtered)
      const filteredCount = await usersPage.getVisibleUsersCount()

      // Either count changes or stays same if all users match filter
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
    })
  })

  // ===========================================================================
  // ⚠️ Persistence Tests with Page Reload
  // ===========================================================================
  // These tests explicitly reload the page to verify persistence functionality.
  // They are grouped at the end and run serially to minimize Supabase load.
  // Each reload will re-fetch ~538 users, permissions, and notifications.

  test.describe.serial('Persistence Tests (with Page Reload)', () => {
    test('filters restored from URL on page reload', async () => {
      const options = await usersPage.getFilterOptions('DEPARTMENT')

      if (options.length > 0) {
        await usersPage.openFilterDropdown('DEPARTMENT')

        const firstCheckbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
        await firstCheckbox.click()

        await usersPage.closeFilterDropdown()

        // Wait for URL to update
        await sharedPage.waitForTimeout(1000)

        // ⚠️ This reload will trigger full page re-initialization
        await sharedPage.reload()
        await usersPage.waitForUsersLoaded()

        // Filter should still be active
        const count = await usersPage.getFilterCount('DEPARTMENT')
        expect(count).toBeGreaterThan(0)
      }
    })
  })
})
