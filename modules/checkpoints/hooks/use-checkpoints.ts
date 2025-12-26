'use client'

/**
 * Хуки для работы с чекпоинтами
 *
 * Инкапсулируют логику кеширования, загрузки данных и автоматической
 * инвалидации кеша для модуля checkpoints.
 *
 * Optimistic updates обновляют кеш sectionsBatch напрямую для мгновенного
 * отображения изменений на resource-graph.
 *
 * @module modules/checkpoints/hooks/use-checkpoints
 */

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createCacheQuery,
  createDetailCacheQuery,
  queryKeys,
  staleTimePresets,
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
} from '@/modules/checkpoints/actions/checkpoints'
import { calculateCheckpointStatus } from '@/modules/checkpoints/utils/status-utils'

import type { CheckpointFilters } from '@/modules/cache/keys/query-keys'
import type { SectionsBatchData, BatchCheckpoint } from '@/modules/resource-graph/types'

// ============================================================================
// Query Hooks (чтение данных)
// ============================================================================

/**
 * Хук для загрузки списка чекпоинтов с фильтрацией
 */
export const useCheckpoints = createCacheQuery({
  queryKey: (filters?: CheckpointFilters) => queryKeys.checkpoints.list(filters),
  queryFn: getCheckpoints,
  staleTime: 'slow',
})

/**
 * Хук для загрузки детальной информации о чекпоинте
 */
export const useCheckpoint = createDetailCacheQuery({
  queryKey: (id: string) => queryKeys.checkpoints.detail(id),
  queryFn: getCheckpoint,
  staleTime: 'slow',
})

/**
 * Хук для загрузки истории изменений чекпоинта
 */
export const useCheckpointAudit = createDetailCacheQuery({
  queryKey: (id: string) => queryKeys.checkpoints.audit(id),
  queryFn: getCheckpointAudit,
  staleTime: 'medium',
})

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Обновляет кеш sectionsBatch для всех закешированных объектов
 */
function updateSectionsBatchCache(
  queryClient: ReturnType<typeof useQueryClient>,
  sectionId: string,
  updater: (checkpoints: BatchCheckpoint[]) => BatchCheckpoint[]
) {
  // Находим все sectionsBatch кеши
  const queries = queryClient.getQueriesData<SectionsBatchData>({
    queryKey: queryKeys.resourceGraph.allSectionsBatch(),
  })

  for (const [queryKey, data] of queries) {
    if (!data) continue

    // Проверяем есть ли данные для этой секции
    if (data.checkpoints[sectionId] !== undefined) {
      queryClient.setQueryData<SectionsBatchData>(queryKey, {
        ...data,
        checkpoints: {
          ...data.checkpoints,
          [sectionId]: updater(data.checkpoints[sectionId] || []),
        },
      })
    }
  }
}

// ============================================================================
// Mutation Hooks (изменение данных)
// ============================================================================

/**
 * Хук для создания нового чекпоинта
 *
 * Использует optimistic update для мгновенного отображения на графике.
 */
export function useCreateCheckpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCheckpoint,

    onMutate: async (input) => {
      // Отменяем исходящие refetch запросы
      await queryClient.cancelQueries({ queryKey: queryKeys.resourceGraph.allSectionsBatch() })

      // Создаем optimistic checkpoint
      const optimisticCheckpoint: BatchCheckpoint = {
        id: `optimistic-${Date.now()}`,
        sectionId: input.sectionId,
        typeId: input.typeId,
        typeCode: input._optimisticTypeCode || 'custom',
        typeName: input._optimisticTypeName || input.title,
        isCustom: input._optimisticIsCustom ?? false,
        icon: input.customIcon || 'Flag',
        color: input.customColor || '#6b7280',
        title: input.title,
        description: input.description || null,
        checkpointDate: input.checkpointDate,
        completedAt: null,
        status: 'pending',
        statusLabel: 'Ожидается',
        linkedSections: input._optimisticLinkedSections || [],
        linkedSectionsCount: input._optimisticLinkedSections?.length || 0,
      }

      // Обновляем кеш sectionsBatch
      updateSectionsBatchCache(queryClient, input.sectionId, (checkpoints) => [
        ...checkpoints,
        optimisticCheckpoint,
      ])

      // Также добавляем в linked секции
      if (input.linkedSectionIds) {
        for (const linkedSectionId of input.linkedSectionIds) {
          updateSectionsBatchCache(queryClient, linkedSectionId, (checkpoints) => [
            ...checkpoints,
            { ...optimisticCheckpoint, sectionId: linkedSectionId },
          ])
        }
      }

      return { optimisticCheckpoint }
    },

    onError: (_error, input, context) => {
      // Откатываем optimistic update при ошибке
      if (context?.optimisticCheckpoint) {
        updateSectionsBatchCache(queryClient, input.sectionId, (checkpoints) =>
          checkpoints.filter((cp) => cp.id !== context.optimisticCheckpoint.id)
        )

        if (input.linkedSectionIds) {
          for (const linkedSectionId of input.linkedSectionIds) {
            updateSectionsBatchCache(queryClient, linkedSectionId, (checkpoints) =>
              checkpoints.filter((cp) => cp.id !== context.optimisticCheckpoint.id)
            )
          }
        }
      }
    },

    onSettled: () => {
      // Инвалидируем кеш для синхронизации с сервером
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.allSectionsBatch() })
    },
  })
}

/**
 * Хук для обновления чекпоинта
 *
 * Использует optimistic update для мгновенного отображения изменений.
 */
export function useUpdateCheckpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateCheckpoint,

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.resourceGraph.allSectionsBatch() })

      // Находим текущий чекпоинт в кеше
      let previousCheckpoint: BatchCheckpoint | undefined

      const queries = queryClient.getQueriesData<SectionsBatchData>({
        queryKey: queryKeys.resourceGraph.allSectionsBatch(),
      })

      for (const [, data] of queries) {
        if (!data) continue
        for (const checkpoints of Object.values(data.checkpoints)) {
          const found = checkpoints.find((cp) => cp.id === input.checkpointId)
          if (found) {
            previousCheckpoint = found
            break
          }
        }
        if (previousCheckpoint) break
      }

      if (!previousCheckpoint) return { previousCheckpoint: undefined }

      // Вычисляем новый статус
      const newStatus = input.checkpointDate
        ? calculateCheckpointStatus(previousCheckpoint.completedAt, input.checkpointDate)
        : previousCheckpoint.status

      // Обновляем чекпоинт во всех секциях (owner + linked)
      const updatedCheckpoint: BatchCheckpoint = {
        ...previousCheckpoint,
        title: input.title ?? previousCheckpoint.title,
        description: input.description !== undefined ? input.description : previousCheckpoint.description,
        checkpointDate: input.checkpointDate ?? previousCheckpoint.checkpointDate,
        icon: input._optimisticIcon ?? input.customIcon ?? previousCheckpoint.icon,
        color: input._optimisticColor ?? input.customColor ?? previousCheckpoint.color,
        typeId: input.typeId ?? previousCheckpoint.typeId,
        typeName: input._optimisticTypeName ?? previousCheckpoint.typeName,
        typeCode: input._optimisticTypeCode ?? previousCheckpoint.typeCode,
        isCustom: input._optimisticIsCustom ?? previousCheckpoint.isCustom,
        linkedSections: input._optimisticLinkedSections ?? previousCheckpoint.linkedSections,
        linkedSectionsCount: input._optimisticLinkedSections?.length ?? previousCheckpoint.linkedSectionsCount,
        status: newStatus,
      }

      // Обновляем во всех sectionsBatch кешах
      for (const [queryKey, data] of queries) {
        if (!data) continue

        let updated = false
        const newCheckpoints = { ...data.checkpoints }

        for (const [sectionId, checkpoints] of Object.entries(newCheckpoints)) {
          const idx = checkpoints.findIndex((cp) => cp.id === input.checkpointId)
          if (idx !== -1) {
            newCheckpoints[sectionId] = [
              ...checkpoints.slice(0, idx),
              updatedCheckpoint,
              ...checkpoints.slice(idx + 1),
            ]
            updated = true
          }
        }

        if (updated) {
          queryClient.setQueryData<SectionsBatchData>(queryKey, {
            ...data,
            checkpoints: newCheckpoints,
          })
        }
      }

      return { previousCheckpoint }
    },

    onError: (_error, input, context) => {
      // Откатываем при ошибке
      if (context?.previousCheckpoint) {
        const queries = queryClient.getQueriesData<SectionsBatchData>({
          queryKey: queryKeys.resourceGraph.allSectionsBatch(),
        })

        for (const [queryKey, data] of queries) {
          if (!data) continue

          const newCheckpoints = { ...data.checkpoints }
          for (const [sectionId, checkpoints] of Object.entries(newCheckpoints)) {
            const idx = checkpoints.findIndex((cp) => cp.id === input.checkpointId)
            if (idx !== -1) {
              newCheckpoints[sectionId] = [
                ...checkpoints.slice(0, idx),
                context.previousCheckpoint,
                ...checkpoints.slice(idx + 1),
              ]
            }
          }

          queryClient.setQueryData<SectionsBatchData>(queryKey, {
            ...data,
            checkpoints: newCheckpoints,
          })
        }
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.allSectionsBatch() })
    },
  })
}

/**
 * Хук для отметки чекпоинта как выполненного/невыполненного
 */
export function useCompleteCheckpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: completeCheckpoint,

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.resourceGraph.allSectionsBatch() })

      const queries = queryClient.getQueriesData<SectionsBatchData>({
        queryKey: queryKeys.resourceGraph.allSectionsBatch(),
      })

      let previousCheckpoint: BatchCheckpoint | undefined

      for (const [queryKey, data] of queries) {
        if (!data) continue

        const newCheckpoints = { ...data.checkpoints }
        let updated = false

        for (const [sectionId, checkpoints] of Object.entries(newCheckpoints)) {
          const idx = checkpoints.findIndex((cp) => cp.id === input.checkpointId)
          if (idx !== -1) {
            previousCheckpoint = checkpoints[idx]
            const completedAt = input.completed ? new Date().toISOString() : null
            const status = calculateCheckpointStatus(completedAt, checkpoints[idx].checkpointDate)

            newCheckpoints[sectionId] = [
              ...checkpoints.slice(0, idx),
              {
                ...checkpoints[idx],
                completedAt,
                status,
                statusLabel: status === 'completed' ? 'Выполнено' : status === 'completed_late' ? 'Выполнено с опозданием' : 'Ожидается',
              },
              ...checkpoints.slice(idx + 1),
            ]
            updated = true
          }
        }

        if (updated) {
          queryClient.setQueryData<SectionsBatchData>(queryKey, {
            ...data,
            checkpoints: newCheckpoints,
          })
        }
      }

      return { previousCheckpoint }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.allSectionsBatch() })
    },
  })
}

/**
 * Хук для удаления чекпоинта
 */
export function useDeleteCheckpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCheckpoint,

    onMutate: async (checkpointId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.resourceGraph.allSectionsBatch() })

      const queries = queryClient.getQueriesData<SectionsBatchData>({
        queryKey: queryKeys.resourceGraph.allSectionsBatch(),
      })

      let previousCheckpoint: BatchCheckpoint | undefined
      let foundInSectionId: string | undefined

      for (const [queryKey, data] of queries) {
        if (!data) continue

        const newCheckpoints = { ...data.checkpoints }
        let updated = false

        for (const [sectionId, checkpoints] of Object.entries(newCheckpoints)) {
          const idx = checkpoints.findIndex((cp) => cp.id === checkpointId)
          if (idx !== -1) {
            previousCheckpoint = checkpoints[idx]
            foundInSectionId = sectionId
            newCheckpoints[sectionId] = checkpoints.filter((cp) => cp.id !== checkpointId)
            updated = true
          }
        }

        if (updated) {
          queryClient.setQueryData<SectionsBatchData>(queryKey, {
            ...data,
            checkpoints: newCheckpoints,
          })
        }
      }

      return { previousCheckpoint, sectionId: foundInSectionId }
    },

    onError: (_error, checkpointId, context) => {
      // Откатываем при ошибке
      if (context?.previousCheckpoint && context.sectionId) {
        updateSectionsBatchCache(queryClient, context.sectionId, (checkpoints) => [
          ...checkpoints,
          context.previousCheckpoint!,
        ])
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.allSectionsBatch() })
    },
  })
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Хук для загрузки разделов проекта
 */
export const useProjectSections = createDetailCacheQuery({
  queryKey: (sectionId: string) => queryKeys.checkpoints.projectSections(sectionId),
  queryFn: getProjectSections,
  staleTime: 'medium',
})

// ============================================================================
// Prefetch Utilities
// ============================================================================

/**
 * Хук для prefetch чекпоинтов нескольких разделов
 */
export function usePrefetchCheckpoints() {
  const queryClient = useQueryClient()

  const prefetchForSections = useCallback(
    (sectionIds: string[]) => {
      sectionIds.forEach((sectionId) => {
        const key = queryKeys.checkpoints.list({ sectionId })
        if (!queryClient.getQueryData(key)) {
          queryClient.prefetchQuery({
            queryKey: key,
            queryFn: () => getCheckpoints({ sectionId }),
            staleTime: staleTimePresets.slow,
          })
        }
      })
    },
    [queryClient]
  )

  const prefetchProjectSections = useCallback(
    (sectionId: string) => {
      const key = queryKeys.checkpoints.projectSections(sectionId)
      if (!queryClient.getQueryData(key)) {
        queryClient.prefetchQuery({
          queryKey: key,
          queryFn: () => getProjectSections(sectionId),
          staleTime: staleTimePresets.slow,
        })
      }
    },
    [queryClient]
  )

  const getCheckpointFromCache = useCallback(
    (checkpointId: string): Checkpoint | undefined => {
      // Ищем в checkpoints.lists()
      const checkpointQueries = queryClient.getQueriesData<{ success: boolean; data: Checkpoint[] }>({
        queryKey: queryKeys.checkpoints.lists(),
      })

      for (const [, data] of checkpointQueries) {
        if (data?.success && data.data) {
          const found = data.data.find((cp) => cp.checkpoint_id === checkpointId)
          if (found) return found
        }
      }

      // Ищем в sectionsBatch и конвертируем
      const batchQueries = queryClient.getQueriesData<SectionsBatchData>({
        queryKey: queryKeys.resourceGraph.allSectionsBatch(),
      })

      for (const [, data] of batchQueries) {
        if (!data) continue
        for (const checkpoints of Object.values(data.checkpoints)) {
          const found = checkpoints.find((cp) => cp.id === checkpointId)
          if (found) {
            // Конвертируем BatchCheckpoint в Checkpoint
            // linkedSections уже использует snake_case (BatchLinkedSection)
            return {
              checkpoint_id: found.id,
              section_id: found.sectionId,
              type_id: found.typeId,
              type_code: found.typeCode,
              type_name: found.typeName,
              is_custom: found.isCustom,
              title: found.title || '',
              description: found.description,
              checkpoint_date: found.checkpointDate,
              icon: found.icon,
              color: found.color,
              completed_at: found.completedAt,
              completed_by: null,
              status: found.status,
              status_label: found.statusLabel,
              created_by: null,
              created_at: '',
              updated_at: '',
              section_responsible: null,
              project_manager: null,
              linked_sections: found.linkedSections,
              linked_sections_count: found.linkedSectionsCount,
            }
          }
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
