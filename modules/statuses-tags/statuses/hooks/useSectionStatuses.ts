'use client'

/**
 * Хуки для работы со статусами секций
 *
 * Использует cache module для:
 * - Кеширование данных через TanStack Query
 * - Автоматическая инвалидация при мутациях
 * - Realtime синхронизация через Supabase
 */

import {
  createSimpleCacheQuery,
  createCacheMutation,
  staleTimePresets,
  queryKeys,
} from '@/modules/cache'
import {
  getSectionStatuses,
  createSectionStatus,
  updateSectionStatus,
  deleteSectionStatus,
  type SectionStatus,
  type CreateStatusInput,
  type UpdateStatusInput,
} from '../actions'

// ============================================================================
// Query Hook
// ============================================================================

/**
 * Хук для получения списка статусов секций
 *
 * @example
 * const { data: statuses, isLoading } = useSectionStatuses()
 */
export const useSectionStatusesQuery = createSimpleCacheQuery<SectionStatus[]>({
  queryKey: queryKeys.sectionStatuses.list(),
  queryFn: getSectionStatuses,
  staleTime: staleTimePresets.medium, // 5 минут - справочник меняется редко
})

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для создания нового статуса
 *
 * @example
 * const { mutate: create, isPending } = useCreateSectionStatus()
 * create({ name: 'В работе', color: '#10B981' })
 */
export const useCreateSectionStatus = createCacheMutation<CreateStatusInput, SectionStatus>({
  mutationFn: createSectionStatus,
  invalidateKeys: () => [queryKeys.sectionStatuses.all],
})

/**
 * Хук для обновления статуса
 *
 * @example
 * const { mutate: update, isPending } = useUpdateSectionStatus()
 * update({ id: '123', name: 'Завершён', color: '#6B7280' })
 */
export const useUpdateSectionStatus = createCacheMutation<UpdateStatusInput, SectionStatus>({
  mutationFn: updateSectionStatus,
  invalidateKeys: () => [
    queryKeys.sectionStatuses.all,
    queryKeys.sections.all, // секции могут показывать статус
    queryKeys.resourceGraph.all, // resource graph показывает статусы
  ],
})

/**
 * Хук для удаления статуса
 *
 * @example
 * const { mutate: remove, isPending } = useDeleteSectionStatus()
 * remove('status-id-123')
 */
export const useDeleteSectionStatus = createCacheMutation<string, { deleted: boolean }>({
  mutationFn: deleteSectionStatus,
  invalidateKeys: () => [
    queryKeys.sectionStatuses.all,
    queryKeys.sections.all, // секции с удалённым статусом обновятся
    queryKeys.resourceGraph.all,
  ],
})

// ============================================================================
// Legacy-compatible wrapper (для обратной совместимости)
// ============================================================================

/**
 * Legacy-совместимый хук для плавной миграции
 *
 * @deprecated Используйте useSectionStatusesQuery, useCreateSectionStatus,
 * useUpdateSectionStatus, useDeleteSectionStatus напрямую
 *
 * @example
 * // Старый способ (deprecated):
 * const { statuses, isLoading, createStatus, updateStatus, deleteStatus } = useSectionStatuses()
 *
 * // Новый способ:
 * const { data: statuses, isLoading } = useSectionStatusesQuery()
 * const createMutation = useCreateSectionStatus()
 * const updateMutation = useUpdateSectionStatus()
 * const deleteMutation = useDeleteSectionStatus()
 */
export function useSectionStatuses() {
  const { data: statuses = [], isLoading, error } = useSectionStatusesQuery()
  const createMutation = useCreateSectionStatus()
  const updateMutation = useUpdateSectionStatus()
  const deleteMutation = useDeleteSectionStatus()

  return {
    statuses,
    isLoading: isLoading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    error: error?.message || null,

    // Legacy methods - возвращают Promise для совместимости
    createStatus: async (data: CreateStatusInput): Promise<SectionStatus | null> => {
      try {
        return await createMutation.mutateAsync(data)
      } catch {
        return null
      }
    },

    updateStatus: async (id: string, data: Omit<UpdateStatusInput, 'id'>): Promise<SectionStatus | null> => {
      try {
        return await updateMutation.mutateAsync({ id, ...data })
      } catch {
        return null
      }
    },

    deleteStatus: async (id: string): Promise<boolean> => {
      try {
        await deleteMutation.mutateAsync(id)
        return true
      } catch {
        return false
      }
    },

    // Deprecated - для совместимости, теперь не нужен (данные автоматически обновляются)
    loadStatuses: () => {
      console.warn('[useSectionStatuses] loadStatuses() deprecated - данные обновляются автоматически')
    },
  }
}
