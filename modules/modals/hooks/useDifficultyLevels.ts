'use client'

/**
 * Hook for fetching difficulty levels
 * Reference data - cached for a long time
 */

import { createSimpleCacheQuery, staleTimePresets, queryKeys } from '@/modules/cache'
import { getDifficultyLevels, type DifficultyLevel } from '../actions'

// ============================================================================
// Hook
// ============================================================================

/**
 * Хук для получения списка уровней сложности
 * Справочные данные - кешируются 10 минут
 *
 * @example
 * const { data: difficulties, isLoading } = useDifficultyLevels()
 */
export const useDifficultyLevels = createSimpleCacheQuery<DifficultyLevel[]>({
  queryKey: queryKeys.difficultyLevels.list(),
  queryFn: getDifficultyLevels,
  staleTime: staleTimePresets.static, // 10 минут - справочник редко меняется
})
