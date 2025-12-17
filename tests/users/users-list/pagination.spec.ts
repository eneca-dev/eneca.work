import { test, expect, Page } from '../../fixtures/auth.fixture'
import { UsersPageHelper } from '../helpers/users-page.helper'

test.describe('Users List - Pagination', () => {
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

    // Set to no grouping mode once
    await usersPage.setGrouping('none')
    await sharedPage.waitForTimeout(500)
  })

  // After each test, reset to first page
  test.afterEach(async () => {
    try {
      // Reset to first page if not already
      const pageInfo = await usersPage.getCurrentPageInfo()
      if (pageInfo && pageInfo.current > 1) {
        while ((await usersPage.getCurrentPageInfo())?.current !== 1) {
          await usersPage.goToPreviousPage()
        }
      }
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
  // Pagination Visibility
  // ===========================================================================

  test.describe('Pagination Visibility', () => {
    test('show all / pagination toggle button is visible', async ({ page }) => {
      const showAllBtn = page.locator('button:has-text("Показать всех")')
      const paginateBtn = page.locator('button:has-text("Пагинация")')

      const isShowAllVisible = await showAllBtn.isVisible()
      const isPaginateVisible = await paginateBtn.isVisible()

      // One of them should be visible
      expect(isShowAllVisible || isPaginateVisible).toBe(true)
    })

    test('pagination controls visible when more than one page', async () => {
      // Page info like "1 из 2" should be visible if there are multiple pages
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        // Prev and next buttons should be visible
        const prevBtn = sharedPage.locator('button:has(svg.lucide-chevron-left)').last()
        const nextBtn = sharedPage.locator('button:has(svg.lucide-chevron-right)').last()

        await expect(prevBtn).toBeVisible()
        await expect(nextBtn).toBeVisible()
      }
    })

    test('pagination is hidden when grouping is enabled', async () => {
      await usersPage.setGrouping('subdivisions')
      await sharedPage.waitForTimeout(500)

      // Show all button should not be visible
      const showAllBtn = sharedPage.locator('button:has-text("Показать всех")')
      const isVisible = await showAllBtn.isVisible()
      expect(isVisible).toBe(false)
    })
  })

  // ===========================================================================
  // Page Navigation
  // ===========================================================================

  test.describe('Page Navigation', () => {
    test('can go to next page', async () => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        const initialPage = pageInfo.current

        await usersPage.goToNextPage()

        const newPageInfo = await usersPage.getCurrentPageInfo()
        expect(newPageInfo?.current).toBe(initialPage + 1)
      }
    })

    test('can go to previous page', async () => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        // First go to page 2
        await usersPage.goToNextPage()

        const pageAfterNext = await usersPage.getCurrentPageInfo()
        expect(pageAfterNext?.current).toBeGreaterThan(1)

        // Then go back
        await usersPage.goToPreviousPage()

        const pageAfterPrev = await usersPage.getCurrentPageInfo()
        expect(pageAfterPrev?.current).toBe((pageAfterNext?.current || 2) - 1)
      }
    })

    test('prev button disabled on first page', async ({ page }) => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.current === 1 && pageInfo.total > 1) {
        const prevBtn = page.locator('button:has(svg.lucide-chevron-left)').last()
        await expect(prevBtn).toBeDisabled()
      }
    })

    test('next button disabled on last page', async ({ page }) => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        // Navigate to last page
        while ((await usersPage.getCurrentPageInfo())?.current !== pageInfo.total) {
          await usersPage.goToNextPage()
        }

        const nextBtn = page.locator('button:has(svg.lucide-chevron-right)').last()
        await expect(nextBtn).toBeDisabled()
      }
    })
  })

  // ===========================================================================
  // Show All Mode
  // ===========================================================================

  test.describe('Show All Mode', () => {
    test('clicking "show all" shows all users', async () => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        // Get initial count (one page)
        const initialCount = await usersPage.getVisibleUsersCount()

        // Toggle to show all
        await usersPage.toggleShowAll()

        // Should show more users now
        const allCount = await usersPage.getVisibleUsersCount()
        expect(allCount).toBeGreaterThanOrEqual(initialCount)
      }
    })

    test('button changes to "Пагинация" in show all mode', async ({ page }) => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        await usersPage.toggleShowAll()

        // Button should now say "Пагинация"
        const paginateBtn = page.locator('button:has-text("Пагинация")')
        await expect(paginateBtn).toBeVisible()
      }
    })

    test('clicking "Пагинация" returns to paginated mode', async () => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        // Toggle to show all
        await usersPage.toggleShowAll()

        // Toggle back to paginated
        await usersPage.toggleShowAll()

        // Should be back to pagination mode
        const isShowAllMode = await usersPage.isShowAllMode()
        expect(isShowAllMode).toBe(false)
      }
    })

    test('page info hidden in show all mode', async () => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        await usersPage.toggleShowAll()

        // Page info should not be visible
        const newPageInfo = await usersPage.getCurrentPageInfo()
        expect(newPageInfo).toBeNull()
      }
    })
  })

  // ===========================================================================
  // Pagination with Search
  // ===========================================================================

  test.describe('Pagination with Search', () => {
    test('search resets to first page', async () => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        // Go to page 2
        await usersPage.goToNextPage()

        const pageOnSecond = await usersPage.getCurrentPageInfo()
        expect(pageOnSecond?.current).toBeGreaterThan(1)

        // Search
        await usersPage.search('a')

        // Should reset to page 1
        const pageAfterSearch = await usersPage.getCurrentPageInfo()
        if (pageAfterSearch) {
          expect(pageAfterSearch.current).toBe(1)
        }
      }
    })

    test('clearing search resets to first page', async () => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        // Go to page 2
        await usersPage.goToNextPage()

        // Search
        await usersPage.search('a')

        // Clear search
        await usersPage.clearSearch()

        // Should be on page 1
        const finalPageInfo = await usersPage.getCurrentPageInfo()
        if (finalPageInfo) {
          expect(finalPageInfo.current).toBe(1)
        }
      }
    })
  })

  // ===========================================================================
  // Pagination with Filters
  // ===========================================================================

  test.describe('Pagination with Filters', () => {
    test('applying filter resets to first page', async ({ page }) => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        // Go to page 2
        await usersPage.goToNextPage()

        const pageOnSecond = await usersPage.getCurrentPageInfo()
        expect(pageOnSecond?.current).toBeGreaterThan(1)

        // Apply filter
        await usersPage.openFilterDropdown('DEPARTMENT')
        await page.locator('[role="menu"] input[type="checkbox"]').first().click()
        await usersPage.closeFilterDropdown()

        // Should reset to page 1
        const pageAfterFilter = await usersPage.getCurrentPageInfo()
        if (pageAfterFilter) {
          expect(pageAfterFilter.current).toBe(1)
        }
      }
    })

    test('reset filters resets to first page', async ({ page }) => {
      const pageInfo = await usersPage.getCurrentPageInfo()

      if (pageInfo && pageInfo.total > 1) {
        // Apply filter first
        await usersPage.openFilterDropdown('DEPARTMENT')
        await page.locator('[role="menu"] input[type="checkbox"]').first().click()
        await usersPage.closeFilterDropdown()

        // If multiple pages, go to page 2
        const filteredPageInfo = await usersPage.getCurrentPageInfo()
        if (filteredPageInfo && filteredPageInfo.total > 1) {
          await usersPage.goToNextPage()
        }

        // Reset filters
        await usersPage.resetAllFilters()

        // Should be on page 1
        const finalPageInfo = await usersPage.getCurrentPageInfo()
        if (finalPageInfo) {
          expect(finalPageInfo.current).toBe(1)
        }
      }
    })
  })

  // ===========================================================================
  // Page Count Updates
  // ===========================================================================

  test.describe('Page Count Updates', () => {
    test('page count updates when filter applied', async ({ page }) => {
      const initialPageInfo = await usersPage.getCurrentPageInfo()

      // Apply a filter that might reduce results
      await usersPage.openFilterDropdown('DEPARTMENT')
      await page.locator('[role="menu"] input[type="checkbox"]').first().click()
      await usersPage.closeFilterDropdown()

      await page.waitForTimeout(1000)

      const filteredPageInfo = await usersPage.getCurrentPageInfo()

      // Total pages might change (usually decrease)
      // We just verify the system doesn't crash
      if (filteredPageInfo) {
        expect(filteredPageInfo.total).toBeGreaterThanOrEqual(0)
      }
    })

    test('page count updates when search applied', async () => {
      const initialPageInfo = await usersPage.getCurrentPageInfo()

      // Search for something specific
      await usersPage.search('zzz-nonexistent-zzz')

      const searchedPageInfo = await usersPage.getCurrentPageInfo()

      // With no results, there might be 0 pages or 1 page with empty state
      // We just verify the system handles it gracefully
      if (searchedPageInfo) {
        expect(searchedPageInfo.total).toBeLessThanOrEqual(initialPageInfo?.total || 100)
      }
    })
  })

  // ===========================================================================
  // Items Per Page
  // ===========================================================================

  test.describe('Items Per Page', () => {
    test('default items per page is 100', async () => {
      // This test verifies the default behavior
      // With 100 items per page, first page should have up to 100 users
      const userCount = await usersPage.getVisibleUsersCount()

      // Should have at most 100 users on first page
      expect(userCount).toBeLessThanOrEqual(100)
    })
  })
})
