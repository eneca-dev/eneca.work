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
} from '../actions'
import type {
  Department,
} from '../types'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Получить иерархию отделов → проектов → разделов → загрузок
 *
 * Данные обновляются через Realtime подписки (loadings, sections, departments, profiles),
 * поэтому staleTime = Infinity — refetch происходит только при инвалидации кеша.
 */
export const useSectionsHierarchy = createCacheQuery<Department[], FilterQueryParams>({
  queryKey: (filters) => queryKeys.sectionsPage.list(filters),
  queryFn: getSectionsHierarchy,
  staleTime: Infinity, // Обновляется через Realtime
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
    [...queryKeys.sectionsPage.lists()],
    [...queryKeys.sectionsPage.capacity(input.sectionId)],
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
    [...queryKeys.sectionsPage.lists()],
    [...queryKeys.sectionsPage.capacity(sectionId)],
  ],
  onSuccess: () => {
    toast.success('Ёмкость сброшена к значению по умолчанию')
  },
})

// ============================================================================
// Re-export specialized mutations
// ============================================================================

export * from './useSectionLoadingMutations'
