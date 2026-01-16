/**
 * Reference Data Server Actions
 *
 * Server Actions для загрузки справочных данных (сложности, категории работ)
 * с проверкой аутентификации.
 *
 * @module budgets-page/actions/reference-data
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export interface DifficultyLevel {
  id: string
  abbr: string
  name: string
  weight: number
}

export interface WorkCategory {
  id: string
  name: string
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить список уровней сложности
 */
export async function getDifficultyLevels(): Promise<ActionResult<DifficultyLevel[]>> {
  console.log('[getDifficultyLevels] Called')
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('[getDifficultyLevels] Auth failed:', authError?.message)
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('decomposition_difficulty_levels')
      .select('difficulty_id, difficulty_abbr, difficulty_definition, difficulty_weight')
      .order('difficulty_weight', { ascending: true })

    if (error) {
      console.error('[getDifficultyLevels] DB Error:', error)
      return { success: false, error: error.message }
    }

    const mapped = (data || []).map((d) => ({
      id: d.difficulty_id,
      abbr: d.difficulty_abbr,
      name: d.difficulty_definition,
      weight: d.difficulty_weight,
    }))

    console.log('[getDifficultyLevels] Success, count:', mapped.length)
    return { success: true, data: mapped }
  } catch (error) {
    console.error('[getDifficultyLevels] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки уровней сложности',
    }
  }
}

/**
 * Получить список категорий работ
 */
export async function getWorkCategoriesForBudgets(): Promise<ActionResult<WorkCategory[]>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const { data, error } = await supabase
      .from('work_categories')
      .select('work_category_id, work_category_name')
      .order('work_category_name', { ascending: true })

    if (error) {
      console.error('[getWorkCategoriesForBudgets] Error:', error)
      return { success: false, error: error.message }
    }

    const mapped = (data || []).map((c) => ({
      id: c.work_category_id,
      name: c.work_category_name,
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('[getWorkCategoriesForBudgets] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки категорий работ',
    }
  }
}
