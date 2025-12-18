/**
 * Resource Graph Module - Constants
 *
 * Константы модуля графика ресурсов
 */

import type { TimelineScale } from '../types'

// ============================================================================
// Timeline Constants
// ============================================================================

/** Масштабы временной шкалы */
export const TIMELINE_SCALES: Record<TimelineScale, { label: string; days: number }> = {
  day: { label: 'День', days: 1 },
  week: { label: 'Неделя', days: 7 },
  month: { label: 'Месяц', days: 30 },
  quarter: { label: 'Квартал', days: 90 },
}

/** Цвета для ставок загрузки */
export const RATE_COLORS = {
  0.25: 'bg-blue-200 dark:bg-blue-900',
  0.5: 'bg-blue-400 dark:bg-blue-700',
  0.75: 'bg-blue-500 dark:bg-blue-600',
  1: 'bg-blue-600 dark:bg-blue-500',
} as const

/** Цвета для статусов загрузки */
export const LOADING_STATUS_COLORS = {
  planned: 'bg-gray-300 dark:bg-gray-600',
  approved: 'bg-green-500 dark:bg-green-600',
  rejected: 'bg-red-500 dark:bg-red-600',
} as const

// ============================================================================
// UI Constants
// ============================================================================

/** Высота строки в пикселях */
export const ROW_HEIGHT = 40

/** Высота строки объекта (с графиками агрегации) */
export const OBJECT_ROW_HEIGHT = 56

/** Высота строки раздела (двухстрочная) */
export const SECTION_ROW_HEIGHT = 56

/** Высота строки этапа декомпозиции (двухстрочная + место для загрузок и готовности) */
export const STAGE_ROW_HEIGHT = 64

/** Фиксированная ширина ячейки дня в пикселях */
export const DAY_CELL_WIDTH = 36

/** Ширина боковой панели */
export const SIDEBAR_WIDTH = 320

// ============================================================================
// Work Log Display Constants
// ============================================================================

/** Минимальная высота блока work log */
export const WORK_LOG_MIN_HEIGHT = 20

/** Пикселей на час (масштаб высоты) */
export const WORK_LOG_HOURS_SCALE = 4

/** Отступ между блоками work log */
export const WORK_LOG_GAP = 2

/** Минимальная ширина блока work log */
export const WORK_LOG_WIDTH = 32

// ============================================================================
// Default Values
// ============================================================================

/** Количество месяцев для отображения по умолчанию */
export const DEFAULT_MONTHS_RANGE = 3

/** Настройки отображения по умолчанию */
export const DEFAULT_DISPLAY_SETTINGS = {
  scale: 'week' as TimelineScale,
  showWeekends: true,
  showHolidays: true,
  compactMode: false,
}
