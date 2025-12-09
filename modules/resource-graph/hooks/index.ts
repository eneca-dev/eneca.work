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
} from '../actions'

import type {
  ResourceGraphFilters,
  Project,
  ProjectTag,
  CompanyCalendarEvent,
} from '../types'

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
 * const { data, isLoading, error } = useResourceGraphData({ projectId: 'xxx' })
 */
export const useResourceGraphData = createCacheQuery<Project[], ResourceGraphFilters>({
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
// Mutation Hooks (TODO)
// ============================================================================

// TODO: Add mutation hooks when actions are implemented
// export const useUpdateLoading = createUpdateMutation({ ... })
// export const useCreateLoading = createCacheMutation({ ... })
// export const useDeleteLoading = createDeleteMutation({ ... })
