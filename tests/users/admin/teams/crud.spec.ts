/**
 * CRUD Tests for Teams Tab
 *
 * Tests Create, Read, Update, Delete operations for teams
 * Uses АВТОТЕСТ- prefix for test data isolation
 *
 * Note: Teams require a department to be selected during creation
 * and have:
 * - Head (руководитель/тимлид) management
 * - Department filter buttons
 * - "Назначить в команду" functionality
 */

import { test, expect, Page } from '@playwright/test'
import { AdminPanelHelper } from '../helpers/admin-panel.helper'
import { TEST_DATA, EMPTY_STATE_MESSAGES, TIMEOUTS, SELECTORS } from '../constants/selectors'

test.describe('Admin Panel - Teams CRUD', () => {
  let helper: AdminPanelHelper
  let sharedPage: Page

  // Test data
  const testTeam = TEST_DATA.TEAM
  const testTeamUpdated = TEST_DATA.TEAM_UPDATED

  // We need to use an existing department for team creation
  // The tests will use the first available department
  let existingDepartment: string | null = null

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    helper = new AdminPanelHelper(sharedPage)
    await helper.goto()

    // First, get an existing department to use for team creation
    await helper.switchTab('departments')
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Get first department name from table
    const departmentNames = await helper.getVisibleEntityNames()
    if (departmentNames.length > 0) {
      // Use first non-test department
      existingDepartment = departmentNames.find(name => !name.startsWith(TEST_DATA.PREFIX)) || departmentNames[0]
    }

    // Switch to Teams tab
    await helper.switchTab('teams')
  })

  test.afterAll(async () => {
    // Cleanup: delete test teams
    try {
      await helper.switchTab('teams')
      await helper.cleanupTestData('team')
    } catch (e) {
      console.log('Cleanup error:', e)
    }
    await sharedPage.close()
  })

  // ===========================================================================
  // CREATE Tests
  // ===========================================================================

  test('should open create team modal', async () => {
    await helper.clickCreateButton('team')
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Should have department select field
    const selectTrigger = sharedPage.locator('[role="dialog"] button[role="combobox"]')
    await expect(selectTrigger).toBeVisible()

    // Close modal for next test
    await helper.clickCancelButton()
  })

  test('should not allow saving empty name', async () => {
    await helper.clickCreateButton('team')

    // Try to save without entering name
    const isSaveDisabled = await helper.isSaveButtonDisabled()
    expect(isSaveDisabled).toBe(true)

    await helper.clickCancelButton()
  })

  test('should create new team', async () => {
    test.skip(!existingDepartment, 'No department available for team creation')

    await helper.clickCreateButton('team')
    await helper.fillEntityName(testTeam)

    // Select department
    if (existingDepartment) {
      await helper.selectDropdownOption(existingDepartment)
    }

    await helper.clickSaveButton()
    await helper.waitForModalClose()
    await helper.waitForDataLoaded()

    // Wait for data refresh
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Verify team was created
    await helper.search('team', testTeam)
    const exists = await helper.entityExists(testTeam)
    expect(exists).toBe(true)

    await helper.clearSearch('team')
  })

  test('should show validation error for duplicate name', async () => {
    test.skip(!existingDepartment, 'No department available')

    await helper.clickCreateButton('team')
    await helper.fillEntityName(testTeam) // Same name as already created

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

  test('should search for team', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeam)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const exists = await helper.entityExists(testTeam)
    expect(exists).toBe(true)

    await helper.clearSearch('team')
  })

  test('should display team table columns', async () => {
    // Verify table headers exist
    const headers = sharedPage.locator(`${SELECTORS.TABLE.HEADER} ${SELECTORS.TABLE.HEADER_CELL}`)
    const headerTexts = await headers.allTextContents()

    // Check expected columns
    expect(headerTexts.join(' ')).toContain('Название')
    expect(headerTexts.join(' ')).toContain('Отдел')
    expect(headerTexts.join(' ')).toContain('Руководитель')
  })

  test('should show department name for team', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeam)

    const row = await helper.findRowByName(testTeam)
    const rowText = await row.textContent()

    // Team should show its department
    expect(rowText).toContain(existingDepartment!)

    await helper.clearSearch('team')
  })

  test('should show "Не назначен" for new team without head', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeam)

    const row = await helper.findRowByName(testTeam)
    const rowText = await row.textContent()

    // New team should have no head assigned
    expect(rowText).toContain('Не назначен')

    await helper.clearSearch('team')
  })

  // ===========================================================================
  // DEPARTMENT FILTER Tests
  // ===========================================================================

  test('should show "Все отделы" filter button', async () => {
    const allDeptBtn = sharedPage.locator(SELECTORS.TEAMS_TAB.ALL_DEPARTMENTS_BTN)
    await expect(allDeptBtn).toBeVisible()
  })

  test('should show department filter buttons', async () => {
    // There should be multiple department filter buttons
    const deptButtons = sharedPage.locator(SELECTORS.TEAMS_TAB.DEPARTMENT_FILTER_BTN)
    const count = await deptButtons.count()
    expect(count).toBeGreaterThan(1) // At least "Все отделы" + 1 department
  })

  test('should filter teams by department', async () => {
    test.skip(!existingDepartment, 'No department available for filtering')

    // Click on department filter button
    await helper.filterTeamsByDepartment(existingDepartment!)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // All visible teams should belong to selected department
    const teamRows = sharedPage.locator(`${SELECTORS.TABLE.BODY} ${SELECTORS.TABLE.ROW}`)
    const rowCount = await teamRows.count()

    if (rowCount > 0) {
      // Check that first visible team shows the correct department
      const firstRow = teamRows.first()
      const rowText = await firstRow.textContent()
      expect(rowText).toContain(existingDepartment!)
    }

    // Reset filter
    await helper.showAllTeams()
  })

  // ===========================================================================
  // UPDATE Tests
  // ===========================================================================

  test('should open edit modal with correct data', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeam)
    await helper.clickEditButton(testTeam)

    // Verify modal is open
    await expect(sharedPage.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()

    // Verify name is pre-filled
    const input = sharedPage.locator(SELECTORS.ENTITY_MODAL.NAME_INPUT).first()
    const value = await input.inputValue()
    expect(value).toBe(testTeam)

    await helper.clickCancelButton()
    await helper.clearSearch('team')
  })

  test('should update team name', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeam)
    await helper.editEntityName(testTeam, testTeamUpdated)

    // Wait for refresh
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Verify old name no longer exists
    await helper.search('team', testTeam)
    const oldExists = await helper.entityExists(testTeam)
    expect(oldExists).toBe(false)

    // Verify new name exists
    await helper.search('team', testTeamUpdated)
    const newExists = await helper.entityExists(testTeamUpdated)
    expect(newExists).toBe(true)

    await helper.clearSearch('team')
  })

  // ===========================================================================
  // HEAD MANAGEMENT Tests
  // ===========================================================================

  test('should show edit head button', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeamUpdated)

    const row = await helper.findRowByName(testTeamUpdated)
    const editHeadBtn = row.locator(SELECTORS.HEAD_MANAGEMENT.EDIT_HEAD_BTN)

    // Edit head button should be visible
    await expect(editHeadBtn).toBeVisible()

    await helper.clearSearch('team')
  })

  test('should open assign head popover', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeamUpdated)

    await helper.clickEditHeadButton(testTeamUpdated)

    // Popover with "Назначить" option should appear
    const assignOption = sharedPage.locator(SELECTORS.HEAD_MANAGEMENT.ASSIGN_HEAD)
    await expect(assignOption).toBeVisible()

    // Close popover
    await sharedPage.keyboard.press('Escape')
    await helper.clearSearch('team')
  })

  // ===========================================================================
  // ASSIGN TO TEAM Tests
  // ===========================================================================

  test('should show "Назначить в команду" button', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeamUpdated)

    const row = await helper.findRowByName(testTeamUpdated)
    const assignBtn = row.locator(SELECTORS.CONTROLS.ASSIGN_TO_TEAM_BTN)

    // "Назначить в команду" button should be visible
    await expect(assignBtn).toBeVisible()

    await helper.clearSearch('team')
  })

  // ===========================================================================
  // DELETE Tests
  // ===========================================================================

  test('should open delete confirmation modal', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeamUpdated)
    await helper.clickDeleteButton(testTeamUpdated)

    // Verify delete modal is open
    await expect(sharedPage.locator(SELECTORS.DELETE_MODAL.MODAL)).toBeVisible()

    // Cancel deletion for now
    await helper.cancelDelete()
    await helper.clearSearch('team')
  })

  test('should delete team', async () => {
    test.skip(!existingDepartment, 'No test team created')

    await helper.search('team', testTeamUpdated)
    await helper.deleteEntity(testTeamUpdated)

    // Wait for refresh
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Verify team no longer exists - empty state message should appear
    await helper.search('team', testTeamUpdated)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)
    await helper.verifyEmptyStateMessage(EMPTY_STATE_MESSAGES.TEAMS)

    await helper.clearSearch('team')
  })
})
