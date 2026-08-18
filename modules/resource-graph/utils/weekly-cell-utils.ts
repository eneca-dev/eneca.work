/**
 * Weekly Cell Utilities
 *
 * Утилиты для генерации недельных ячеек. Используются в режиме "Неделя"
 * на странице «Разделы» (по образцу monthly-cell-utils.ts).
 */

import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
  eachDayOfInterval,
  getWeek,
  differenceInDays,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { getTodayMinsk, formatMinskDate, parseMinskDate } from '@/lib/timezone-utils'
import { buildCalendarMap, getDayInfo } from './index'
import type { CompanyCalendarEvent } from '../types'
import { isValidCustomRange, type CustomDateRange } from '../components/timeline/TimelineDatePopover'

// ============================================================================
// Types
// ============================================================================

export interface WeekCell {
  /** Номер недели (Пн-старт, как в дневном режиме — getWeek({ weekStartsOn: 1 })) */
  weekNumber: number
  /** Полное название: "10–16 авг" (или "28 июл – 3 авг" на стыке месяцев) */
  label: string
  /** Короткое название: "Нед. 33" */
  shortLabel: string
  /** Первый день недели, понедельник: "2026-08-10" */
  startDate: string
  /** Последний день недели, воскресенье: "2026-08-16" */
  endDate: string
  /** Является ли текущей неделей */
  isCurrentWeek: boolean
  /** Количество рабочих дней (с учётом праздников и переносов) */
  workingDays: number
  /** Даты рабочих дней недели ("YYYY-MM-DD") — для агрегации X/Y без учёта выходных */
  workingDates: string[]
  /** Праздничные даты внутри недели — для информационных маркеров в шапке */
  holidayDates: string[]
  /** Индекс месяца (по дате начала недели) — для группировки шапки и чередования цвета */
  monthIndex: number
  /** Название месяца недели, с заглавной буквы: "Август 2026" */
  monthName: string
}

// ============================================================================
// Range resolution
// ============================================================================

export interface WeeklyRange {
  /** Первый день окна, понедельник */
  firstWeekStart: Date
  /** Количество недель в окне */
  totalWeeks: number
}

interface ResolveWeeklyRangeOptions {
  weeksBefore: number
  weeksAfter: number
}

/**
 * Вычисляет недельное окно таймлайна — аналог resolveTimelineRange для дневного
 * режима (см. TimelineHeader.tsx). При наличии валидного customRange окно
 * растягивается по неделям, полностью покрывающим выбранный диапазон дат
 * (начало/конец snap-ятся к границам недели, Пн-старт). Иначе — окно из
 * weeksBefore недель до текущей + weeksAfter после, центрировано на сегодня.
 */
export function resolveWeeklyRange(
  customRange: CustomDateRange | null | undefined,
  options: ResolveWeeklyRangeOptions
): WeeklyRange {
  if (customRange && isValidCustomRange(customRange)) {
    const start = parseMinskDate(customRange.startDate)
    const end = parseMinskDate(customRange.endDate)
    const firstWeekStart = startOfWeek(start, { weekStartsOn: 1 })
    const lastWeekStart = startOfWeek(end, { weekStartsOn: 1 })
    const totalWeeks = differenceInDays(lastWeekStart, firstWeekStart) / 7 + 1
    return { firstWeekStart, totalWeeks }
  }
  const today = getTodayMinsk()
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
  const firstWeekStart = addWeeks(currentWeekStart, -options.weeksBefore)
  const totalWeeks = options.weeksBefore + options.weeksAfter
  return { firstWeekStart, totalWeeks }
}

// ============================================================================
// Generation
// ============================================================================

/**
 * Генерирует массив WeekCell для заданного окна (см. resolveWeeklyRange).
 * Недели — Пн-Вс, как и нумерация недель в дневном режиме (TimelineHeader).
 *
 * @param range - Окно недель (firstWeekStart/totalWeeks), см. resolveWeeklyRange
 * @param calendarEvents - События компании (праздники, переносы)
 */
export function generateWeekCells(
  range: WeeklyRange,
  calendarEvents: CompanyCalendarEvent[] = []
): WeekCell[] {
  const today = getTodayMinsk()
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
  const currentWeekKey = formatMinskDate(currentWeekStart)

  const calendarMap = buildCalendarMap(calendarEvents)
  const cells: WeekCell[] = []

  const { firstWeekStart, totalWeeks } = range

  let monthIdx = -1
  let prevMonth = -1

  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addWeeks(firstWeekStart, i)
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

    let workingDays = 0
    const workingDates: string[] = []
    const holidayDates: string[] = []
    for (const day of days) {
      const info = getDayInfo(day, calendarMap)
      if (info.isWorkday) {
        workingDays++
        workingDates.push(formatMinskDate(day))
      }
      if (info.isHoliday) holidayDates.push(formatMinskDate(day))
    }

    const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
    const label = sameMonth
      ? `${format(weekStart, 'd')}–${format(weekEnd, 'd MMM', { locale: ru })}`
      : `${format(weekStart, 'd MMM', { locale: ru })} – ${format(weekEnd, 'd MMM', { locale: ru })}`

    const month = weekStart.getMonth()
    if (month !== prevMonth) {
      prevMonth = month
      monthIdx++
    }

    cells.push({
      weekNumber: getWeek(weekStart, { weekStartsOn: 1, locale: ru }),
      label,
      shortLabel: `Нед. ${getWeek(weekStart, { weekStartsOn: 1, locale: ru })}`,
      startDate: formatMinskDate(weekStart),
      endDate: formatMinskDate(weekEnd),
      isCurrentWeek: formatMinskDate(weekStart) === currentWeekKey,
      workingDays,
      workingDates,
      holidayDates,
      monthIndex: monthIdx,
      monthName: format(weekStart, 'LLLL yyyy', { locale: ru }),
    })
  }

  return cells
}
