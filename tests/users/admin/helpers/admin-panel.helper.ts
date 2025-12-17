import { Page, expect, Locator } from '@playwright/test'
import { SELECTORS, ROUTES, TEST_DATA, EMPTY_STATE_MESSAGES, TIMEOUTS, AdminTabType, EntityType } from '../constants/selectors'

/**
 * Helper class for interacting with Admin Panel
 * Follows Page Object pattern
 */
export class AdminPanelHelper {
  constructor(private page: Page) {}

  // ===========================================================================
  // Navigation
  // ===========================================================================

  /**
   * Navigate to Admin Panel and wait for it to load
   */
  async goto(): Promise<void> {
    await this.page.goto(ROUTES.ADMIN)
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.PAGE_LOAD })
    await this.page.waitForTimeout(TIMEOUTS.MEDIUM)
  }

  /**
   * Switch to a specific tab
   */
  async switchTab(tab: AdminTabType): Promise<void> {
    const tabSelectors: Record<AdminTabType, string> = {
      'subdivisions': SELECTORS.TABS.SUBDIVISIONS,
      'departments': SELECTORS.TABS.DEPARTMENTS,
      'teams': SELECTORS.TABS.TEAMS,
      'positions': SELECTORS.TABS.POSITIONS,
      'categories': SELECTORS.TABS.CATEGORIES,
      'roles': SELECTORS.TABS.ROLES,
    }

    await this.page.locator(tabSelectors[tab]).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
    await this.waitForDataLoaded()
  }

  /**
   * Check if a tab is visible
   */
  async isTabVisible(tab: AdminTabType): Promise<boolean> {
    const tabSelectors: Record<AdminTabType, string> = {
      'subdivisions': SELECTORS.TABS.SUBDIVISIONS,
      'departments': SELECTORS.TABS.DEPARTMENTS,
      'teams': SELECTORS.TABS.TEAMS,
      'positions': SELECTORS.TABS.POSITIONS,
      'categories': SELECTORS.TABS.CATEGORIES,
      'roles': SELECTORS.TABS.ROLES,
    }

    return await this.page.locator(tabSelectors[tab]).isVisible()
  }

  /**
   * Wait for data to be loaded (loading spinner disappears)
   */
  async waitForDataLoaded(): Promise<void> {
    const spinner = this.page.locator(SELECTORS.LOADING.SPINNER)
    try {
      await spinner.waitFor({ state: 'hidden', timeout: TIMEOUTS.DATA_LOAD })
    } catch {
      // Spinner might not appear for fast loads
    }
    await this.page.waitForTimeout(TIMEOUTS.SHORT)
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Get search input for specific entity type
   */
  private getSearchInput(entityType: EntityType): Locator {
    const searchSelectors: Record<EntityType, string> = {
      'subdivision': SELECTORS.CONTROLS.SEARCH_SUBDIVISIONS,
      'department': SELECTORS.CONTROLS.SEARCH_DEPARTMENTS,
      'team': SELECTORS.CONTROLS.SEARCH_TEAMS,
      'position': SELECTORS.CONTROLS.SEARCH_POSITIONS,
      'category': SELECTORS.CONTROLS.SEARCH_CATEGORIES,
    }

    return this.page.locator(searchSelectors[entityType])
  }

  /**
   * Search for entity by name
   */
  async search(entityType: EntityType, query: string): Promise<void> {
    const searchInput = this.getSearchInput(entityType)
    await searchInput.fill(query)
    await this.page.waitForTimeout(TIMEOUTS.DEBOUNCE)
  }

  /**
   * Clear search input
   */
  async clearSearch(entityType: EntityType): Promise<void> {
    const searchInput = this.getSearchInput(entityType)
    await searchInput.clear()
    await this.page.waitForTimeout(TIMEOUTS.DEBOUNCE)
  }

  // ===========================================================================
  // CRUD Operations - Create
  // ===========================================================================

  /**
   * Click create button for entity type
   */
  async clickCreateButton(entityType: EntityType): Promise<void> {
    const createSelectors: Record<EntityType, string> = {
      'subdivision': SELECTORS.CONTROLS.CREATE_SUBDIVISION,
      'department': SELECTORS.CONTROLS.CREATE_DEPARTMENT,
      'team': SELECTORS.CONTROLS.CREATE_TEAM,
      'position': SELECTORS.CONTROLS.CREATE_POSITION,
      'category': SELECTORS.CONTROLS.CREATE_CATEGORY,
    }

    await this.page.locator(createSelectors[entityType]).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
    await expect(this.page.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()
  }

  /**
   * Fill entity name in modal
   */
  async fillEntityName(name: string): Promise<void> {
    const input = this.page.locator(SELECTORS.ENTITY_MODAL.NAME_INPUT).first()
    await input.fill(name)
    await this.page.waitForTimeout(TIMEOUTS.DEBOUNCE)
  }

  /**
   * Select dropdown option in modal (for subdivision/department selects)
   */
  async selectDropdownOption(optionText: string): Promise<void> {
    // Click the select trigger
    const selectTrigger = this.page.locator('[role="dialog"] button[role="combobox"]').first()
    await selectTrigger.click()
    await this.page.waitForTimeout(TIMEOUTS.SHORT)

    // Select option
    const option = this.page.locator(`[role="option"]:has-text("${optionText}")`)
    await option.click()
    await this.page.waitForTimeout(TIMEOUTS.SHORT)
  }

  /**
   * Click save button in modal
   */
  async clickSaveButton(): Promise<void> {
    await this.page.locator(SELECTORS.ENTITY_MODAL.SAVE_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.MEDIUM)
  }

  /**
   * Click cancel button in modal
   */
  async clickCancelButton(): Promise<void> {
    await this.page.locator(SELECTORS.ENTITY_MODAL.CANCEL_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
  }

  /**
   * Check if save button is disabled
   */
  async isSaveButtonDisabled(): Promise<boolean> {
    return await this.page.locator(SELECTORS.ENTITY_MODAL.SAVE_BTN).isDisabled()
  }

  /**
   * Get validation error message from modal
   */
  async getValidationError(): Promise<string | null> {
    const errorEl = this.page.locator(SELECTORS.ENTITY_MODAL.ERROR_MESSAGE)
    if (await errorEl.isVisible()) {
      return await errorEl.textContent()
    }
    return null
  }

  /**
   * Create entity with given name (full flow)
   */
  async createEntity(entityType: EntityType, name: string, extraOptions?: { selectOption?: string }): Promise<void> {
    await this.clickCreateButton(entityType)
    await this.fillEntityName(name)

    if (extraOptions?.selectOption) {
      await this.selectDropdownOption(extraOptions.selectOption)
    }

    await this.clickSaveButton()
    await this.waitForModalClose()
    await this.waitForDataLoaded()
  }

  // ===========================================================================
  // CRUD Operations - Read
  // ===========================================================================

  /**
   * Find table row by entity name
   */
  async findRowByName(name: string): Promise<Locator> {
    return this.page.locator(`${SELECTORS.TABLE.CONTAINER} ${SELECTORS.TABLE.ROW}:has-text("${name}")`)
  }

  /**
   * Check if entity exists in table
   */
  async entityExists(name: string): Promise<boolean> {
    const row = await this.findRowByName(name)
    return await row.isVisible()
  }

  /**
   * Get all visible entity names from table
   */
  async getVisibleEntityNames(): Promise<string[]> {
    const cells = this.page.locator(`${SELECTORS.TABLE.BODY} ${SELECTORS.TABLE.ROW} ${SELECTORS.TABLE.CELL}:first-child`)
    const names = await cells.allTextContents()
    return names.map(n => n.trim()).filter(n => n.length > 0)
  }

  /**
   * Get row count in table
   */
  async getRowCount(): Promise<number> {
    const rows = this.page.locator(`${SELECTORS.TABLE.BODY} ${SELECTORS.TABLE.ROW}`)
    return await rows.count()
  }

  // ===========================================================================
  // CRUD Operations - Update
  // ===========================================================================

  /**
   * Click edit button for entity
   */
  async clickEditButton(entityName: string): Promise<void> {
    const row = await this.findRowByName(entityName)
    await row.locator(SELECTORS.CONTROLS.EDIT_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
    await expect(this.page.locator(SELECTORS.ENTITY_MODAL.MODAL)).toBeVisible()
  }

  /**
   * Edit entity name
   */
  async editEntityName(oldName: string, newName: string): Promise<void> {
    await this.clickEditButton(oldName)
    await this.fillEntityName(newName)
    await this.clickSaveButton()
    await this.waitForModalClose()
    await this.waitForDataLoaded()
  }

  // ===========================================================================
  // CRUD Operations - Delete
  // ===========================================================================

  /**
   * Click delete button for entity
   */
  async clickDeleteButton(entityName: string): Promise<void> {
    const row = await this.findRowByName(entityName)
    await row.locator(SELECTORS.CONTROLS.DELETE_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
    await expect(this.page.locator(SELECTORS.DELETE_MODAL.MODAL)).toBeVisible()
  }

  /**
   * Confirm deletion in modal
   */
  async confirmDelete(): Promise<void> {
    await this.page.locator(SELECTORS.DELETE_MODAL.DELETE_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.MEDIUM)
  }

  /**
   * Cancel deletion
   */
  async cancelDelete(): Promise<void> {
    await this.page.locator(SELECTORS.DELETE_MODAL.CANCEL_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
  }

  /**
   * Delete entity (full flow)
   */
  async deleteEntity(entityName: string): Promise<void> {
    await this.clickDeleteButton(entityName)
    await this.confirmDelete()
    await this.waitForModalClose()
    await this.waitForDataLoaded()
  }

  // ===========================================================================
  // Head Management (Subdivisions, Departments, Teams)
  // ===========================================================================

  /**
   * Click edit head button for entity
   */
  async clickEditHeadButton(entityName: string): Promise<void> {
    const row = await this.findRowByName(entityName)
    await row.locator(SELECTORS.HEAD_MANAGEMENT.EDIT_HEAD_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.SHORT)
  }

  /**
   * Click "Назначить" in popover
   */
  async clickAssignHeadInPopover(): Promise<void> {
    await this.page.locator(SELECTORS.HEAD_MANAGEMENT.ASSIGN_HEAD).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
    await expect(this.page.locator(SELECTORS.HEAD_MODAL.MODAL)).toBeVisible()
  }

  /**
   * Click "Сменить" in popover
   */
  async clickChangeHeadInPopover(): Promise<void> {
    await this.page.locator(SELECTORS.HEAD_MANAGEMENT.CHANGE_HEAD).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
    await expect(this.page.locator(SELECTORS.HEAD_MODAL.MODAL)).toBeVisible()
  }

  /**
   * Click "Убрать" in popover
   */
  async clickRemoveHeadInPopover(): Promise<void> {
    await this.page.locator(SELECTORS.HEAD_MANAGEMENT.REMOVE_HEAD).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
    await expect(this.page.locator(SELECTORS.REMOVE_HEAD_MODAL.MODAL)).toBeVisible()
  }

  /**
   * Search user in head assignment modal
   */
  async searchUserInHeadModal(query: string): Promise<void> {
    const searchInput = this.page.locator(SELECTORS.HEAD_MODAL.SEARCH_INPUT)
    await searchInput.fill(query)
    await this.page.waitForTimeout(TIMEOUTS.DEBOUNCE)
  }

  /**
   * Select user in head assignment modal
   */
  async selectUserInHeadModal(userName: string): Promise<void> {
    const userItem = this.page.locator(`${SELECTORS.HEAD_MODAL.USER_ITEM}:has-text("${userName}")`)
    await userItem.click()
    await this.page.waitForTimeout(TIMEOUTS.SHORT)
  }

  /**
   * Confirm head assignment
   */
  async confirmHeadAssignment(): Promise<void> {
    await this.page.locator(SELECTORS.HEAD_MODAL.ASSIGN_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.MEDIUM)
  }

  /**
   * Confirm head removal
   */
  async confirmHeadRemoval(): Promise<void> {
    await this.page.locator(SELECTORS.REMOVE_HEAD_MODAL.REMOVE_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.MEDIUM)
  }

  /**
   * Get head name from row
   */
  async getHeadName(entityName: string): Promise<string | null> {
    const row = await this.findRowByName(entityName)
    // Head column is typically second or third, look for avatar + name pattern
    const headCell = row.locator('td').nth(1) // Adjust index if needed
    const nameEl = headCell.locator('.font-medium')
    if (await nameEl.isVisible()) {
      return await nameEl.textContent()
    }
    // Check if "Не назначен"
    const notAssigned = headCell.locator(':has-text("Не назначен")')
    if (await notAssigned.isVisible()) {
      return null
    }
    return null
  }

  /**
   * Check if entity has head assigned
   */
  async hasHeadAssigned(entityName: string): Promise<boolean> {
    const headName = await this.getHeadName(entityName)
    return headName !== null
  }

  // ===========================================================================
  // Teams Tab Specific
  // ===========================================================================

  /**
   * Click department filter button in Teams tab
   */
  async filterTeamsByDepartment(departmentName: string): Promise<void> {
    const filterBtn = this.page.locator(`${SELECTORS.TEAMS_TAB.DEPARTMENT_FILTER_BTN}:has-text("${departmentName}")`)
    await filterBtn.click()
    await this.page.waitForTimeout(TIMEOUTS.DEBOUNCE)
  }

  /**
   * Show all departments in Teams tab
   */
  async showAllTeams(): Promise<void> {
    await this.page.locator(SELECTORS.TEAMS_TAB.ALL_DEPARTMENTS_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.DEBOUNCE)
  }

  // ===========================================================================
  // Modal Helpers
  // ===========================================================================

  /**
   * Wait for any modal to close
   */
  async waitForModalClose(): Promise<void> {
    await expect(this.page.locator(SELECTORS.ENTITY_MODAL.MODAL)).not.toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
  }

  /**
   * Check if modal is open
   */
  async isModalOpen(): Promise<boolean> {
    return await this.page.locator(SELECTORS.ENTITY_MODAL.MODAL).isVisible()
  }

  /**
   * Close modal by pressing Escape
   */
  async closeModalByEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
  }

  // ===========================================================================
  // Toast Notifications
  // ===========================================================================

  /**
   * Wait for success toast
   */
  async waitForSuccessToast(): Promise<void> {
    await expect(this.page.locator(SELECTORS.TOAST.SUCCESS)).toBeVisible({ timeout: TIMEOUTS.TOAST_VISIBLE })
  }

  /**
   * Wait for error toast
   */
  async waitForErrorToast(): Promise<void> {
    await expect(this.page.locator(SELECTORS.TOAST.ERROR)).toBeVisible({ timeout: TIMEOUTS.TOAST_VISIBLE })
  }

  // ===========================================================================
  // Empty State
  // ===========================================================================

  /**
   * Check if empty state is visible
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.page.locator(SELECTORS.EMPTY_STATE.MESSAGE).isVisible()
  }

  /**
   * Get empty state message text
   */
  async getEmptyStateMessage(): Promise<string | null> {
    const message = this.page.locator(SELECTORS.EMPTY_STATE.MESSAGE)
    if (await message.isVisible()) {
      return await message.textContent()
    }
    return null
  }

  /**
   * Verify empty state message matches expected text
   */
  async verifyEmptyStateMessage(expectedMessage: string): Promise<void> {
    const message = this.page.locator(SELECTORS.EMPTY_STATE.MESSAGE)
    await expect(message).toBeVisible()
    await expect(message).toContainText(expectedMessage)
  }

  /**
   * Click "Create first" button in empty state
   */
  async clickCreateFirstButton(): Promise<void> {
    await this.page.locator(SELECTORS.EMPTY_STATE.CREATE_FIRST_BTN).click()
    await this.page.waitForTimeout(TIMEOUTS.MODAL_ANIMATION)
  }

  // ===========================================================================
  // Test Data Cleanup
  // ===========================================================================

  /**
   * Delete all test entities with E2E_TEST_ prefix
   * Should be called after tests to clean up
   */
  async cleanupTestData(entityType: EntityType): Promise<void> {
    await this.search(entityType, TEST_DATA.PREFIX)
    await this.page.waitForTimeout(TIMEOUTS.MEDIUM)

    const names = await this.getVisibleEntityNames()
    const testNames = names.filter(name => name.startsWith(TEST_DATA.PREFIX))

    for (const name of testNames) {
      try {
        await this.deleteEntity(name)
        await this.page.waitForTimeout(TIMEOUTS.SHORT)
      } catch (e) {
        console.log(`Failed to delete ${name}:`, e)
      }
    }

    await this.clearSearch(entityType)
  }
}
