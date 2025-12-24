'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export interface DecompositionItemOption {
  id: string
  description: string
  work_category_id: string
  progress: number
}

export interface CreateWorkLogInput {
  decompositionItemId: string
  description: string | null
  workDate: string
  hours: number
  hourlyRate: number
  budgetId: string
  /** ID исполнителя (если не указан, используется текущий пользователь) */
  executorId?: string
}

export interface WorkLogResult {
  id: string
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить decomposition items по section_id
 */
export async function getDecompositionItemsBySection(
  sectionId: string
): Promise<ActionResult<DecompositionItemOption[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('decomposition_items')
      .select(
        'decomposition_item_id, decomposition_item_description, decomposition_item_work_category_id, decomposition_item_progress'
      )
      .eq('decomposition_item_section_id', sectionId)
      .order('decomposition_item_order', { ascending: true })

    if (error) {
      console.error('[getDecompositionItemsBySection] Error:', error)
      return { success: false, error: error.message }
    }

    const items: DecompositionItemOption[] = (data || []).map((r) => ({
      id: r.decomposition_item_id,
      description: r.decomposition_item_description,
      work_category_id: r.decomposition_item_work_category_id,
      progress: r.decomposition_item_progress ?? 0,
    }))

    return { success: true, data: items }
  } catch (error) {
    console.error('[getDecompositionItemsBySection] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить ставку пользователя по его ID
 */
export async function getUserHourlyRate(
  userId: string
): Promise<ActionResult<number | null>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('salary')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[getUserHourlyRate] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data?.salary ?? null }
  } catch (error) {
    console.error('[getUserHourlyRate] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Создать запись work log
 */
export async function createWorkLog(
  input: CreateWorkLogInput
): Promise<ActionResult<WorkLogResult>> {
  try {
    const supabase = await createClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const payload = {
      decomposition_item_id: input.decompositionItemId,
      work_log_description: input.description,
      work_log_created_by: input.executorId || user.id,
      work_log_date: input.workDate,
      work_log_hours: input.hours,
      work_log_hourly_rate: input.hourlyRate,
      budget_id: input.budgetId,
    }

    const { data, error } = await supabase
      .from('work_logs')
      .insert(payload)
      .select('work_log_id')
      .single()

    if (error) {
      console.error('[createWorkLog] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { id: data.work_log_id } }
  } catch (error) {
    console.error('[createWorkLog] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
