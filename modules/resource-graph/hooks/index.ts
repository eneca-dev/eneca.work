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
} from '../actions'

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
// Mutation Hooks (TODO)
// ============================================================================

// TODO: Add mutation hooks when actions are implemented
// export const useUpdateLoading = createUpdateMutation({ ... })
// export const useCreateLoading = createCacheMutation({ ... })
// export const useDeleteLoading = createDeleteMutation({ ... })
