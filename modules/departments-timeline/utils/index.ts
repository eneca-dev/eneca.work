/**
 * Departments Timeline Module - Utils
 *
 * Re-export утилит из resource-graph для совместимости
 * Плюс дополнительные утилиты для отрисовки загрузок
 */

import { cn } from '@/lib/utils'
import { formatMinskDate } from '@/lib/timezone-utils'
import type { DayCell } from '../types'

// Re-export date utils from resource-graph
export { buildCalendarMap, getDayInfo } from '@/modules/resource-graph/utils'

// Re-export loading bars utils from shared components
export {
  loadingsToPeriods,
  calculateBarRenders,
  calculateBarTop,
  formatBarLabel,
  formatBarTooltip,
  getBarLabelParts,
  getSectionColor,
  splitPeriodByNonWorkingDays,
  BASE_BAR_HEIGHT,
  BAR_GAP,
  COMMENT_HEIGHT,
  COMMENT_GAP,
  type BarPeriod,
  type BarRender,
  type BarLabelParts,
} from '@/components/shared/timeline/loading-bars-utils'

// Re-export shared cell utils
export { getCellDayType } from '@/components/shared/timeline/cell-utils'

/**
 * Генерирует CSS классы для ячейки дня на таймлайне
 */
export function getCellClassNames(cell: DayCell, additionalClasses?: string) {
  const { isWeekend, isSpecialDayOff } = getCellDayType(cell)

  return cn(
    'border-r border-border/50 relative',
    cell.monthIndex % 2 === 1 && 'bg-black/[0.03] dark:bg-white/[0.035]',
    !cell.isToday && isSpecialDayOff && 'bg-amber-50 dark:bg-amber-950/30',
    !cell.isToday && isWeekend && 'bg-muted/50',
    // Сегодня - применяется последним, но за загрузками
    cell.isToday && 'bg-green-300/60 dark:bg-green-700/25',
    additionalClasses
  )
}

/**
 * Вычисляет процент загрузки для дня
 */
export function calculateLoadPercentage(
  dailyWorkloads: Record<string, number> | undefined,
  cell: DayCell,
  totalCapacity: number
): number {
  const { isWeekend, isSpecialDayOff } = getCellDayType(cell)
  const dateKey = formatMinskDate(cell.date)
  const workload = dailyWorkloads?.[dateKey] || 0

  return !isWeekend && !isSpecialDayOff && totalCapacity > 0
    ? Math.round((workload / totalCapacity) * 100)
    : 0
}
