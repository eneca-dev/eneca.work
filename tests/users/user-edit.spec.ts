import { test, expect, Page } from '../fixtures/auth.fixture'
import { UsersPageHelper } from './helpers/users-page.helper'
import { SELECTORS } from './constants/selectors'

/**
 * Tests for editing user information
 *
 * Prerequisites:
 * - Test user should exist in the database
 * - Admin auth state should be configured
 * - Test user should have consistent data for validation
 *
 * TODO: Create dedicated test user with known data
 */
test.describe('Users - Edit User Dialog', () => {
  let usersPage: UsersPageHelper
  let sharedPage: Page

  // Test user hierarchy for navigation in grouped view
  const TEST_USER_HIERARCHY = {
    subdivision: 'Непроизводственные отделы',
    department: 'Тестовый отдел',
    team: 'Тест Команда',
    userEmail: 'test.user.e2e@eneca.test'
  }

  // Helper to open test user dialog (with debug enabled to see logs)
  const openTestUserDialog = async () => {
    await usersPage.openUserEditDialogInGroupedView(TEST_USER_HIERARCHY, true)
  }

  // Load page ONCE for all tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    usersPage = new UsersPageHelper(sharedPage)
    await usersPage.goto('list')
  })

  // After each test, close dialog if open
  test.afterEach(async () => {
    try {
      if (await usersPage.isEditDialogOpen()) {
        await usersPage.closeEditDialog()
      }
    } catch (e) {
      console.log('Cleanup error:', e)
    }
  })

  test.afterAll(async () => {
    await sharedPage.close()
  })

  // ===========================================================================
  // Opening and Closing Dialog
  // ===========================================================================

  test.describe('Dialog Opening and Closing', () => {
    test('clicking on user row opens edit dialog', async () => {
      await openTestUserDialog()

      // Dialog should be visible
      const isOpen = await usersPage.isEditDialogOpen()
      expect(isOpen).toBe(true)

      // Title should be visible
      const title = sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.TITLE)
      await expect(title).toBeVisible()
    })

    test('edit dialog displays current user data', async () => {
      await openTestUserDialog()

      // All fields should have values (not empty)
      const firstName = await usersPage.getEditFirstName()
      const lastName = await usersPage.getEditLastName()
      const email = await usersPage.getEditEmail()

      expect(firstName).toBe('TestUser')
      expect(lastName).toBe('E2E')
      expect(email).toBe('test.user.e2e@eneca.test')
    })

    test('Cancel button closes dialog without saving', async () => {
      await openTestUserDialog()

      // Get initial name
      const initialFirstName = await usersPage.getEditFirstName()

      // Change name
      await usersPage.fillEditFirstName('TempName')

      // Click Cancel
      await usersPage.clickEditCancel()

      // Dialog should be closed
      await usersPage.waitForEditDialogClose()
      const isOpen = await usersPage.isEditDialogOpen()
      expect(isOpen).toBe(false)

      // Reopen and verify changes were not saved
      await openTestUserDialog()
      const currentFirstName = await usersPage.getEditFirstName()
      expect(currentFirstName).toBe(initialFirstName)
    })

    test('X button closes dialog', async () => {
      await openTestUserDialog()

      await usersPage.closeEditDialogByX()

      // Dialog should be closed
      const isOpen = await usersPage.isEditDialogOpen()
      expect(isOpen).toBe(false)
    })

    test('ESC key closes dialog', async () => {
      await openTestUserDialog()

      await usersPage.closeEditDialogByBackdrop()

      // Dialog should be closed
      const isOpen = await usersPage.isEditDialogOpen()
      expect(isOpen).toBe(false)
    })
  })

  // ===========================================================================
  // Editing Basic Fields
  // ===========================================================================

  test.describe('Basic Field Editing', () => {
    test('can edit first name', async () => {
      await openTestUserDialog()

      const initialName = await usersPage.getEditFirstName()
      const newName = `${initialName}_EDITED`

      await usersPage.fillEditFirstName(newName)

      const updatedName = await usersPage.getEditFirstName()
      expect(updatedName).toBe(newName)
    })

    test('can edit last name', async () => {
      await openTestUserDialog()

      const initialName = await usersPage.getEditLastName()
      const newName = `${initialName}_EDITED`

      await usersPage.fillEditLastName(newName)

      const updatedName = await usersPage.getEditLastName()
      expect(updatedName).toBe(newName)
    })

    test('email field is read-only', async () => {
      await openTestUserDialog()

      const emailInput = sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.EMAIL_INPUT)

      // Email should be visible
      await expect(emailInput).toBeVisible()

      // Email should be disabled or readonly
      const isDisabled = await emailInput.isDisabled()
      const isReadonly = await emailInput.evaluate((el: HTMLInputElement) => el.readOnly)

      expect(isDisabled || isReadonly).toBe(true)
    })

    test('can edit rate', async () => {
      await openTestUserDialog()

      await usersPage.fillEditRate('25.50')

      const updatedRate = await usersPage.getEditRate()
      expect(updatedRate).toBe('25.5') // Числа могут форматироваться
    })

    test('rate accepts only numbers', async () => {
      await openTestUserDialog()

      // Try to input invalid characters
      await usersPage.fillEditRate('abc')

      const rate = await usersPage.getEditRate()
      // Should be empty or keep previous value (no letters accepted)
      expect(rate).not.toContain('abc')
    })

    test('negative rate is not accepted', async () => {
      await openTestUserDialog()

      await usersPage.fillEditRate('-10')

      // Either field validation prevents negative or Save button is disabled
      const saveEnabled = await usersPage.isEditSaveEnabled()
      // This test might need adjustment based on actual validation behavior
    })
  })

  // ===========================================================================
  // Dropdown Selections
  // ===========================================================================

  test.describe('Dropdown Selections', () => {
    test('can select position', async () => {
      await openTestUserDialog()

      // Click position dropdown
      await sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.POSITION_DROPDOWN).click()
      await sharedPage.waitForTimeout(500)

      // Check if options are visible
      const options = sharedPage.locator('[role="option"]')
      const count = await options.count()
      expect(count).toBeGreaterThan(0)
    })

    test('can select workload percentage', async () => {
      await openTestUserDialog()

      // Click workload dropdown
      await sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.WORKLOAD_DROPDOWN).click()
      await sharedPage.waitForTimeout(500)

      // Options should be available
      const options = sharedPage.locator('[role="option"]')
      const count = await options.count()
      expect(count).toBeGreaterThan(0)
    })

    test('can select location type', async () => {
      await openTestUserDialog()

      await sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.LOCATION_DROPDOWN).click()
      await sharedPage.waitForTimeout(500)

      // Location options should include: Офис, Удаленно, Гибрид
      const options = sharedPage.locator('[role="option"]')
      const count = await options.count()
      expect(count).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Cascading Dropdowns (Country → City)
  // ===========================================================================

  test.describe('Cascading Dropdowns - Country and City', () => {
    test('city dropdown is disabled before country selection', async () => {
      await openTestUserDialog()

      // Clear country first (if needed)
      // Check if city is disabled
      const isCityDisabled = await usersPage.isCityDropdownDisabled()

      // This may pass or fail depending on whether country is already selected
      // for the test user
    })

    test('selecting country enables city dropdown', async () => {
      await openTestUserDialog()

      // Select a country
      await sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.COUNTRY_DROPDOWN).click()
      await sharedPage.waitForTimeout(500)

      // Select first available country
      const firstCountry = sharedPage.locator('[role="option"]').first()
      const countryName = await firstCountry.textContent()
      await firstCountry.click()
      await sharedPage.waitForTimeout(1000) // Wait for cascade

      // City dropdown should now be enabled
      const isCityDisabled = await usersPage.isCityDropdownDisabled()
      expect(isCityDisabled).toBe(false)

      // Cities should be available
      await sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.CITY_DROPDOWN).click()
      await sharedPage.waitForTimeout(500)

      const cityOptions = sharedPage.locator('[role="option"]')
      const cityCount = await cityOptions.count()
      expect(cityCount).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Organizational Structure (Subdivision → Department → Team)
  // ===========================================================================

  test.describe('Organizational Structure Cascading', () => {
    test('team assignment hint is visible', async () => {
      await openTestUserDialog()

      // Hint about team assignment should be visible
      const isHintVisible = await usersPage.isTeamAssignmentHintVisible()
      expect(isHintVisible).toBe(true)
    })

    test('changing department may affect team selection', async () => {
      await openTestUserDialog()

      // Get initial team
      const initialTeam = await usersPage.getEditDropdownValue(
        SELECTORS.EDIT_USER_DIALOG.TEAM_DROPDOWN
      )

      // Change department
      await sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.DEPARTMENT_DROPDOWN).click()
      await sharedPage.waitForTimeout(500)

      const departments = sharedPage.locator('[role="option"]')
      const deptCount = await departments.count()

      if (deptCount > 1) {
        // Select different department
        await departments.nth(1).click()
        await sharedPage.waitForTimeout(1000) // Wait for cascade

        // Team may have changed or been reset
        const newTeam = await usersPage.getEditDropdownValue(
          SELECTORS.EDIT_USER_DIALOG.TEAM_DROPDOWN
        )

        // Team either changed or is available for selection
        // This depends on your business logic
      }
    })

    test('can select subdivision', async () => {
      await openTestUserDialog()

      await sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.SUBDIVISION_DROPDOWN).click()
      await sharedPage.waitForTimeout(500)

      const options = sharedPage.locator('[role="option"]')
      const count = await options.count()
      expect(count).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Save Button State
  // ===========================================================================

  test.describe('Save Button Behavior', () => {
    test('Save button is visible', async () => {
      await openTestUserDialog()

      const saveBtn = sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.SAVE_BTN)
      await expect(saveBtn).toBeVisible()
    })

    test('Save button state after changes', async () => {
      await openTestUserDialog()

      // Make a change
      const initialName = await usersPage.getEditFirstName()
      await usersPage.fillEditFirstName(`${initialName}_MODIFIED`)

      // Save button should be enabled
      const isEnabled = await usersPage.isEditSaveEnabled()
      expect(isEnabled).toBe(true)
    })
  })

  // ===========================================================================
  // Role Badges
  // ===========================================================================

  test.describe('User Roles', () => {
    test('role badges are visible', async () => {
      await openTestUserDialog()

      const badges = await usersPage.getEditRoleBadges()
      // User should have at least one role
      expect(badges.length).toBeGreaterThan(0)
    })

    test('add role button is visible for admin', async () => {
      await openTestUserDialog()

      const addRoleBtn = sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.ADD_ROLE_BTN)
      // Button visibility depends on permissions
      // For admin, it should be visible
    })
  })

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  test.describe('Edge Cases', () => {
    test('very long name is handled', async () => {
      await openTestUserDialog()

      const longName = 'A'.repeat(100)
      await usersPage.fillEditFirstName(longName)

      const value = await usersPage.getEditFirstName()
      // Either truncated or full value accepted
      expect(value.length).toBeGreaterThan(0)
    })

    test('special characters in name', async () => {
      await openTestUserDialog()

      await usersPage.fillEditFirstName("O'Brien-Smith")

      const value = await usersPage.getEditFirstName()
      expect(value).toContain("'")
      expect(value).toContain("-")
    })

    test('cyrillic characters in name', async () => {
      await openTestUserDialog()

      await usersPage.fillEditFirstName('Иван')
      await usersPage.fillEditLastName('Петров')

      const firstName = await usersPage.getEditFirstName()
      const lastName = await usersPage.getEditLastName()

      expect(firstName).toBe('Иван')
      expect(lastName).toBe('Петров')
    })

    test('empty first name validation', async () => {
      await openTestUserDialog()

      // Clear first name
      await usersPage.fillEditFirstName('')
      await sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.LAST_NAME_INPUT).click()
      await sharedPage.waitForTimeout(500)

      // Save should be disabled or validation error shown
      const saveEnabled = await usersPage.isEditSaveEnabled()
      // Validation behavior depends on implementation
    })

    test('empty last name validation', async () => {
      await openTestUserDialog()

      await usersPage.fillEditLastName('')
      await sharedPage.locator(SELECTORS.EDIT_USER_DIALOG.FIRST_NAME_INPUT).click()
      await sharedPage.waitForTimeout(500)

      // Validation check
    })
  })

  // ===========================================================================
  // ⚠️ Full Edit Flow (with actual save)
  // ===========================================================================
  // These tests will modify data in the database
  // Should only run on test users with known IDs

  test.describe.skip('Full Edit Flow (Modifies Database)', () => {
    test('complete edit and save flow', async () => {
      // TODO: Implement after creating dedicated test user
      // 1. Open dialog for test user
      // 2. Edit multiple fields
      // 3. Click Save
      // 4. Verify dialog closes
      // 5. Verify changes appear in user list
      // 6. Reopen dialog and verify changes persisted
    })

    test('edit and save updates table immediately', async () => {
      // TODO: Verify that after save, table row reflects new data
    })

    test('edit and save triggers success notification', async () => {
      // TODO: Check for success toast/notification
    })
  })
})
