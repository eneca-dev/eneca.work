/**
 * WS Task Report - Types
 *
 * Отчёт по задачам 3-го уровня Worksection.
 * Все значения приходят из Worksection, наша модель данных не участвует.
 */

import type { TableRow } from '@/modules/cache'

// ============================================================================
// Строка отчёта
// ============================================================================

/** Строка таблицы ws_task_report */
export type WsTaskReportRow = TableRow<'ws_task_report'>

/** Статус задачи в Worksection */
export type WsTaskStatus = 'active' | 'done'

/** Значение фильтра по статусу в интерфейсе */
export type WsTaskStatusFilter = 'all' | WsTaskStatus

// ============================================================================
// Фильтры
// ============================================================================

export interface WsTaskReportFilters {
  /** Поиск по названию задачи (подстрока, без учёта регистра) */
  search?: string
  /** Статус: all — не фильтровать */
  status?: WsTaskStatusFilter
  /** Дата открытия от, включительно. Формат YYYY-MM-DD (минский день) */
  dateFrom?: string
  /** Дата открытия до, включительно. Формат YYYY-MM-DD (минский день) */
  dateTo?: string
}

// ============================================================================
// Ответ действия
// ============================================================================

export interface WsTaskReportData {
  rows: WsTaskReportRow[]
  /** Момент последней синхронизации — max(synced_at) по всей таблице */
  lastSyncedAt: string | null
  /** Сколько строк вернулось (после фильтров) */
  total: number
}

// ============================================================================
// Сортировка
// ============================================================================

export type WsTaskReportSortField =
  | 'ws_project_name'
  | 'ws_object_name'
  | 'ws_task_name'
  | 'date_added'
  | 'ws_status'
  | 'date_closed'
  | 'total_hours'
  | 'planned_budget'
  | 'total_money'

export type SortDirection = 'asc' | 'desc'

/**
 * Состояние сортировки. Живёт в WsTaskReportView, а не в таблице:
 * выгрузка в Excel должна повторять экран, а кнопка выгрузки в шапке.
 */
export interface ReportSort {
  field: WsTaskReportSortField
  direction: SortDirection
}
