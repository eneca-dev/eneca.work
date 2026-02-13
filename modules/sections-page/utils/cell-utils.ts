/**
 * Cell Utilities
 *
 * Утилиты для работы с ячейками timeline
 */

import { cn } from '@/lib/utils'
import type { DayCell } from '../types'

/**
 * Get cell day type (weekend, special day off, etc.)
 */
export function getCellDayType(cell: DayCell) {
  const isWeekend = cell.isWeekend && !cell.isWorkday
  const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff
  return { isWeekend, isSpecialDayOff }
}

/**
 * Get cell background class names
 */
export function getCellClassNames(cell: DayCell): string {
  const { isWeekend, isSpecialDayOff } = getCellDayType(cell)
  return cn(
    'border-r border-border/30',
    isWeekend && 'bg-muted/20',
    isSpecialDayOff && 'bg-red-50/30 dark:bg-red-950/10'
  )
}
