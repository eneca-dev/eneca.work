'use client'

/**
 * Hook for fetching decomposition bootstrap data for a section
 * Includes stages, items, employees, and reference data
 */

import { createDetailCacheQuery, createCacheQuery, staleTimePresets, queryKeys } from '@/modules/cache'
import {
  getDecompositionBootstrap,
  getEmployees,
  getWorkLogsAggregate,
  type DecompositionBootstrapData,
  type Employee,
} from '../actions'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения bootstrap данных декомпозиции раздела
 * Включает: этапы, задачи, категории, сложности, статусы, профили
 *
 * @example
 * const { data: bootstrap, isLoading } = useDecompositionBootstrap(sectionId)
 */
export const useDecompositionBootstrap = createDetailCacheQuery<DecompositionBootstrapData>({
  queryKey: (sectionId) => queryKeys.decomposition.bootstrap(sectionId),
  queryFn: getDecompositionBootstrap,
  staleTime: staleTimePresets.fast, // 2 минуты - данные могут меняться часто
})

/**
 * Хук для получения списка сотрудников (для назначения ответственных)
 *
 * @example
 * const { data: employees, isLoading } = useEmployees()
 */
export const useEmployees = createCacheQuery<Employee[], void>({
  queryKey: () => queryKeys.employees.list(),
  queryFn: () => getEmployees(),
  staleTime: staleTimePresets.medium, // 5 минут - список сотрудников стабилен
})

/**
 * Хук для получения агрегированных часов работы по задачам
 *
 * @example
 * const { data: hoursMap, isLoading } = useWorkLogsAggregate(['item-1', 'item-2'])
 */
export const useWorkLogsAggregate = createCacheQuery<Record<string, number>, string[]>({
  queryKey: (itemIds) => {
    // Создаём стабильный ключ из массива ID
    const sortedIds = [...itemIds].sort().join(',')
    return queryKeys.decomposition.workLogs(sortedIds)
  },
  queryFn: getWorkLogsAggregate,
  staleTime: staleTimePresets.fast, // 2 минуты - часы могут меняться часто
})
