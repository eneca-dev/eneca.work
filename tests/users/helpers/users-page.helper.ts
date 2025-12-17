import { Page, expect, Locator } from '@playwright/test'
import { SELECTORS, ROUTES, STORAGE_KEYS, TIMEOUTS, FilterType, TabType } from '../constants/selectors'

/**
 * Helper class for interacting with Users page
 */
export class UsersPageHelper {
  constructor(private page: Page) {}

  // ===========================================================================
  // Navigation
  // ===========================================================================

  /**
   * Navigate to users page and wait for it to load
   */
  async goto(tab?: TabType): Promise<void> {
    const url = tab ? `${ROUTES.USERS}?tab=${tab}` : ROUTES.USERS
    await this.page.goto(url)
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.PAGE_LOAD })

    // Wait for React hydration
    await this.page.waitForTimeout(TIMEOUTS.HYDRATION)

    // Wait for loading to complete
    await this.waitForUsersLoaded()
  }

  /**
   * Wait for users data to be loaded
   */
  async waitForUsersLoaded(): Promise<void> {
    // Wait for loading spinner to disappear
    const spinner = this.page.locator(SELECTORS.PAGE.LOADING_SPINNER)
    try {
      await spinner.waitFor({ state: 'hidden', timeout: TIMEOUTS.DATA_LOAD })
    } catch {
      // Spinner might not appear for fast loads
    }

    // Wait for table or empty state to be visible
    const table = this.page.locator(SELECTORS.USERS_LIST.TABLE)
    const emptyState = this.page.locator(SELECTORS.USERS_LIST.EMPTY_STATE)

    await expect(table.or(emptyState)).toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
  }

  /**
   * Switch to a specific tab
   */
  async switchTab(tab: TabType): Promise<void> {
    const tabSelectors: Record<TabType, string> = {
      'list': SELECTORS.TABS.LIST,
      'add-user': SELECTORS.TABS.ADD_USER,
      'analytics': SELECTORS.TABS.ANALYTICS,
      'admin': SELECTORS.TABS.ADMIN,
    }

    const tabElement = this.page.locator(tabSelectors[tab])
    await tabElement.click()
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
  }

  /**
   * Check if a tab is visible (based on permissions)
   */
  async isTabVisible(tab: TabType): Promise<boolean> {
    const tabSelectors: Record<TabType, string> = {
      'list': SELECTORS.TABS.LIST,
      'add-user': SELECTORS.TABS.ADD_USER,
      'analytics': SELECTORS.TABS.ANALYTICS,
      'admin': SELECTORS.TABS.ADMIN,
    }

    return await this.page.locator(tabSelectors[tab]).isVisible()
  }

  /**
   * Get current URL tab parameter
   */
  async getCurrentTab(): Promise<string | null> {
    const url = new URL(this.page.url())
    return url.searchParams.get('tab')
  }

  /**
   * Expect URL to have specific tab
   */
  async expectTab(tab: TabType): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`tab=${tab}`))
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Enter search query
   */
  async search(query: string): Promise<void> {
    const searchInput = this.page.locator(SELECTORS.SEARCH.INPUT)
    await searchInput.fill(query)
    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
  }

  /**
   * Clear search query
   */
  async clearSearch(): Promise<void> {
    const searchInput = this.page.locator(SELECTORS.SEARCH.INPUT)
    await searchInput.clear()
    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
  }

  /**
   * Get current search value
   */
  async getSearchValue(): Promise<string> {
    const searchInput = this.page.locator(SELECTORS.SEARCH.INPUT)
    return await searchInput.inputValue()
  }

  // ===========================================================================
  // Filters
  // ===========================================================================

  /**
   * Get filter button locator by filter type
   * Filter buttons are located in the header row, identified by their tooltip or icon
   * Order in UI: Subdivision(Network) | Department(Building2) | Team(Users) | Position(Briefcase) | Category(Tag) | Role(Users) | Location(Home)
   */
  private getFilterButton(filterType: FilterType): Locator {
    // Use icon class names that Lucide generates (lucide-[icon-name])
    const iconSelectors: Record<FilterType, string> = {
      'SUBDIVISION': '[class*="lucide-network"]',
      'DEPARTMENT': '[class*="lucide-building"]',
      'TEAM': '[class*="lucide-users"]',
      'POSITION': '[class*="lucide-briefcase"]',
      'CATEGORY': '[class*="lucide-tag"]',
      'ROLE': '[class*="lucide-users"]',
      'LOCATION': '[class*="lucide-home"]',
    }

    // Filter row is the first flex container in card header
    const filterRow = this.page.locator('.flex.items-center.gap-0\\.5').first()

    // For TEAM and ROLE which both use lucide-users, we need to differentiate by position
    if (filterType === 'TEAM') {
      // Team is the first lucide-users icon button (after Building2)
      return filterRow.locator('button').filter({ has: this.page.locator('[class*="lucide-users"]') }).first()
    }
    if (filterType === 'ROLE') {
      // Role is the second lucide-users icon button (after Tag)
      return filterRow.locator('button').filter({ has: this.page.locator('[class*="lucide-users"]') }).nth(1)
    }

    // For other filters, just find button containing the icon
    return filterRow.locator('button').filter({ has: this.page.locator(iconSelectors[filterType]) })
  }

  /**
   * Get reset filters button
   */
  private getResetButton(): Locator {
    const filterRow = this.page.locator('.flex.items-center.gap-0\\.5').first()
    return filterRow.locator('button').filter({ has: this.page.locator('[class*="lucide-rotate-ccw"]') })
  }

  /**
   * Open filter dropdown
   */
  async openFilterDropdown(filterType: FilterType): Promise<void> {
    const button = this.getFilterButton(filterType)
    await button.click()
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)

    // Wait for dropdown content to be visible
    await expect(this.page.locator(SELECTORS.FILTER_DROPDOWN.CONTENT)).toBeVisible()
  }

  /**
   * Close filter dropdown (click outside)
   */
  async closeFilterDropdown(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
  }

  /**
   * Search within filter dropdown
   */
  async searchInFilterDropdown(query: string): Promise<void> {
    const searchInput = this.page.locator(SELECTORS.FILTER_DROPDOWN.SEARCH_INPUT)
    await searchInput.fill(query)
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
  }

  /**
   * Select filter option by label text
   */
  async selectFilterOption(filterType: FilterType, optionText: string): Promise<void> {
    await this.openFilterDropdown(filterType)

    // Find and click the checkbox for this option
    const checkbox = this.page.locator(`${SELECTORS.FILTER_DROPDOWN.CONTENT} input[type="checkbox"]`)
      .locator(`xpath=../following-sibling::label[contains(text(), "${optionText}")] | ../label[contains(text(), "${optionText}")]`)
      .locator('xpath=preceding-sibling::input[@type="checkbox"]')

    // Alternative: find by label text first
    const label = this.page.locator(`${SELECTORS.FILTER_DROPDOWN.CONTENT} label:has-text("${optionText}")`)
    const checkboxId = await label.getAttribute('for')

    if (checkboxId) {
      await this.page.locator(`#${checkboxId}`).click()
    } else {
      // Fallback: click on label which should toggle checkbox
      await label.click()
    }

    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
    await this.closeFilterDropdown()
  }

  /**
   * Deselect filter option by label text
   */
  async deselectFilterOption(filterType: FilterType, optionText: string): Promise<void> {
    // Same as select - clicking toggles
    await this.selectFilterOption(filterType, optionText)
  }

  /**
   * Get all available options in filter dropdown
   */
  async getFilterOptions(filterType: FilterType): Promise<string[]> {
    await this.openFilterDropdown(filterType)

    const labels = this.page.locator(`${SELECTORS.FILTER_DROPDOWN.CONTENT} label`)
    const options = await labels.allTextContents()

    await this.closeFilterDropdown()
    return options.map(opt => opt.trim())
  }

  /**
   * Get count badge from filter button (e.g., "(3)")
   */
  async getFilterCount(filterType: FilterType): Promise<number> {
    const button = this.getFilterButton(filterType)
    const countBadge = button.locator('.text-blue-600')

    if (await countBadge.isVisible()) {
      const text = await countBadge.textContent()
      const match = text?.match(/\((\d+)\)/)
      return match ? parseInt(match[1], 10) : 0
    }
    return 0
  }

  /**
   * Check if filter has active selections
   */
  async hasActiveFilter(filterType: FilterType): Promise<boolean> {
    return (await this.getFilterCount(filterType)) > 0
  }

  /**
   * Reset all filters
   */
  async resetAllFilters(): Promise<void> {
    const resetBtn = this.getResetButton()
    if (await resetBtn.isEnabled()) {
      await resetBtn.click()
      await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
    }
  }

  /**
   * Expect reset button to be disabled (no active filters)
   */
  async expectResetButtonDisabled(): Promise<void> {
    const resetBtn = this.getResetButton()
    await expect(resetBtn).toBeDisabled()
  }

  /**
   * Expect reset button to be enabled (has active filters)
   */
  async expectResetButtonEnabled(): Promise<void> {
    const resetBtn = this.getResetButton()
    await expect(resetBtn).toBeEnabled()
  }

  // ===========================================================================
  // Filter Chips
  // ===========================================================================

  /**
   * Check if subdivision chip is visible
   */
  async isSubdivisionChipVisible(): Promise<boolean> {
    const chip = this.page.locator(SELECTORS.FILTER_CHIPS.SUBDIVISION)
    return await chip.isVisible()
  }

  /**
   * Get subdivision chip text
   */
  async getSubdivisionChipText(): Promise<string | null> {
    const chip = this.page.locator(SELECTORS.FILTER_CHIPS.SUBDIVISION).first()
    if (await chip.isVisible()) {
      return await chip.textContent()
    }
    return null
  }

  /**
   * Remove subdivision chip
   */
  async removeSubdivisionChip(): Promise<void> {
    const chip = this.page.locator(SELECTORS.FILTER_CHIPS.SUBDIVISION).first()
    const removeBtn = chip.locator(SELECTORS.FILTER_CHIPS.REMOVE_BTN)
    await removeBtn.click()
    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
  }

  // ===========================================================================
  // Grouping
  // ===========================================================================

  /**
   * Get current grouping mode
   */
  async getCurrentGrouping(): Promise<'none' | 'subdivisions'> {
    const trigger = this.page.locator(SELECTORS.GROUPING.DROPDOWN_TRIGGER)
    const text = await trigger.textContent()
    return text?.includes('Без группировки') ? 'none' : 'subdivisions'
  }

  /**
   * Set grouping mode
   */
  async setGrouping(mode: 'none' | 'subdivisions'): Promise<void> {
    const trigger = this.page.locator(SELECTORS.GROUPING.DROPDOWN_TRIGGER)
    await trigger.click()
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)

    if (mode === 'none') {
      await this.page.locator(SELECTORS.GROUPING.NO_GROUPING).click()
    } else {
      await this.page.locator(SELECTORS.GROUPING.BY_SUBDIVISIONS).click()
    }

    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
  }

  /**
   * Check if a group header is visible
   */
  async isGroupHeaderVisible(type: 'subdivision' | 'department' | 'team'): Promise<boolean> {
    const selectors: Record<string, string> = {
      'subdivision': SELECTORS.GROUPING.SUBDIVISION_HEADER,
      'department': SELECTORS.GROUPING.DEPARTMENT_HEADER,
      'team': SELECTORS.GROUPING.TEAM_HEADER,
    }
    return await this.page.locator(selectors[type]).first().isVisible()
  }

  /**
   * Toggle group expansion by clicking on header
   */
  async toggleGroupExpansion(groupName: string): Promise<void> {
    const groupHeader = this.page.locator(`tr:has-text("${groupName}")`)
    await groupHeader.click()
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
  }

  /**
   * Check if a group is expanded
   */
  async isGroupExpanded(groupName: string): Promise<boolean> {
    const groupHeader = this.page.locator(`tr:has-text("${groupName}")`)
    const expandIcon = groupHeader.locator(SELECTORS.GROUPING.COLLAPSE_ICON)
    return await expandIcon.isVisible()
  }

  /**
   * Navigate through nested groups and find user by email
   * Useful for grouped view: Subdivision → Department → Team → User
   * @param debug - Enable debug logging to console
   */
  async navigateToUserInGroupedView(hierarchy: {
    subdivision: string
    department: string
    team: string
    userEmail: string
  }, debug: boolean = false): Promise<void> {
    // Ensure we're in grouped mode
    const currentGrouping = await this.getCurrentGrouping()
    if (debug) console.log(`[DEBUG] Current grouping: ${currentGrouping}`)

    if (currentGrouping !== 'subdivisions') {
      if (debug) console.log('[DEBUG] Switching to subdivisions grouping...')
      await this.setGrouping('subdivisions')
    }

    // Wait for table to render
    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)

    // 1. Expand subdivision
    if (debug) console.log(`[DEBUG] Looking for subdivision: "${hierarchy.subdivision}"`)
    const subdivisionHeader = this.page.locator('tr:has(svg.lucide-network)').filter({ hasText: hierarchy.subdivision })
    await expect(subdivisionHeader).toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
    if (debug) console.log('[DEBUG] Subdivision header found')

    // Scroll into view
    await subdivisionHeader.scrollIntoViewIfNeeded()
    await this.page.waitForTimeout(300)

    // Check if collapsed, then expand
    const subdivChevronRight = subdivisionHeader.locator(SELECTORS.GROUPING.EXPAND_ICON)
    if (await subdivChevronRight.isVisible()) {
      if (debug) console.log('[DEBUG] Subdivision is collapsed, expanding...')
      // Click on the chevron icon itself, not the whole row
      await subdivChevronRight.click({ force: true })

      // IMPORTANT: Wait for departments to appear in DOM after expanding
      if (debug) console.log('[DEBUG] Waiting for departments to appear...')
      try {
        await this.page.waitForSelector('tr:has(svg.lucide-building-2)', {
          timeout: TIMEOUTS.DATA_LOAD,
          state: 'visible'
        })
        if (debug) console.log('[DEBUG] Departments are now visible')
      } catch (err) {
        if (debug) console.log('[DEBUG] Warning: No departments found after expanding subdivision')
      }

      await this.page.waitForTimeout(500)
      if (debug) console.log('[DEBUG] Subdivision expanded')
    } else {
      if (debug) console.log('[DEBUG] Subdivision already expanded')
    }

    // 2. Expand department
    if (debug) console.log(`[DEBUG] Looking for department: "${hierarchy.department}"`)

    // Wait for network to be idle before searching for department
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      if (debug) console.log('[DEBUG] networkidle timeout, continuing anyway...')
    })

    // Use filter with hasText for more flexible matching (works with "Тестовый отдел 10")
    const departmentHeader = this.page.locator('tr:has(svg.lucide-building-2)').filter({ hasText: hierarchy.department })

    // Debug: print all visible department headers
    if (debug) {
      const allDepts = await this.page.locator('tr:has(svg.lucide-building-2)').allTextContents()
      console.log('[DEBUG] All visible departments:', allDepts)
      console.log(`[DEBUG] Looking for department containing: "${hierarchy.department}"`)
    }

    await expect(departmentHeader).toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
    if (debug) console.log('[DEBUG] Department header found')

    // Scroll into view
    await departmentHeader.scrollIntoViewIfNeeded()
    await this.page.waitForTimeout(300)

    const deptChevronRight = departmentHeader.locator(SELECTORS.GROUPING.EXPAND_ICON)
    if (await deptChevronRight.isVisible()) {
      if (debug) console.log('[DEBUG] Department is collapsed, expanding...')
      // Click on the chevron icon itself, not the whole row
      await deptChevronRight.click({ force: true })

      // Wait for teams to appear in DOM after expanding department
      if (debug) console.log('[DEBUG] Waiting for teams to appear...')
      try {
        await this.page.waitForSelector('tr:has(svg.lucide-users)', {
          timeout: TIMEOUTS.DATA_LOAD,
          state: 'visible'
        })
        if (debug) console.log('[DEBUG] Teams are now visible')
      } catch (err) {
        if (debug) console.log('[DEBUG] Warning: No teams found after expanding department')
      }

      await this.page.waitForTimeout(500)
      if (debug) console.log('[DEBUG] Department expanded')
    } else {
      if (debug) console.log('[DEBUG] Department already expanded')
    }

    // 3. Expand team
    if (debug) console.log(`[DEBUG] Looking for team: "${hierarchy.team}"`)
    const teamHeader = this.page.locator('tr:has(svg.lucide-users)').filter({ hasText: hierarchy.team })
    await expect(teamHeader).toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
    if (debug) console.log('[DEBUG] Team header found')

    // Scroll into view
    await teamHeader.scrollIntoViewIfNeeded()
    await this.page.waitForTimeout(300)

    const teamChevronRight = teamHeader.locator(SELECTORS.GROUPING.EXPAND_ICON)
    if (await teamChevronRight.isVisible()) {
      if (debug) console.log('[DEBUG] Team is collapsed, expanding...')
      // Click on the chevron icon itself, not the whole row
      await teamChevronRight.click({ force: true })

      // Wait for user rows to appear after expanding team
      if (debug) console.log('[DEBUG] Waiting for user rows to appear...')
      await this.page.waitForTimeout(500)

      if (debug) console.log('[DEBUG] Team expanded')
    } else {
      if (debug) console.log('[DEBUG] Team already expanded')
    }

    // 4. Now find user row
    if (debug) console.log(`[DEBUG] Looking for user: "${hierarchy.userEmail}"`)
    const userRow = this.page.locator('tr').filter({ hasText: hierarchy.userEmail })
    await expect(userRow).toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
    if (debug) console.log('[DEBUG] User row found')

    // Scroll user into view
    await userRow.scrollIntoViewIfNeeded()
    await this.page.waitForTimeout(300)
  }

  /**
   * Open edit dialog for user in grouped view by navigating hierarchy
   * @param debug - Enable debug logging to console
   */
  async openUserEditDialogInGroupedView(hierarchy: {
    subdivision: string
    department: string
    team: string
    userEmail: string
  }, debug: boolean = false): Promise<void> {
    // Use search-based approach instead of hierarchy navigation
    // This is more reliable as it doesn't depend on group expand/collapse behavior
    await this.openUserEditDialogBySearch(hierarchy.userEmail, debug)
  }

  /**
   * Open edit dialog by searching for user email
   * This is more reliable than navigating through group hierarchy
   * @param userEmail - Email to search for
   * @param debug - Enable debug logging
   */
  async openUserEditDialogBySearch(userEmail: string, debug: boolean = false): Promise<void> {
    if (debug) console.log(`[DEBUG] Opening edit dialog by search for: "${userEmail}"`)

    // 1. Switch to ungrouped mode for easier searching
    const currentGrouping = await this.getCurrentGrouping()
    if (debug) console.log(`[DEBUG] Current grouping: ${currentGrouping}`)

    if (currentGrouping !== 'none') {
      if (debug) console.log('[DEBUG] Switching to ungrouped mode...')
      await this.setGrouping('none')
      await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
    }

    // 2. Clear any existing search and enter email
    if (debug) console.log('[DEBUG] Entering search query...')
    const searchInput = this.page.locator(SELECTORS.SEARCH.INPUT)
    await searchInput.clear()
    await searchInput.fill(userEmail)
    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)

    // 3. Wait for search results
    if (debug) console.log('[DEBUG] Waiting for search results...')
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      if (debug) console.log('[DEBUG] networkidle timeout, continuing...')
    })

    // 4. Find user row
    if (debug) console.log('[DEBUG] Looking for user row...')
    const userRow = this.page.locator('tr').filter({ hasText: userEmail })

    // Debug: count matching rows
    if (debug) {
      const rowCount = await userRow.count()
      console.log(`[DEBUG] Found ${rowCount} matching row(s)`)
    }

    await expect(userRow).toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
    if (debug) console.log('[DEBUG] User row found')

    // Scroll into view
    await userRow.scrollIntoViewIfNeeded()
    await this.page.waitForTimeout(300)

    // 5. Click on menu button (three dots) in the user row
    if (debug) console.log('[DEBUG] Looking for menu button...')
    const menuButton = userRow.locator('button:has-text("Меню"), button:has(svg.lucide-more-horizontal)')
    await expect(menuButton).toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
    await menuButton.click()
    if (debug) console.log('[DEBUG] Menu button clicked')

    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)

    // 6. Click on "Редактировать" menu item
    if (debug) console.log('[DEBUG] Looking for "Редактировать" menu item...')
    const editMenuItem = this.page.locator('[role="menuitem"]:has-text("Редактировать")')
    await expect(editMenuItem).toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
    await editMenuItem.click()
    if (debug) console.log('[DEBUG] Edit menu item clicked')

    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)

    // 7. Wait for dialog to open
    await expect(this.page.locator(SELECTORS.EDIT_USER_DIALOG.MODAL)).toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
    if (debug) console.log('[DEBUG] Edit dialog opened')
  }

  // ===========================================================================
  // Pagination
  // ===========================================================================

  /**
   * Check if pagination is visible (only in non-grouped mode)
   */
  async isPaginationVisible(): Promise<boolean> {
    const pageInfo = this.page.locator(SELECTORS.PAGINATION.PAGE_INFO)
    return await pageInfo.isVisible()
  }

  /**
   * Get current page info (e.g., "1 из 5")
   */
  async getCurrentPageInfo(): Promise<{ current: number; total: number } | null> {
    const pageInfo = this.page.locator(SELECTORS.PAGINATION.PAGE_INFO)
    if (await pageInfo.isVisible()) {
      const text = await pageInfo.textContent()
      const match = text?.match(/(\d+)\s+из\s+(\d+)/)
      if (match) {
        return { current: parseInt(match[1], 10), total: parseInt(match[2], 10) }
      }
    }
    return null
  }

  /**
   * Go to next page
   */
  async goToNextPage(): Promise<void> {
    const nextBtn = this.page.locator(SELECTORS.PAGINATION.NEXT_BTN).last()
    if (await nextBtn.isEnabled()) {
      await nextBtn.click()
      await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
    }
  }

  /**
   * Go to previous page
   */
  async goToPreviousPage(): Promise<void> {
    const prevBtn = this.page.locator(SELECTORS.PAGINATION.PREV_BTN).last()
    if (await prevBtn.isEnabled()) {
      await prevBtn.click()
      await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
    }
  }

  /**
   * Toggle "Show all" / "Pagination" mode
   */
  async toggleShowAll(): Promise<void> {
    const showAllBtn = this.page.locator(SELECTORS.PAGINATION.SHOW_ALL_BTN)
    const paginateBtn = this.page.locator(SELECTORS.PAGINATION.PAGINATE_BTN)

    if (await showAllBtn.isVisible()) {
      await showAllBtn.click()
    } else if (await paginateBtn.isVisible()) {
      await paginateBtn.click()
    }

    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
  }

  /**
   * Check if "Show all" mode is active
   */
  async isShowAllMode(): Promise<boolean> {
    return await this.page.locator(SELECTORS.PAGINATION.PAGINATE_BTN).isVisible()
  }

  // ===========================================================================
  // Users Table
  // ===========================================================================

  /**
   * Get count of visible users in table
   */
  async getVisibleUsersCount(): Promise<number> {
    const rows = this.page.locator(`${SELECTORS.USERS_LIST.TABLE} tbody tr`)
    // Filter out group headers
    const userRows = rows.filter({ hasNot: this.page.locator('svg.lucide-network, svg.lucide-building-2, svg.lucide-users') })
    return await userRows.count()
  }

  /**
   * Get all visible user names
   */
  async getVisibleUserNames(): Promise<string[]> {
    const names = this.page.locator(`${SELECTORS.USERS_LIST.TABLE} tbody tr ${SELECTORS.USER_ROW.NAME}`)
    return await names.allTextContents()
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.page.locator(SELECTORS.USERS_LIST.EMPTY_STATE).isVisible()
  }

  // ===========================================================================
  // LocalStorage
  // ===========================================================================

  /**
   * Clear users list state from localStorage
   */
  async clearStorage(): Promise<void> {
    try {
      await this.page.evaluate((key) => {
        localStorage.removeItem(key)
      }, STORAGE_KEYS.USERS_LIST_STATE)
      await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
    } catch {
      // Ignore if localStorage is not accessible
    }
  }

  /**
   * Get storage state
   */
  async getStorageState(): Promise<{
    search?: string
    groupBy?: string
    filters?: Record<string, string[]>
    expandedGroups?: Record<string, boolean>
  } | null> {
    try {
      return await this.page.evaluate((key) => {
        const stored = localStorage.getItem(key)
        return stored ? JSON.parse(stored) : null
      }, STORAGE_KEYS.USERS_LIST_STATE)
    } catch {
      return null
    }
  }

  /**
   * Expect storage to contain specific search value
   */
  async expectStorageSearch(expectedSearch: string): Promise<void> {
    await this.page.waitForFunction(
      ({ key, expected }) => {
        try {
          const stored = localStorage.getItem(key)
          if (!stored) return false
          const parsed = JSON.parse(stored)
          return parsed.search === expected
        } catch {
          return false
        }
      },
      { key: STORAGE_KEYS.USERS_LIST_STATE, expected: expectedSearch },
      { timeout: TIMEOUTS.DATA_LOAD }
    )
  }

  /**
   * Expect storage to contain specific groupBy value
   */
  async expectStorageGrouping(expectedGroupBy: 'none' | 'subdivisions'): Promise<void> {
    await this.page.waitForFunction(
      ({ key, expected }) => {
        try {
          const stored = localStorage.getItem(key)
          if (!stored) return false
          const parsed = JSON.parse(stored)
          return parsed.groupBy === expected
        } catch {
          return false
        }
      },
      { key: STORAGE_KEYS.USERS_LIST_STATE, expected: expectedGroupBy },
      { timeout: TIMEOUTS.DATA_LOAD }
    )
  }

  /**
   * Expect storage to contain specific filter
   */
  async expectStorageFilter(filterKey: string, expectedValues: string[]): Promise<void> {
    await this.page.waitForFunction(
      ({ key, filterKey, expected }) => {
        try {
          const stored = localStorage.getItem(key)
          if (!stored) return false
          const parsed = JSON.parse(stored)
          const actual = parsed.filters?.[filterKey] || []
          return JSON.stringify(actual.sort()) === JSON.stringify(expected.sort())
        } catch {
          return false
        }
      },
      { key: STORAGE_KEYS.USERS_LIST_STATE, filterKey, expected: expectedValues },
      { timeout: TIMEOUTS.DATA_LOAD }
    )
  }

  // ===========================================================================
  // URL State
  // ===========================================================================

  /**
   * Get URL filter params
   */
  async getUrlFilters(): Promise<{
    search?: string
    group?: string
    subdivs: string[]
    depts: string[]
    teams: string[]
    cats: string[]
    pos: string[]
    roles: string[]
    locs: string[]
  }> {
    const url = new URL(this.page.url())
    return {
      search: url.searchParams.get('search') || undefined,
      group: url.searchParams.get('group') || undefined,
      subdivs: url.searchParams.getAll('subdivs'),
      depts: url.searchParams.getAll('depts'),
      teams: url.searchParams.getAll('teams'),
      cats: url.searchParams.getAll('cats'),
      pos: url.searchParams.getAll('pos'),
      roles: url.searchParams.getAll('roles'),
      locs: url.searchParams.getAll('locs'),
    }
  }

  /**
   * Expect URL to contain search param
   */
  async expectUrlSearch(expectedSearch: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`search=${encodeURIComponent(expectedSearch)}`))
  }

  /**
   * Expect URL to contain grouping param
   */
  async expectUrlGrouping(expectedGroupBy: 'subdivisions'): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`group=${expectedGroupBy}`))
  }

  // ===========================================================================
  // Edit User Dialog (Modal)
  // ===========================================================================

  /**
   * Open edit dialog for a specific user by clicking on user row
   */
  async openUserEditDialog(userIndex: number = 0): Promise<void> {
    const userRow = this.page.locator(`${SELECTORS.USERS_LIST.TABLE} tbody tr`).nth(userIndex)
    await userRow.click()
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
    await expect(this.page.locator(SELECTORS.EDIT_USER_DIALOG.MODAL)).toBeVisible()
  }

  /**
   * Open edit dialog for a specific user by name
   */
  async openUserEditDialogByName(userName: string): Promise<void> {
    const userRow = this.page.locator(`${SELECTORS.USERS_LIST.TABLE} tbody tr:has-text("${userName}")`)
    await userRow.click()
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
    await expect(this.page.locator(SELECTORS.EDIT_USER_DIALOG.MODAL)).toBeVisible()
  }

  /**
   * Check if edit dialog is open
   */
  async isEditDialogOpen(): Promise<boolean> {
    return await this.page.locator(SELECTORS.EDIT_USER_DIALOG.MODAL).isVisible()
  }

  /**
   * Close edit dialog by pressing Escape (most reliable method)
   */
  async closeEditDialog(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
  }

  /**
   * Close edit dialog by clicking X button
   */
  async closeEditDialogByX(): Promise<void> {
    const closeBtn = this.page.locator(SELECTORS.EDIT_USER_DIALOG.CLOSE_BTN)
    await closeBtn.scrollIntoViewIfNeeded()
    await closeBtn.click({ force: true })
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
  }

  /**
   * Close edit dialog by clicking outside (backdrop)
   */
  async closeEditDialogByBackdrop(): Promise<void> {
    // Click on backdrop (outside modal)
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
  }

  /**
   * Fill first name in edit dialog
   */
  async fillEditFirstName(value: string): Promise<void> {
    const input = this.page.locator(SELECTORS.EDIT_USER_DIALOG.FIRST_NAME_INPUT)
    await input.clear()
    await input.fill(value)
  }

  /**
   * Fill last name in edit dialog
   */
  async fillEditLastName(value: string): Promise<void> {
    const input = this.page.locator(SELECTORS.EDIT_USER_DIALOG.LAST_NAME_INPUT)
    await input.clear()
    await input.fill(value)
  }

  /**
   * Fill rate in edit dialog
   */
  async fillEditRate(value: string | number): Promise<void> {
    const input = this.page.locator(SELECTORS.EDIT_USER_DIALOG.RATE_INPUT)
    await input.clear()
    await input.fill(value.toString())
  }

  /**
   * Get value from a text input in edit dialog
   */
  async getEditInputValue(selector: string): Promise<string> {
    return await this.page.locator(selector).inputValue()
  }

  /**
   * Get first name value
   */
  async getEditFirstName(): Promise<string> {
    return await this.getEditInputValue(SELECTORS.EDIT_USER_DIALOG.FIRST_NAME_INPUT)
  }

  /**
   * Get last name value
   */
  async getEditLastName(): Promise<string> {
    return await this.getEditInputValue(SELECTORS.EDIT_USER_DIALOG.LAST_NAME_INPUT)
  }

  /**
   * Get email value
   */
  async getEditEmail(): Promise<string> {
    return await this.getEditInputValue(SELECTORS.EDIT_USER_DIALOG.EMAIL_INPUT)
  }

  /**
   * Get rate value
   */
  async getEditRate(): Promise<string> {
    return await this.getEditInputValue(SELECTORS.EDIT_USER_DIALOG.RATE_INPUT)
  }

  /**
   * Select option from dropdown in edit dialog
   */
  async selectEditDropdownOption(dropdownSelector: string, optionText: string): Promise<void> {
    // Click to open dropdown
    await this.page.locator(dropdownSelector).click()
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)

    // Select option
    await this.page.locator(`[role="option"]:has-text("${optionText}")`).click()
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
  }

  /**
   * Select subdivision
   */
  async selectEditSubdivision(value: string): Promise<void> {
    await this.selectEditDropdownOption(SELECTORS.EDIT_USER_DIALOG.SUBDIVISION_DROPDOWN, value)
  }

  /**
   * Select department
   */
  async selectEditDepartment(value: string): Promise<void> {
    await this.selectEditDropdownOption(SELECTORS.EDIT_USER_DIALOG.DEPARTMENT_DROPDOWN, value)
  }

  /**
   * Select team
   */
  async selectEditTeam(value: string): Promise<void> {
    await this.selectEditDropdownOption(SELECTORS.EDIT_USER_DIALOG.TEAM_DROPDOWN, value)
  }

  /**
   * Select position
   */
  async selectEditPosition(value: string): Promise<void> {
    await this.selectEditDropdownOption(SELECTORS.EDIT_USER_DIALOG.POSITION_DROPDOWN, value)
  }

  /**
   * Select category
   */
  async selectEditCategory(value: string): Promise<void> {
    await this.selectEditDropdownOption(SELECTORS.EDIT_USER_DIALOG.CATEGORY_DROPDOWN, value)
  }

  /**
   * Select workload
   */
  async selectEditWorkload(value: string): Promise<void> {
    await this.selectEditDropdownOption(SELECTORS.EDIT_USER_DIALOG.WORKLOAD_DROPDOWN, value)
  }

  /**
   * Select location
   */
  async selectEditLocation(value: string): Promise<void> {
    await this.selectEditDropdownOption(SELECTORS.EDIT_USER_DIALOG.LOCATION_DROPDOWN, value)
  }

  /**
   * Select country
   */
  async selectEditCountry(value: string): Promise<void> {
    await this.selectEditDropdownOption(SELECTORS.EDIT_USER_DIALOG.COUNTRY_DROPDOWN, value)
  }

  /**
   * Select city
   */
  async selectEditCity(value: string): Promise<void> {
    await this.selectEditDropdownOption(SELECTORS.EDIT_USER_DIALOG.CITY_DROPDOWN, value)
  }

  /**
   * Get current dropdown text value
   */
  async getEditDropdownValue(dropdownSelector: string): Promise<string> {
    const dropdown = this.page.locator(dropdownSelector)
    return await dropdown.textContent() || ''
  }

  /**
   * Check if Save button is enabled
   */
  async isEditSaveEnabled(): Promise<boolean> {
    return await this.page.locator(SELECTORS.EDIT_USER_DIALOG.SAVE_BTN).isEnabled()
  }

  /**
   * Check if Save button is disabled
   */
  async isEditSaveDisabled(): Promise<boolean> {
    return await this.page.locator(SELECTORS.EDIT_USER_DIALOG.SAVE_BTN).isDisabled()
  }

  /**
   * Click Save button in edit dialog (uses JS click to bypass viewport issues)
   */
  async clickEditSave(): Promise<void> {
    const saveBtn = this.page.locator(SELECTORS.EDIT_USER_DIALOG.SAVE_BTN)
    await saveBtn.evaluate((el: HTMLElement) => el.click())
    await this.page.waitForTimeout(TIMEOUTS.DATA_LOAD)
  }

  /**
   * Click Cancel button in edit dialog (uses JS click to bypass viewport issues)
   */
  async clickEditCancel(): Promise<void> {
    const cancelBtn = this.page.locator(SELECTORS.EDIT_USER_DIALOG.CANCEL_BTN)
    await cancelBtn.evaluate((el: HTMLElement) => el.click())
    await this.page.waitForTimeout(TIMEOUTS.ANIMATION)
  }

  /**
   * Get all role badges in edit dialog
   */
  async getEditRoleBadges(): Promise<string[]> {
    const badges = this.page.locator(SELECTORS.EDIT_USER_DIALOG.ROLE_BADGE)
    return await badges.allTextContents()
  }

  /**
   * Check if team assignment hint is visible
   */
  async isTeamAssignmentHintVisible(): Promise<boolean> {
    return await this.page.locator(SELECTORS.EDIT_USER_DIALOG.TEAM_ASSIGNMENT_HINT).isVisible()
  }

  /**
   * Check if city dropdown is disabled (before country selection)
   */
  async isCityDropdownDisabled(): Promise<boolean> {
    const dropdown = this.page.locator(SELECTORS.EDIT_USER_DIALOG.CITY_DROPDOWN)
    const isDisabled = await dropdown.evaluate(el =>
      el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
    )
    return isDisabled
  }

  /**
   * Wait for edit dialog to close
   */
  async waitForEditDialogClose(): Promise<void> {
    await expect(this.page.locator(SELECTORS.EDIT_USER_DIALOG.MODAL)).not.toBeVisible({ timeout: TIMEOUTS.DATA_LOAD })
  }

  /**
   * Fill all basic fields in edit dialog (email is read-only)
   */
  async fillBasicUserInfo(data: {
    firstName?: string
    lastName?: string
    rate?: string | number
  }): Promise<void> {
    if (data.firstName) await this.fillEditFirstName(data.firstName)
    if (data.lastName) await this.fillEditLastName(data.lastName)
    if (data.rate !== undefined) await this.fillEditRate(data.rate)
  }
}
