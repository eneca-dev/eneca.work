'use client'

/**
 * Хуки для работы с чекпоинтами
 *
 * Инкапсулируют логику кеширования, загрузки данных и автоматической
 * инвалидации кеша для модуля checkpoints.
 *
 * Optimistic updates используются только для операций complete/delete.
 * Для create/update используется инвалидация кеша с перезагрузкой данных.
 *
 * @module modules/checkpoints/hooks/use-checkpoints
 */

import {
  createCacheQuery,
  createDetailCacheQuery,
  createCacheMutation,
  createUpdateMutation,
  createDeleteMutation,
  queryKeys,
} from '@/modules/cache'

import {
  getCheckpoints,
  getCheckpoint,
  getCheckpointAudit,
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  deleteCheckpoint,
  getProjectSections,
  type Checkpoint,
  type CreateCheckpointInput,
  type UpdateCheckpointInput,
  type CompleteCheckpointInput,
  type AuditEntry,
  type SectionOption,
} from '@/modules/checkpoints/actions/checkpoints'

import type { CheckpointFilters } from '@/modules/cache/keys/query-keys'

// ============================================================================
// Query Hooks (чтение данных)
// ============================================================================

/**
 * Хук для загрузки списка чекпоинтов с фильтрацией
 *
 * ОПТИМИЗИРОВАНО: Увеличен staleTime до 5 минут, т.к. чекпоинты
 * меняются относительно редко (не каждые 30 сек).
 *
 * @example
 * ```tsx
 * const { data: checkpoints, isLoading } = useCheckpoints({ sectionId: 'uuid' })
 * ```
 */
export const useCheckpoints = createCacheQuery({
  queryKey: (filters?: CheckpointFilters) => queryKeys.checkpoints.list(filters),
  queryFn: getCheckpoints,
  staleTime: 'slow', // 5 минут — чекпоинты меняются редко
})

/**
 * Хук для загрузки детальной информации о чекпоинте
 *
 * ОПТИМИЗИРОВАНО: Увеличен staleTime до 5 минут.
 *
 * @example
 * ```tsx
 * const { data: checkpoint } = useCheckpoint(checkpointId)
 * ```
 */
export const useCheckpoint = createDetailCacheQuery({
  queryKey: (id: string) => queryKeys.checkpoints.detail(id),
  queryFn: getCheckpoint,
  staleTime: 'slow', // 5 минут
})

/**
 * Хук для загрузки истории изменений чекпоинта (audit trail)
 *
 * @example
 * ```tsx
 * const { data: audit } = useCheckpointAudit(checkpointId)
 * ```
 */
export const useCheckpointAudit = createDetailCacheQuery({
  queryKey: (id: string) => queryKeys.checkpoints.audit(id),
  queryFn: getCheckpointAudit,
  staleTime: 'medium', // 5 минут — история редко меняется
})

// ============================================================================
// Constants
// ============================================================================

/** Временный ID пользователя для optimistic updates (будет заменен сервером) */
const OPTIMISTIC_USER_ID = 'optimistic-user-id' as const

// ============================================================================
// Mutation Hooks (изменение данных)
// ============================================================================

/**
 * Хук для создания нового чекпоинта
 *
 * После успешного создания на сервере автоматически инвалидирует кеш
 * списков чекпоинтов. Чекпоинты загружаются отдельно от основных данных
 * графика, поэтому не требуется инвалидация resourceGraph.
 *
 * ОПТИМИЗИРОВАНО: Инвалидирует только списки чекпоинтов, не затрагивая
 * sections или resourceGraph (чекпоинты загружаются отдельным запросом).
 *
 * @example
 * ```tsx
 * const createMutation = useCreateCheckpoint()
 * createMutation.mutate({
 *   sectionId: 'uuid',
 *   typeId: 'exam-type-uuid',
 *   title: 'Экспертиза',
 *   checkpointDate: '2025-12-31',
 * })
 * ```
 */
export const useCreateCheckpoint = createCacheMutation<CreateCheckpointInput, Checkpoint>({
  mutationFn: createCheckpoint,
  invalidateKeys: (input) => [
    // Инвалидируем список чекпоинтов для родительского раздела
    queryKeys.checkpoints.bySection(input.sectionId),
    // Инвалидируем списки для связанных разделов (если есть)
    ...(input.linkedSectionIds || []).map(id => queryKeys.checkpoints.bySection(id)),
  ],
})

/**
 * Хук для обновления чекпоинта
 *
 * Обновляет чекпоинт и инвалидирует кеш списков чекпоинтов.
 *
 * ОПТИМИЗИРОВАНО: Инвалидирует только detail и списки чекпоинтов,
 * не затрагивая sections или resourceGraph.
 *
 * @example
 * ```tsx
 * const updateMutation = useUpdateCheckpoint()
 * updateMutation.mutate({
 *   checkpointId: 'uuid',
 *   title: 'Новое название',
 *   checkpointDate: '2026-01-15',
 *   linkedSectionIds: ['section-1', 'section-2'],
 * })
 * ```
 */
export const useUpdateCheckpoint = createCacheMutation<UpdateCheckpointInput, Checkpoint>({
  mutationFn: updateCheckpoint,
  invalidateKeys: (input) => [
    // Инвалидируем detail кеш чекпоинта
    queryKeys.checkpoints.detail(input.checkpointId),
    // Инвалидируем все списки чекпоинтов (т.к. не знаем какие секции затронуты)
    queryKeys.checkpoints.lists(),
  ],
})

/**
 * Вычисляет статус чекпоинта на основе дат
 *
 * Используется в useCompleteCheckpoint для optimistic update.
 * Логика соответствует VIEW logic из миграции 2025-12-18_section_checkpoints_status_audit.sql
 */
function calculateCheckpointStatus(
  completedAt: string | null,
  checkpointDate: string
): Checkpoint['status'] {
  const now = new Date()
  now.setHours(0, 0, 0, 0) // Сброс времени для корректного сравнения дат

  const deadline = new Date(checkpointDate)
  deadline.setHours(0, 0, 0, 0)

  if (completedAt) {
    const completed = new Date(completedAt)
    completed.setHours(0, 0, 0, 0)

    // Выполнен в срок или с опозданием
    return completed <= deadline ? 'completed' : 'completed_late'
  }

  // Не выполнен: просрочен или ожидается
  return now > deadline ? 'overdue' : 'pending'
}

/**
 * Хук для отметки чекпоинта как выполненного/невыполненного
 *
 * Использует optimistic update для мгновенной реакции UI.
 * Обновляет как списки чекпоинтов, так и detail-кеш для мгновенного отклика в модалках.
 *
 * @example
 * ```tsx
 * const completeMutation = useCompleteCheckpoint()
 * completeMutation.mutate({
 *   checkpointId: 'uuid',
 *   completed: true,
 * })
 * ```
 */
export const useCompleteCheckpoint = createUpdateMutation({
  mutationFn: completeCheckpoint,
  listQueryKey: queryKeys.checkpoints.lists(),
  detailQueryKey: (input: CompleteCheckpointInput) => queryKeys.checkpoints.detail(input.checkpointId),
  getId: (input: CompleteCheckpointInput) => input.checkpointId,
  getItemId: (item: Checkpoint) => item.checkpoint_id,
  merge: (item: Checkpoint, input: CompleteCheckpointInput) => {
    const completedAt = input.completed ? new Date().toISOString() : null
    const status = calculateCheckpointStatus(completedAt, item.checkpoint_date)

    return {
      ...item,
      completed_at: completedAt,
      completed_by: input.completed ? OPTIMISTIC_USER_ID : null,
      status,
    }
  },
  // ОПТИМИЗИРОВАНО: Убраны sections.all и resourceGraph.all
  // Чекпоинты загружаются отдельно, optimistic update уже обновил списки
  invalidateKeys: [],
})

/**
 * Хук для удаления чекпоинта
 *
 * ОПТИМИЗИРОВАНО: Использует optimistic delete + инвалидацию только
 * списков чекпоинтов. Убраны sections.all и resourceGraph.all.
 *
 * @example
 * ```tsx
 * const deleteMutation = useDeleteCheckpoint()
 * deleteMutation.mutate(checkpointId)
 * ```
 */
export const useDeleteCheckpoint = createDeleteMutation({
  mutationFn: deleteCheckpoint,
  listQueryKey: queryKeys.checkpoints.lists(),
  getId: (checkpointId: string) => checkpointId,
  getItemId: (item: Checkpoint) => item.checkpoint_id,
  // ОПТИМИЗИРОВАНО: Убраны sections.all и resourceGraph.all
  // Optimistic delete уже удалил элемент из списков
  invalidateKeys: [],
})

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Хук для загрузки разделов проекта
 *
 * Используется для выбора связанных разделов в CheckpointEditModal.
 * Загружает только разделы того же проекта, что и указанный раздел.
 *
 * @example
 * ```tsx
 * const { data: sections, isLoading } = useProjectSections(checkpoint.section_id)
 * ```
 */
export const useProjectSections = createDetailCacheQuery({
  queryKey: (sectionId: string) => queryKeys.checkpoints.projectSections(sectionId),
  queryFn: getProjectSections,
  staleTime: 'medium', // 5 минут — структура проекта меняется редко
})

// ============================================================================
// Prefetch Utilities
// ============================================================================

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { staleTimePresets } from '@/modules/cache'

/**
 * Хук для prefetch чекпоинтов нескольких разделов
 *
 * Используется при раскрытии объекта для предзагрузки чекпоинтов
 * всех его разделов. Это обеспечивает мгновенное отображение маркеров.
 *
 * @example
 * ```tsx
 * const { prefetchForSections, prefetchProjectSections } = usePrefetchCheckpoints()
 *
 * useEffect(() => {
 *   if (isExpanded) {
 *     prefetchForSections(object.sections.map(s => s.id))
 *   }
 * }, [isExpanded])
 * ```
 */
export function usePrefetchCheckpoints() {
  const queryClient = useQueryClient()

  /**
   * Prefetch чекпоинтов для списка разделов
   */
  const prefetchForSections = useCallback(
    (sectionIds: string[]) => {
      sectionIds.forEach((sectionId) => {
        const key = queryKeys.checkpoints.list({ sectionId })
        // Prefetch только если нет в кеше
        if (!queryClient.getQueryData(key)) {
          queryClient.prefetchQuery({
            queryKey: key,
            queryFn: () => getCheckpoints({ sectionId }),
            staleTime: staleTimePresets.slow, // 5 минут
          })
        }
      })
    },
    [queryClient]
  )

  /**
   * Prefetch разделов проекта для модалки (нужны для выбора связанных разделов)
   */
  const prefetchProjectSections = useCallback(
    (sectionId: string) => {
      const key = queryKeys.checkpoints.projectSections(sectionId)
      if (!queryClient.getQueryData(key)) {
        queryClient.prefetchQuery({
          queryKey: key,
          queryFn: () => getProjectSections(sectionId),
          staleTime: staleTimePresets.slow, // 5 минут
        })
      }
    },
    [queryClient]
  )

  /**
   * Получить чекпоинт из кеша списка (для модалки)
   * Возвращает checkpoint если он есть в любом закешированном списке
   */
  const getCheckpointFromCache = useCallback(
    (checkpointId: string): Checkpoint | undefined => {
      // Получаем все закешированные списки чекпоинтов
      const queries = queryClient.getQueriesData<{ success: boolean; data: Checkpoint[] }>({
        queryKey: queryKeys.checkpoints.lists(),
      })

      for (const [, data] of queries) {
        if (data?.success && data.data) {
          const found = data.data.find((cp) => cp.checkpoint_id === checkpointId)
          if (found) return found
        }
      }
      return undefined
    },
    [queryClient]
  )

  return {
    prefetchForSections,
    prefetchProjectSections,
    getCheckpointFromCache,
  }
}
