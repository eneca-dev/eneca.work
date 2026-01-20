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
// Drag and Drop Hook
// ============================================================================

export { useDragHandlers } from './useDragHandlers'

// ============================================================================
// Mutation Hooks
// ============================================================================
//
// ARCHITECTURAL NOTE:
// Эти хуки используют useMutation напрямую из @tanstack/react-query,
// а НЕ фабрики из modules/cache (createCacheMutation, createUpdateMutation).
//
// Причина: текущие фабрики cache module работают с плоскими массивами TData[],
// но НЕ поддерживают InfiniteData<TData[]> структуру, которая используется
// в useKanbanSectionsInfinite для пагинации.
//
// TODO: Когда cache module будет расширен фабрикой createInfiniteUpdateMutation,
// перевести эти хуки на использование фабрики.
// ============================================================================

import { useMutation, type InfiniteData } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { flushSync } from 'react-dom'
import { updateStageStatus, updateTaskProgress } from '../actions'
import type { StageStatus } from '../types'

/**
 * Input для обновления статуса этапа
 */
export interface UpdateStageStatusInput {
  stageId: string
  sectionId: string
  newStatus: StageStatus
}

/**
 * Хук для обновления статуса этапа с оптимистичным обновлением
 *
 * При drag&drop:
 * 1. UI обновляется мгновенно (optimistic update)
 * 2. Запрос идёт на сервер в фоне
 * 3. При ошибке - автоматический откат к предыдущему состоянию
 *
 * @example
 * const { mutate: updateStatus, isPending } = useUpdateStageStatusOptimistic()
 *
 * const handleDragEnd = (event: DragEndEvent) => {
 *   updateStatus({
 *     stageId: 'stage-123',
 *     sectionId: 'section-456',
 *     newStatus: 'in_progress',
 *   })
 * }
 */
export function useUpdateStageStatusOptimistic(
  filters?: Record<string, unknown>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateStageStatusInput) => {
      const result = await updateStageStatus(input)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },

    // Оптимистичное обновление ПЕРЕД отправкой запроса
    onMutate: async (input: UpdateStageStatusInput) => {
      // Отменяем текущие запросы, чтобы они не перезаписали наше обновление
      await queryClient.cancelQueries({ queryKey: queryKeys.kanban.all })

      // Сохраняем предыдущее состояние для отката
      const infiniteQueryKey = queryKeys.kanban.infinite(filters)
      const previousData = queryClient.getQueryData<
        InfiniteData<KanbanSection[]>
      >(infiniteQueryKey)

      // КРИТИЧНО: Используем flushSync для СИНХРОННОГО обновления кеша и ререндера
      // Это гарантирует, что карточка переместится в новую колонку ДО того,
      // как handleDragEnd вызовет setActiveCard(null)
      if (previousData) {
        flushSync(() => {
          queryClient.setQueryData<InfiniteData<KanbanSection[]>>(
            infiniteQueryKey,
            (old) => {
              if (!old) return old

              // Обновляем каждую страницу
              const newPages = old.pages.map((page) =>
                page.map((section) => {
                  // Находим нужный section
                  if (section.id !== input.sectionId) return section

                  // Обновляем stages в этом section
                  return {
                    ...section,
                    stages: section.stages.map((stage) => {
                      if (stage.id !== input.stageId) return stage
                      // Обновляем статус этапа
                      return {
                        ...stage,
                        status: input.newStatus,
                      }
                    }),
                  }
                })
              )

              return {
                ...old,
                pages: newPages,
              }
            }
          )
        })
      }

      // Возвращаем контекст для отката при ошибке
      return { previousData, infiniteQueryKey }
    },

    // При ошибке откатываем к предыдущему состоянию
    onError: (error, _input, context) => {
      console.error('[useUpdateStageStatusOptimistic] Error:', error)

      if (context?.previousData) {
        // КРИТИЧНО: Откат тоже должен быть синхронным (как и оптимистичное обновление)
        flushSync(() => {
          queryClient.setQueryData(context.infiniteQueryKey, context.previousData)
        })
      }
    },

    // НЕ инвалидируем данные после успеха - optimistic update уже обновил кеш корректно
    // Инвалидация вызывала бы полную перезагрузку данных, что замедляет UI
    // Синхронизация с сервером происходит через Realtime подписку на decomposition_stages
  })
}

/**
 * Input для обновления прогресса задачи
 */
export interface UpdateTaskProgressInput {
  taskId: string
  stageId: string
  sectionId: string
  progress: number
}

/**
 * Хук для обновления прогресса задачи с оптимистичным обновлением
 */
export function useUpdateTaskProgressOptimistic(
  filters?: Record<string, unknown>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateTaskProgressInput) => {
      const result = await updateTaskProgress(input)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },

    onMutate: async (input: UpdateTaskProgressInput) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.kanban.all })

      const infiniteQueryKey = queryKeys.kanban.infinite(filters)
      const previousData = queryClient.getQueryData<
        InfiniteData<KanbanSection[]>
      >(infiniteQueryKey)

      if (previousData) {
        // КРИТИЧНО: Используем flushSync для синхронного обновления progress
        flushSync(() => {
          queryClient.setQueryData<InfiniteData<KanbanSection[]>>(
            infiniteQueryKey,
            (old) => {
              if (!old) return old

              const newPages = old.pages.map((page) =>
                page.map((section) => {
                  if (section.id !== input.sectionId) return section

                  return {
                    ...section,
                    stages: section.stages.map((stage) => {
                      if (stage.id !== input.stageId) return stage

                      // Обновляем progress у задачи
                      const newTasks = stage.tasks.map((task) => {
                        if (task.id !== input.taskId) return task
                        return { ...task, progress: input.progress }
                      })

                      // Пересчитываем progress этапа
                      const totalProgress = newTasks.reduce(
                        (sum, t) => sum + t.progress,
                        0
                      )
                      const avgProgress =
                        newTasks.length > 0
                          ? Math.round(totalProgress / newTasks.length)
                          : 0

                      return {
                        ...stage,
                        tasks: newTasks,
                        progress: avgProgress,
                      }
                    }),
                  }
                })
              )

              return { ...old, pages: newPages }
            }
          )
        })
      }

      return { previousData, infiniteQueryKey }
    },

    onError: (error, _input, context) => {
      console.error('[useUpdateTaskProgressOptimistic] Error:', error)
      if (context?.previousData) {
        // КРИТИЧНО: Откат тоже должен быть синхронным
        flushSync(() => {
          queryClient.setQueryData(context.infiniteQueryKey, context.previousData)
        })
      }
    },

    // НЕ инвалидируем - optimistic update уже обновил кеш, Realtime синхронизирует
  })
}
