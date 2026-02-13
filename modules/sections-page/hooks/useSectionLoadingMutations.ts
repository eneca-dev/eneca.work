/**
 * Section Loading Mutations
 *
 * Hooks для изменения загрузок (даты, ставка, комментарий)
 */

import { createCacheMutation, queryKeys } from '@/modules/cache'
import { updateSectionLoading } from '../actions'
import type { Department } from '../types'

interface UpdateLoadingDatesInput {
  loadingId: string
  employeeId: string
  startDate: string // YYYY-MM-DD
  finishDate: string // YYYY-MM-DD
}

/**
 * Обновляет даты загрузки в иерархической структуре Department[]
 *
 * Рекурсивно проходит по Department → Project → ObjectSection → Loading
 * и обновляет loading с указанным loadingId
 */
function updateLoadingDatesInCache(
  departments: Department[] | undefined,
  loadingId: string,
  startDate: string,
  finishDate: string
): Department[] | undefined {
  // Если данных нет или это не массив - возвращаем как есть
  if (!departments || !Array.isArray(departments)) {
    return departments
  }

  return departments.map((department) => ({
    ...department,
    projects: department.projects.map((project) => ({
      ...project,
      objectSections: project.objectSections.map((section) => ({
        ...section,
        loadings: section.loadings.map((loading) =>
          loading.id === loadingId
            ? { ...loading, startDate, endDate: finishDate }
            : loading
        ),
      })),
    })),
  }))
}

/**
 * Мутация для обновления дат загрузки с optimistic update
 *
 * Используется для drag-to-resize функциональности в timeline
 *
 * @example
 * const mutation = useUpdateLoadingDates()
 * mutation.mutate({
 *   loadingId: 'xxx',
 *   employeeId: 'yyy',
 *   startDate: '2024-01-01',
 *   finishDate: '2024-01-15'
 * })
 */
export const useUpdateLoadingDates = createCacheMutation<
  UpdateLoadingDatesInput,
  { loadingId: string; startDate: string; endDate: string }
>({
  mutationFn: ({ loadingId, startDate, finishDate }) =>
    updateSectionLoading({ loadingId, startDate, endDate: finishDate }),

  optimisticUpdate: {
    queryKey: queryKeys.sectionsPage.all,
    updater: (oldData, input) => {
      // oldData может быть Department[] из кеша useSectionsHierarchy,
      // или другим типом данных. Обрабатываем только массивы отделов
      if (!Array.isArray(oldData)) {
        return [] as unknown as Department[]
      }

      const result = updateLoadingDatesInCache(
        oldData as Department[],
        input.loadingId,
        input.startDate,
        input.finishDate
      )
      return (result ?? []) as unknown as Department[]
    },
  },

  // Инвалидируем все sections page запросы после успешного обновления
  invalidateKeys: [queryKeys.sectionsPage.all, queryKeys.resourceGraph.all],
})
