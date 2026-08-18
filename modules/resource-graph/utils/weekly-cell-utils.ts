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
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { getTodayMinsk, formatMinskDate } from '@/lib/timezone-utils'
import { buildCalendarMap, getDayInfo } from './index'
import type { CompanyCalendarEvent } from '../types'

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
// Generation
// ============================================================================

/**
 * Генерирует массив WeekCell для заданного диапазона.
 *
 * Окно: [текущая неделя - weeksBefore + offset, + weeksAfter). Недели — Пн-Вс,
 * как и нумерация недель в дневном режиме (TimelineHeader).
 *
 * @param offset - Сдвиг окна в неделях (0 = центрировано на текущую неделю)
 * @param weeksBefore - Недель до текущей
 * @param weeksAfter - Недель после текущей (включая текущую)
 * @param calendarEvents - События компании (праздники, переносы)
 */
export function generateWeekCells(
  offset: number,
  weeksBefore: number,
  weeksAfter: number,
  calendarEvents: CompanyCalendarEvent[] = []
): WeekCell[] {
  const today = getTodayMinsk()
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
  const currentWeekKey = formatMinskDate(currentWeekStart)

  const calendarMap = buildCalendarMap(calendarEvents)
  const cells: WeekCell[] = []

  const firstWeekStart = addWeeks(currentWeekStart, -weeksBefore + offset)
  const totalWeeks = weeksBefore + weeksAfter

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
