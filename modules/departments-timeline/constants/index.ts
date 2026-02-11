/**
 * Departments Timeline Module - Constants
 *
 * Константы модуля таймлайна отделов
 * Re-export из resource-graph для совместимости
 */

// Re-export timeline constants from resource-graph
export {
  ROW_HEIGHT,
  SIDEBAR_WIDTH,
} from '@/modules/resource-graph/constants'

/** Ширина ячейки дня — шире чем в resource-graph (36) для heatmap с процентами */
export const DAY_CELL_WIDTH = 48

// ============================================================================
// Department Timeline Specific Constants
// ============================================================================

/** Высота строки отдела */
export const DEPARTMENT_ROW_HEIGHT = 48

/** Высота строки команды */
export const TEAM_ROW_HEIGHT = 40

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

// ============================================================================
// Timeline Config
// ============================================================================

/** Дней назад от сегодня */
export const DAYS_BEFORE_TODAY = 30

/** Дней вперёд от сегодня */
export const DAYS_AFTER_TODAY = 150

/** Всего дней на таймлайне */
export const TOTAL_DAYS = DAYS_BEFORE_TODAY + DAYS_AFTER_TODAY

// ============================================================================
// Freshness Thresholds
// ============================================================================

/** Порог "зелёного" индикатора (дней) */
export const FRESHNESS_GREEN_THRESHOLD = 3

/** Порог "жёлтого" индикатора (дней) */
export const FRESHNESS_YELLOW_THRESHOLD = 5

/** Порог "не обновлялось" (дней) */
export const FRESHNESS_NEVER_THRESHOLD = 200
