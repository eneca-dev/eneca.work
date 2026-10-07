import { expect, test as base, type Page } from '@playwright/test'

interface EmploymentBoardFixtures {
  employmentBoardPage: Page
}

const EMPLOYMENT_TAB_ID = 'e2e-employment'
const tasksTabsState = JSON.stringify({
  state: {
    tabs: [{
      id: EMPLOYMENT_TAB_ID,
      name: 'Занятость E2E',
      viewMode: 'employment',
      filterString: '',
      isSystem: false,
      order: 0,
      createdAt: '2026-10-07T00:00:00.000Z',
    }],
    activeTabId: EMPLOYMENT_TAB_ID,
  },
  version: 3,
})

export const test = base.extend<EmploymentBoardFixtures>({
  employmentBoardPage: async ({ page }, use) => {
    if (!process.env.PLAYWRIGHT_STORAGE_STATE) {
      throw new Error(
        'Задайте PLAYWRIGHT_STORAGE_STATE авторизованного пользователя с доступом к доске',
      )
    }

    await page.addInitScript((persistedState) => {
      window.localStorage.setItem('tasks-tabs', persistedState)
    }, tasksTabsState)

    await page.goto(`/tasks?tab=${EMPLOYMENT_TAB_ID}`)
    await expect(page.getByTestId('employment-board-side-panel')).toBeVisible()
    const columns = page.getByTestId('employment-board-columns')
    await expect(columns).toBeVisible()
    await expect(page.getByTestId('employment-board-project-card').first()).toBeVisible()

    await use(page)
  },
})

export { expect }
