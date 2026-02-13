/**
 * Sections Page Module - Utilities
 *
 * Утилиты для работы с данными страницы разделов
 */

export * from './loading-bars-utils'

import { format, eachDayOfInterval, parseISO, isWithinInterval } from 'date-fns'
import type { ObjectSection, SectionLoading } from '../types'
import type { DayCell } from '@/modules/resource-graph/components/timeline/TimelineHeader'

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Генерация цвета на основе ID (простой hash)
 */
export function hashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  const hue = Math.abs(hash % 360)
  // Используем высокую насыщенность и средний lightness для ярких цветов
  return `hsl(${hue}, 70%, 60%)`
}

/**
 * Получить цвет для загрузки на основе её ID
 */
export function getLoadingColor(loadingId: string): string {
  return hashColor(loadingId)
}

/**
 * Получить цвет для раздела на основе его ID
 */
export function getSectionColor(sectionId: string): string {
  return hashColor(sectionId)
}

// ============================================================================
// Capacity Utilities
// ============================================================================

/**
 * Получить эффективную capacity для раздела на конкретную дату
 * Приоритет: date-specific override > default capacity > 1
 */
export function getEffectiveCapacity(
  objectSection: ObjectSection,
  date: string
): number {
  // Проверяем override для конкретной даты
  if (objectSection.capacityOverrides?.[date] !== undefined) {
    return objectSection.capacityOverrides[date]
  }

  // Используем default capacity
  if (objectSection.defaultCapacity !== null && objectSection.defaultCapacity !== undefined) {
    return objectSection.defaultCapacity
  }

  // Fallback
  return 1
}

/**
 * Проверить есть ли capacity override для даты
 */
export function hasCapacityOverride(
  objectSection: ObjectSection,
  date: string
): boolean {
  return objectSection.capacityOverrides?.[date] !== undefined
}

// ============================================================================
// Daily Workload Utilities
// ============================================================================

/**
 * Вычислить ежедневные загрузки для раздела из массива loadings
 */
export function calculateDailyWorkloads(
  loadings: SectionLoading[],
  dayCells: DayCell[]
): Record<string, number> {
  const workloads: Record<string, number> = {}

  for (const dayCell of dayCells) {
    const dateStr = format(dayCell.date, 'yyyy-MM-dd')
    let totalRate = 0

    for (const loading of loadings) {
      // Проверяем попадает ли дата в интервал загрузки
      const loadingStart = parseISO(loading.startDate)
      const loadingEnd = parseISO(loading.endDate)

      if (
        isWithinInterval(dayCell.date, {
          start: loadingStart,
          end: loadingEnd,
        })
      ) {
        totalRate += loading.rate
      }
    }

    if (totalRate > 0) {
      workloads[dateStr] = totalRate
    }
  }

  return workloads
}

/**
 * Вычислить X/Y для конкретной даты
 */
export function calculateXY(
  objectSection: ObjectSection,
  date: string
): { x: number; y: number } {
  const x = objectSection.dailyWorkloads?.[date] || 0
  const y = getEffectiveCapacity(objectSection, date)
  return { x, y }
}

// ============================================================================
// Loading Position Utilities
// ============================================================================

/**
 * Вычислить позицию загрузки на timeline
 */
export function calculateLoadingPosition(
  loading: SectionLoading,
  dayCells: DayCell[],
  dayCellWidth: number
): { left: number; width: number } | null {
  const startDate = parseISO(loading.startDate)
  const endDate = parseISO(loading.endDate)

  // Находим индексы дней
  const startIndex = dayCells.findIndex(
    (cell) => format(cell.date, 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd')
  )
  const endIndex = dayCells.findIndex(
    (cell) => format(cell.date, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')
  )

  // Если загрузка вне видимого диапазона
  if (startIndex === -1 && endIndex === -1) {
    // Проверяем охватывает ли загрузка весь видимый диапазон
    const firstDay = dayCells[0].date
    const lastDay = dayCells[dayCells.length - 1].date

    if (startDate <= firstDay && endDate >= lastDay) {
      return {
        left: 0,
        width: dayCells.length * dayCellWidth,
      }
    }
    return null
  }

  // Вычисляем видимую часть
  const visibleStartIndex = Math.max(0, startIndex)
  const visibleEndIndex = endIndex === -1 ? dayCells.length - 1 : endIndex

  const left = visibleStartIndex * dayCellWidth
  const width = (visibleEndIndex - visibleStartIndex + 1) * dayCellWidth

  return { left, width }
}

// ============================================================================
// Aggregation Utilities
// ============================================================================

/**
 * Агрегировать daily workloads от детей к родителям
 */
export function aggregateDailyWorkloads(
  children: Array<{ dailyWorkloads?: Record<string, number> }>
): Record<string, number> {
  const aggregated: Record<string, number> = {}

  for (const child of children) {
    if (!child.dailyWorkloads) continue

    for (const [date, workload] of Object.entries(child.dailyWorkloads)) {
      aggregated[date] = (aggregated[date] || 0) + workload
    }
  }

  return aggregated
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Валидация диапазона дат
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  try {
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    return start <= end
  } catch {
    return false
  }
}

/**
 * Валидация значения capacity
 */
export function validateCapacity(value: number): boolean {
  return value > 0 && value <= 99
}

/**
 * Валидация значения rate
 */
export function validateRate(value: number): boolean {
  return value > 0 && value <= 1
}
