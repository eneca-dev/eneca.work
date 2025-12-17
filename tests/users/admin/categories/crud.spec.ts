/**
 * CRUD Tests for Categories Tab
 *
 * Tests Create, Read, Update, Delete operations for categories
 * Uses АВТОТЕСТ- prefix for test data isolation
 */

import { test, expect, Page } from '@playwright/test'
import { AdminPanelHelper } from '../helpers/admin-panel.helper'
import { TEST_DATA, EMPTY_STATE_MESSAGES, TIMEOUTS, SELECTORS } from '../constants/selectors'

test.describe('Admin Panel - Categories CRUD', () => {
  let helper: AdminPanelHelper
  let sharedPage: Page

  // Test data
  const testCategory = TEST_DATA.CATEGORY
  const testCategoryUpdated = TEST_DATA.CATEGORY_UPDATED

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    helper = new AdminPanelHelper(sharedPage)
    await helper.goto()

    // Switch to Categories tab
    await helper.switchTab('categories')
  })

  test.afterAll(async () => {
    // Cleanup: delete test categories
    try {
      await helper.cleanupTestData('category')
    } catch (e) {
      console.log('Cleanup error:', e)
    }
    await sharedPage.close()
  })

  // ===========================================================================
  // CREATE Tests
  // ===========================================================================

  test('should open create category modal', async () => {
    await helper.clickCreateButton('category')
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Verify modal title
    const title = sharedPage.locator(SELECTORS.ENTITY_MODAL.TITLE)
    await expect(title).toContainText('Создать категорию')

    // Close modal for next test
    await helper.clickCancelButton()
  })

  test('should not allow saving empty name', async () => {
    await helper.clickCreateButton('category')

    // Try to save without entering name
    const isSaveDisabled = await helper.isSaveButtonDisabled()
    expect(isSaveDisabled).toBe(true)

    await helper.clickCancelButton()
  })

  test('should create new category', async () => {
    await helper.createEntity('category', testCategory)

    // Verify category was created
    await helper.search('category', testCategory)
    const exists = await helper.entityExists(testCategory)
    expect(exists).toBe(true)

    await helper.clearSearch('category')
  })

  test('should show validation error for duplicate name', async () => {
    await helper.clickCreateButton('category')
    await helper.fillEntityName(testCategory) // Same name as already created

    // Wait for validation
    await sharedPage.waitForTimeout(TIMEOUTS.DEBOUNCE)

    // Check for error message
    const error = await helper.getValidationError()
    expect(error).not.toBeNull()

    await helper.clickCancelButton()
  })

  // ===========================================================================
  // READ Tests
  // ===========================================================================

  test('should search for category', async () => {
    await helper.search('category', testCategory)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const exists = await helper.entityExists(testCategory)
    expect(exists).toBe(true)

    await helper.clearSearch('category')
  })

  test('should filter results by search query', async () => {
    await helper.search('category', TEST_DATA.PREFIX)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Get all visible names
    const names = await helper.getVisibleEntityNames()
    // All visible names should contain the prefix
    const allMatch = names.every(name => name.includes(TEST_DATA.PREFIX) || name.trim() === '')
    expect(allMatch).toBe(true)

    await helper.clearSearch('category')
  })

  test('should show empty state when no results found', async () => {
    await helper.search('category', 'NONEXISTENT_CATEGORY_XYZ_123')
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const rowCount = await helper.getRowCount()
    // Should show "not found" message or empty table
    expect(rowCount).toBeLessThanOrEqual(1)

    await helper.clearSearch('category')
  })

  // ===========================================================================
  // UPDATE Tests
  // ===========================================================================

  test('should open edit modal with correct data', async () => {
    await helper.search('category', testCategory)
    await helper.clickEditButton(testCategory)

    // Verify modal is open
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Verify title indicates edit mode
    const title = sharedPage.locator(SELECTORS.ENTITY_MODAL.TITLE)
    await expect(title).toContainText('Редактировать')

    // Verify name is pre-filled
    const input = sharedPage.locator(SELECTORS.ENTITY_MODAL.NAME_INPUT).first()
    const value = await input.inputValue()
    expect(value).toBe(testCategory)

    await helper.clickCancelButton()
    await helper.clearSearch('category')
  })

  test('should update category name', async () => {
    await helper.search('category', testCategory)
    await helper.editEntityName(testCategory, testCategoryUpdated)

    // Verify old name no longer exists
    await helper.search('category', testCategory)
    const oldExists = await helper.entityExists(testCategory)
    expect(oldExists).toBe(false)

    // Verify new name exists
    await helper.search('category', testCategoryUpdated)
    const newExists = await helper.entityExists(testCategoryUpdated)
    expect(newExists).toBe(true)

    await helper.clearSearch('category')
  })

  // ===========================================================================
  // DELETE Tests
  // ===========================================================================

  test('should open delete confirmation modal', async () => {
    await helper.search('category', testCategoryUpdated)
    await helper.clickDeleteButton(testCategoryUpdated)

    // Verify delete modal is open
    await expect(sharedPage.locator(SELECTORS.DELETE_MODAL.MODAL)).toBeVisible()

    // Verify entity name is mentioned in the modal
    const modalText = await sharedPage.locator(SELECTORS.DELETE_MODAL.MESSAGE).textContent()
    expect(modalText).toContain(testCategoryUpdated)

    // Cancel deletion for now
    await helper.cancelDelete()
    await helper.clearSearch('category')
  })

  test('should delete category', async () => {
    await helper.search('category', testCategoryUpdated)
    await helper.deleteEntity(testCategoryUpdated)

    // Verify category no longer exists - empty state message should appear
    await helper.search('category', testCategoryUpdated)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)
    await helper.verifyEmptyStateMessage(EMPTY_STATE_MESSAGES.CATEGORIES)

    await helper.clearSearch('category')
  })
})
