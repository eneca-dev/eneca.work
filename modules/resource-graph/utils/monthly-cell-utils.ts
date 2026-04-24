/**
 * Monthly Cell Utilities
 *
 * Утилиты для генерации месячных ячеек и расчёта загрузок по месяцам.
 * Используются в режиме "Месяц" на вкладках Отделы и Разделы.
 */

import {
  startOfMonth,
  endOfMonth,
  addMonths,
  format,
  eachDayOfInterval,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { getTodayMinsk, formatMinskDate } from '@/lib/timezone-utils'
import { buildCalendarMap, getDayInfo } from './index'
import type { CompanyCalendarEvent, DayInfo } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface MonthCell {
  /** Год */
  year: number
  /** Месяц (0-11) */
  month: number
  /** Полное название: "Апрель 2026" */
  label: string
  /** Короткое название: "Апр" */
  shortLabel: string
  /** Первый день месяца: "2026-04-01" */
  startDate: string
  /** Последний день месяца: "2026-04-30" */
  endDate: string
  /** Является ли текущим месяцем */
  isCurrentMonth: boolean
  /** Количество рабочих дней (с учётом праздников и переносов) */
  workingDays: number
}

// ============================================================================
// Generation
// ============================================================================

/**
 * Генерирует массив MonthCell для заданного диапазона
 *
 * Окно: [today - monthsBefore + offset, today + monthsAfter + offset)
 * Сдвиг offset смещает всё окно, количество месяцев всегда = monthsBefore + monthsAfter.
 *
 * @param offset - Сдвиг окна в месяцах (0 = центрировано на сегодня)
 * @param monthsBefore - Месяцев до текущего (по умолчанию)
 * @param monthsAfter - Месяцев после текущего включая текущий
 * @param calendarEvents - События компании (праздники, переносы)
 */
export function generateMonthCells(
  offset: number,
  monthsBefore: number,
  monthsAfter: number,
  calendarEvents: CompanyCalendarEvent[] = []
): MonthCell[] {
  const today = getTodayMinsk()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const calendarMap = buildCalendarMap(calendarEvents)
  const cells: MonthCell[] = []

  const startMonth = addMonths(startOfMonth(today), -monthsBefore + offset)
  const totalMonths = monthsBefore + monthsAfter

  for (let i = 0; i < totalMonths; i++) {
    const monthDate = addMonths(startMonth, i)
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)

    // Подсчёт рабочих дней с учётом календаря компании
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    let workingDays = 0
    for (const day of days) {
      const info = getDayInfo(day, calendarMap)
      if (info.isWorkday) workingDays++
    }

    cells.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: format(monthDate, 'LLLL yyyy', { locale: ru }),
      shortLabel: format(monthDate, 'LLL', { locale: ru }),
      startDate: formatMinskDate(monthStart),
      endDate: formatMinskDate(monthEnd),
      isCurrentMonth:
        monthDate.getMonth() === currentMonth &&
        monthDate.getFullYear() === currentYear,
      workingDays,
    })
  }

  return cells
}

// ============================================================================
// Loading Filtering
// ============================================================================

/**
 * Проверяет, пересекается ли период загрузки с месяцем
 */
function overlapsMonth(
  loadingStart: string,
  loadingEnd: string,
  monthStart: string,
  monthEnd: string
): boolean {
  return loadingStart <= monthEnd && loadingEnd >= monthStart
}

/**
 * Фильтрует загрузки, пересекающиеся с данным месяцем
 *
 * @param loadings - Массив загрузок с полями startDate/endDate
 * @param monthCell - Ячейка месяца
 * @returns Отфильтрованные загрузки
 */
export function getLoadingsForMonth<
  T extends { startDate: string; endDate: string }
>(loadings: T[], monthCell: MonthCell): T[] {
  return loadings.filter((l) =>
    overlapsMonth(l.startDate, l.endDate, monthCell.startDate, monthCell.endDate)
  )
}

/**
 * Средняя дневная нагрузка за месяц.
 *
 * Формула: Σ dailyWorkloads[день] / workingDays
 *
 * Число сравнимо с дневным режимом:
 * - "1.0" значит то же что "1.0" на конкретном дне
 * - Суммы по командам сходятся с отделом (один делитель — workingDays)
 *
 * @param dailyWorkloads - Map дата→суммарная загрузка (из department/team)
 * @param monthCell - Ячейка месяца
 * @returns Средняя дневная нагрузка
 */
export function aggregateMonthlyWorkload(
  dailyWorkloads: Record<string, number> | undefined,
  monthCell: MonthCell,
  calendarMap?: Map<string, Partial<DayInfo>>
): number {
  if (!dailyWorkloads) return 0

  const days = eachDayOfInterval({
    start: new Date(monthCell.startDate),
    end: new Date(monthCell.endDate),
  })

  let total = 0
  for (const day of days) {
    // Пропускаем выходные и праздники — как в дневном режиме
    const dayInfo = getDayInfo(day, calendarMap ?? new Map())
    if (!dayInfo.isWorkday) continue

    const key = formatMinskDate(day)
    const workload = dailyWorkloads[key]
    if (workload !== undefined && workload > 0) {
      total += workload
    }
  }

  if (monthCell.workingDays === 0) return 0
  return total / monthCell.workingDays
}

/**
 * Считает суммарную ставку загрузок за месяц
 *
 * @param loadings - Массив загрузок
 * @param monthCell - Ячейка месяца
 * @returns Суммарная ставка (может быть > 1.0 при перегрузке)
 */
export function calculateMonthlyTotalRate<
  T extends { startDate: string; endDate: string; rate: number }
>(loadings: T[], monthCell: MonthCell): number {
  const monthLoadings = getLoadingsForMonth(loadings, monthCell)
  return monthLoadings.reduce((sum, l) => sum + l.rate, 0)
}
