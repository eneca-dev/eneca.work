/**
 * Cleanup Test for Admin Panel
 *
 * This test removes ALL test data with АВТОТЕСТ- prefix
 * Run manually after tests or if tests failed mid-execution
 *
 * IMPORTANT: Учитывает бизнес-логику:
 * - Нельзя удалить последнюю команду в отделе (нужно удалить весь отдел)
 * - Нельзя удалить подразделение если в нём есть отделы
 *
 * Порядок удаления:
 * 1. Teams (только если их >1 в отделе, иначе пропускаем)
 * 2. Departments (удаляются вместе с последней командой)
 * 3. Subdivisions (только пустые, без отделов)
 * 4. Positions, Categories (независимые)
 *
 * Usage:
 *   npx playwright test tests/users/admin/cleanup.spec.ts
 */

import { test, Page } from '@playwright/test'
import { AdminPanelHelper } from './helpers/admin-panel.helper'
import { TIMEOUTS, TEST_DATA, SELECTORS } from './constants/selectors'

test.describe('Admin Panel - Cleanup', () => {
  let helper: AdminPanelHelper
  let sharedPage: Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json'
    })
    sharedPage = await context.newPage()
    helper = new AdminPanelHelper(sharedPage)
    await helper.goto()
  })

  test.afterAll(async () => {
    await sharedPage.close()
  })

  /**
   * Step 1: Try to cleanup teams (skip if it's the last team in department)
   * Teams can only be deleted if there are multiple teams in the department
   */
  test('cleanup teams (skip if last in department)', async () => {
    await helper.switchTab('teams')
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    // Search for test teams
    await helper.search('team', TEST_DATA.PREFIX)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const teamNames = await helper.getVisibleEntityNames()
    const testTeams = teamNames.filter(name => name.startsWith(TEST_DATA.PREFIX))

    console.log(`Found ${testTeams.length} test teams to cleanup`)
    console.log('Test teams:', testTeams)
    console.log(`⚠️ WILL ONLY DELETE entities starting with: "${TEST_DATA.PREFIX}"`)

    // Try to delete each team
    for (const teamName of testTeams) {
      try {
        await helper.search('team', teamName)
        await sharedPage.waitForTimeout(TIMEOUTS.SHORT)

        await helper.clickDeleteButton(teamName)
        await sharedPage.waitForTimeout(TIMEOUTS.SHORT)

        // Check if delete modal appeared (it won't if team is last in department)
        const deleteModal = sharedPage.locator(SELECTORS.DELETE_MODAL.MODAL)
        const isModalVisible = await deleteModal.isVisible()

        if (isModalVisible) {
          // Can delete - proceed
          await helper.confirmDelete()
          await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)
          console.log(`✓ Deleted team: ${teamName}`)
        } else {
          // Check for error toast (last team in department)
          const errorToast = sharedPage.locator(SELECTORS.TOAST.ERROR)
          const hasError = await errorToast.isVisible().catch(() => false)

          if (hasError) {
            console.log(`⊘ Skipped team (last in department): ${teamName}`)
            // Close error toast by pressing Escape
            await sharedPage.keyboard.press('Escape')
          }
        }
      } catch (e) {
        console.log(`Failed to delete team ${teamName}:`, e)
      }
    }

    await helper.clearSearch('team')
  })

  /**
   * Step 2: Cleanup departments (will delete remaining teams automatically)
   * When department is deleted, all its teams are deleted too (cascade)
   */
  test('cleanup departments', async () => {
    await helper.switchTab('departments')
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    await helper.search('department', TEST_DATA.PREFIX)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const deptNames = await helper.getVisibleEntityNames()
    const testDepts = deptNames.filter(name => name.startsWith(TEST_DATA.PREFIX))

    console.log(`Found ${testDepts.length} test departments to cleanup`)
    console.log('Test departments:', testDepts)
    console.log(`⚠️ WILL ONLY DELETE entities starting with: "${TEST_DATA.PREFIX}"`)

    for (const deptName of testDepts) {
      try {
        await helper.search('department', deptName)
        await helper.deleteEntity(deptName)
        await sharedPage.waitForTimeout(TIMEOUTS.SHORT)
        console.log(`✓ Deleted department: ${deptName}`)
      } catch (e) {
        console.log(`Failed to delete department ${deptName}:`, e)
      }
    }

    await helper.clearSearch('department')
  })

  /**
   * Step 3: Cleanup subdivisions (only if they have no departments)
   * Can only delete empty subdivisions
   */
  test('cleanup subdivisions', async () => {
    await helper.switchTab('subdivisions')
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    await helper.search('subdivision', TEST_DATA.PREFIX)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const subdivNames = await helper.getVisibleEntityNames()
    const testSubdivs = subdivNames.filter(name => name.startsWith(TEST_DATA.PREFIX))

    console.log(`Found ${testSubdivs.length} test subdivisions to cleanup`)
    console.log('Test subdivisions:', testSubdivs)
    console.log(`⚠️ WILL ONLY DELETE entities starting with: "${TEST_DATA.PREFIX}"`)

    for (const subdivName of testSubdivs) {
      try {
        await helper.search('subdivision', subdivName)
        await helper.deleteEntity(subdivName)
        await sharedPage.waitForTimeout(TIMEOUTS.SHORT)
        console.log(`✓ Deleted subdivision: ${subdivName}`)
      } catch (e) {
        console.log(`Failed to delete subdivision ${subdivName}:`, e)
        console.log('Note: Subdivision might have departments - delete them first')
      }
    }

    await helper.clearSearch('subdivision')
  })

  /**
   * Step 4: Cleanup independent entities (positions, categories)
   * These have no FK dependencies
   */
  test('cleanup positions', async () => {
    await helper.switchTab('positions')
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    await helper.search('position', TEST_DATA.PREFIX)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const posNames = await helper.getVisibleEntityNames()
    const testPositions = posNames.filter(name => name.startsWith(TEST_DATA.PREFIX))

    console.log(`Found ${testPositions.length} test positions to cleanup`)
    console.log('Test positions:', testPositions)
    console.log(`⚠️ WILL ONLY DELETE entities starting with: "${TEST_DATA.PREFIX}"`)

    for (const posName of testPositions) {
      try {
        await helper.search('position', posName)
        await helper.deleteEntity(posName)
        await sharedPage.waitForTimeout(TIMEOUTS.SHORT)
        console.log(`✓ Deleted position: ${posName}`)
      } catch (e) {
        console.log(`Failed to delete position ${posName}:`, e)
      }
    }

    await helper.clearSearch('position')
  })

  test('cleanup categories', async () => {
    await helper.switchTab('categories')
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    await helper.search('category', TEST_DATA.PREFIX)
    await sharedPage.waitForTimeout(TIMEOUTS.MEDIUM)

    const catNames = await helper.getVisibleEntityNames()
    const testCategories = catNames.filter(name => name.startsWith(TEST_DATA.PREFIX))

    console.log(`Found ${testCategories.length} test categories to cleanup`)
    console.log('Test categories:', testCategories)
    console.log(`⚠️ WILL ONLY DELETE entities starting with: "${TEST_DATA.PREFIX}"`)

    for (const catName of testCategories) {
      try {
        await helper.search('category', catName)
        await helper.deleteEntity(catName)
        await sharedPage.waitForTimeout(TIMEOUTS.SHORT)
        console.log(`✓ Deleted category: ${catName}`)
      } catch (e) {
        console.log(`Failed to delete category ${catName}:`, e)
      }
    }

    await helper.clearSearch('category')
  })
})
