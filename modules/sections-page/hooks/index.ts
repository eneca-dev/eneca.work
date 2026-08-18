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
  upsertSectionCapacityBatch,
  deleteSectionCapacityOverride,
} from '../actions'
import type {
  Department,
  CapacityInput,
  SectionCapacity,
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
 * Обновляет capacityOverrides разделов в иерархической структуре Department[]
 *
 * Рекурсивно проходит по Department → Project → ObjectSection и мёржит новые
 * значения ёмкости в capacityOverrides разделов, чей sectionId встретился
 * среди входных данных батча — по образцу updateLoadingDatesInCache
 * (useSectionLoadingMutations.ts).
 */
function updateCapacityInCache(
  departments: Department[] | undefined,
  inputs: CapacityInput[]
): Department[] | undefined {
  if (!departments || !Array.isArray(departments)) {
    return departments
  }

  const bySection = new Map<string, CapacityInput[]>()
  for (const input of inputs) {
    if (!input.capacityDate) continue // NULL-дата — дефолтная ёмкость, вне охвата этой мутации
    const list = bySection.get(input.sectionId)
    if (list) list.push(input)
    else bySection.set(input.sectionId, [input])
  }
  if (bySection.size === 0) return departments

  return departments.map((department) => ({
    ...department,
    projects: department.projects.map((project) => ({
      ...project,
      objectSections: project.objectSections.map((section) => {
        const updates = bySection.get(section.sectionId)
        if (!updates) return section
        const capacityOverrides = { ...(section.capacityOverrides ?? {}) }
        for (const u of updates) {
          capacityOverrides[u.capacityDate as string] = u.capacityValue
        }
        return { ...section, capacityOverrides }
      }),
    })),
  }))
}

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
 * Установить/обновить ёмкость сразу для нескольких разделов/дат одним запросом
 * (например, ввод ёмкости на строке проекта — раздаётся на все разделы проекта)
 *
 * Optimistic update: значение появляется в UI сразу, не дожидаясь ни записи на
 * сервер, ни последующего рефетча всей иерархии (getSectionsHierarchy — тяжёлый
 * запрос). invalidateKeys ниже — фоновая сверка с сервером, не блокирует UI.
 */
/**
 * `createCacheMutation<CapacityInput[], SectionCapacity[]>` типизирует updater как
 * `(SectionCapacity[] | undefined) => SectionCapacity[]`, но кеш по ключу
 * queryKeys.sectionsPage.all реально хранит Department[] (иерархию, не список
 * ёмкостей) — фабрика не разделяет тип данных мутации и тип кеша, который
 * обновляет optimisticUpdate. Тот же обход — в updateLoadingDatesInCache
 * (useSectionLoadingMutations.ts). Эти два хелпера называют обе стороны каста
 * явно вместо голых `as unknown as` инлайн.
 */
function asDepartmentsCache(data: unknown): Department[] | undefined {
  return Array.isArray(data) ? (data as unknown as Department[]) : undefined
}
function asCapacityMutationShape(departments: Department[] | undefined): SectionCapacity[] {
  return (departments ?? []) as unknown as SectionCapacity[]
}

export const useUpsertSectionCapacityBatch = createCacheMutation<
  CapacityInput[],
  SectionCapacity[]
>({
  mutationFn: upsertSectionCapacityBatch,
  optimisticUpdate: {
    queryKey: queryKeys.sectionsPage.all,
    updater: (oldData, input) => {
      const departments = asDepartmentsCache(oldData)
      if (!departments) return asCapacityMutationShape(undefined)
      return asCapacityMutationShape(updateCapacityInCache(departments, input))
    },
  },
  invalidateKeys: () => [
    [...queryKeys.sectionsPage.lists()],
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
