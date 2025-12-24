'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export interface CreateStageInput {
  sectionId: string
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  statusId?: string | null
  responsibles?: string[]
  order?: number
  createdBy?: string
}

export interface UpdateStageInput {
  stageId: string
  name?: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  statusId?: string | null
  responsibles?: string[]
  order?: number
}

export interface ReorderStagesInput {
  stages: Array<{ stageId: string; order: number }>
}

export interface StageResult {
  id: string
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  statusId: string | null
  responsibles: string[]
  order: number | null
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Создать новый этап декомпозиции
 */
export async function createDecompositionStage(
  input: CreateStageInput
): Promise<ActionResult<StageResult>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('decomposition_stages')
      .insert({
        decomposition_stage_section_id: input.sectionId,
        decomposition_stage_name: input.name,
        decomposition_stage_description: input.description ?? null,
        decomposition_stage_start: input.startDate ?? null,
        decomposition_stage_finish: input.endDate ?? null,
        stage_status_id: input.statusId ?? null, // Используем stage_status_id (не decomposition_stage_status_id!)
        decomposition_stage_responsibles: input.responsibles ?? [],
        decomposition_stage_order: input.order ?? 0,
        decomposition_stage_created_by: input.createdBy ?? null,
      })
      .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_description, decomposition_stage_start, decomposition_stage_finish, stage_status_id, decomposition_stage_responsibles, decomposition_stage_order')
      .single()

    if (error) {
      console.error('[createDecompositionStage] Error:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: {
        id: data.decomposition_stage_id,
        name: data.decomposition_stage_name,
        description: data.decomposition_stage_description,
        startDate: data.decomposition_stage_start,
        endDate: data.decomposition_stage_finish,
        statusId: data.stage_status_id,
        responsibles: data.decomposition_stage_responsibles ?? [],
        order: data.decomposition_stage_order,
      },
    }
  } catch (error) {
    console.error('[createDecompositionStage] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Обновить этап декомпозиции
 */
export async function updateDecompositionStage(
  input: UpdateStageInput
): Promise<ActionResult<StageResult>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}

    if (input.name !== undefined) {
      updateData.decomposition_stage_name = input.name
    }
    if (input.description !== undefined) {
      updateData.decomposition_stage_description = input.description
    }
    if (input.startDate !== undefined) {
      updateData.decomposition_stage_start = input.startDate
    }
    if (input.endDate !== undefined) {
      updateData.decomposition_stage_finish = input.endDate
    }
    if (input.statusId !== undefined) {
      updateData.stage_status_id = input.statusId // Используем stage_status_id (не decomposition_stage_status_id!)
    }
    if (input.responsibles !== undefined) {
      updateData.decomposition_stage_responsibles = input.responsibles
    }
    if (input.order !== undefined) {
      updateData.decomposition_stage_order = input.order
    }

    const { data, error } = await supabase
      .from('decomposition_stages')
      .update(updateData)
      .eq('decomposition_stage_id', input.stageId)
      .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_description, decomposition_stage_start, decomposition_stage_finish, stage_status_id, decomposition_stage_responsibles, decomposition_stage_order')
      .single()

    if (error) {
      console.error('[updateDecompositionStage] Error:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: {
        id: data.decomposition_stage_id,
        name: data.decomposition_stage_name,
        description: data.decomposition_stage_description,
        startDate: data.decomposition_stage_start,
        endDate: data.decomposition_stage_finish,
        statusId: data.stage_status_id,
        responsibles: data.decomposition_stage_responsibles ?? [],
        order: data.decomposition_stage_order,
      },
    }
  } catch (error) {
    console.error('[updateDecompositionStage] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Удалить этап декомпозиции
 */
export async function deleteDecompositionStage(
  stageId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Сначала обнуляем stage_id у всех items этого этапа
    await supabase
      .from('decomposition_items')
      .update({ decomposition_item_stage_id: null })
      .eq('decomposition_item_stage_id', stageId)

    const { error } = await supabase
      .from('decomposition_stages')
      .delete()
      .eq('decomposition_stage_id', stageId)

    if (error) {
      console.error('[deleteDecompositionStage] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { deleted: true } }
  } catch (error) {
    console.error('[deleteDecompositionStage] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Изменить порядок этапов декомпозиции
 */
export async function reorderDecompositionStages(
  input: ReorderStagesInput
): Promise<ActionResult<{ reordered: boolean }>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Обновляем порядок каждого этапа
    const updates = input.stages.map(({ stageId, order }) =>
      supabase
        .from('decomposition_stages')
        .update({ decomposition_stage_order: order })
        .eq('decomposition_stage_id', stageId)
    )

    const results = await Promise.all(updates)
    const hasError = results.some((r) => r.error)

    if (hasError) {
      const errors = results.filter((r) => r.error).map((r) => r.error?.message)
      console.error('[reorderDecompositionStages] Errors:', errors)
      return { success: false, error: errors.join(', ') }
    }

    return { success: true, data: { reordered: true } }
  } catch (error) {
    console.error('[reorderDecompositionStages] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
