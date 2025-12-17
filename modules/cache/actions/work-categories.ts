'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface WorkCategory {
  work_category_id: string
  work_category_name: string
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить список категорий работ
 *
 * Используется для кеширования справочника категорий,
 * который редко меняется.
 *
 * @returns Список категорий работ
 */
export async function getWorkCategories(): Promise<ActionResult<WorkCategory[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('work_categories')
      .select('work_category_id, work_category_name')
      .order('work_category_name')

    if (error) {
      console.error('[getWorkCategories] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('[getWorkCategories] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки категорий работ',
    }
  }
}
