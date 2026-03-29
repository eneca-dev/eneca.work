'use client'

import { useMemo } from 'react'
import { format, getDay, getWeek, addDays, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DAY_CELL_WIDTH } from '../../constants'
import type { TimelineRange, CompanyCalendarEvent, DayInfo } from '../../types'
import { buildCalendarMap, getDayInfo } from '../../utils'
import { formatMinskDate, getMinskDayOfWeek, getMinskDate, getTodayMinsk, parseMinskDate } from '@/lib/timezone-utils'
import { TimelineDatePopover, type CustomDateRange } from './TimelineDatePopover'

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
  monthIndex: number
}

interface CalculateTimelineRangeOptions {
  daysBefore: number
  daysAfter: number
}

/**
 * Вычисляет диапазон дат таймлайна.
 * При наличии customRange — использует его, иначе — daysBefore/daysAfter от сегодня.
 */
export function resolveTimelineRange(
  customRange: CustomDateRange | null | undefined,
  options: CalculateTimelineRangeOptions
): TimelineRange {
  if (customRange) {
    const start = parseMinskDate(customRange.startDate)
    const end = parseMinskDate(customRange.endDate)
    const totalDays = differenceInDays(end, start) + 1
    return { start, end, totalDays }
  }
  const today = getTodayMinsk()
  const start = addDays(today, -options.daysBefore)
  const end = addDays(today, options.daysAfter - 1)
  const totalDays = options.daysBefore + options.daysAfter
  return { start, end, totalDays }
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
  // Используем сегодняшнюю дату в часовом поясе Минска
  const todayKey = formatMinskDate(getTodayMinsk())

  // Build calendar map for fast lookup
  const calendarMap = buildCalendarMap(calendarEvents)

  let monthIdx = -1
  let prevMonth = -1

  for (let i = 0; i < range.totalDays; i++) {
    const date = addDays(range.start, i)
    // Используем день недели в часовом поясе Минска
    const dayOfWeek = getMinskDayOfWeek(date)
    const isDefaultWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Get calendar info for this day
    const dayInfo = getDayInfo(date, calendarMap)

    // Используем день месяца в часовом поясе Минска
    const dayOfMonth = getMinskDate(date)
    const dateKey = formatMinskDate(date)

    // Track month changes for alternating colors
    const month = date.getMonth()
    if (month !== prevMonth) {
      prevMonth = month
      monthIdx++
    }

    cells.push({
      date,
      dayOfMonth,
      dayOfWeek: format(date, 'EEEEEE', { locale: ru }),
      isWeekend: isDefaultWeekend,
      isToday: dateKey === todayKey,
      isMonthStart: dayOfMonth === 1,
      monthName: format(date, 'LLLL yyyy', { locale: ru }),
      // Calendar info
      isHoliday: dayInfo.isHoliday,
      holidayName: dayInfo.holidayName,
      isWorkday: dayInfo.isWorkday,
      isTransferredWorkday: dayInfo.isTransferredWorkday,
      isTransferredDayOff: dayInfo.isTransferredDayOff,
      monthIndex: monthIdx,
    })
  }

  return cells
}

interface TimelineDatePopoverConfig {
  customRange: CustomDateRange | null
  onRangeChange: (range: CustomDateRange | null) => void
  onScrollToToday: () => void
  defaultDaysBefore: number
  defaultDaysAfter: number
}

interface TimelineHeaderProps {
  dayCells: DayCell[]
  /** Simple scroll-to-today button (legacy) */
  onScrollToToday?: () => void
  /** Full date range popover config (replaces onScrollToToday when provided) */
  datePopoverConfig?: TimelineDatePopoverConfig
}

/**
 * Заголовок timeline с неделями и днями
 */
export function TimelineHeader({ dayCells, onScrollToToday, datePopoverConfig }: TimelineHeaderProps) {
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

  // Группировка по месяцам (используем monthIndex вместо format() для производительности)
  const months = useMemo(() => {
    const result: { name: string; daysCount: number }[] = []
    let prevIndex = -1

    dayCells.forEach((cell) => {
      if (cell.monthIndex !== prevIndex) {
        prevIndex = cell.monthIndex
        result.push({ name: cell.monthName, daysCount: 1 })
      } else {
        result[result.length - 1].daysCount++
      }
    })

    return result
  }, [dayCells])

  // Позиции месяцев для фоновых полос чередования
  const monthSpans = useMemo(() => {
    let left = 0
    return months.map((month, i) => {
      const span = { left, width: month.daysCount * DAY_CELL_WIDTH, isOdd: i % 2 === 1 }
      left += span.width
      return span
    })
  }, [months])

  // Фоновые полосы чередования месяцев (переиспользуется в 3 строках header)
  const monthAlternationBg = useMemo(() => (
    <>
      {monthSpans.map((span, i) => span.isOdd ? (
        <div
          key={`month-bg-${i}`}
          className="absolute top-0 bottom-0 bg-black/[0.03] dark:bg-white/[0.035] pointer-events-none"
          style={{ left: span.left, width: span.width }}
        />
      ) : null)}
      {monthSpans.slice(1).map((span, i) => (
        <div
          key={`month-border-${i}`}
          className="absolute top-0 bottom-0 w-px bg-border/50 pointer-events-none"
          style={{ left: span.left }}
        />
      ))}
    </>
  ), [monthSpans])

  // Общая ширина timeline
  const totalWidth = dayCells.length * DAY_CELL_WIDTH

  // Минимальная ширина для отображения текста
  const MIN_DAYS_FOR_MONTH_NAME = 4  // ~144px
  const MIN_DAYS_FOR_WEEK_NAME = 3   // ~108px

  return (
    <div className="flex flex-col bg-card border-b border-border" style={{ width: totalWidth }}>
      {/* Месяцы */}
      <div className="flex h-7 border-b border-border/50 relative">
        {monthAlternationBg}
        {months.map((month, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-xs font-medium text-muted-foreground capitalize overflow-hidden relative z-[1]"
            style={{ width: month.daysCount * DAY_CELL_WIDTH }}
          >
            {month.daysCount >= MIN_DAYS_FOR_MONTH_NAME && month.name}
          </div>
        ))}
        {/* Кнопка настройки дат / перехода к сегодня */}
        {(datePopoverConfig || onScrollToToday) && (
          <div className="sticky right-0 ml-auto flex items-center pr-2 bg-card z-10 border-l border-border/50">
            {datePopoverConfig ? (
              <TimelineDatePopover {...datePopoverConfig} />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onScrollToToday}
                title="Перейти к сегодняшней дате"
              >
                <Calendar className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Недели */}
      <div className="flex h-5 border-b border-border/50 relative">
        {monthAlternationBg}
        {weeks.map((week, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center justify-center text-[10px] text-muted-foreground overflow-hidden relative z-[1]',
              i < weeks.length - 1 && 'border-r border-border/30'
            )}
            style={{ width: week.daysCount * DAY_CELL_WIDTH }}
          >
            {week.daysCount >= MIN_DAYS_FOR_WEEK_NAME && `Нед. ${week.weekNum}`}
          </div>
        ))}
      </div>

      {/* Дни */}
      <div className="flex h-10 relative">
        {monthAlternationBg}
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
                'flex flex-col items-center justify-center text-[10px] relative z-[1]',
                // Сегодня - высший приоритет
                cell.isToday && 'bg-green-50 dark:bg-green-700/40',
                // Праздники и дополнительные выходные - желтоватый фон (сохраняем amber акцент)
                !cell.isToday && isSpecialDayOff && 'bg-amber-500/10 dark:bg-amber-500/10',
                // Стандартные выходные (Сб/Вс) - нейтральный серый фон
                !cell.isToday && isRegularWeekend && 'bg-muted/50 dark:bg-muted/30',
                i < dayCells.length - 1 && 'border-r border-border/20'
              )}
              style={{ width: DAY_CELL_WIDTH }}
              title={cell.holidayName || undefined}
            >
              <span
                className={cn(
                  'font-medium',
                  cell.isToday && 'text-primary',
                  !cell.isToday && isSpecialDayOff && 'text-amber-500 dark:text-amber-400',
                  !cell.isToday && isRegularWeekend && 'text-muted-foreground/70'
                )}
              >
                {cell.dayOfMonth}
              </span>
              <span
                className={cn(
                  'uppercase',
                  isSpecialDayOff ? 'text-amber-500 dark:text-amber-400' :
                  isRegularWeekend ? 'text-muted-foreground/50' :
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
