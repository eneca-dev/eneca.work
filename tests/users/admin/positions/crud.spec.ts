/**
 * CRUD Tests for Positions Tab
 *
 * Tests Create, Read, Update, Delete operations for positions
 * Uses АВТОТЕСТ- prefix for test data isolation
 */

import { test, expect, Page } from '@playwright/test'
import { AdminPanelHelper } from '../helpers/admin-panel.helper'
import { TEST_DATA, EMPTY_STATE_MESSAGES, TIMEOUTS, SELECTORS } from '../constants/selectors'

test.describe('Admin Panel - Positions CRUD', () => {
  let helper: AdminPanelHelper
  let sharedPage: Page

  // Test data
  const testPosition = TEST_DATA.POSITION
  const testPositionUpdated = TEST_DATA.POSITION_UPDATED

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    helper = new AdminPanelHelper(sharedPage)
    await helper.goto()

    // Switch to Positions tab
    await helper.switchTab('positions')
  })

  test.afterAll(async () => {
    // Cleanup: delete test positions
    try {
      await helper.cleanupTestData('position')
    } catch (e) {
      console.log('Cleanup error:', e)
    }
    await sharedPage.close()
  })

  // ===========================================================================
  // CREATE Tests
  // ===========================================================================

  test('should open create position modal', async () => {
    await helper.clickCreateButton('position')
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Close modal for next test
    await helper.clickCancelButton()
  })

  test('should not allow saving empty name', async () => {
    await helper.clickCreateButton('position')

    // Try to save without entering name
    const isSaveDisabled = await helper.isSaveButtonDisabled()
    expect(isSaveDisabled).toBe(true)

    await helper.clickCancelButton()
  })

  test('should create new position', async () => {
    await helper.createEntity('position', testPosition)

    // Verify position was created
    await helper.search('position', testPosition)
    const exists = await helper.entityExists(testPosition)
    expect(exists).toBe(true)

    await helper.clearSearch('position')
  })

  test('should show validation error for duplicate name', async () => {
    await helper.clickCreateButton('position')
    await helper.fillEntityName(testPosition) // Same name as already created

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

  test('should search for position', async () => {
    await helper.search('position', testPosition)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const exists = await helper.entityExists(testPosition)
    expect(exists).toBe(true)

    await helper.clearSearch('position')
  })

  test('should show empty state when no results found', async () => {
    await helper.search('position', 'NONEXISTENT_POSITION_XYZ_123')
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const rowCount = await helper.getRowCount()
    // Should show "not found" message or empty table
    expect(rowCount).toBeLessThanOrEqual(1) // 1 for empty state row

    await helper.clearSearch('position')
  })

  // ===========================================================================
  // UPDATE Tests
  // ===========================================================================

  test('should open edit modal with correct data', async () => {
    await helper.search('position', testPosition)
    await helper.clickEditButton(testPosition)

    // Verify modal is open
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Verify name is pre-filled
    const input = sharedPage.locator(SELECTORS.ENTITY_MODAL.NAME_INPUT).first()
    const value = await input.inputValue()
    expect(value).toBe(testPosition)

    await helper.clickCancelButton()
    await helper.clearSearch('position')
  })

  test('should update position name', async () => {
    await helper.search('position', testPosition)
    await helper.editEntityName(testPosition, testPositionUpdated)

    // Verify old name no longer exists
    await helper.search('position', testPosition)
    const oldExists = await helper.entityExists(testPosition)
    expect(oldExists).toBe(false)

    // Verify new name exists
    await helper.search('position', testPositionUpdated)
    const newExists = await helper.entityExists(testPositionUpdated)
    expect(newExists).toBe(true)

    await helper.clearSearch('position')
  })

  // ===========================================================================
  // DELETE Tests
  // ===========================================================================

  test('should open delete confirmation modal', async () => {
    await helper.search('position', testPositionUpdated)
    await helper.clickDeleteButton(testPositionUpdated)

    // Verify delete modal is open
    await expect(sharedPage.locator(SELECTORS.DELETE_MODAL.MODAL)).toBeVisible()

    // Cancel deletion for now
    await helper.cancelDelete()
    await helper.clearSearch('position')
  })

  test('should delete position', async () => {
    await helper.search('position', testPositionUpdated)
    await helper.deleteEntity(testPositionUpdated)

    // Verify position no longer exists - empty state message should appear
    await helper.search('position', testPositionUpdated)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)
    await helper.verifyEmptyStateMessage(EMPTY_STATE_MESSAGES.POSITIONS)

    await helper.clearSearch('position')
  })
})
