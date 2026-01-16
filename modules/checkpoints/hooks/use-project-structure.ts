import { createSimpleCacheQuery, queryKeys, staleTimePresets } from '@/modules/cache'
import { getProjectStructure } from '@/modules/resource-graph/actions'

/**
 * Хук для получения структуры проектов (проекты, стадии, объекты, разделы)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useProjectStructure()
 *
 * if (data) {
 *   const { projects, stages, objects, sections } = data
 *   // Use the structure data
 * }
 * ```
 */
export const useProjectStructure = createSimpleCacheQuery({
  // Используем filterStructure.project() для единого кеша с фильтрами
  queryKey: queryKeys.filterStructure.project(),
  queryFn: getProjectStructure,
  staleTime: staleTimePresets.medium, // 5 минут - синхронизировано с filter options
})
