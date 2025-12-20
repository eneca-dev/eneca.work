/**
 * Project Reports Module - Types
 *
 * Типы данных для модуля отчетов руководителей проектов
 */

// ============================================================================
// Project Report Types
// ============================================================================

/**
 * Отчет руководителя проекта к стадии
 */
export interface ProjectReport {
  /** ID отчета */
  id: string
  /** ID стадии */
  stageId: string
  /** Комментарий руководителя проекта */
  comment: string
  /** Фактическая готовность стадии (%) на момент создания отчета */
  actualReadiness: number | null
  /** Плановая готовность стадии (%) на момент создания отчета */
  plannedReadiness: number | null
  /** Процент расхода бюджета стадии (%) на момент создания отчета */
  budgetSpent: number | null
  /** Автор отчета */
  createdBy: {
    id: string
    firstName: string | null
    lastName: string | null
    name: string | null
    avatarUrl: string | null
  }
  /** Дата создания */
  createdAt: string
  /** Дата последнего обновления */
  updatedAt: string
}
