/**
 * Reference Data Hooks
 *
 * Хуки для загрузки справочных данных (сложности, категории работ)
 * с использованием централизованных query keys из cache модуля.
 *
 * BP-007: Миграция на createSimpleCacheQuery + centralized query keys
 */

'use client'

import {
  createSimpleCacheQuery,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import {
  getDifficultyLevels,
  getWorkCategoriesForBudgets,
  type DifficultyLevel,
  type WorkCategory,
} from '../actions/reference-data'

// ============================================================================
// Re-export Types
// ============================================================================

export type { DifficultyLevel, WorkCategory }

// ============================================================================
// Hooks (BP-007: Centralized Query Keys)
// ============================================================================

/**
 * Загружает список уровней сложности
 *
 * Использует централизованные query keys из cache модуля
 * и Server Actions с проверкой аутентификации.
 */
export const useDifficultyLevels = createSimpleCacheQuery<DifficultyLevel[]>({
  queryKey: queryKeys.difficultyLevels.list(),
  queryFn: getDifficultyLevels,
  staleTime: staleTimePresets.static, // 10 мин - справочники редко меняются
})

/**
 * Загружает список категорий работ
 *
 * Использует централизованные query keys из cache модуля
 * и Server Actions с проверкой аутентификации.
 */
export const useWorkCategories = createSimpleCacheQuery<WorkCategory[]>({
  queryKey: queryKeys.workCategories.list(),
  queryFn: getWorkCategoriesForBudgets,
  staleTime: staleTimePresets.static, // 10 мин - справочники редко меняются
})
