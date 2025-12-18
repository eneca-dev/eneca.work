/**
 * Resource Graph Module - Hooks
 *
 * Query и Mutation хуки для модуля графика ресурсов
 * Используют фабрики из cache module
 */

'use client'

import {
  createCacheQuery,
  createDetailCacheQuery,
  createSimpleCacheQuery,
  createCacheMutation,
  staleTimePresets,
  queryKeys,
} from '@/modules/cache'

import {
  getResourceGraphData,
  getUserWorkload,
  getProjectTags,
  getCompanyCalendarEvents,
  getWorkLogsForSection,
  getLoadingsForSection,
  getStageReadinessForSection,
  getStageResponsiblesForSection,
  updateItemProgress,
  updateLoadingDates,
  updateStageDates,
  updateSectionDates,
} from '../actions'

import type { StageResponsible } from '../actions'

import type {
  Project,
  ProjectTag,
  CompanyCalendarEvent,
  WorkLog,
  Loading,
  ReadinessPoint,
} from '../types'

import type { FilterQueryParams } from '@/modules/inline-filter'

// ============================================================================
// Query Keys (re-export from cache module)
// ============================================================================

/** Ключи запросов для resource-graph (используем централизованные из cache) */
export const resourceGraphKeys = queryKeys.resourceGraph

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения данных графика ресурсов
 *
 * @example
 * const { data, isLoading, error } = useResourceGraphData({ project_id: 'xxx' })
 */
export const useResourceGraphData = createCacheQuery<Project[], FilterQueryParams>({
  queryKey: (filters) => queryKeys.resourceGraph.list(filters),
  queryFn: getResourceGraphData,
  staleTime: staleTimePresets.fast,
})

/**
 * Хук для получения загрузки конкретного пользователя
 *
 * @example
 * const { data, isLoading } = useUserWorkload('user-id-123')
 */
export const useUserWorkload = createDetailCacheQuery<Project[]>({
  queryKey: (userId) => queryKeys.resourceGraph.user(userId),
  queryFn: (userId) => getUserWorkload(userId),
  staleTime: staleTimePresets.fast,
})

// ============================================================================
// Static Data Hooks (редко меняются)
// ============================================================================

/**
 * Хук для получения списка тегов проектов
 *
 * @example
 * const { data: tags, isLoading } = useTagOptions()
 */
export const useTagOptions = createSimpleCacheQuery<ProjectTag[]>({
  queryKey: ['project-tags', 'list'],
  queryFn: getProjectTags,
  staleTime: staleTimePresets.static, // 10 минут - теги редко меняются
})

/**
 * Хук для получения праздников и переносов рабочих дней компании
 *
 * Данные кешируются на 24 часа, т.к. праздники очень редко меняются
 *
 * @example
 * const { data: events, isLoading } = useCompanyCalendarEvents()
 */
export const useCompanyCalendarEvents = createSimpleCacheQuery<CompanyCalendarEvent[]>({
  queryKey: ['company-calendar-events', 'list'],
  queryFn: getCompanyCalendarEvents,
  staleTime: staleTimePresets.eternal, // 24 часа - праздники практически не меняются
})

// ============================================================================
// Work Logs Hooks - Отчёты о работе
// ============================================================================

/**
 * Хук для получения отчётов о работе для раздела
 *
 * Загружается лениво при развороте раздела (enabled: true).
 * Данные кешируются навечно, обновляются только через Realtime.
 *
 * @param sectionId - ID раздела
 * @param options - { enabled: boolean } - включить загрузку
 *
 * @example
 * const { data: workLogs, isLoading } = useWorkLogs(sectionId, { enabled: isExpanded })
 */
export const useWorkLogs = createDetailCacheQuery<WorkLog[]>({
  queryKey: (sectionId) => queryKeys.resourceGraph.workLogs(sectionId),
  queryFn: getWorkLogsForSection,
  staleTime: Infinity, // Данные не устаревают, обновляются через Realtime
})

// ============================================================================
// Loadings Hooks - Загрузки сотрудников
// ============================================================================

/**
 * Хук для получения загрузок для раздела
 *
 * Загружается лениво при развороте раздела (enabled: true).
 * Данные кешируются навечно, обновляются только через Realtime.
 *
 * @param sectionId - ID раздела
 * @param options - { enabled: boolean } - включить загрузку
 *
 * @example
 * const { data: loadings, isLoading } = useLoadings(sectionId, { enabled: isExpanded })
 */
export const useLoadings = createDetailCacheQuery<Loading[]>({
  queryKey: (sectionId) => queryKeys.resourceGraph.loadings(sectionId),
  queryFn: getLoadingsForSection,
  staleTime: Infinity, // Данные не устаревают, обновляются через Realtime
})

// ============================================================================
// Stage Readiness Hooks - Готовность этапов декомпозиции
// ============================================================================

/**
 * Хук для получения готовности этапов раздела
 *
 * Загружается лениво при развороте раздела (enabled: true).
 * Возвращает Record<stageId, ReadinessPoint[]> для отображения столбиков на timeline.
 *
 * @param sectionId - ID раздела
 * @param options - { enabled: boolean } - включить загрузку
 *
 * @example
 * const { data: stageReadiness, isLoading } = useStageReadiness(sectionId, { enabled: isExpanded })
 * // stageReadiness['stage-id-123'] -> [{ date: '2024-01-01', value: 25 }, ...]
 */
export const useStageReadiness = createDetailCacheQuery<Record<string, ReadinessPoint[]>>({
  queryKey: (sectionId) => queryKeys.resourceGraph.stageReadiness(sectionId),
  queryFn: getStageReadinessForSection,
  staleTime: Infinity, // Данные не устаревают, обновляются через Realtime
})

// ============================================================================
// Stage Responsibles Hooks - Ответственные за этапы
// ============================================================================

/**
 * Хук для получения ответственных за этапы раздела
 *
 * Загружается лениво при развороте раздела (enabled: true).
 * Возвращает Record<stageId, StageResponsible[]> для отображения аватаров в sidebar.
 *
 * @param sectionId - ID раздела
 * @param options - { enabled: boolean } - включить загрузку
 *
 * @example
 * const { data: stageResponsibles, isLoading } = useStageResponsibles(sectionId, { enabled: isExpanded })
 * // stageResponsibles['stage-id-123'] -> [{ id: 'user-id', firstName: 'John', lastName: 'Doe', avatarUrl: '...' }, ...]
 */
export const useStageResponsibles = createDetailCacheQuery<Record<string, StageResponsible[]>>({
  queryKey: (sectionId) => queryKeys.resourceGraph.stageResponsibles(sectionId),
  queryFn: getStageResponsiblesForSection,
  staleTime: Infinity, // Данные не устаревают, обновляются через Realtime
})

// ============================================================================
// Budgets Hooks - Re-export from budgets module
// ============================================================================

/**
 * Хук для получения бюджетов раздела
 *
 * @example
 * const { data: budgets, isLoading } = useSectionBudgets(sectionId, { enabled: isExpanded })
 */
export { useBudgetsByEntity as useSectionBudgets } from '@/modules/budgets'

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Тип входных данных для обновления прогресса
 */
interface UpdateItemProgressInput {
  itemId: string
  progress: number
}

/**
 * Рекурсивно обновляет progress у item в иерархии проектов
 * Включает защитные проверки для случаев когда структура данных неполная
 */
function updateProgressInHierarchy(
  projects: Project[] | undefined,
  itemId: string,
  newProgress: number
): Project[] {
  if (!projects || !Array.isArray(projects)) return projects || []

  return projects.map((project) => {
    // Проверяем что project имеет нужную структуру
    if (!project?.stages || !Array.isArray(project.stages)) {
      return project
    }

    return {
      ...project,
      stages: project.stages.map((stage) => {
        if (!stage?.objects || !Array.isArray(stage.objects)) {
          return stage
        }

        return {
          ...stage,
          objects: stage.objects.map((obj) => {
            if (!obj?.sections || !Array.isArray(obj.sections)) {
              return obj
            }

            return {
              ...obj,
              sections: obj.sections.map((section) => {
                if (!section?.decompositionStages || !Array.isArray(section.decompositionStages)) {
                  return section
                }

                return {
                  ...section,
                  decompositionStages: section.decompositionStages.map((dStage) => {
                    if (!dStage?.items || !Array.isArray(dStage.items)) {
                      return dStage
                    }

                    return {
                      ...dStage,
                      items: dStage.items.map((item) =>
                        item.id === itemId ? { ...item, progress: newProgress } : item
                      ),
                    }
                  }),
                }
              }),
            }
          }),
        }
      }),
    }
  })
}

/**
 * Мутация для обновления прогресса задачи с optimistic update
 *
 * @example
 * const mutation = useUpdateItemProgress()
 * mutation.mutate({ itemId: 'xxx', progress: 50 })
 */
export const useUpdateItemProgress = createCacheMutation<
  UpdateItemProgressInput,
  { itemId: string; progress: number }
>({
  mutationFn: ({ itemId, progress }) => updateItemProgress(itemId, progress),

  optimisticUpdate: {
    // Обновляем все списки resource graph (с любыми фильтрами)
    queryKey: queryKeys.resourceGraph.all,
    updater: (oldData, input) => {
      // oldData это Project[] из кеша
      return updateProgressInHierarchy(oldData as Project[] | undefined, input.itemId, input.progress)
    },
  },

  // НЕ инвалидируем данные - optimistic update уже обновил кеш корректно
  // Инвалидация вызывала полную перезагрузку данных, что замедляло UI
  // invalidateKeys: [queryKeys.resourceGraph.all],
})

// ============================================================================
// Timeline Resize Mutation Hooks
// ============================================================================

/**
 * Тип входных данных для обновления дат загрузки
 */
interface UpdateLoadingDatesInput {
  loadingId: string
  sectionId: string // Нужен для инвалидации кеша
  startDate: string
  finishDate: string
}

/**
 * Обновляет даты в массиве загрузок
 */
function updateLoadingDatesInCache(
  loadings: Loading[] | undefined,
  loadingId: string,
  startDate: string,
  finishDate: string
): Loading[] {
  if (!loadings) return []

  return loadings.map((loading) =>
    loading.id === loadingId
      ? { ...loading, startDate, finishDate }
      : loading
  )
}

/**
 * Мутация для обновления дат загрузки с optimistic update
 *
 * @example
 * const mutation = useUpdateLoadingDates()
 * mutation.mutate({
 *   loadingId: 'xxx',
 *   sectionId: 'yyy',
 *   startDate: '2024-01-01',
 *   finishDate: '2024-01-15'
 * })
 */
export const useUpdateLoadingDates = createCacheMutation<
  UpdateLoadingDatesInput,
  { loadingId: string; startDate: string; finishDate: string }
>({
  mutationFn: ({ loadingId, startDate, finishDate }) =>
    updateLoadingDates(loadingId, startDate, finishDate),

  optimisticUpdate: {
    // Динамический ключ на основе sectionId для правильного кеша Loading[]
    queryKey: (input) => queryKeys.resourceGraph.loadings(input.sectionId),
    updater: (oldData, input) => {
      // oldData это Loading[] из кеша useLoadings(sectionId)
      return updateLoadingDatesInCache(
        oldData as Loading[] | undefined,
        input.loadingId,
        input.startDate,
        input.finishDate
      )
    },
  },
})

/**
 * Тип входных данных для обновления дат этапа
 */
interface UpdateStageDatesInput {
  stageId: string
  startDate: string
  finishDate: string
}

/**
 * Рекурсивно обновляет даты этапа в иерархии проектов
 */
function updateStageDatesInHierarchy(
  projects: Project[] | undefined,
  stageId: string,
  startDate: string,
  finishDate: string
): Project[] {
  if (!projects || !Array.isArray(projects)) return projects || []

  return projects.map((project) => {
    if (!project?.stages || !Array.isArray(project.stages)) {
      return project
    }

    return {
      ...project,
      stages: project.stages.map((stage) => {
        if (!stage?.objects || !Array.isArray(stage.objects)) {
          return stage
        }

        return {
          ...stage,
          objects: stage.objects.map((obj) => {
            if (!obj?.sections || !Array.isArray(obj.sections)) {
              return obj
            }

            return {
              ...obj,
              sections: obj.sections.map((section) => {
                if (!section?.decompositionStages || !Array.isArray(section.decompositionStages)) {
                  return section
                }

                return {
                  ...section,
                  decompositionStages: section.decompositionStages.map((dStage) =>
                    dStage.id === stageId
                      ? { ...dStage, startDate, finishDate }
                      : dStage
                  ),
                }
              }),
            }
          }),
        }
      }),
    }
  })
}

/**
 * Мутация для обновления дат этапа декомпозиции с optimistic update
 *
 * @example
 * const mutation = useUpdateStageDates()
 * mutation.mutate({
 *   stageId: 'xxx',
 *   startDate: '2024-01-01',
 *   finishDate: '2024-01-31'
 * })
 */
export const useUpdateStageDates = createCacheMutation<
  UpdateStageDatesInput,
  { stageId: string; startDate: string; finishDate: string }
>({
  mutationFn: ({ stageId, startDate, finishDate }) =>
    updateStageDates(stageId, startDate, finishDate),

  optimisticUpdate: {
    queryKey: queryKeys.resourceGraph.all,
    updater: (oldData, input) => {
      return updateStageDatesInHierarchy(
        oldData as Project[] | undefined,
        input.stageId,
        input.startDate,
        input.finishDate
      )
    },
  },
})

/**
 * Тип входных данных для обновления дат раздела
 */
interface UpdateSectionDatesInput {
  sectionId: string
  startDate: string
  endDate: string
}

/**
 * Рекурсивно обновляет даты раздела в иерархии проектов
 */
function updateSectionDatesInHierarchy(
  projects: Project[] | undefined,
  sectionId: string,
  startDate: string,
  endDate: string
): Project[] {
  if (!projects || !Array.isArray(projects)) return projects || []

  return projects.map((project) => {
    if (!project?.stages || !Array.isArray(project.stages)) {
      return project
    }

    return {
      ...project,
      stages: project.stages.map((stage) => {
        if (!stage?.objects || !Array.isArray(stage.objects)) {
          return stage
        }

        return {
          ...stage,
          objects: stage.objects.map((obj) => {
            if (!obj?.sections || !Array.isArray(obj.sections)) {
              return obj
            }

            return {
              ...obj,
              sections: obj.sections.map((section) =>
                section.id === sectionId
                  ? { ...section, startDate, endDate }
                  : section
              ),
            }
          }),
        }
      }),
    }
  })
}

/**
 * Мутация для обновления дат раздела с optimistic update
 *
 * @example
 * const mutation = useUpdateSectionDates()
 * mutation.mutate({
 *   sectionId: 'xxx',
 *   startDate: '2024-01-01',
 *   endDate: '2024-03-31'
 * })
 */
export const useUpdateSectionDates = createCacheMutation<
  UpdateSectionDatesInput,
  { sectionId: string; startDate: string; endDate: string }
>({
  mutationFn: ({ sectionId, startDate, endDate }) =>
    updateSectionDates(sectionId, startDate, endDate),

  optimisticUpdate: {
    queryKey: queryKeys.resourceGraph.all,
    updater: (oldData, input) => {
      return updateSectionDatesInHierarchy(
        oldData as Project[] | undefined,
        input.sectionId,
        input.startDate,
        input.endDate
      )
    },
  },
})

// ============================================================================
// Timeline Resize Hook
// ============================================================================

export { useTimelineResize } from './useTimelineResize'
export type {
  UseTimelineResizeOptions,
  UseTimelineResizeReturn,
  ResizeEdge,
} from './useTimelineResize'
