'use client'

/**
 * Hook for fetching work categories
 * Reference data - cached for a long time
 */

import { createSimpleCacheQuery, staleTimePresets, queryKeys } from '@/modules/cache'
import { getWorkCategories, type WorkCategory } from '../actions'

// ============================================================================
// Hook
// ============================================================================

/**
 * Хук для получения списка категорий работ
 * Справочные данные - кешируются 10 минут
 *
 * @example
 * const { data: categories, isLoading } = useWorkCategories()
 */
export const useWorkCategories = createSimpleCacheQuery<WorkCategory[]>({
  queryKey: queryKeys.workCategories.list(),
  queryFn: getWorkCategories,
  staleTime: staleTimePresets.static, // 10 минут - справочник редко меняется
})
