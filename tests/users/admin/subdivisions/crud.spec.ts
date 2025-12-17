/**
 * CRUD Tests for Subdivisions Tab
 *
 * Tests Create, Read, Update, Delete operations for subdivisions
 * Uses АВТОТЕСТ- prefix for test data isolation
 *
 * Note: Subdivisions have additional complexity:
 * - Head (руководитель) management
 * - Statistics (departments count, employees count)
 */

import { test, expect, Page } from '@playwright/test'
import { AdminPanelHelper } from '../helpers/admin-panel.helper'
import { TEST_DATA, EMPTY_STATE_MESSAGES, TIMEOUTS, SELECTORS } from '../constants/selectors'

test.describe('Admin Panel - Subdivisions CRUD', () => {
  let helper: AdminPanelHelper
  let sharedPage: Page

  // Test data
  const testSubdivision = TEST_DATA.SUBDIVISION
  const testSubdivisionUpdated = TEST_DATA.SUBDIVISION_UPDATED

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    helper = new AdminPanelHelper(sharedPage)
    await helper.goto()

    // Switch to Subdivisions tab
    await helper.switchTab('subdivisions')
  })

  test.afterAll(async () => {
    // Cleanup: delete test subdivisions
    try {
      await helper.switchTab('subdivisions')
      await helper.cleanupTestData('subdivision')
    } catch (e) {
      console.log('Cleanup error:', e)
    }
    await sharedPage.close()
  })

  // ===========================================================================
  // CREATE Tests
  // ===========================================================================

  test('should open create subdivision modal', async () => {
    await helper.clickCreateButton('subdivision')
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Close modal for next test
    await helper.clickCancelButton()
  })

  test('should not allow saving empty name', async () => {
    await helper.clickCreateButton('subdivision')

    // Try to save without entering name
    const isSaveDisabled = await helper.isSaveButtonDisabled()
    expect(isSaveDisabled).toBe(true)

    await helper.clickCancelButton()
  })

  test('should create new subdivision', async () => {
    await helper.createEntity('subdivision', testSubdivision)

    // Wait for data refresh
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Verify subdivision was created
    await helper.search('subdivision', testSubdivision)
    const exists = await helper.entityExists(testSubdivision)
    expect(exists).toBe(true)

    await helper.clearSearch('subdivision')
  })

  test('should show validation error for duplicate name', async () => {
    await helper.clickCreateButton('subdivision')
    await helper.fillEntityName(testSubdivision) // Same name as already created

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

  test('should search for subdivision', async () => {
    await helper.search('subdivision', testSubdivision)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const exists = await helper.entityExists(testSubdivision)
    expect(exists).toBe(true)

    await helper.clearSearch('subdivision')
  })

  test('should display subdivision table columns', async () => {
    // Verify table headers exist
    const headers = sharedPage.locator(`${SELECTORS.TABLE.HEADER} ${SELECTORS.TABLE.HEADER_CELL}`)
    const headerTexts = await headers.allTextContents()

    // Check expected columns
    expect(headerTexts.join(' ')).toContain('Название')
    expect(headerTexts.join(' ')).toContain('Руководитель')
    expect(headerTexts.join(' ')).toContain('Отделов')
    expect(headerTexts.join(' ')).toContain('Сотрудников')
  })

  test('should show "Не назначен" for new subdivision without head', async () => {
    await helper.search('subdivision', testSubdivision)

    const row = await helper.findRowByName(testSubdivision)
    const rowText = await row.textContent()

    // New subdivision should have no head assigned
    expect(rowText).toContain('Не назначен')

    await helper.clearSearch('subdivision')
  })

  // ===========================================================================
  // UPDATE Tests
  // ===========================================================================

  test('should open edit modal with correct data', async () => {
    await helper.search('subdivision', testSubdivision)
    await helper.clickEditButton(testSubdivision)

    // Verify modal is open
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Verify name is pre-filled
    const input = sharedPage.locator(SELECTORS.ENTITY_MODAL.NAME_INPUT).first()
    const value = await input.inputValue()
    expect(value).toBe(testSubdivision)

    await helper.clickCancelButton()
    await helper.clearSearch('subdivision')
  })

  test('should update subdivision name', async () => {
    await helper.search('subdivision', testSubdivision)
    await helper.editEntityName(testSubdivision, testSubdivisionUpdated)

    // Wait for refresh
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Verify old name no longer exists
    await helper.search('subdivision', testSubdivision)
    const oldExists = await helper.entityExists(testSubdivision)
    expect(oldExists).toBe(false)

    // Verify new name exists
    await helper.search('subdivision', testSubdivisionUpdated)
    const newExists = await helper.entityExists(testSubdivisionUpdated)
    expect(newExists).toBe(true)

    await helper.clearSearch('subdivision')
  })

  // ===========================================================================
  // HEAD MANAGEMENT Tests
  // ===========================================================================

  test('should show edit head button', async () => {
    await helper.search('subdivision', testSubdivisionUpdated)

    const row = await helper.findRowByName(testSubdivisionUpdated)
    const editHeadBtn = row.locator(SELECTORS.HEAD_MANAGEMENT.EDIT_HEAD_BTN)

    // Edit head button should be visible
    await expect(editHeadBtn).toBeVisible()

    await helper.clearSearch('subdivision')
  })

  test('should open assign head popover', async () => {
    await helper.search('subdivision', testSubdivisionUpdated)

    await helper.clickEditHeadButton(testSubdivisionUpdated)

    // Popover with "Назначить" option should appear
    const assignOption = sharedPage.locator(SELECTORS.HEAD_MANAGEMENT.ASSIGN_HEAD)
    await expect(assignOption).toBeVisible()

    // Close popover by clicking elsewhere
    await sharedPage.keyboard.press('Escape')
    await helper.clearSearch('subdivision')
  })

  test('should open head assignment modal', async () => {
    await helper.search('subdivision', testSubdivisionUpdated)

    await helper.clickEditHeadButton(testSubdivisionUpdated)
    await helper.clickAssignHeadInPopover()

    // Head modal should be visible
    await expect(sharedPage.locator(SELECTORS.HEAD_MODAL.MODAL)).toBeVisible()

    // Modal should have search input
    const searchInput = sharedPage.locator(SELECTORS.HEAD_MODAL.SEARCH_INPUT)
    await expect(searchInput).toBeVisible()

    // Close modal
    await sharedPage.locator(SELECTORS.HEAD_MODAL.CANCEL_BTN).click()
    await helper.clearSearch('subdivision')
  })

  // ===========================================================================
  // DELETE Tests
  // ===========================================================================

  test('should open delete confirmation modal', async () => {
    await helper.search('subdivision', testSubdivisionUpdated)
    await helper.clickDeleteButton(testSubdivisionUpdated)

    // Verify delete modal is open
    await expect(sharedPage.locator(SELECTORS.DELETE_MODAL.MODAL)).toBeVisible()

    // Cancel deletion for now
    await helper.cancelDelete()
    await helper.clearSearch('subdivision')
  })

  test('should delete subdivision', async () => {
    await helper.search('subdivision', testSubdivisionUpdated)
    await helper.deleteEntity(testSubdivisionUpdated)

    // Wait for refresh
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Verify subdivision no longer exists - empty state message should appear
    await helper.search('subdivision', testSubdivisionUpdated)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)
    await helper.verifyEmptyStateMessage(EMPTY_STATE_MESSAGES.SUBDIVISIONS)

    await helper.clearSearch('subdivision')
  })
})
