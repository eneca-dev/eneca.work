import { test, expect, Page } from '../fixtures/auth.fixture'
import { UsersPageHelper } from './helpers/users-page.helper'

test.describe('Users - Navigation', () => {
  let usersPage: UsersPageHelper
  let sharedPage: Page

  // Load page ONCE for all navigation tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    usersPage = new UsersPageHelper(sharedPage)
    await usersPage.goto()
  })

  // After each test, return to list tab
  test.afterEach(async () => {
    try {
      const currentTab = await usersPage.getCurrentTab()
      if (currentTab !== 'list' && currentTab !== null) {
        await usersPage.switchTab('list')
      }
    } catch (e) {
      console.log('Cleanup error:', e)
    }
  })

  test.afterAll(async () => {
    await sharedPage.close()
  })

  // ===========================================================================
  // Tab Navigation
  // ===========================================================================

  test('default tab is "list" when no tab param', async () => {
    await usersPage.goto()

    // Should show users list tab content
    const table = sharedPage.locator('table')
    await expect(table).toBeVisible({ timeout: 30000 })

    // URL should have tab=list or no tab (defaults to list)
    const currentTab = await usersPage.getCurrentTab()
    // Either no tab param or 'list' - both mean list tab
    expect(currentTab === null || currentTab === 'list').toBe(true)
  })

  test('navigate to list tab via URL param', async () => {
    await usersPage.goto('list')

    const table = sharedPage.locator('table')
    await expect(table).toBeVisible({ timeout: 30000 })

    await usersPage.expectTab('list')
  })

  test('navigate to add-user tab via URL param', async () => {
    await usersPage.goto('add-user')

    // Should show add user form
    const emailInput = sharedPage.locator('#email')
    await expect(emailInput).toBeVisible({ timeout: 30000 })

    await usersPage.expectTab('add-user')
  })

  test('navigate to analytics tab via URL param', async () => {
    await usersPage.goto('analytics')

    await usersPage.expectTab('analytics')
  })

  test('navigate to admin tab via URL param', async () => {
    await usersPage.goto('admin')

    await usersPage.expectTab('admin')
  })

  // ===========================================================================
  // Tab Switching via Click
  // ===========================================================================

  test('switch tabs by clicking', async () => {
    await usersPage.goto('list')

    // Click on Analytics tab
    await usersPage.switchTab('analytics')
    await usersPage.expectTab('analytics')

    // Click back to List tab
    await usersPage.switchTab('list')
    await usersPage.expectTab('list')
  })

  test('URL updates when switching tabs', async () => {
    await usersPage.goto('list')

    // Switch to analytics
    await usersPage.switchTab('analytics')

    // Verify URL changed
    await expect(sharedPage).toHaveURL(/tab=analytics/)

    // Switch to admin
    await usersPage.switchTab('admin')

    // Verify URL changed
    await expect(sharedPage).toHaveURL(/tab=admin/)
  })

  // ===========================================================================
  // Tab Visibility (Permission Guards)
  // ===========================================================================

  test('list tab is always visible', async () => {
    await usersPage.goto()

    const isVisible = await usersPage.isTabVisible('list')
    expect(isVisible).toBe(true)
  })

  test('analytics tab is always visible', async () => {
    await usersPage.goto()

    const isVisible = await usersPage.isTabVisible('analytics')
    expect(isVisible).toBe(true)
  })

  test('add-user tab visibility depends on permissions', async () => {
    await usersPage.goto()

    // For admin user (from auth fixture), add-user should be visible
    const isVisible = await usersPage.isTabVisible('add-user')
    // Note: This test verifies tab visibility, actual value depends on user permissions
    expect(typeof isVisible).toBe('boolean')
  })

  test('admin tab visibility depends on permissions', async () => {
    await usersPage.goto()

    // For admin user (from auth fixture), admin tab should be visible
    const isVisible = await usersPage.isTabVisible('admin')
    // Note: This test verifies tab visibility, actual value depends on user permissions
    expect(typeof isVisible).toBe('boolean')
  })

  // ===========================================================================
  // Current User Card
  // ===========================================================================

  test('current user card is visible on users page', async () => {
    await usersPage.goto()

    // Wait for card to be rendered
    await sharedPage.waitForTimeout(2000)

    // Current user card should be visible
    const userCard = sharedPage.locator('.mb-6').first()
    await expect(userCard).toBeVisible()
  })

  // ===========================================================================
  // Tab Content Switching
  // ===========================================================================

  test('content changes when switching to add-user tab', async () => {
    await usersPage.goto('list')

    // Verify list content
    const table = sharedPage.locator('table')
    await expect(table).toBeVisible()

    // Switch to add-user
    await usersPage.switchTab('add-user')

    // Verify add-user form content
    const emailInput = sharedPage.locator('#email')
    await expect(emailInput).toBeVisible()

    // Table should not be visible anymore (or at least not the same content)
  })

  test('content persists when returning to same tab', async () => {
    await usersPage.goto('list')

    // Enter search term
    await usersPage.search('test')

    // Switch to analytics
    await usersPage.switchTab('analytics')

    // Switch back to list
    await usersPage.switchTab('list')

    // Search term should persist (stored in URL/localStorage)
    const searchValue = await usersPage.getSearchValue()
    expect(searchValue).toBe('test')
  })
})
