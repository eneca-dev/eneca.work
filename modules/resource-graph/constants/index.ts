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

/** Высота строки раздела (двухстрочная) */
export const SECTION_ROW_HEIGHT = 56

/** Фиксированная ширина ячейки дня в пикселях */
export const DAY_CELL_WIDTH = 36

/** Ширина боковой панели */
export const SIDEBAR_WIDTH = 320

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
