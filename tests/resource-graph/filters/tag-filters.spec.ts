import { test, expect } from '../../fixtures/auth.fixture'
import { FiltersHelper } from '../helpers/filters.helper'

test.describe('Resource Graph - Tag Filters', () => {
  let filters: FiltersHelper

  test.beforeEach(async ({ page }) => {
    filters = new FiltersHelper(page)
    await filters.clearFiltersStorage()
    await filters.goto()
  })

  // ===========================================================================
  // Single Tag Selection
  // ===========================================================================

  test('select single tag', async () => {
    const tagIds = await filters.getAllTagIds()
    expect(tagIds.length).toBeGreaterThan(0)

    // Select first tag
    await filters.toggleTag(tagIds[0])
    expect(await filters.isTagSelected(tagIds[0])).toBe(true)

    // Verify in localStorage
    await filters.expectFilterInStorage('tagIds', [tagIds[0]])
  })

  // ===========================================================================
  // Multi-select Tags
  // ===========================================================================

  test('multi-select tags (2-5 tags)', async () => {
    const tagIds = await filters.getAllTagIds()

    if (tagIds.length >= 3) {
      // Select 3 tags
      await filters.toggleTag(tagIds[0])
      await filters.toggleTag(tagIds[1])
      await filters.toggleTag(tagIds[2])

      expect(await filters.isTagSelected(tagIds[0])).toBe(true)
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)
      expect(await filters.isTagSelected(tagIds[2])).toBe(true)

      // Verify in localStorage
      await filters.expectFilterInStorage('tagIds', [tagIds[0], tagIds[1], tagIds[2]])
    }
  })

  // ===========================================================================
  // Deselect Tag
  // ===========================================================================

  test('toggle off selected tag', async () => {
    const tagIds = await filters.getAllTagIds()
    expect(tagIds.length).toBeGreaterThan(0)

    // Select tag
    await filters.toggleTag(tagIds[0])
    expect(await filters.isTagSelected(tagIds[0])).toBe(true)

    // Deselect tag
    await filters.toggleTag(tagIds[0])
    expect(await filters.isTagSelected(tagIds[0])).toBe(false)
  })

  // ===========================================================================
  // Select All Tags
  // ===========================================================================

  test('select all available tags', async () => {
    const tagIds = await filters.getAllTagIds()
    expect(tagIds.length).toBeGreaterThan(0)

    // Select all tags
    for (const tagId of tagIds) {
      await filters.toggleTag(tagId)
    }

    // Verify all are selected
    for (const tagId of tagIds) {
      expect(await filters.isTagSelected(tagId)).toBe(true)
    }

    // Verify in localStorage
    await filters.expectFilterInStorage('tagIds', tagIds)
  })

  // ===========================================================================
  // Sequential Add/Remove
  // ===========================================================================

  test('sequential adding/removing tags', async () => {
    const tagIds = await filters.getAllTagIds()

    if (tagIds.length >= 3) {
      // Add first
      await filters.toggleTag(tagIds[0])
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)

      // Add second
      await filters.toggleTag(tagIds[1])
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)

      // Add third
      await filters.toggleTag(tagIds[2])
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)
      expect(await filters.isTagSelected(tagIds[2])).toBe(true)

      // Remove first
      await filters.toggleTag(tagIds[0])
      expect(await filters.isTagSelected(tagIds[0])).toBe(false)
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)
      expect(await filters.isTagSelected(tagIds[2])).toBe(true)

      // Remove second
      await filters.toggleTag(tagIds[1])
      expect(await filters.isTagSelected(tagIds[0])).toBe(false)
      expect(await filters.isTagSelected(tagIds[1])).toBe(false)
      expect(await filters.isTagSelected(tagIds[2])).toBe(true)

      // Remove third
      await filters.toggleTag(tagIds[2])
      expect(await filters.isTagSelected(tagIds[0])).toBe(false)
      expect(await filters.isTagSelected(tagIds[1])).toBe(false)
      expect(await filters.isTagSelected(tagIds[2])).toBe(false)
    }
  })

  // ===========================================================================
  // Tags with Hierarchical Filters
  // ===========================================================================

  test('tags work with active hierarchical filters', async ({ page }) => {
    // Select a hierarchical filter first
    const managerSelect = page.locator('[data-testid="filter-manager"]')
    const firstManager = await managerSelect.locator('option').nth(1).getAttribute('value')
    if (firstManager) {
      await filters.selectFilter('MANAGER', firstManager)
    }

    const subdivisionSelect = page.locator('[data-testid="filter-subdivision"]')
    const firstSubdiv = await subdivisionSelect.locator('option').nth(1).getAttribute('value')
    if (firstSubdiv) {
      await filters.selectFilter('SUBDIVISION', firstSubdiv)
    }

    // Now select tags
    const tagIds = await filters.getAllTagIds()
    if (tagIds.length >= 2) {
      await filters.toggleTag(tagIds[0])
      await filters.toggleTag(tagIds[1])

      // Verify tags are selected
      expect(await filters.isTagSelected(tagIds[0])).toBe(true)
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)

      // Verify hierarchical filters still applied
      if (firstManager) await filters.expectFilterValue('MANAGER', firstManager)
      if (firstSubdiv) await filters.expectFilterValue('SUBDIVISION', firstSubdiv)

      // Remove one tag
      await filters.toggleTag(tagIds[0])
      expect(await filters.isTagSelected(tagIds[0])).toBe(false)
      expect(await filters.isTagSelected(tagIds[1])).toBe(true)

      // Hierarchical filters should still be applied
      if (firstManager) await filters.expectFilterValue('MANAGER', firstManager)
      if (firstSubdiv) await filters.expectFilterValue('SUBDIVISION', firstSubdiv)
    }
  })
})
