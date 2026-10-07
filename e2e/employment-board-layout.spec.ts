import { expect, test } from './fixtures/employment-board'

test.describe('employment board layout', () => {
  test('keeps the side panel and project list independently scrollable', async ({ employmentBoardPage }) => {
    const employeeScroll = employmentBoardPage.getByTestId('employment-board-employee-scroll')
    const projects = employmentBoardPage.getByTestId('employment-board-projects')

    await expect(employeeScroll).toHaveCSS('overflow-y', 'auto')
    await expect(projects).toHaveCSS('overflow-y', 'auto')

    await employeeScroll.evaluate((element) => {
      const filler = document.createElement('div')
      filler.style.height = '1000px'
      filler.style.flex = '0 0 auto'
      element.append(filler)
    })
    await projects.evaluate((element) => {
      const filler = document.createElement('div')
      filler.style.height = '1000px'
      element.append(filler)
    })

    await employeeScroll.evaluate((element) => { element.scrollTop = 80 })
    const employeeTop = await employeeScroll.evaluate((element) => element.scrollTop)
    expect(employeeTop).toBeGreaterThan(0)
    await expect.poll(() => projects.evaluate((element) => element.scrollTop)).toBe(0)

    await projects.evaluate((element) => { element.scrollTop = 80 })
    await expect.poll(() => projects.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await expect.poll(() => employeeScroll.evaluate((element) => element.scrollTop)).toBe(employeeTop)
  })

  test('uses the compact responsive layout', async ({ employmentBoardPage }, testInfo) => {
    const viewport = employmentBoardPage.viewportSize()
    const sidePanel = employmentBoardPage.getByTestId('employment-board-side-panel')
    const sideBox = await sidePanel.boundingBox()

    expect(viewport).not.toBeNull()
    expect(sideBox).not.toBeNull()
    if (!viewport || !sideBox) return

    if (testInfo.project.name === 'mobile-chromium') {
      expect(sideBox.width).toBeGreaterThanOrEqual(viewport.width - 2)
      expect(sideBox.height).toBeLessThanOrEqual(Math.min(viewport.height * 0.4, 320) + 1)
      await expect(employmentBoardPage.getByTestId('employment-board-columns')).toHaveCSS('column-count', '1')
      return
    }

    expect(sideBox.width).toBeLessThanOrEqual(256)
    await expect(employmentBoardPage.getByTestId('employment-board-columns')).toHaveCSS('column-count', '2')
  })
})
