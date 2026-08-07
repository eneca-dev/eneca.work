/**
 * WS Task Report - Hooks
 *
 * Query-хуки поверх фабрик cache-модуля.
 * Мутаций нет: таблицу наполняет внешняя синхронизация.
 *
 * @module ws-task-report/hooks
 */

'use client'

import {
  createCacheQuery,
  createSimpleCacheQuery,
  staleTimePresets,
  queryKeys,
} from '@/modules/cache'

import { getWsTaskReport, hasWsReportAccess } from '../actions'
import type { WsTaskReportData, WsTaskReportFilters } from '../types'

/**
 * Есть ли доступ к отчёту.
 *
 * staleTime большой: доступ меняется вручную через insert в БД,
 * дёргать проверку на каждый рендер незачем.
 */
export const useWsReportAccess = createSimpleCacheQuery<boolean>({
  queryKey: queryKeys.wsTaskReport.access(),
  queryFn: hasWsReportAccess,
  staleTime: staleTimePresets.static,
})

/**
 * Строки отчёта с фильтрами.
 *
 * Данные обновляются раз в сутки синхронизацией, поэтому staleTime длинный —
 * перезапросы при переключении вкладок не нужны. 10 минут выбраны как
 * компромисс: ручной прогон синка подхватится в разумный срок.
 */
export const useWsTaskReport = createCacheQuery<WsTaskReportData, WsTaskReportFilters | undefined>({
  queryKey: (filters) =>
    queryKeys.wsTaskReport.list(
      filters
        ? {
            search: filters.search?.trim() || undefined,
            status: filters.status && filters.status !== 'all' ? filters.status : undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
          }
        : undefined
    ),
  queryFn: getWsTaskReport,
  staleTime: staleTimePresets.static,
})
