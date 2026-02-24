'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export interface DifficultyLevel {
  difficulty_id: string
  difficulty_abbr: string
  difficulty_definition: string
}

// ============================================================================
// Action
// ============================================================================

/**
 * Получить список уровней сложности декомпозиции
 * Справочные данные - кешируются надолго
 */
export async function getDifficultyLevels(): Promise<ActionResult<DifficultyLevel[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('decomposition_difficulty_levels')
      .select('difficulty_id, difficulty_abbr, difficulty_definition')
      .order('difficulty_abbr')

    if (error) {
      console.error('[getDifficultyLevels] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [] }
  } catch (error) {
    console.error('[getDifficultyLevels] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
