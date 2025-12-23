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
  queryKey: queryKeys.projects.structure(),
  queryFn: getProjectStructure,
  staleTime: staleTimePresets.medium, // 3 минуты кеширования
})
