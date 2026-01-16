/**
 * Departments Timeline Module - Hooks
 *
 * Query и Mutation хуки для модуля таймлайна отделов
 * Используют фабрики из cache module
 */

'use client'

import {
  createCacheQuery,
  createSimpleCacheQuery,
  createCacheMutation,
  queryKeys,
} from '@/modules/cache'

import {
  getDepartmentsData,
  getTeamsFreshness,
  confirmTeamActivity,
  confirmMultipleTeamsActivity,
} from '../actions'

import type { Department, TeamFreshness } from '../types'
import type { FilterQueryParams } from '@/modules/inline-filter'

// Re-export calendar events hook from resource-graph
export { useCompanyCalendarEvents } from '@/modules/resource-graph/hooks'

// ============================================================================
// Query Keys (re-export from cache module)
// ============================================================================

/** Ключи запросов для departments-timeline */
export const departmentsTimelineKeys = queryKeys.departmentsTimeline

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения данных отделов с командами и сотрудниками
 *
 * Данные обновляются через Realtime подписки, поэтому staleTime = Infinity.
 *
 * @example
 * const { data, isLoading, error } = useDepartmentsData({ department_id: 'xxx' })
 */
export const useDepartmentsData = createCacheQuery<Department[], FilterQueryParams>({
  queryKey: (filters) => queryKeys.departmentsTimeline.list(filters),
  queryFn: getDepartmentsData,
  staleTime: Infinity, // Обновляется через Realtime
})

/**
 * Хук для получения данных актуальности команд
 *
 * Данные о том, когда команды последний раз подтвердили актуальность данных.
 *
 * @example
 * const { data: freshness, isLoading } = useTeamsFreshness()
 * const teamFreshness = freshness?.[teamId]
 */
export const useTeamsFreshness = createSimpleCacheQuery<Record<string, TeamFreshness>>({
  queryKey: queryKeys.departmentsTimeline.freshness(),
  queryFn: getTeamsFreshness,
  staleTime: 5 * 60 * 1000, // 5 минут
  gcTime: 10 * 60 * 1000, // 10 минут
})

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Мутация для подтверждения актуальности данных команды
 *
 * @example
 * const mutation = useConfirmTeamActivity()
 * mutation.mutate('team-id-123')
 */
export const useConfirmTeamActivity = createCacheMutation<
  string, // teamId
  { teamId: string }
>({
  mutationFn: (teamId) => confirmTeamActivity(teamId),
  invalidateKeys: [queryKeys.departmentsTimeline.freshness()],
})

/**
 * Мутация для подтверждения актуальности данных нескольких команд
 *
 * @example
 * const mutation = useConfirmMultipleTeamsActivity()
 * mutation.mutate(['team-1', 'team-2', 'team-3'])
 */
export const useConfirmMultipleTeamsActivity = createCacheMutation<
  string[], // teamIds
  { teamIds: string[] }
>({
  mutationFn: (teamIds) => confirmMultipleTeamsActivity(teamIds),
  invalidateKeys: [queryKeys.departmentsTimeline.freshness()],
})
