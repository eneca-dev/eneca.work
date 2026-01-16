/**
 * Project Reports Module - Hooks
 *
 * Query и Mutation хуки для модуля отчетов руководителей проектов
 */

'use client'

import {
  createDetailCacheQuery,
  createCacheMutation,
  queryKeys,
} from '@/modules/cache'

import {
  getProjectReports,
  upsertProjectReport,
  deleteProjectReport,
  calculateProjectMetrics,
} from '../actions'

import type { ProjectReport } from '../types'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения отчетов к проекту
 *
 * Загружается лениво при развороте проекта (enabled: true).
 * Данные кешируются навечно, обновляются только через Realtime.
 *
 * @param projectId - ID проекта
 * @param options - { enabled: boolean } - включить загрузку
 *
 * @example
 * const { data: reports, isLoading } = useProjectReports(projectId, { enabled: isExpanded })
 */
export const useProjectReports = createDetailCacheQuery<ProjectReport[]>({
  queryKey: (projectId) => queryKeys.projectReports.detail(projectId),
  queryFn: getProjectReports,
  staleTime: Infinity, // Данные не устаревают, обновляются через Realtime
})

/**
 * Хук для получения текущих метрик проекта
 *
 * Загружает метрики на текущий момент (не snapshot).
 *
 * @param projectId - ID проекта
 * @param options - { enabled: boolean } - включить загрузку
 *
 * @example
 * const { data: metrics } = useProjectMetrics(projectId, { enabled: true })
 */
export const useProjectMetrics = createDetailCacheQuery<{
  actualReadiness: number
  plannedReadiness: number
  budgetSpent: number
}>({
  queryKey: (projectId) => [...queryKeys.projectReports.all, 'metrics', projectId] as const,
  queryFn: calculateProjectMetrics,
  staleTime: 0, // Всегда свежие данные
})

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для создания/обновления отчета к проекту
 *
 * Автоматически инвалидирует кеш отчетов проекта.
 *
 * @example
 * const saveMutation = useSaveProjectReport()
 * saveMutation.mutate({ projectId: 'xxx', comment: 'Текст отчета' })
 */
export const useSaveProjectReport = createCacheMutation({
  mutationFn: upsertProjectReport,
  invalidateKeys: (input) => [
    queryKeys.projectReports.detail(input.projectId),
    queryKeys.projectReports.all, // Ensure list refresh
  ],
})

/**
 * Хук для удаления отчета к проекту
 *
 * Автоматически инвалидирует кеш отчетов проекта.
 *
 * @example
 * const deleteMutation = useDeleteProjectReport()
 * deleteMutation.mutate({ reportId: 'xxx', projectId: 'yyy' })
 */
export const useDeleteProjectReport = createCacheMutation({
  mutationFn: deleteProjectReport,
  invalidateKeys: (input) => [
    queryKeys.projectReports.detail(input.projectId),
    queryKeys.projectReports.all, // Ensure list refresh
  ],
})
