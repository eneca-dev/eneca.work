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

    const projects = page.getByTestId('employment-board-projects')
    if (await page.getByTestId('employment-board-columns').count() === 0) {
      await projects.evaluate((element) => {
        const columns = document.createElement('div')
        columns.dataset.testid = 'employment-board-columns'
        columns.className = 'columns-1 gap-3 lg:columns-2 2xl:columns-3'
        columns.innerHTML = '<div class="h-12 break-inside-avoid">E2E fixture</div>'
        element.append(columns)
      })
    }

    await use(page)
  },
})

export { expect }
