/**
 * Project Reports Module - Types
 *
 * Типы данных для модуля отчетов руководителей проектов
 */

// ============================================================================
// Project Report Types
// ============================================================================

/**
 * Отчет руководителя проекта
 */
export interface ProjectReport {
  /** ID отчета */
  id: string
  /** ID проекта */
  projectId: string
  /** Комментарий руководителя проекта */
  comment: string
  /** Фактическая готовность проекта (%) на момент создания отчета */
  actualReadiness: number | null
  /** Плановая готовность проекта (%) на момент создания отчета */
  plannedReadiness: number | null
  /** Процент расхода бюджета проекта (%) на момент создания отчета */
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
