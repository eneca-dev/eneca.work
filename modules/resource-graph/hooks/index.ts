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
  getProjectTagsMap,
  getCompanyCalendarEvents,
  getWorkLogsForSection,
  getLoadingsForSection,
  getStageReadinessForSection,
  getStageResponsiblesForSection,
  updateItemProgress,
  updateLoadingDates,
  updateStageDates,
  updateSectionDates,
  createLoading as createLoadingAction,
  updateLoading as updateLoadingAction,
  deleteLoading as deleteLoadingAction,
  deleteDecompositionItem as deleteDecompositionItemAction,
} from '../actions'

import type {
  Project,
  ProjectTag,
  CompanyCalendarEvent,
  WorkLog,
  Loading,
  ReadinessPoint,
  StageResponsible,
} from '../types'

import {
  updateItemProgressInHierarchy,
  updateDecompositionStageDates,
  updateSectionDatesInHierarchy,
} from '../utils'

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
  queryKey: queryKeys.projectTags.list(),
  queryFn: getProjectTags,
  staleTime: staleTimePresets.static, // 10 минут - теги редко меняются
})

/**
 * Хук для получения тегов всех проектов пакетом
 *
 * Возвращает Record<projectId, tags[]> для эффективного доступа
 * к тегам каждого проекта в sidebar timeline.
 *
 * Оптимизация: один запрос вместо N запросов на каждый проект.
 *
 * @example
 * const { data: tagsMap, isLoading } = useProjectTagsMap()
 * const projectTags = tagsMap?.[project.id] || []
 */
export const useProjectTagsMap = createSimpleCacheQuery<Record<string, ProjectTag[]>>({
  queryKey: queryKeys.projectTags.map(),
  queryFn: getProjectTagsMap,
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
  queryKey: queryKeys.companyCalendar.events(),
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
    queryKey: queryKeys.resourceGraph.all,
    updater: (oldData, input) => {
      return updateItemProgressInHierarchy(oldData as Project[] | undefined, input.itemId, input.progress)
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
      return updateDecompositionStageDates(
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
// Loading CRUD Mutation Hooks
// ============================================================================

/**
 * Тип входных данных для создания загрузки
 */
interface CreateLoadingInput {
  sectionId: string
  stageId: string
  responsibleId: string
  startDate: string
  endDate: string
  rate: number
  comment?: string
  // Данные сотрудника для optimistic update
  employee?: {
    firstName: string | null
    lastName: string | null
    name: string | null
    avatarUrl: string | null
  }
}

/**
 * Создаёт временную загрузку для optimistic update
 */
function createOptimisticLoading(input: CreateLoadingInput): Loading {
  return {
    id: `temp-${Date.now()}`, // Временный ID, будет заменён после refetch
    stageId: input.stageId,
    startDate: input.startDate,
    finishDate: input.endDate,
    rate: input.rate,
    comment: input.comment || null,
    status: 'active',
    isShortage: false,
    employee: {
      id: input.responsibleId,
      firstName: input.employee?.firstName || null,
      lastName: input.employee?.lastName || null,
      name: input.employee?.name || null,
      avatarUrl: input.employee?.avatarUrl || null,
    },
  }
}

/**
 * Мутация для создания новой загрузки с optimistic update
 *
 * @example
 * const mutation = useCreateLoading()
 * mutation.mutate({
 *   sectionId: 'xxx',
 *   stageId: 'yyy',
 *   responsibleId: 'zzz',
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-15',
 *   rate: 1,
 *   comment: 'Комментарий',
 *   employee: { firstName: 'John', lastName: 'Doe', name: 'John Doe', avatarUrl: null }
 * })
 */
export const useCreateLoading = createCacheMutation<
  CreateLoadingInput,
  { loadingId: string }
>({
  // Передаём action напрямую - factory сам обрабатывает ActionResult
  mutationFn: createLoadingAction,

  // Optimistic update - добавляем загрузку в кеш сразу
  optimisticUpdate: {
    queryKey: (input) => queryKeys.resourceGraph.loadings(input.sectionId),
    updater: (oldData, input) => {
      const loadings = (oldData as Loading[] | undefined) || []
      const newLoading = createOptimisticLoading(input)
      return [...loadings, newLoading]
    },
  },

  // Инвалидируем кеш после создания чтобы получить реальный ID
  invalidateKeys: (input) => [queryKeys.resourceGraph.loadings(input.sectionId)],
})

/**
 * Тип входных данных для обновления загрузки
 */
interface UpdateLoadingInput {
  loadingId: string
  sectionId: string // Нужен для инвалидации кеша
  updates: {
    responsibleId?: string
    rate?: number
    comment?: string
    stageId?: string
    startDate?: string
    endDate?: string
  }
}

/**
 * Обновляет загрузку в массиве (для optimistic update)
 */
function updateLoadingInCache(
  loadings: Loading[] | undefined,
  loadingId: string,
  updates: UpdateLoadingInput['updates']
): Loading[] {
  if (!loadings) return []

  return loadings.map((loading) => {
    if (loading.id !== loadingId) return loading

    return {
      ...loading,
      ...(updates.rate !== undefined && { rate: updates.rate }),
      ...(updates.comment !== undefined && { comment: updates.comment }),
      ...(updates.startDate && { startDate: updates.startDate }),
      ...(updates.endDate && { finishDate: updates.endDate }),
      ...(updates.stageId && { stageId: updates.stageId }),
      // responsibleId требует refetch - не обновляем optimistic
    }
  })
}

/**
 * Мутация для обновления загрузки с optimistic update
 *
 * @example
 * const mutation = useUpdateLoading()
 * mutation.mutate({
 *   loadingId: 'xxx',
 *   sectionId: 'yyy',
 *   updates: { rate: 0.5, comment: 'Новый комментарий' }
 * })
 */
export const useUpdateLoading = createCacheMutation<
  UpdateLoadingInput,
  { loadingId: string }
>({
  // Wrapper нужен т.к. action принимает 2 аргумента, а не объект
  // Возвращаем ActionResult напрямую - factory сам обработает
  mutationFn: ({ loadingId, updates }) => updateLoadingAction(loadingId, updates),

  optimisticUpdate: {
    queryKey: (input) => queryKeys.resourceGraph.loadings(input.sectionId),
    updater: (oldData, input) => {
      return updateLoadingInCache(
        oldData as Loading[] | undefined,
        input.loadingId,
        input.updates
      )
    },
  },

  // При изменении responsibleId или stageId нужен refetch
  invalidateKeys: (input) => {
    if (input.updates.responsibleId || input.updates.stageId) {
      return [queryKeys.resourceGraph.loadings(input.sectionId)]
    }
    return []
  },
})

/**
 * Тип входных данных для удаления загрузки
 */
interface DeleteLoadingInput {
  loadingId: string
  sectionId: string // Нужен для инвалидации кеша
}

/**
 * Удаляет загрузку из массива (для optimistic update)
 */
function deleteLoadingFromCache(
  loadings: Loading[] | undefined,
  loadingId: string
): Loading[] {
  if (!loadings) return []
  return loadings.filter((loading) => loading.id !== loadingId)
}

/**
 * Мутация для удаления загрузки с optimistic update
 *
 * @example
 * const mutation = useDeleteLoading()
 * mutation.mutate({ loadingId: 'xxx', sectionId: 'yyy' })
 */
export const useDeleteLoading = createCacheMutation<
  DeleteLoadingInput,
  { loadingId: string }
>({
  // Wrapper нужен т.к. action принимает только loadingId
  // Возвращаем ActionResult напрямую - factory сам обработает
  mutationFn: ({ loadingId }) => deleteLoadingAction(loadingId),

  optimisticUpdate: {
    queryKey: (input) => queryKeys.resourceGraph.loadings(input.sectionId),
    updater: (oldData, input) => {
      return deleteLoadingFromCache(oldData as Loading[] | undefined, input.loadingId)
    },
  },
})

// ============================================================================
// Decomposition Item Mutation Hooks
// ============================================================================

/**
 * Тип входных данных для удаления задачи
 */
interface DeleteDecompositionItemInput {
  itemId: string
  sectionId: string // Нужен для инвалидации кеша work_logs
}

/**
 * Мутация для удаления задачи с каскадным удалением отчётов
 *
 * @example
 * const mutation = useDeleteDecompositionItem()
 * mutation.mutate({ itemId: 'xxx', sectionId: 'yyy' })
 */
export const useDeleteDecompositionItem = createCacheMutation<
  DeleteDecompositionItemInput,
  { itemId: string }
>({
  mutationFn: ({ itemId }) => deleteDecompositionItemAction(itemId),

  // Инвалидируем все связанные кеши
  invalidateKeys: (input) => [
    queryKeys.resourceGraph.all, // Основные данные графика
    queryKeys.resourceGraph.workLogs(input.sectionId), // Отчёты раздела
  ],
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
