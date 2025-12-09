'use client'

import { useMemo } from 'react'
import { format, getDay, getWeek, addDays, differenceInDays, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { TimelineRange } from '../../types'

export interface DayCell {
  date: Date
  dayOfMonth: number
  dayOfWeek: string
  isWeekend: boolean
  isToday: boolean
  isMonthStart: boolean
  monthName: string
}

/**
 * Генерирует массив ячеек дней для timeline
 */
export function generateDayCells(range: TimelineRange): DayCell[] {
  const cells: DayCell[] = []
  const today = startOfDay(new Date())

  for (let i = 0; i < range.totalDays; i++) {
    const date = addDays(range.start, i)
    const dayOfWeek = getDay(date)

    cells.push({
      date,
      dayOfMonth: date.getDate(),
      dayOfWeek: format(date, 'EEEEEE', { locale: ru }),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isToday: differenceInDays(date, today) === 0,
      isMonthStart: date.getDate() === 1,
      monthName: format(date, 'LLLL yyyy', { locale: ru }),
    })
  }

  return cells
}

interface TimelineHeaderProps {
  dayCells: DayCell[]
}

/**
 * Заголовок timeline с неделями и днями
 */
export function TimelineHeader({ dayCells }: TimelineHeaderProps) {
  // Группировка по неделям (с нумерацией от начала года)
  const weeks = useMemo(() => {
    const result: { weekNum: number; startIdx: number; daysCount: number }[] = []
    let currentWeekStart = 0
    let currentWeekNum = dayCells.length > 0
      ? getWeek(dayCells[0].date, { weekStartsOn: 1, locale: ru })
      : 1

    dayCells.forEach((cell, idx) => {
      const dayNum = getDay(cell.date)
      // Понедельник = начало новой недели
      if (dayNum === 1 && idx > 0) {
        result.push({
          weekNum: currentWeekNum,
          startIdx: currentWeekStart,
          daysCount: idx - currentWeekStart,
        })
        currentWeekNum = getWeek(cell.date, { weekStartsOn: 1, locale: ru })
        currentWeekStart = idx
      }
    })

    // Добавляем последнюю неделю
    result.push({
      weekNum: currentWeekNum,
      startIdx: currentWeekStart,
      daysCount: dayCells.length - currentWeekStart,
    })

    return result
  }, [dayCells])

  // Группировка по месяцам
  const months = useMemo(() => {
    const result: { name: string; daysCount: number }[] = []
    let currentMonth = ''
    let currentCount = 0

    dayCells.forEach((cell) => {
      const monthKey = format(cell.date, 'yyyy-MM')
      if (monthKey !== currentMonth) {
        if (currentMonth) {
          result.push({ name: currentMonth, daysCount: currentCount })
        }
        currentMonth = monthKey
        currentCount = 1
      } else {
        currentCount++
      }
    })

    if (currentCount > 0) {
      result.push({ name: currentMonth, daysCount: currentCount })
    }

    return result.map((m) => ({
      ...m,
      name: format(new Date(m.name + '-01'), 'LLLL yyyy', { locale: ru }),
    }))
  }, [dayCells])

  return (
    <div className="flex flex-col sticky top-0 z-20 bg-background border-b border-border">
      {/* Месяцы */}
      <div className="flex h-7 border-b border-border/50">
        {months.map((month, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-xs font-medium text-muted-foreground capitalize"
            style={{ flex: month.daysCount }}
          >
            {month.name}
          </div>
        ))}
      </div>

      {/* Недели */}
      <div className="flex h-5 border-b border-border/50">
        {weeks.map((week, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center justify-center text-[10px] text-muted-foreground',
              i < weeks.length - 1 && 'border-r border-border/30'
            )}
            style={{ flex: week.daysCount }}
          >
            Нед. {week.weekNum}
          </div>
        ))}
      </div>

      {/* Дни */}
      <div className="flex h-10">
        {dayCells.map((cell, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 flex flex-col items-center justify-center text-[10px] min-w-0',
              cell.isWeekend && 'bg-muted/50',
              cell.isToday && 'bg-primary/10',
              i < dayCells.length - 1 && 'border-r border-border/20'
            )}
          >
            <span
              className={cn(
                'font-medium',
                cell.isToday && 'text-primary',
                cell.isWeekend && !cell.isToday && 'text-muted-foreground'
              )}
            >
              {cell.dayOfMonth}
            </span>
            <span
              className={cn(
                'uppercase text-muted-foreground',
                cell.isWeekend && 'text-muted-foreground/60'
              )}
            >
              {cell.dayOfWeek}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
