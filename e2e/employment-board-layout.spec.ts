import { expect, test } from './fixtures/employment-board'

test.describe('employment board layout', () => {
  test('keeps the side panel and project list independently scrollable', async ({ employmentBoardPage }) => {
    const viewport = employmentBoardPage.viewportSize()
    expect(viewport).not.toBeNull()
    if (!viewport) return
    // One real project card is enough to overflow this intentionally low viewport.
    await employmentBoardPage.setViewportSize({ width: viewport.width, height: 240 })

    const employeeScroll = employmentBoardPage.getByTestId('employment-board-employee-scroll')
    const projects = employmentBoardPage.getByTestId('employment-board-projects')

    await expect(employeeScroll).toHaveCSS('overflow-y', 'auto')
    await expect(projects).toHaveCSS('overflow-y', 'auto')

    await expect.poll(() => employeeScroll.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    )).toBe(true)
    await expect.poll(() => projects.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    )).toBe(true)

    await employeeScroll.evaluate((element) => { element.scrollTop = 80 })
    const employeeTop = await employeeScroll.evaluate((element) => element.scrollTop)
    expect(employeeTop).toBeGreaterThan(0)
    await expect.poll(() => projects.evaluate((element) => element.scrollTop)).toBe(0)

    await projects.evaluate((element) => { element.scrollTop = 80 })
    await expect.poll(() => projects.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await expect.poll(() => employeeScroll.evaluate((element) => element.scrollTop)).toBe(employeeTop)
  })

  test('keeps the Today action reachable in a low viewport', async ({ employmentBoardPage }) => {
    const viewport = employmentBoardPage.viewportSize()
    expect(viewport).not.toBeNull()
    if (!viewport) return
    await employmentBoardPage.setViewportSize({ width: viewport.width, height: 360 })

    await employmentBoardPage.getByRole('button', {
      name: /Выбрать дату занятости/,
    }).click()

    const dialog = employmentBoardPage.getByRole('dialog')
    const today = dialog.getByRole('button', { name: 'Сегодня', exact: true })
    await today.scrollIntoViewIfNeeded()
    await expect(today).toBeVisible()
    await expect(dialog).toHaveCSS('overflow-y', 'auto')

    const dialogBox = await dialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    if (!dialogBox) return
    expect(dialogBox.y).toBeGreaterThanOrEqual(0)
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(360)
  })

  test('uses the compact responsive layout', async ({ employmentBoardPage }, testInfo) => {
    const viewport = employmentBoardPage.viewportSize()
    const sidePanel = employmentBoardPage.getByTestId('employment-board-side-panel')
    const sideBox = await sidePanel.boundingBox()

    expect(viewport).not.toBeNull()
    expect(sideBox).not.toBeNull()
    if (!viewport || !sideBox) return

    if (testInfo.project.name === 'mobile-chromium') {
      const availableViewportWidth = viewport.width - sideBox.x
      expect(sideBox.width).toBeGreaterThanOrEqual(availableViewportWidth - 2)
      expect(sideBox.x + sideBox.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(sideBox.height).toBeLessThanOrEqual(Math.min(viewport.height * 0.4, 320) + 1)
      await expect(employmentBoardPage.getByTestId('employment-board-columns')).toHaveCSS('column-count', '1')
      return
    }

    expect(sideBox.width).toBeLessThanOrEqual(256)
    await expect(employmentBoardPage.getByTestId('employment-board-columns')).toHaveCSS('column-count', '2')

    await employmentBoardPage.setViewportSize({ width: 1600, height: viewport.height })
    await expect(employmentBoardPage.getByTestId('employment-board-columns')).toHaveCSS('column-count', '3')
  })
})
