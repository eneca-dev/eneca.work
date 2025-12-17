import { Page, expect } from '@playwright/test'
import { SELECTORS, TIMEOUTS, ROUTES } from '../constants/selectors'

type FilterType = 'MANAGER' | 'PROJECT' | 'SUBDIVISION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE'

const FILTER_SELECTORS: Record<FilterType, string> = {
  MANAGER: SELECTORS.FILTERS.MANAGER,
  PROJECT: SELECTORS.FILTERS.PROJECT,
  SUBDIVISION: SELECTORS.FILTERS.SUBDIVISION,
  DEPARTMENT: SELECTORS.FILTERS.DEPARTMENT,
  TEAM: SELECTORS.FILTERS.TEAM,
  EMPLOYEE: SELECTORS.FILTERS.EMPLOYEE,
}

/**
 * Helper class for interacting with Resource Graph filters
 */
export class FiltersHelper {
  constructor(private page: Page) {}

  /**
   * Navigate to resource graph page and wait for filters to load
   */
  async goto(): Promise<void> {
    await this.page.goto(ROUTES.RESOURCE_GRAPH)
    await this.page.waitForLoadState('networkidle', { timeout: 60000 })

    // Wait for React hydration - increased to 10 seconds
    await this.page.waitForTimeout(10000)

    // Wait for filters container to be visible
    const filtersContainer = this.page.locator(SELECTORS.PAGE.FILTERS_CONTAINER)
    await filtersContainer.waitFor({ state: 'visible', timeout: 60000 })

    // Make sure filters are expanded
    const expandButton = this.page.locator('button:has-text("Фильтры")')
    if (await expandButton.isVisible()) {
      const isCollapsed = await this.page.locator('[data-testid="filter-manager"]').isHidden().catch(() => true)
      if (isCollapsed) {
        await expandButton.click()
        await this.page.waitForTimeout(1000)
      }
    }

    // Wait for manager filter to be ready
    await this.page.locator('[data-testid="filter-manager"]').waitFor({ state: 'visible', timeout: 30000 })

    // Wait MUCH longer for data to load - 30 seconds
    console.log('Waiting for filter data to load...')
    await this.page.waitForTimeout(30000)

    // Now verify that manager filter actually has options
    let retries = 0
    const maxRetries = 6 // 6 retries * 10 seconds = 1 minute total
    while (retries < maxRetries) {
      const managerFilter = this.page.locator('[data-testid="filter-manager"]')
      const optionsCount = await managerFilter.locator('option').count()

      console.log(`Attempt ${retries + 1}: Found ${optionsCount} options in manager filter`)

      if (optionsCount > 1) { // More than just "Все" placeholder
        console.log('Filter data loaded successfully!')
        break
      }

      console.log('Waiting 10 more seconds for filter data...')
      await this.page.waitForTimeout(10000)
      retries++
    }

    // Final wait for stability
    await this.page.waitForTimeout(2000)
  }

  /**
   * Select a value in a filter dropdown
   */
  async selectFilter(filterTypeOrSelector: FilterType | string, value: string): Promise<void> {
    // Check if it's a FilterType or direct selector
    const selector = filterTypeOrSelector in FILTER_SELECTORS
      ? FILTER_SELECTORS[filterTypeOrSelector as FilterType]
      : filterTypeOrSelector

    const filter = this.page.locator(selector)
    await filter.selectOption(value)
    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
  }

  /**
   * Get currently selected value from a filter
   */
  async getFilterValue(filterSelector: string): Promise<string> {
    const filter = this.page.locator(filterSelector)
    // For select elements, use evaluate to get the actual value
    return await filter.evaluate((el: HTMLSelectElement) => el.value)
  }

  /**
   * Toggle a tag
   */
  async toggleTag(tagId: string): Promise<void> {
    const tagButton = this.page.locator(SELECTORS.TAGS.TAG_BUTTON(tagId))
    await tagButton.click()
    await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
  }

  /**
   * Reset all filters
   */
  async resetAllFilters(): Promise<void> {
    const resetButton = this.page.locator(SELECTORS.RESET.ALL)
    if (await resetButton.isVisible()) {
      await resetButton.click()
      await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
    }
  }

  /**
   * Reset project filters
   */
  async resetProjectFilters(): Promise<void> {
    const resetButton = this.page.locator(SELECTORS.RESET.PROJECT)
    if (await resetButton.isVisible()) {
      await resetButton.click()
      await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
    }
  }

  /**
   * Reset organization filters
   */
  async resetOrgFilters(): Promise<void> {
    const resetButton = this.page.locator(SELECTORS.RESET.ORG)
    if (await resetButton.isVisible()) {
      await resetButton.click()
      await this.page.waitForTimeout(TIMEOUTS.FILTER_APPLY)
    }
  }

  /**
   * Check if a filter is disabled
   */
  async isFilterDisabled(filterSelector: string): Promise<boolean> {
    const filter = this.page.locator(filterSelector)
    return await filter.isDisabled()
  }

  /**
   * Wait for filters to finish loading
   */
  async waitForFiltersReady(): Promise<void> {
    await this.page.waitForTimeout(TIMEOUTS.DATA_LOAD)
  }

  /**
   * Get filter options from dropdown
   */
  async getFilterOptions(filterType: FilterType): Promise<string[]> {
    const selector = FILTER_SELECTORS[filterType]
    const filter = this.page.locator(selector)
    const options = await filter.locator('option').all()
    const values = await Promise.all(options.map(opt => opt.getAttribute('value')))
    return values.filter(v => v !== null && v !== '') as string[]
  }

  /**
   * Select filter by type
   */
  async selectFilterByType(filterType: FilterType, value: string): Promise<void> {
    const selector = FILTER_SELECTORS[filterType]
    await this.selectFilter(selector, value)
  }

  /**
   * Expect filter to have specific value
   */
  async expectFilterValue(filterType: FilterType, expectedValue: string): Promise<void> {
    const selector = FILTER_SELECTORS[filterType]
    const filter = this.page.locator(selector)
    // Use Playwright's auto-waiting instead of manual check
    await expect(filter).toHaveValue(expectedValue, { timeout: 10000 })
  }

  /**
   * Expect value in localStorage
   */
  async expectFilterInStorage(key: string, expectedValue: string | string[]): Promise<void> {
    // Wait for localStorage to be updated by React component
    // Zustand persist stores data as: { state: { filters: {...} }, version: 0 }
    await this.page.waitForFunction(
      ({ storageKey, expected }) => {
        try {
          const stored = localStorage.getItem('resource-graph-filters')
          if (!stored) return false
          const parsed = JSON.parse(stored)
          // Zustand persist format: { state: { filters: {...} }, version: 0 }
          const actual = parsed.state?.filters?.[storageKey]

          if (Array.isArray(expected)) {
            return JSON.stringify(actual) === JSON.stringify(expected)
          }
          return actual === expected
        } catch (e) {
          return false
        }
      },
      { storageKey: key, expected: expectedValue },
      { timeout: 10000 }
    )

    // Verify final value
    const storageValue = await this.page.evaluate((storageKey) => {
      const stored = localStorage.getItem('resource-graph-filters')
      if (!stored) return null
      const parsed = JSON.parse(stored)
      // Zustand persist format: { state: { filters: {...} }, version: 0 }
      return parsed.state?.filters?.[storageKey]
    }, key)

    if (Array.isArray(expectedValue)) {
      expect(storageValue).toEqual(expectedValue)
    } else {
      expect(storageValue).toBe(expectedValue)
    }
  }

  /**
   * Expect filter to be disabled
   */
  async expectFilterDisabled(filterType: FilterType): Promise<void> {
    const selector = FILTER_SELECTORS[filterType]
    const isDisabled = await this.isFilterDisabled(selector)
    expect(isDisabled).toBe(true)
  }

  /**
   * Expect filter to be enabled
   */
  async expectFilterEnabled(filterType: FilterType): Promise<void> {
    const selector = FILTER_SELECTORS[filterType]
    const isDisabled = await this.isFilterDisabled(selector)
    expect(isDisabled).toBe(false)
  }

  /**
   * Get all tag IDs from the page
   */
  async getAllTagIds(): Promise<string[]> {
    const tags = await this.page.locator('[data-testid^="tag-"]').all()
    const ids: string[] = []
    for (const tag of tags) {
      const testId = await tag.getAttribute('data-testid')
      if (testId) {
        const id = testId.replace('tag-', '')
        ids.push(id)
      }
    }
    return ids
  }

  /**
   * Check if tag is selected
   */
  async isTagSelected(tagId: string): Promise<boolean> {
    const tag = this.page.locator(`[data-testid="tag-${tagId}"]`)
    const classes = await tag.getAttribute('class')
    return classes?.includes('selected') || classes?.includes('active') || false
  }

  /**
   * Clear filters from localStorage
   */
  async clearFiltersStorage(): Promise<void> {
    try {
      await this.page.evaluate(() => {
        try {
          // Remove Zustand persisted filters completely
          // This is safer than trying to reconstruct the structure
          localStorage.removeItem('resource-graph-filters')
        } catch (e) {
          // Ignore if localStorage is not accessible
          console.log('Could not access localStorage:', e)
        }
      })
      // Wait for React to pick up the change
      await this.page.waitForTimeout(500)
    } catch (e) {
      // Ignore if page context is not available yet
      console.log('Could not clear localStorage:', e)
    }
  }
}
