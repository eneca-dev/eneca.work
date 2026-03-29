'use client'

import { useMemo } from 'react'
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
 * - Вертикальные разделители дней через CSS gradient (не DOM)
 * - Чередование фона по месяцам
 * - Подсвечивает выходные, праздники и сегодняшний день
 */
export function TimelineGrid({ dayCells }: TimelineGridProps) {
  const monthSpans = useMemo(() => {
    const spans: { startIdx: number; count: number; isOdd: boolean }[] = []
    let prevMonthIndex = -1
    dayCells.forEach((cell, i) => {
      if (cell.monthIndex !== prevMonthIndex) {
        prevMonthIndex = cell.monthIndex
        spans.push({ startIdx: i, count: 1, isOdd: cell.monthIndex % 2 === 1 })
      } else {
        spans[spans.length - 1].count++
      }
    })
    return spans
  }, [dayCells])

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        // Вертикальные линии разделителей через CSS — вместо ~180 DOM-элементов
        backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_CELL_WIDTH - 1}px, hsl(var(--border) / 0.3) ${DAY_CELL_WIDTH - 1}px, hsl(var(--border) / 0.3) ${DAY_CELL_WIDTH}px)`,
        backgroundSize: `${DAY_CELL_WIDTH}px 100%`,
      }}
    >
      {/* Чередование фона по месяцам */}
      {monthSpans.map((span, i) => span.isOdd ? (
        <div
          key={`month-${i}`}
          className="absolute top-0 bottom-0 bg-black/[0.03] dark:bg-white/[0.035]"
          style={{
            left: span.startIdx * DAY_CELL_WIDTH,
            width: span.count * DAY_CELL_WIDTH,
          }}
        />
      ) : null)}
      {/* Границы месяцев (жирнее обычных разделителей) */}
      {monthSpans.slice(1).map((span, i) => (
        <div
          key={`month-border-${i}`}
          className="absolute top-0 bottom-0 w-px bg-border/60"
          style={{ left: span.startIdx * DAY_CELL_WIDTH }}
        />
      ))}
      {/* Фоновые подсветки (только для дней с особым фоном) */}
      {dayCells.map((cell, i) => {
        const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff
        const isRegularWeekend = cell.isWeekend && !cell.isWorkday && !isSpecialDayOff
        const showBackground = cell.isToday || isSpecialDayOff || isRegularWeekend

        if (!showBackground) return null

        return (
          <div
            key={i}
            className={cn(
              'absolute top-0 bottom-0',
              !cell.isToday && isSpecialDayOff && 'bg-amber-500/10 dark:bg-amber-500/5',
              !cell.isToday && isRegularWeekend && 'bg-muted/30 dark:bg-muted/15',
              cell.isToday && 'bg-green-50 dark:bg-green-800 z-10'
            )}
            style={{
              left: i * DAY_CELL_WIDTH,
              width: DAY_CELL_WIDTH,
            }}
          />
        )
      })}
    </div>
  )
}
