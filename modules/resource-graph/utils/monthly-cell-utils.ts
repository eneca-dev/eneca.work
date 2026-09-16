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
  differenceInCalendarMonths,
  format,
  eachDayOfInterval,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { getTodayMinsk, formatMinskDate, parseMinskDate } from '@/lib/timezone-utils'
import { buildCalendarMap, getDayInfo } from './index'
import type { CompanyCalendarEvent, DayInfo } from '../types'
import { isValidCustomRange, type CustomDateRange } from '../components/timeline/TimelineDatePopover'

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
  /** Даты рабочих дней месяца ("YYYY-MM-DD") — для агрегации X/Y без учёта выходных */
  workingDates: string[]
}

// ============================================================================
// Range resolution
// ============================================================================

export interface MonthlyRange {
  /** Первый месяц окна (1-е число) */
  firstMonthStart: Date
  /** Количество месяцев в окне */
  totalMonths: number
}

interface ResolveMonthlyRangeOptions {
  monthsBefore: number
  monthsAfter: number
}

/**
 * Вычисляет месячное окно таймлайна — аналог resolveWeeklyRange для недельного
 * режима (см. weekly-cell-utils.ts). При наличии валидного customRange окно
 * растягивается по месяцам, полностью покрывающим выбранный диапазон дат
 * (границы snap-ятся к 1-му числу и концу месяца). Иначе — окно из monthsBefore
 * месяцев до текущего и monthsAfter после, центрировано на сегодня.
 */
export function resolveMonthlyRange(
  customRange: CustomDateRange | null | undefined,
  options: ResolveMonthlyRangeOptions
): MonthlyRange {
  if (customRange && isValidCustomRange(customRange)) {
    const firstMonthStart = startOfMonth(parseMinskDate(customRange.startDate))
    const lastMonthStart = startOfMonth(parseMinskDate(customRange.endDate))
    const totalMonths = differenceInCalendarMonths(lastMonthStart, firstMonthStart) + 1
    return { firstMonthStart, totalMonths }
  }
  const today = getTodayMinsk()
  const firstMonthStart = addMonths(startOfMonth(today), -options.monthsBefore)
  const totalMonths = options.monthsBefore + options.monthsAfter
  return { firstMonthStart, totalMonths }
}

// ============================================================================
// Generation
// ============================================================================

/**
 * Генерирует массив MonthCell для заданного окна (см. resolveMonthlyRange).
 *
 * @param range - Окно месяцев (firstMonthStart/totalMonths)
 * @param calendarEvents - События компании (праздники, переносы)
 */
export function generateMonthCellsInRange(
  range: MonthlyRange,
  calendarEvents: CompanyCalendarEvent[] = []
): MonthCell[] {
  const today = getTodayMinsk()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const calendarMap = buildCalendarMap(calendarEvents)
  const cells: MonthCell[] = []

  const { firstMonthStart, totalMonths } = range

  for (let i = 0; i < totalMonths; i++) {
    const monthDate = addMonths(firstMonthStart, i)
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)

    // Подсчёт рабочих дней с учётом календаря компании
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    let workingDays = 0
    const workingDates: string[] = []
    for (const day of days) {
      const info = getDayInfo(day, calendarMap)
      if (info.isWorkday) {
        workingDays++
        workingDates.push(formatMinskDate(day))
      }
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
      workingDates,
    })
  }

  return cells
}

/**
 * Генерирует массив MonthCell для окна, центрированного на сегодня.
 *
 * Окно: [today - monthsBefore + offset, today + monthsAfter + offset)
 * Сдвиг offset смещает всё окно, количество месяцев всегда = monthsBefore + monthsAfter.
 * Используется страницей «Отделы» — обёртка над generateMonthCellsInRange.
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
  const firstMonthStart = addMonths(startOfMonth(getTodayMinsk()), -monthsBefore + offset)
  return generateMonthCellsInRange(
    { firstMonthStart, totalMonths: monthsBefore + monthsAfter },
    calendarEvents
  )
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
