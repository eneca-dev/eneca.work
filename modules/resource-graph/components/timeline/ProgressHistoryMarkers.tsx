'use client'

import { useMemo } from 'react'
import { differenceInDays } from 'date-fns'
import { parseMinskDate } from '@/lib/timezone-utils'
import { cn } from '@/lib/utils'
import type { ProgressHistoryEntry, TimelineRange } from '../../types'
import { DAY_CELL_WIDTH } from '../../constants'

interface ProgressHistoryMarkersProps {
  /** История изменений прогресса */
  progressHistory: ProgressHistoryEntry[]
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
}

interface DayAggregate {
  x: number
  /** Суммарное изменение за день */
  totalDelta: number
}

/**
 * Компонент текстовых меток прироста прогресса
 * Отображается как простой текст внизу ячейки
 */
export function ProgressHistoryMarkers({
  progressHistory,
  range,
  timelineWidth,
}: ProgressHistoryMarkersProps) {
  // Агрегируем изменения по дням
  const dayAggregates = useMemo(() => {
    if (!progressHistory || progressHistory.length === 0) return []

    const aggregateMap = new Map<number, DayAggregate>()

    for (const entry of progressHistory) {
      const entryDate = parseMinskDate(entry.date)
      const dayIndex = differenceInDays(entryDate, range.start)

      // Пропускаем если за пределами диапазона
      if (dayIndex < 0 || dayIndex * DAY_CELL_WIDTH >= timelineWidth) continue

      const x = dayIndex * DAY_CELL_WIDTH

      const existing = aggregateMap.get(dayIndex)
      if (existing) {
        existing.totalDelta += entry.delta
      } else {
        aggregateMap.set(dayIndex, {
          x,
          totalDelta: entry.delta,
        })
      }
    }

    return Array.from(aggregateMap.values())
  }, [progressHistory, range.start, timelineWidth])

  if (dayAggregates.length === 0) return null

  return (
    <div
      className="absolute bottom-1 left-0 pointer-events-none"
      style={{ width: timelineWidth }}
    >
      {dayAggregates.map((day) => {
        const isPositive = day.totalDelta > 0
        return (
          <span
            key={day.x}
            className={cn(
              'absolute text-[9px] font-medium tabular-nums',
              isPositive ? 'text-emerald-500' : 'text-red-500'
            )}
            style={{
              left: day.x,
              width: DAY_CELL_WIDTH,
              textAlign: 'center',
            }}
          >
            {isPositive ? '+' : ''}{day.totalDelta}%
          </span>
        )
      })}
    </div>
  )
}
