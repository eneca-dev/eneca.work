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
  getStageReports,
  upsertStageReport,
  deleteStageReport,
  calculateStageMetrics,
} from '../actions'

import type { ProjectReport } from '../types'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения отчетов к стадии
 *
 * Загружается лениво при развороте стадии (enabled: true).
 * Данные кешируются навечно, обновляются только через Realtime.
 *
 * @param stageId - ID стадии
 * @param options - { enabled: boolean } - включить загрузку
 *
 * @example
 * const { data: reports, isLoading } = useStageReports(stageId, { enabled: isExpanded })
 */
export const useStageReports = createDetailCacheQuery<ProjectReport[]>({
  queryKey: (stageId) => queryKeys.projectReports.detail(stageId),
  queryFn: getStageReports,
  staleTime: Infinity, // Данные не устаревают, обновляются через Realtime
})

/**
 * Хук для получения текущих метрик стадии
 *
 * Загружает метрики на текущий момент (не snapshot).
 *
 * @param stageId - ID стадии
 * @param options - { enabled: boolean } - включить загрузку
 *
 * @example
 * const { data: metrics } = useStageMetrics(stageId, { enabled: true })
 */
export const useStageMetrics = createDetailCacheQuery<{
  actualReadiness: number
  plannedReadiness: number
  budgetSpent: number
}>({
  queryKey: (stageId) => [...queryKeys.projectReports.all, 'metrics', stageId] as const,
  queryFn: calculateStageMetrics,
  staleTime: 0, // Всегда свежие данные
})

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для создания/обновления отчета к стадии
 *
 * Автоматически инвалидирует кеш отчетов стадии.
 *
 * @example
 * const saveMutation = useSaveStageReport()
 * saveMutation.mutate({ stageId: 'xxx', comment: 'Текст отчета' })
 */
export const useSaveStageReport = createCacheMutation({
  mutationFn: upsertStageReport,
  invalidateKeys: (input) => [
    queryKeys.projectReports.detail(input.stageId),
    queryKeys.projectReports.all, // Ensure list refresh
  ],
})

/**
 * Хук для удаления отчета к стадии
 *
 * Автоматически инвалидирует кеш отчетов стадии.
 *
 * @example
 * const deleteMutation = useDeleteStageReport()
 * deleteMutation.mutate({ reportId: 'xxx', stageId: 'yyy' })
 */
export const useDeleteStageReport = createCacheMutation({
  mutationFn: deleteStageReport,
  invalidateKeys: (input) => [
    queryKeys.projectReports.detail(input.stageId),
    queryKeys.projectReports.all, // Ensure list refresh
  ],
})
