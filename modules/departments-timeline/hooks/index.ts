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
  updateLoadingDates,
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

// ============================================================================
// Loading Mutation Hooks
// ============================================================================

/**
 * Тип входных данных для обновления дат загрузки
 */
interface UpdateLoadingDatesInput {
  loadingId: string
  employeeId: string // для поиска в кеше
  startDate: string
  finishDate: string
}

/**
 * Обновляет даты загрузки в иерархической структуре Department[]
 *
 * Рекурсивно проходит по Department → Team → Employee → Loading
 * и обновляет loading с указанным loadingId
 */
function updateLoadingDatesInEmployeeCache(
  departments: Department[] | undefined,
  loadingId: string,
  employeeId: string,
  startDate: string,
  finishDate: string
): Department[] | undefined {
  // Если данных нет или это не массив - возвращаем как есть
  if (!departments || !Array.isArray(departments)) {
    console.warn('[updateLoadingDatesInEmployeeCache] Invalid data type:', typeof departments)
    return departments
  }

  return departments.map((department) => ({
    ...department,
    teams: department.teams.map((team) => ({
      ...team,
      employees: team.employees.map((employee) => {
        // Обновляем только загрузки нужного сотрудника
        if (employee.id !== employeeId) return employee

        return {
          ...employee,
          loadings: employee.loadings?.map((loading) =>
            loading.id === loadingId
              ? { ...loading, startDate, endDate: finishDate }
              : loading
          ),
        }
      }),
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
  { loadingId: string; startDate: string; finishDate: string }
>({
  mutationFn: ({ loadingId, startDate, finishDate }) =>
    updateLoadingDates(loadingId, startDate, finishDate),

  optimisticUpdate: {
    queryKey: queryKeys.departmentsTimeline.all,
    updater: (oldData, input) => {
      // oldData может быть Department[] из кеша useDepartmentsData,
      // или другим типом данных (например, Record<string, TeamFreshness>)
      // Обрабатываем только массивы отделов, остальное возвращаем как есть
      if (!Array.isArray(oldData)) {
        return oldData
      }

      return updateLoadingDatesInEmployeeCache(
        oldData as Department[],
        input.loadingId,
        input.employeeId,
        input.startDate,
        input.finishDate
      )
    },
  },

  // Инвалидируем departments timeline + sections page после успешного обновления
  // Это важно т.к. staleTime: Infinity и данные обновляются только через Realtime или invalidation
  invalidateKeys: [queryKeys.departmentsTimeline.all, queryKeys.sectionsPage.all],
})
