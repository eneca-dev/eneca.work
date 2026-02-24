'use client'

/**
 * Work Categories Cache Hooks
 *
 * Хуки для кеширования справочника категорий работ.
 * Используются в модалках для избежания загрузки при каждом открытии.
 */

import { createSimpleCacheQuery } from './use-cache-query'
import { staleTimePresets } from '../client/query-client'
import { getWorkCategories } from '../actions/work-categories'
import { queryKeys } from '../keys/query-keys'
import type { WorkCategory } from '../actions/work-categories'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения списка категорий работ
 *
 * Данные кешируются на длительное время, т.к. категории работ
 * практически не меняются (справочник).
 *
 * @example
 * const { data: categories, isLoading } = useWorkCategories()
 * // categories = [{ work_category_id: '...', work_category_name: '...' }, ...]
 */
export const useWorkCategories = createSimpleCacheQuery<WorkCategory[]>({
  queryKey: queryKeys.workCategories.list(),
  queryFn: getWorkCategories,
  staleTime: staleTimePresets.static, // 10 минут - категории редко меняются
})

// Re-export type for convenience
export type { WorkCategory }
