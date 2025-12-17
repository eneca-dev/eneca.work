/**
 * CRUD Tests for Departments Tab
 *
 * Tests Create, Read, Update, Delete operations for departments
 * Uses АВТОТЕСТ- prefix for test data isolation
 *
 * Note: Departments require a subdivision to be selected during creation
 * and have head (руководитель) management.
 */

import { test, expect, Page } from '@playwright/test'
import { AdminPanelHelper } from '../helpers/admin-panel.helper'
import { TEST_DATA, EMPTY_STATE_MESSAGES, TIMEOUTS, SELECTORS } from '../constants/selectors'

test.describe('Admin Panel - Departments CRUD', () => {
  let helper: AdminPanelHelper
  let sharedPage: Page

  // Test data
  const testDepartment = TEST_DATA.DEPARTMENT
  const testDepartmentUpdated = TEST_DATA.DEPARTMENT_UPDATED

  // We need to use an existing subdivision for department creation
  // The tests will use the first available subdivision
  let existingSubdivision: string | null = null

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    helper = new AdminPanelHelper(sharedPage)
    await helper.goto()

    // First, get an existing subdivision to use for department creation
    await helper.switchTab('subdivisions')
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Get first subdivision name from table
    const subdivisionNames = await helper.getVisibleEntityNames()
    if (subdivisionNames.length > 0) {
      // Use first non-test subdivision
      existingSubdivision = subdivisionNames.find(name => !name.startsWith(TEST_DATA.PREFIX)) || subdivisionNames[0]
    }

    // Switch to Departments tab
    await helper.switchTab('departments')
  })

  test.afterAll(async () => {
    // Cleanup: delete test departments
    try {
      await helper.switchTab('departments')
      await helper.cleanupTestData('department')
    } catch (e) {
      console.log('Cleanup error:', e)
    }
    await sharedPage.close()
  })

  // ===========================================================================
  // CREATE Tests
  // ===========================================================================

  test('should open create department modal', async () => {
    await helper.clickCreateButton('department')
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Should have subdivision select field
    const selectTrigger = sharedPage.locator('[role="dialog"] button[role="combobox"]')
    await expect(selectTrigger).toBeVisible()

    // Close modal for next test
    await helper.clickCancelButton()
  })

  test('should not allow saving empty name', async () => {
    await helper.clickCreateButton('department')

    // Try to save without entering name (even with subdivision selected)
    const isSaveDisabled = await helper.isSaveButtonDisabled()
    expect(isSaveDisabled).toBe(true)

    await helper.clickCancelButton()
  })

  test('should create new department', async () => {
    test.skip(!existingSubdivision, 'No subdivision available for department creation')

    await helper.clickCreateButton('department')
    await helper.fillEntityName(testDepartment)

    // Select subdivision
    if (existingSubdivision) {
      await helper.selectDropdownOption(existingSubdivision)
    }

    await helper.clickSaveButton()
    await helper.waitForModalClose()
    await helper.waitForDataLoaded()

    // Wait for data refresh
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Verify department was created
    await helper.search('department', testDepartment)
    const exists = await helper.entityExists(testDepartment)
    expect(exists).toBe(true)

    await helper.clearSearch('department')
  })

  test('should show validation error for duplicate name', async () => {
    test.skip(!existingSubdivision, 'No subdivision available')

    await helper.clickCreateButton('department')
    await helper.fillEntityName(testDepartment) // Same name as already created

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

  test('should search for department', async () => {
    test.skip(!existingSubdivision, 'No test department created')

    await helper.search('department', testDepartment)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const exists = await helper.entityExists(testDepartment)
    expect(exists).toBe(true)

    await helper.clearSearch('department')
  })

  test('should display department table columns', async () => {
    // Verify table headers exist
    const headers = sharedPage.locator(`${SELECTORS.TABLE.HEADER} ${SELECTORS.TABLE.HEADER_CELL}`)
    const headerTexts = await headers.allTextContents()

    // Check expected columns
    expect(headerTexts.join(' ')).toContain('Название')
    expect(headerTexts.join(' ')).toContain('Подразделение')
    expect(headerTexts.join(' ')).toContain('Руководитель')
  })

  test('should show subdivision name for department', async () => {
    test.skip(!existingSubdivision, 'No test department created')

    await helper.search('department', testDepartment)

    const row = await helper.findRowByName(testDepartment)
    const rowText = await row.textContent()

    // Department should show its subdivision
    expect(rowText).toContain(existingSubdivision!)

    await helper.clearSearch('department')
  })

  test('should show "Не назначен" for new department without head', async () => {
    test.skip(!existingSubdivision, 'No test department created')

    await helper.search('department', testDepartment)

    const row = await helper.findRowByName(testDepartment)
    const rowText = await row.textContent()

    // New department should have no head assigned
    expect(rowText).toContain('Не назначен')

    await helper.clearSearch('department')
  })

  // ===========================================================================
  // UPDATE Tests
  // ===========================================================================

  test('should open edit modal with correct data', async () => {
    test.skip(!existingSubdivision, 'No test department created')

    await helper.search('department', testDepartment)
    await helper.clickEditButton(testDepartment)

    // Verify modal is open
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Verify name is pre-filled
    const input = sharedPage.locator(SELECTORS.ENTITY_MODAL.NAME_INPUT).first()
    const value = await input.inputValue()
    expect(value).toBe(testDepartment)

    await helper.clickCancelButton()
    await helper.clearSearch('department')
  })

  test('should update department name', async () => {
    test.skip(!existingSubdivision, 'No test department created')

    await helper.search('department', testDepartment)
    await helper.editEntityName(testDepartment, testDepartmentUpdated)

    // Wait for refresh
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Verify old name no longer exists
    await helper.search('department', testDepartment)
    const oldExists = await helper.entityExists(testDepartment)
    expect(oldExists).toBe(false)

    // Verify new name exists
    await helper.search('department', testDepartmentUpdated)
    const newExists = await helper.entityExists(testDepartmentUpdated)
    expect(newExists).toBe(true)

    await helper.clearSearch('department')
  })

  // ===========================================================================
  // HEAD MANAGEMENT Tests
  // ===========================================================================

  test('should show edit head button', async () => {
    test.skip(!existingSubdivision, 'No test department created')

    await helper.search('department', testDepartmentUpdated)

    const row = await helper.findRowByName(testDepartmentUpdated)
    const editHeadBtn = row.locator(SELECTORS.HEAD_MANAGEMENT.EDIT_HEAD_BTN)

    // Edit head button should be visible
    await expect(editHeadBtn).toBeVisible()

    await helper.clearSearch('department')
  })

  test('should open assign head popover', async () => {
    test.skip(!existingSubdivision, 'No test department created')

    await helper.search('department', testDepartmentUpdated)

    await helper.clickEditHeadButton(testDepartmentUpdated)

    // Popover with "Назначить" option should appear
    const assignOption = sharedPage.locator(SELECTORS.HEAD_MANAGEMENT.ASSIGN_HEAD)
    await expect(assignOption).toBeVisible()

    // Close popover
    await sharedPage.keyboard.press('Escape')
    await helper.clearSearch('department')
  })

  // ===========================================================================
  // DELETE Tests
  // ===========================================================================

  test('should open delete confirmation modal', async () => {
    test.skip(!existingSubdivision, 'No test department created')

    await helper.search('department', testDepartmentUpdated)
    await helper.clickDeleteButton(testDepartmentUpdated)

    // Verify delete modal is open
    await expect(sharedPage.locator(SELECTORS.DELETE_MODAL.MODAL)).toBeVisible()

    // Cancel deletion for now
    await helper.cancelDelete()
    await helper.clearSearch('department')
  })

  test('should delete department', async () => {
    test.skip(!existingSubdivision, 'No test department created')

    await helper.search('department', testDepartmentUpdated)
    await helper.deleteEntity(testDepartmentUpdated)

    // Wait for refresh
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Verify department no longer exists - empty state message should appear
    await helper.search('department', testDepartmentUpdated)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)
    await helper.verifyEmptyStateMessage(EMPTY_STATE_MESSAGES.DEPARTMENTS)

    await helper.clearSearch('department')
  })
})
