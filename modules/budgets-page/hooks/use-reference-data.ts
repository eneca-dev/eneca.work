/**
 * Reference Data Hooks
 *
 * Хуки для загрузки справочных данных (сложности, категории работ)
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'

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
// Query Keys
// ============================================================================

export const referenceDataKeys = {
  difficulties: ['reference', 'difficulties'] as const,
  workCategories: ['reference', 'workCategories'] as const,
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Загружает список уровней сложности
 */
export function useDifficultyLevels() {
  const supabase = createClient()

  return useQuery({
    queryKey: referenceDataKeys.difficulties,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('decomposition_difficulty_levels')
        .select('difficulty_id, difficulty_abbr, difficulty_definition, difficulty_weight')
        .order('difficulty_weight', { ascending: true })

      if (error) throw new Error(error.message)

      return (data || []).map((d) => ({
        id: d.difficulty_id,
        abbr: d.difficulty_abbr,
        name: d.difficulty_definition,
        weight: d.difficulty_weight,
      })) as DifficultyLevel[]
    },
    staleTime: 5 * 60 * 1000, // 5 минут - справочники редко меняются
  })
}

/**
 * Загружает список категорий работ
 */
export function useWorkCategories() {
  const supabase = createClient()

  return useQuery({
    queryKey: referenceDataKeys.workCategories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_categories')
        .select('work_category_id, work_category_name')
        .order('work_category_name', { ascending: true })

      if (error) throw new Error(error.message)

      return (data || []).map((c) => ({
        id: c.work_category_id,
        name: c.work_category_name,
      })) as WorkCategory[]
    },
    staleTime: 5 * 60 * 1000, // 5 минут
  })
}
