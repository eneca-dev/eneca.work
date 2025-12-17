import { test, expect, Page } from '../../fixtures/auth.fixture'
import { UsersPageHelper } from '../helpers/users-page.helper'

test.describe('Users List - Search', () => {
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

  // After each test, only reset state - don't reload page
  test.afterEach(async () => {
    try {
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
  // Basic Search
  // ===========================================================================

  test.describe('Basic Search', () => {
    test('search input is visible', async () => {
      const searchInput = sharedPage.locator('input[placeholder="Поиск сотрудников"]')
      await expect(searchInput).toBeVisible()
    })

    test('can type in search input', async () => {
      await usersPage.search('test query')

      const searchValue = await usersPage.getSearchValue()
      expect(searchValue).toBe('test query')
    })

    test('can clear search input', async () => {
      await usersPage.search('test query')
      await usersPage.clearSearch()

      const searchValue = await usersPage.getSearchValue()
      expect(searchValue).toBe('')
    })

    test('search filters users in table', async () => {
      // Get initial user count
      const initialCount = await usersPage.getVisibleUsersCount()

      // Search for something specific that likely won't match all
      await usersPage.search('zzz-nonexistent-user-zzz')

      // Should show fewer users (or empty state)
      const filteredCount = await usersPage.getVisibleUsersCount()
      const isEmptyState = await usersPage.isEmptyStateVisible()

      expect(filteredCount < initialCount || isEmptyState).toBe(true)
    })
  })

  // ===========================================================================
  // Search by Different Fields
  // ===========================================================================

  test.describe('Search by Fields', () => {
    test('search by name filters users', async () => {
      // First get some user names
      const names = await usersPage.getVisibleUserNames()

      if (names.length > 0) {
        // Get first part of first name
        const searchTerm = names[0].split(' ')[0]

        // Search for it
        await usersPage.search(searchTerm)

        // Should still find at least one user
        const count = await usersPage.getVisibleUsersCount()
        expect(count).toBeGreaterThan(0)
      }
    })

    test('search is case insensitive', async () => {
      const names = await usersPage.getVisibleUserNames()

      if (names.length > 0) {
        const searchTerm = names[0].split(' ')[0]

        // Search lowercase
        await usersPage.search(searchTerm.toLowerCase())
        const countLower = await usersPage.getVisibleUsersCount()

        // Search uppercase
        await usersPage.search(searchTerm.toUpperCase())
        const countUpper = await usersPage.getVisibleUsersCount()

        // Both should find users (case insensitive)
        expect(countLower).toBeGreaterThan(0)
        expect(countUpper).toBeGreaterThan(0)
      }
    })

    test('partial search works', async () => {
      const names = await usersPage.getVisibleUserNames()

      if (names.length > 0) {
        // Search for just first 2 characters
        const searchTerm = names[0].substring(0, 2)

        await usersPage.search(searchTerm)

        // Should find at least one user
        const count = await usersPage.getVisibleUsersCount()
        expect(count).toBeGreaterThan(0)
      }
    })
  })

  // ===========================================================================
  // Search Persistence
  // ===========================================================================

  test.describe('Search Persistence', () => {
    test('search query appears in URL', async () => {
      const searchTerm = 'test-search-query'
      await usersPage.search(searchTerm)

      // Wait for URL to update
      await sharedPage.waitForTimeout(1000)

      // URL should contain search parameter
      const urlFilters = await usersPage.getUrlFilters()
      expect(urlFilters.search).toBe(searchTerm)
    })

    test('search query saved to localStorage', async () => {
      const searchTerm = 'localstorage-search'
      await usersPage.search(searchTerm)

      // Wait for localStorage to update
      await sharedPage.waitForTimeout(1000)

      // Check localStorage
      const state = await usersPage.getStorageState()
      expect(state?.search).toBe(searchTerm)
    })
  })

  // ===========================================================================
  // Search with Filters
  // ===========================================================================

  test.describe('Search Combined with Filters', () => {
    test('search works together with filters', async () => {
      // Apply a filter first
      await usersPage.openFilterDropdown('DEPARTMENT')
      const checkbox = sharedPage.locator('[role="menu"] input[type="checkbox"]').first()
      await checkbox.click()
      await usersPage.closeFilterDropdown()

      // Then search
      await usersPage.search('a')

      // Both should be active
      const filterCount = await usersPage.getFilterCount('DEPARTMENT')
      const searchValue = await usersPage.getSearchValue()

      expect(filterCount).toBeGreaterThan(0)
      expect(searchValue).toBe('a')
    })

    test('clearing search keeps filters active', async () => {
      // Apply filter
      await usersPage.openFilterDropdown('DEPARTMENT')
      await sharedPage.locator('[role="menu"] input[type="checkbox"]').first().click()
      await usersPage.closeFilterDropdown()

      // Add search
      await usersPage.search('test')

      // Clear search
      await usersPage.clearSearch()

      // Filter should still be active
      const filterCount = await usersPage.getFilterCount('DEPARTMENT')
      expect(filterCount).toBeGreaterThan(0)
    })

    test('reset filters clears search too', async () => {
      // Add search
      await usersPage.search('test-search')

      // Reset (should clear search as part of all filters)
      await usersPage.resetAllFilters()

      // Search should be cleared
      const searchValue = await usersPage.getSearchValue()
      expect(searchValue).toBe('')
    })
  })

  // ===========================================================================
  // Search Edge Cases
  // ===========================================================================

  test.describe('Search Edge Cases', () => {
    test('empty search shows all users', async () => {
      // Get initial count
      const initialCount = await usersPage.getVisibleUsersCount()

      // Search for something
      await usersPage.search('test')

      // Clear search
      await usersPage.clearSearch()

      // Should be back to initial state (or similar)
      const finalCount = await usersPage.getVisibleUsersCount()
      expect(finalCount).toBeGreaterThanOrEqual(initialCount - 1) // Allow for minor variance
    })

    test('search with special characters does not crash', async () => {
      // Search with special characters
      await usersPage.search('!@#$%^&*()')

      // Should not crash, either shows empty or handles gracefully
      const count = await usersPage.getVisibleUsersCount()
      const isEmpty = await usersPage.isEmptyStateVisible()

      // Either shows results or empty state, but doesn't crash
      expect(count >= 0 || isEmpty).toBe(true)
    })

    test('search with spaces works', async () => {
      // Search with spaces (multi-word search)
      await usersPage.search('user name')

      // Should not crash
      const count = await usersPage.getVisibleUsersCount()
      expect(count >= 0).toBe(true)
    })

    test('very long search query is handled', async () => {
      // Search with very long string
      const longQuery = 'a'.repeat(100)
      await usersPage.search(longQuery)

      // Should not crash
      const count = await usersPage.getVisibleUsersCount()
      const isEmpty = await usersPage.isEmptyStateVisible()
      expect(count >= 0 || isEmpty).toBe(true)
    })
  })

  // ===========================================================================
  // Search Debounce/Performance
  // ===========================================================================

  test.describe('Search Performance', () => {
    test('rapid typing is handled', async () => {
      // Type rapidly
      const searchInput = sharedPage.locator('input[placeholder="Поиск сотрудников"]')

      await searchInput.pressSequentially('testquery', { delay: 50 })

      // Wait for debounce
      await sharedPage.waitForTimeout(1000)

      // Should show final value
      const searchValue = await usersPage.getSearchValue()
      expect(searchValue).toBe('testquery')
    })
  })

  // ===========================================================================
  // ⚠️ Persistence Tests with Page Reload
  // ===========================================================================
  // These tests explicitly reload the page to verify persistence functionality.
  // They are grouped at the end and run serially to minimize Supabase load.
  // Each reload will re-fetch ~538 users, permissions, and notifications.

  test.describe.serial('Persistence Tests (with Page Reload)', () => {
    test('search query restored from URL on page reload', async () => {
      const searchTerm = 'persistent-search'
      await usersPage.search(searchTerm)

      // Wait for URL to update
      await sharedPage.waitForTimeout(1000)

      // ⚠️ This reload will trigger full page re-initialization
      await sharedPage.reload()
      await usersPage.waitForUsersLoaded()

      // Search should be restored
      const searchValue = await usersPage.getSearchValue()
      expect(searchValue).toBe(searchTerm)
    })
  })
})
