/**
 * Kanban Module - Cache Hooks
 *
 * Хуки для кеширования данных канбан-доски.
 * Используют Server Actions из modules/kanban/actions/
 */

'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import {
  createCacheQuery,
  createDetailCacheQuery,
} from '@/modules/cache/hooks/use-cache-query'
import { staleTimePresets } from '@/modules/cache/client/query-client'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import {
  getKanbanSections,
  getKanbanSectionById,
  getKanbanSectionsPaginated,
  type KanbanFilters,
} from '../actions'
import type { KanbanSection } from '../types'

/** Размер страницы для пагинации */
const KANBAN_PAGE_SIZE = 15

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения списка разделов канбан-доски
 *
 * @example
 * const filters = useKanbanFiltersStore(state => state.getQueryParams())
 * const { data: sections, isLoading } = useKanbanSections(filters)
 */
export const useKanbanSections = createCacheQuery<KanbanSection[], KanbanFilters | undefined>({
  queryKey: (filters) => queryKeys.kanban.list(filters),
  queryFn: (filters) => getKanbanSections(filters ?? undefined),
  staleTime: staleTimePresets.fast, // 2 минуты - данные часто меняются
})

/**
 * Хук для получения разделов канбан-доски с пагинацией (infinite scroll)
 *
 * Загружает по 15 разделов за раз. Используйте fetchNextPage() для
 * загрузки следующей порции данных.
 *
 * @example
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 * } = useKanbanSectionsInfinite(filters)
 *
 * // Все секции из всех загруженных страниц:
 * const allSections = data?.pages.flat() ?? []
 */
export function useKanbanSectionsInfinite(
  filters: KanbanFilters | undefined,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery({
    queryKey: queryKeys.kanban.infinite(filters),
    queryFn: async ({ pageParam }) => {
      const result = await getKanbanSectionsPaginated({
        filters,
        page: pageParam,
        pageSize: KANBAN_PAGE_SIZE,
      })
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      // Если последняя страница меньше pageSize, значит данных больше нет
      if (lastPage.length < KANBAN_PAGE_SIZE) {
        return undefined
      }
      return allPages.length + 1
    },
    staleTime: staleTimePresets.fast,
    enabled: options?.enabled,
  })
}

/**
 * Хук для получения детальной информации о разделе
 *
 * @example
 * const { data: section } = useKanbanSection('section-id-123')
 */
export const useKanbanSection = createDetailCacheQuery<KanbanSection | null>({
  queryKey: (id) => queryKeys.kanban.detail(id),
  queryFn: getKanbanSectionById,
  staleTime: staleTimePresets.fast,
})

// ============================================================================
// Stage Statuses Hook
// ============================================================================

export { useStageStatuses } from './useStageStatuses'

// ============================================================================
// Mutation Hooks (TODO: добавить после подключения к БД)
// ============================================================================

// export const useUpdateStageStatus = createUpdateMutation(...)
// export const useUpdateTaskProgress = createUpdateMutation(...)
