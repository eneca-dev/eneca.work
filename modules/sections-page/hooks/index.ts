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
// Cache Helpers
// ============================================================================

/**
 * Удаляет загрузку из иерархической структуры Department[] (optimistic removal).
 * Также очищает пустые секции и проекты после удаления.
 */
function removeLoadingFromCache(
  departments: Department[] | undefined,
  loadingId: string
): Department[] | undefined {
  if (!departments || !Array.isArray(departments)) return departments

  return departments.map((dept) => ({
    ...dept,
    projects: dept.projects.map((project) => ({
      ...project,
      objectSections: project.objectSections.map((section) => ({
        ...section,
        loadings: section.loadings.filter((l) => l.id !== loadingId),
        totalLoadings: section.loadings.filter((l) => l.id !== loadingId).length,
      })),
    })),
  }))
}

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
    queryKeys.resourceGraph.lists(),
    queryKeys.departmentsTimeline.all, // Синхронизация с вкладкой отделов
  ],
  onSuccess: () => {
    toast.success('Загрузка создана')
  },
})

/**
 * Обновить загрузку
 *
 * Optimistic: мгновенно убирает загрузку из старого раздела.
 * После refetch загрузка появится в новом месте.
 */
export const useUpdateSectionLoading = createCacheMutation<UpdateLoadingInput, void>({
  mutationFn: updateSectionLoading,
  optimisticUpdate: {
    queryKey: queryKeys.sectionsPage.all,
    updater: (oldData, input) => {
      if (!Array.isArray(oldData)) return [] as unknown as Department[]
      const result = removeLoadingFromCache(oldData as Department[], input.loadingId)
      return (result ?? []) as unknown as Department[]
    },
  },
  invalidateKeys: [
    queryKeys.sectionsPage.all,
    queryKeys.resourceGraph.all,
    queryKeys.departmentsTimeline.all,
  ],
  onSuccess: () => {
    toast.success('Загрузка обновлена')
  },
})

/**
 * Удалить загрузку (архивировать)
 *
 * Optimistic: мгновенно убирает загрузку из UI.
 */
export const useDeleteSectionLoading = createCacheMutation<string, void>({
  mutationFn: (loadingId: string) => deleteSectionLoading(loadingId),
  optimisticUpdate: {
    queryKey: queryKeys.sectionsPage.all,
    updater: (oldData, loadingId) => {
      if (!Array.isArray(oldData)) return [] as unknown as Department[]
      const result = removeLoadingFromCache(oldData as Department[], loadingId)
      return (result ?? []) as unknown as Department[]
    },
  },
  invalidateKeys: [
    queryKeys.sectionsPage.all,
    queryKeys.resourceGraph.all,
    queryKeys.departmentsTimeline.all,
  ],
  onSuccess: () => {
    toast.success('Загрузка удалена')
  },
})

// ============================================================================
// Re-export specialized mutations
// ============================================================================

export * from './useSectionLoadingMutations'
