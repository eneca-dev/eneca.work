/**
 * Модуль ws-task-report
 *
 * Отчёт по задачам 3-го уровня Worksection: трудозатраты, суммы, статусы,
 * плановый бюджет. Данные приходят из Worksection отдельной синхронизацией
 * (ws-to-work/task-report) в таблицу ws_task_report — приложение только читает.
 *
 * @see README.md
 * @see docs/ws-task-report-plan.md
 */

// Types
export type {
  WsTaskReportRow,
  WsTaskReportData,
  WsTaskReportFilters,
  WsTaskStatus,
  WsTaskStatusFilter,
  WsTaskReportSortField,
  SortDirection,
  ReportSort,
} from './types'

// Actions
export { getWsTaskReport, hasWsReportAccess, exportWsTaskReport } from './actions'

// Hooks
export { useWsTaskReport, useWsReportAccess } from './hooks'

// Components
export { WsTaskReportView } from './components/WsTaskReportView'
