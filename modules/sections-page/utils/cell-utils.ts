/**
 * Cell Utilities
 *
 * Утилиты для работы с ячейками timeline
 */

import { cn } from '@/lib/utils'
import type { DayCell } from '../types'
import { getCellDayType } from '@/components/shared/timeline/cell-utils'

export { getCellDayType }

/**
 * Get cell background class names
 */
export function getCellClassNames(cell: DayCell): string {
  const { isWeekend, isSpecialDayOff } = getCellDayType(cell)
  return cn(
    'border-r border-border/30 relative',
    cell.monthIndex % 2 === 1 && 'bg-black/[0.03] dark:bg-white/[0.035]',
    !cell.isToday && isWeekend && 'bg-muted/20',
    !cell.isToday && isSpecialDayOff && 'bg-red-50/30 dark:bg-red-950/10',
    // Сегодня - применяется последним, но за загрузками
    cell.isToday && 'bg-green-300/60 dark:bg-green-700/25'
  )
}
