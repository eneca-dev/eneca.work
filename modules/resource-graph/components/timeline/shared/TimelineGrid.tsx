'use client'

import { cn } from '@/lib/utils'
import type { DayCell } from '../TimelineHeader'
import { DAY_CELL_WIDTH } from '../../../constants'

// ============================================================================
// Timeline Grid Background
// ============================================================================

interface TimelineGridProps {
  dayCells: DayCell[]
}

/**
 * Фоновая сетка для Timeline
 * - Подсвечивает выходные, праздники и сегодняшний день
 * - Отображает вертикальные разделители между днями
 */
export function TimelineGrid({ dayCells }: TimelineGridProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Фоновые подсветки */}
      {dayCells.map((cell, i) => {
        // Логика цветов выходных:
        // - Праздники и дополнительные выходные (переносы) → желтоватый
        // - Стандартные выходные (Сб/Вс) → серый
        const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff
        const isRegularWeekend = cell.isWeekend && !cell.isWorkday && !isSpecialDayOff
        const showBackground = cell.isToday || isSpecialDayOff || isRegularWeekend

        if (!showBackground) return null

        return (
          <div
            key={i}
            className={cn(
              'absolute top-0 bottom-0',
              cell.isToday && 'bg-primary/20',
              !cell.isToday && isSpecialDayOff && 'bg-amber-50/50 dark:bg-amber-950/20',
              !cell.isToday && isRegularWeekend && 'bg-gray-100/50 dark:bg-gray-800/30'
            )}
            style={{
              left: i * DAY_CELL_WIDTH,
              width: DAY_CELL_WIDTH,
            }}
          />
        )
      })}
      {/* Вертикальные линии разделителей */}
      {dayCells.slice(0, -1).map((_, i) => (
        <div
          key={`line-${i}`}
          className="absolute top-0 bottom-0 w-px bg-border/30"
          style={{ left: (i + 1) * DAY_CELL_WIDTH }}
        />
      ))}
    </div>
  )
}
