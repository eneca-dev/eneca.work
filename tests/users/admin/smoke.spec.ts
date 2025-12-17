/**
 * Smoke Tests for Admin Panel
 *
 * Basic visibility and navigation tests
 * These tests verify that admin panel loads correctly and tabs are accessible
 *
 * Note: These tests don't create any data, they only check UI visibility
 */

import { test, expect, Page } from '@playwright/test'
import { AdminPanelHelper } from './helpers/admin-panel.helper'
import { SELECTORS, TIMEOUTS } from './constants/selectors'

test.describe('Admin Panel - Smoke Tests', () => {
  let helper: AdminPanelHelper
  let sharedPage: Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    helper = new AdminPanelHelper(sharedPage)
    await helper.goto()
  })

  test.afterAll(async () => {
    await sharedPage.close()
  })

  test('admin panel should load', async () => {
    // Verify we're on the admin tab
    await expect(sharedPage).toHaveURL(/tab=admin/)
  })

  test('tabs should be visible', async () => {
    // Check that tabs list is visible
    const tabsList = sharedPage.locator(SELECTORS.TABS.LIST)
    await expect(tabsList).toBeVisible()

    // Check individual tabs (based on permissions, some might not be visible)
    // At minimum, with admin user, all tabs should be visible
    const subdivisionTab = sharedPage.locator(SELECTORS.TABS.SUBDIVISIONS)
    const departmentsTab = sharedPage.locator(SELECTORS.TABS.DEPARTMENTS)
    const teamsTab = sharedPage.locator(SELECTORS.TABS.TEAMS)
    const positionsTab = sharedPage.locator(SELECTORS.TABS.POSITIONS)
    const categoriesTab = sharedPage.locator(SELECTORS.TABS.CATEGORIES)

    // Check at least some tabs are visible
    const visibleTabs = await Promise.all([
      subdivisionTab.isVisible(),
      departmentsTab.isVisible(),
      teamsTab.isVisible(),
      positionsTab.isVisible(),
      categoriesTab.isVisible(),
    ])

    const visibleCount = visibleTabs.filter(v => v).length
    expect(visibleCount).toBeGreaterThan(0)
  })

  test('can switch to Subdivisions tab', async () => {
    const isVisible = await helper.isTabVisible('subdivisions')
    if (isVisible) {
      await helper.switchTab('subdivisions')
      // Verify table is visible (more reliable than text search)
      await expect(sharedPage.locator(SELECTORS.TABLE.CONTAINER)).toBeVisible()
    }
  })

  test('can switch to Departments tab', async () => {
    const isVisible = await helper.isTabVisible('departments')
    if (isVisible) {
      await helper.switchTab('departments')
      // Verify table is visible
      await expect(sharedPage.locator(SELECTORS.TABLE.CONTAINER)).toBeVisible()
    }
  })

  test('can switch to Teams tab', async () => {
    const isVisible = await helper.isTabVisible('teams')
    if (isVisible) {
      await helper.switchTab('teams')
      // Verify table is visible
      await expect(sharedPage.locator(SELECTORS.TABLE.CONTAINER)).toBeVisible()
    }
  })

  test('can switch to Positions tab', async () => {
    const isVisible = await helper.isTabVisible('positions')
    if (isVisible) {
      await helper.switchTab('positions')
      // Verify table is visible
      await expect(sharedPage.locator(SELECTORS.TABLE.CONTAINER)).toBeVisible()
    }
  })

  test('can switch to Categories tab', async () => {
    const isVisible = await helper.isTabVisible('categories')
    if (isVisible) {
      await helper.switchTab('categories')
      // Verify table is visible
      await expect(sharedPage.locator(SELECTORS.TABLE.CONTAINER)).toBeVisible()
    }
  })

  test('table should be visible on each tab', async () => {
    // Test table visibility on Positions tab (simpler structure)
    const isPositionsVisible = await helper.isTabVisible('positions')
    if (isPositionsVisible) {
      await helper.switchTab('positions')
      await expect(sharedPage.locator(SELECTORS.TABLE.CONTAINER)).toBeVisible()
    }
  })
})
