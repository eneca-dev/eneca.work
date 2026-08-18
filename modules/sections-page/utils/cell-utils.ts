/**
 * Cell Utilities
 *
 * Утилиты для работы с ячейками timeline
 */

import { cn } from '@/lib/utils'
import type { DayCell } from '../types'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import { getCellDayType } from '@/components/shared/timeline/cell-utils'

export { getCellDayType }

/**
 * Get cell background class names.
 *
 * ⚠️ Без `relative`: все вызывающие компоненты дописывают `absolute` (ячейки
 * позиционируются по left из виртуализатора). В Tailwind `.relative` объявлен
 * ПОСЛЕ `.absolute`, поэтому при одинаковой специфичности выигрывал `relative`
 * — ячейка оставалась в потоке flex-контейнера и `left` сдвигал её ВТОРОЙ раз,
 * поверх позиции в потоке (смещение «сегодня» на ширину окна виртуализации).
 */
export function getCellClassNames(cell: DayCell): string {
  const { isWeekend, isSpecialDayOff } = getCellDayType(cell)
  return cn(
    'border-r border-border/30',
    cell.monthIndex % 2 === 1 && 'bg-black/[0.03] dark:bg-white/[0.035]',
    !cell.isToday && isWeekend && 'bg-muted/20',
    !cell.isToday && isSpecialDayOff && 'bg-red-50/30 dark:bg-red-950/10',
    // Сегодня - применяется последним, но за загрузками
    cell.isToday && 'bg-green-300/60 dark:bg-green-700/25'
  )
}

/**
 * Get week cell background class names (недельный режим).
 * Чередование — по месяцу (как в дневном режиме и WeeklyHeader), текущая неделя — зелёным.
 */
export function getWeekCellClassNames(week: WeekCell): string {
  return cn(
    'border-r border-border/30',
    week.monthIndex % 2 === 1 && 'bg-black/[0.03] dark:bg-white/[0.035]',
    // Текущая неделя - применяется последним, но за загрузками
    week.isCurrentWeek && 'bg-green-300/60 dark:bg-green-700/25'
  )
}
