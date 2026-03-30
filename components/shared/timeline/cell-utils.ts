/**
 * Shared Cell Utilities for timeline modules
 *
 * Общие утилиты для работы с ячейками DayCell,
 * переиспользуемые в departments-timeline и sections-page
 */

import type { DayCell } from '@/modules/resource-graph/components/timeline/TimelineHeader'

/**
 * Определяет тип дня (выходной, праздник и т.д.)
 */
export function getCellDayType(cell: DayCell) {
  const isWeekend = cell.isWeekend && !cell.isWorkday
  const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff
  return { isWeekend, isSpecialDayOff }
}
