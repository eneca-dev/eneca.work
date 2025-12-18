'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export interface StageStatus {
  id: string
  name: string
  color: string
  description: string | null
}

// ============================================================================
// Action
// ============================================================================

/**
 * Получить список статусов для этапов декомпозиции
 * Справочные данные - кешируются надолго
 */
export async function getStageStatuses(): Promise<ActionResult<StageStatus[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('section_statuses')
      .select('id, name, color, description')
      .order('name')

    if (error) {
      console.error('[getStageStatuses] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [] }
  } catch (error) {
    console.error('[getStageStatuses] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
