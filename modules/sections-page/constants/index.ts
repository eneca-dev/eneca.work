/**
 * Sections Page Module - Constants
 *
 * Константы модуля таймлайна разделов
 * Re-export из resource-graph для совместимости
 */

// Re-export timeline constants from resource-graph
export {
  DAY_CELL_WIDTH,
  ROW_HEIGHT,
  SIDEBAR_WIDTH,
} from '@/modules/resource-graph/constants'

// ============================================================================
// Sections Timeline Specific Constants
// ============================================================================

/** Высота строки отдела */
export const DEPARTMENT_ROW_HEIGHT = 48

/** Высота строки проекта */
export const PROJECT_ROW_HEIGHT = 44

/** Высота строки объект/раздел */
export const OBJECT_SECTION_ROW_HEIGHT = 40

/** Высота строки сотрудника (базовая) */
export const EMPLOYEE_ROW_HEIGHT = 44

/** Высота полоски загрузки */
export const LOADING_BAR_HEIGHT = 32

/** Отступ между полосками загрузок */
export const LOADING_BAR_GAP = 4

/** Высота комментария под загрузкой */
export const COMMENT_HEIGHT = 18

/** Отступ между полоской и комментарием */
export const COMMENT_GAP = 4

/** Высота мини-бара X/Y */
export const AGGREGATED_BAR_HEIGHT = 24

/** Отступ над мини-баром */
export const AGGREGATED_BAR_TOP_MARGIN = 4

// ============================================================================
// Timeline Config
// ============================================================================

/** Дней назад от сегодня */
export const DAYS_BEFORE_TODAY = 150

/** Дней вперёд от сегодня */
export const DAYS_AFTER_TODAY = 150

/** Всего дней на таймлайне */
export const TOTAL_DAYS = DAYS_BEFORE_TODAY + DAYS_AFTER_TODAY

// ============================================================================
// Capacity Config
// ============================================================================

/** Минимальное значение ёмкости */
export const MIN_CAPACITY = 0.1

/** Максимальное значение ёмкости */
export const MAX_CAPACITY = 99

/** Дефолтное значение ёмкости если не указано */
export const DEFAULT_CAPACITY_VALUE = 1
