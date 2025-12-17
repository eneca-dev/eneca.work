'use client'

import { useMemo } from 'react'
import { format, getDay, getWeek, addDays, differenceInDays, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { DAY_CELL_WIDTH } from '../../constants'
import type { TimelineRange, CompanyCalendarEvent, DayInfo } from '../../types'
import { buildCalendarMap, getDayInfo } from '../../utils'

export interface DayCell {
  date: Date
  dayOfMonth: number
  dayOfWeek: string
  isWeekend: boolean
  isToday: boolean
  isMonthStart: boolean
  monthName: string
  // Calendar info (holidays & transfers)
  isHoliday: boolean
  holidayName: string | null
  isWorkday: boolean
  isTransferredWorkday: boolean
  isTransferredDayOff: boolean
}

/**
 * Генерирует массив ячеек дней для timeline
 *
 * @param range - Диапазон дат
 * @param calendarEvents - События календаря (праздники и переносы)
 */
export function generateDayCells(
  range: TimelineRange,
  calendarEvents: CompanyCalendarEvent[] = []
): DayCell[] {
  const cells: DayCell[] = []
  const today = startOfDay(new Date())

  // Build calendar map for fast lookup
  const calendarMap = buildCalendarMap(calendarEvents)

  for (let i = 0; i < range.totalDays; i++) {
    const date = addDays(range.start, i)
    const dayOfWeek = getDay(date)
    const isDefaultWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Get calendar info for this day
    const dayInfo = getDayInfo(date, calendarMap)

    cells.push({
      date,
      dayOfMonth: date.getDate(),
      dayOfWeek: format(date, 'EEEEEE', { locale: ru }),
      isWeekend: isDefaultWeekend,
      isToday: differenceInDays(date, today) === 0,
      isMonthStart: date.getDate() === 1,
      monthName: format(date, 'LLLL yyyy', { locale: ru }),
      // Calendar info
      isHoliday: dayInfo.isHoliday,
      holidayName: dayInfo.holidayName,
      isWorkday: dayInfo.isWorkday,
      isTransferredWorkday: dayInfo.isTransferredWorkday,
      isTransferredDayOff: dayInfo.isTransferredDayOff,
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

  // Общая ширина timeline
  const totalWidth = dayCells.length * DAY_CELL_WIDTH

  // Минимальная ширина для отображения текста
  const MIN_DAYS_FOR_MONTH_NAME = 4  // ~144px
  const MIN_DAYS_FOR_WEEK_NAME = 3   // ~108px

  return (
    <div className="flex flex-col bg-card border-b border-border" style={{ width: totalWidth }}>
      {/* Месяцы */}
      <div className="flex h-7 border-b border-border/50">
        {months.map((month, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-xs font-medium text-muted-foreground capitalize overflow-hidden"
            style={{ width: month.daysCount * DAY_CELL_WIDTH }}
          >
            {month.daysCount >= MIN_DAYS_FOR_MONTH_NAME && month.name}
          </div>
        ))}
      </div>

      {/* Недели */}
      <div className="flex h-5 border-b border-border/50">
        {weeks.map((week, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center justify-center text-[10px] text-muted-foreground overflow-hidden',
              i < weeks.length - 1 && 'border-r border-border/30'
            )}
            style={{ width: week.daysCount * DAY_CELL_WIDTH }}
          >
            {week.daysCount >= MIN_DAYS_FOR_WEEK_NAME && `Нед. ${week.weekNum}`}
          </div>
        ))}
      </div>

      {/* Дни */}
      <div className="flex h-10">
        {dayCells.map((cell, i) => {
          // Логика цветов выходных:
          // - Праздники и дополнительные выходные (переносы) → желтоватый
          // - Стандартные выходные (Сб/Вс) → серый
          const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff
          const isRegularWeekend = cell.isWeekend && !cell.isWorkday && !isSpecialDayOff

          return (
            <div
              key={i}
              className={cn(
                'flex flex-col items-center justify-center text-[10px]',
                // Сегодня - высший приоритет
                cell.isToday && 'bg-primary/10',
                // Праздники и дополнительные выходные - желтоватый фон
                !cell.isToday && isSpecialDayOff && 'bg-amber-50 dark:bg-amber-950/30',
                // Стандартные выходные (Сб/Вс) - серый фон
                !cell.isToday && isRegularWeekend && 'bg-gray-100 dark:bg-gray-800/50',
                i < dayCells.length - 1 && 'border-r border-border/20'
              )}
              style={{ width: DAY_CELL_WIDTH }}
              title={cell.holidayName || undefined}
            >
              <span
                className={cn(
                  'font-medium',
                  cell.isToday && 'text-primary',
                  !cell.isToday && isSpecialDayOff && 'text-amber-600 dark:text-amber-400',
                  !cell.isToday && isRegularWeekend && 'text-gray-500 dark:text-gray-400'
                )}
              >
                {cell.dayOfMonth}
              </span>
              <span
                className={cn(
                  'uppercase',
                  isSpecialDayOff ? 'text-amber-500 dark:text-amber-500' :
                  isRegularWeekend ? 'text-gray-400 dark:text-gray-500' :
                  'text-muted-foreground'
                )}
              >
                {cell.dayOfWeek}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
