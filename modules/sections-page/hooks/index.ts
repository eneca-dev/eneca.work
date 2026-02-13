/**
 * Sections Page Module - Hooks
 *
 * React Query хуки для работы с иерархией разделов
 */

import {
  createCacheQuery,
  createCacheMutation,
  queryKeys,
} from '@/modules/cache'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { toast } from 'sonner'
import {
  getSectionsHierarchy,
  upsertSectionCapacity,
  deleteSectionCapacityOverride,
  createSectionLoading,
  updateSectionLoading,
  deleteSectionLoading,
} from '../actions'
import type {
  Department,
  CapacityInput,
  CreateLoadingInput,
  UpdateLoadingInput,
} from '../types'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Получить иерархию отделов → проектов → разделов → загрузок
 *
 * TODO: Добавить Realtime подписку для автоматического обновления
 * при изменении loadings/section_capacity
 */
export const useSectionsHierarchy = createCacheQuery<Department[], FilterQueryParams>({
  queryKey: (filters) => queryKeys.sectionsPage.list(filters),
  queryFn: getSectionsHierarchy,
  staleTime: 5 * 60 * 1000, // 5 минут - пока нет Realtime
  // enabled опция передаётся через второй параметр хука
})

// ============================================================================
// Capacity Mutations
// ============================================================================

/**
 * Установить/обновить capacity раздела
 */
export const useUpsertSectionCapacity = createCacheMutation({
  mutationFn: upsertSectionCapacity,
  invalidateKeys: (input) => [
    queryKeys.sectionsPage.lists(),
    queryKeys.sectionsPage.capacity(input.sectionId),
  ],
  onSuccess: () => {
    toast.success('Ёмкость обновлена')
  },
})

/**
 * Удалить capacity override (вернуть к default)
 */
export const useDeleteSectionCapacityOverride = createCacheMutation({
  mutationFn: ({ sectionId, date }: { sectionId: string; date: string }) =>
    deleteSectionCapacityOverride(sectionId, date),
  invalidateKeys: ({ sectionId }) => [
    queryKeys.sectionsPage.lists(),
    queryKeys.sectionsPage.capacity(sectionId),
  ],
  onSuccess: () => {
    toast.success('Ёмкость сброшена к значению по умолчанию')
  },
})

// ============================================================================
// Loading Mutations
// ============================================================================

/**
 * Создать загрузку
 */
export const useCreateSectionLoading = createCacheMutation({
  mutationFn: createSectionLoading,
  invalidateKeys: (input) => [
    queryKeys.sectionsPage.lists(),
    // Также инвалидируем resource-graph если есть
    queryKeys.resourceGraph.lists(),
  ],
  onSuccess: () => {
    toast.success('Загрузка создана')
  },
})

/**
 * Обновить загрузку
 */
export const useUpdateSectionLoading = createCacheMutation({
  mutationFn: updateSectionLoading,
  invalidateKeys: () => [
    queryKeys.sectionsPage.lists(),
    queryKeys.resourceGraph.lists(),
  ],
  onSuccess: () => {
    toast.success('Загрузка обновлена')
  },
})

/**
 * Удалить загрузку (архивировать)
 */
export const useDeleteSectionLoading = createCacheMutation({
  mutationFn: (loadingId: string) => deleteSectionLoading(loadingId),
  invalidateKeys: () => [
    queryKeys.sectionsPage.lists(),
    queryKeys.resourceGraph.lists(),
  ],
  onSuccess: () => {
    toast.success('Загрузка удалена')
  },
})

// ============================================================================
// Re-export specialized mutations
// ============================================================================

export * from './useSectionLoadingMutations'
