/**
 * Section Loading Modal - Types
 *
 * Типы для модального окна создания/редактирования загрузки на раздел
 */

// ============================================================================
// Form Data
// ============================================================================

export interface SectionLoadingFormData {
  /** ID сотрудника */
  employeeId: string
  /** Ставка загрузки (0.01 - 2.0) */
  rate: number
  /** Дата начала (YYYY-MM-DD) */
  startDate: string
  /** Дата окончания (YYYY-MM-DD) */
  endDate: string
  /** Комментарий (опционально) */
  comment?: string
}

// ============================================================================
// Modal Props
// ============================================================================

export interface SectionLoadingCreateData {
  /** ID раздела */
  sectionId: string
  /** Название раздела */
  sectionName: string
  /** Название объекта */
  objectName: string
  /** Название проекта */
  projectName: string
  /** ID сотрудника (опционально - для pre-fill) */
  employeeId?: string
  /** Этапы декомпозиции (опционально) */
  stages?: Array<{ id: string; name: string; order: number | null }>
}

export interface SectionLoadingEditData {
  /** ID загрузки */
  loadingId: string
  /** ID раздела */
  sectionId: string
  /** Данные загрузки */
  loading: {
    id: string
    employee_id: string
    start_date: string
    end_date: string
    rate: number
    comment?: string | null
    stage_id?: string | null
  }
  /** Breadcrumbs */
  sectionName: string
  objectName: string
  projectName: string
  /** Этапы декомпозиции (опционально) */
  stages?: Array<{ id: string; name: string; order: number | null }>
}
