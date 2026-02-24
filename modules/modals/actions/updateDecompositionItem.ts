'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export interface CreateItemInput {
  sectionId: string
  stageId?: string | null
  description: string
  workCategoryId: string
  difficultyId?: string | null
  plannedHours: number
  progress?: number
  order?: number
  createdBy?: string
}

export interface UpdateItemInput {
  itemId: string
  stageId?: string | null
  description?: string
  workCategoryId?: string
  difficultyId?: string | null
  plannedHours?: number
  progress?: number
  order?: number
}

export interface MoveItemsInput {
  itemIds: string[]
  targetStageId: string | null
}

export interface ReorderItemsInput {
  items: Array<{ itemId: string; order: number; stageId?: string | null }>
}

export interface ItemResult {
  id: string
  sectionId: string
  stageId: string | null
  description: string
  workCategoryId: string
  difficultyId: string | null
  plannedHours: number
  progress: number
  order: number
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Создать новую задачу декомпозиции
 */
export async function createDecompositionItem(
  input: CreateItemInput
): Promise<ActionResult<ItemResult>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('decomposition_items')
      .insert({
        decomposition_item_section_id: input.sectionId,
        decomposition_item_stage_id: input.stageId ?? null,
        decomposition_item_description: input.description,
        decomposition_item_work_category_id: input.workCategoryId,
        decomposition_item_difficulty_id: input.difficultyId ?? null,
        decomposition_item_planned_hours: input.plannedHours,
        decomposition_item_progress: input.progress ?? 0,
        decomposition_item_order: input.order ?? 0,
        decomposition_item_created_by: input.createdBy ?? null,
      })
      .select('decomposition_item_id, decomposition_item_section_id, decomposition_item_stage_id, decomposition_item_description, decomposition_item_work_category_id, decomposition_item_difficulty_id, decomposition_item_planned_hours, decomposition_item_progress, decomposition_item_order')
      .single()

    if (error) {
      console.error('[createDecompositionItem] Error:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: {
        id: data.decomposition_item_id,
        sectionId: data.decomposition_item_section_id,
        stageId: data.decomposition_item_stage_id,
        description: data.decomposition_item_description,
        workCategoryId: data.decomposition_item_work_category_id,
        difficultyId: data.decomposition_item_difficulty_id,
        plannedHours: Number(data.decomposition_item_planned_hours),
        progress: data.decomposition_item_progress ?? 0,
        order: data.decomposition_item_order,
      },
    }
  } catch (error) {
    console.error('[createDecompositionItem] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Обновить задачу декомпозиции
 */
export async function updateDecompositionItem(
  input: UpdateItemInput
): Promise<ActionResult<ItemResult>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}

    if (input.stageId !== undefined) {
      updateData.decomposition_item_stage_id = input.stageId
    }
    if (input.description !== undefined) {
      updateData.decomposition_item_description = input.description
    }
    if (input.workCategoryId !== undefined) {
      updateData.decomposition_item_work_category_id = input.workCategoryId
    }
    if (input.difficultyId !== undefined) {
      updateData.decomposition_item_difficulty_id = input.difficultyId
    }
    if (input.plannedHours !== undefined) {
      updateData.decomposition_item_planned_hours = input.plannedHours
    }
    if (input.progress !== undefined) {
      updateData.decomposition_item_progress = input.progress
    }
    if (input.order !== undefined) {
      updateData.decomposition_item_order = input.order
    }

    const { data, error } = await supabase
      .from('decomposition_items')
      .update(updateData)
      .eq('decomposition_item_id', input.itemId)
      .select('decomposition_item_id, decomposition_item_section_id, decomposition_item_stage_id, decomposition_item_description, decomposition_item_work_category_id, decomposition_item_difficulty_id, decomposition_item_planned_hours, decomposition_item_progress, decomposition_item_order')
      .single()

    if (error) {
      console.error('[updateDecompositionItem] Error:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: {
        id: data.decomposition_item_id,
        sectionId: data.decomposition_item_section_id,
        stageId: data.decomposition_item_stage_id,
        description: data.decomposition_item_description,
        workCategoryId: data.decomposition_item_work_category_id,
        difficultyId: data.decomposition_item_difficulty_id,
        plannedHours: Number(data.decomposition_item_planned_hours),
        progress: data.decomposition_item_progress ?? 0,
        order: data.decomposition_item_order,
      },
    }
  } catch (error) {
    console.error('[updateDecompositionItem] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Удалить задачу декомпозиции
 *
 * Проверяет целостность данных:
 * - Нельзя удалить если есть активные loadings (нагрузки сотрудников)
 */
export async function deleteDecompositionItem(
  itemId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Проверка: Есть ли loadings привязанные к этому элементу
    const { count: loadingsCount, error: loadingsError } = await supabase
      .from('loadings')
      .select('*', { count: 'exact', head: true })
      .eq('loading_decomposition_item_id', itemId)

    if (loadingsError) {
      console.error('[deleteDecompositionItem] Loadings check error:', loadingsError)
      // Не блокируем, возможно поле не существует (FK может быть на stage, не item)
    }

    if (loadingsCount && loadingsCount > 0) {
      return {
        success: false,
        error: `Нельзя удалить задачу: на неё назначено ${loadingsCount} нагрузок. Сначала удалите нагрузки.`,
      }
    }

    const { error } = await supabase
      .from('decomposition_items')
      .delete()
      .eq('decomposition_item_id', itemId)

    if (error) {
      console.error('[deleteDecompositionItem] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { deleted: true } }
  } catch (error) {
    console.error('[deleteDecompositionItem] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Переместить задачи в другой этап
 */
export async function moveDecompositionItems(
  input: MoveItemsInput
): Promise<ActionResult<{ moved: boolean }>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { error } = await supabase
      .from('decomposition_items')
      .update({ decomposition_item_stage_id: input.targetStageId })
      .in('decomposition_item_id', input.itemIds)

    if (error) {
      console.error('[moveDecompositionItems] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { moved: true } }
  } catch (error) {
    console.error('[moveDecompositionItems] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Изменить порядок задач декомпозиции
 */
export async function reorderDecompositionItems(
  input: ReorderItemsInput
): Promise<ActionResult<{ reordered: boolean }>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Обновляем порядок и/или этап для каждой задачи
    const updates = input.items.map(({ itemId, order, stageId }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        decomposition_item_order: order,
      }
      if (stageId !== undefined) {
        updateData.decomposition_item_stage_id = stageId
      }
      return supabase
        .from('decomposition_items')
        .update(updateData)
        .eq('decomposition_item_id', itemId)
    })

    const results = await Promise.all(updates)
    const hasError = results.some((r) => r.error)

    if (hasError) {
      const errors = results.filter((r) => r.error).map((r) => r.error?.message)
      console.error('[reorderDecompositionItems] Errors:', errors)
      return { success: false, error: errors.join(', ') }
    }

    return { success: true, data: { reordered: true } }
  } catch (error) {
    console.error('[reorderDecompositionItems] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Массовое создание задач декомпозиции (для вставки из Excel)
 */
export async function bulkCreateDecompositionItems(
  items: CreateItemInput[]
): Promise<ActionResult<ItemResult[]>> {
  try {
    if (items.length === 0) {
      return { success: true, data: [] }
    }

    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const insertData = items.map((item) => ({
      decomposition_item_section_id: item.sectionId,
      decomposition_item_stage_id: item.stageId ?? null,
      decomposition_item_description: item.description,
      decomposition_item_work_category_id: item.workCategoryId,
      decomposition_item_difficulty_id: item.difficultyId ?? null,
      decomposition_item_planned_hours: item.plannedHours,
      decomposition_item_progress: item.progress ?? 0,
      decomposition_item_order: item.order ?? 0,
      decomposition_item_created_by: item.createdBy ?? null,
    }))

    const { data, error } = await supabase
      .from('decomposition_items')
      .insert(insertData)
      .select('decomposition_item_id, decomposition_item_section_id, decomposition_item_stage_id, decomposition_item_description, decomposition_item_work_category_id, decomposition_item_difficulty_id, decomposition_item_planned_hours, decomposition_item_progress, decomposition_item_order')

    if (error) {
      console.error('[bulkCreateDecompositionItems] Error:', error)
      return { success: false, error: error.message }
    }

    const results: ItemResult[] = (data ?? []).map((d) => ({
      id: d.decomposition_item_id,
      sectionId: d.decomposition_item_section_id,
      stageId: d.decomposition_item_stage_id,
      description: d.decomposition_item_description,
      workCategoryId: d.decomposition_item_work_category_id,
      difficultyId: d.decomposition_item_difficulty_id,
      plannedHours: Number(d.decomposition_item_planned_hours),
      progress: d.decomposition_item_progress ?? 0,
      order: d.decomposition_item_order,
    }))

    return { success: true, data: results }
  } catch (error) {
    console.error('[bulkCreateDecompositionItems] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Массовое удаление задач декомпозиции
 *
 * Проверяет целостность данных:
 * - Нельзя удалить если есть loadings на любую из задач
 */
export async function bulkDeleteDecompositionItems(
  itemIds: string[]
): Promise<ActionResult<{ deleted: number }>> {
  try {
    if (itemIds.length === 0) {
      return { success: true, data: { deleted: 0 } }
    }

    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Проверка: Есть ли loadings привязанные к любой из задач
    const { data: loadings, error: loadingsError } = await supabase
      .from('loadings')
      .select('loading_decomposition_item_id')
      .in('loading_decomposition_item_id', itemIds)
      .limit(10)

    if (loadingsError) {
      console.error('[bulkDeleteDecompositionItems] Loadings check error:', loadingsError)
      // Не блокируем, возможно поле не существует
    }

    if (loadings && loadings.length > 0) {
      const blockedCount = new Set(loadings.map(l => l.loading_decomposition_item_id)).size
      return {
        success: false,
        error: `Нельзя удалить: ${blockedCount} из ${itemIds.length} задач имеют назначенные нагрузки. Сначала удалите нагрузки.`,
      }
    }

    const { error, count } = await supabase
      .from('decomposition_items')
      .delete()
      .in('decomposition_item_id', itemIds)

    if (error) {
      console.error('[bulkDeleteDecompositionItems] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { deleted: count ?? itemIds.length } }
  } catch (error) {
    console.error('[bulkDeleteDecompositionItems] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
