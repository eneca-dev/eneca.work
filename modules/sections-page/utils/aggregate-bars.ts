/**
 * Aggregate Bars — утилиты для агрегации загрузок X/Y
 *
 * X = сумма активных ставок на день
 * Y = плановая ёмкость (задаётся пользователем на уровне ObjectSection)
 */

import { formatMinskDate } from '@/lib/timezone-utils'
import type { SectionLoading, DayCell } from '../types'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'

// ============================================================================
// Types
// ============================================================================

/** Per-day aggregated data: rateSum / capacity */
export interface DailyAggregation {
  /** Sum of active employee rates on this day */
  rateSum: number
  /** Total capacity (user-defined) */
  capacity: number
}

// ============================================================================
// Compute daily aggregation from loadings
// ============================================================================

/** Check if a date string falls within a range */
function isDateInRange(dateStr: string, startDate: string, endDate: string): boolean {
  return dateStr >= startDate && dateStr <= endDate
}

/**
 * Единая точка форматирования для любого числа, показываемого в баре
 * загрузки (ставка ИЛИ ёмкость) — 2.25 → "2.25", 1 → "1", 0.5 → "0.5".
 * Устраняет хвосты float (0.30000000000000004 → "0.3"), которые иначе
 * могли просочиться из сумм/делений при агрегации по отделу/неделе.
 *
 * `decimals` — по умолчанию 2 (проект/раздел, где дробная ставка значима).
 * Строка отдела (bug-AB-10) передаёт 0 — на уровне десятков сотрудников
 * дробная точность не несёт смысла, «48 из 52» читается легче, чем
 * «47.83 из 52.14».
 */
export function formatBarNumber(value: number, decimals: number = 2): string {
  return Number(value.toFixed(decimals)).toString()
}

/**
 * Compute per-day aggregation for a list of loadings + capacity.
 * Supports per-date capacity overrides: each day can have its own capacity.
 * Returns array aligned with dayCells.
 */
export function computeDailyAggregation(
  loadings: SectionLoading[],
  defaultCapacity: number,
  dateCapacityOverrides: Record<string, number>,
  dayCells: DayCell[]
): DailyAggregation[] {
  return dayCells.map((cell) => {
    const dateStr = formatMinskDate(cell.date)
    const capacity = dateCapacityOverrides[dateStr] ?? defaultCapacity

    let rateSum = 0
    for (const loading of loadings) {
      if (isDateInRange(dateStr, loading.startDate, loading.endDate)) {
        rateSum += loading.rate
      }
    }

    return { rateSum, capacity }
  })
}

// ============================================================================
// Compute weekly aggregation from loadings (для недельного режима)
// ============================================================================

/**
 * Per-week aggregated data — те же rateSum/capacity, что и DailyAggregation,
 * но усреднённые по рабочим дням недели (WeekCell.workingDates), чтобы проценты
 * оставались сравнимы с дневным режимом (среднедневная загрузка недели).
 */
export type WeeklyAggregation = DailyAggregation

/**
 * Compute per-week aggregation for a list of loadings + capacity.
 * Суммирует rateSum/capacity ТОЛЬКО по рабочим дням недели (week.workingDates) —
 * выходные и праздники не участвуют ни в сумме, ни в делителе, поэтому среднее
 * не завышается (раньше сумма шла по всем 7 дням, а делилась на workingDays,
 * что задирало результат при ненулевой ёмкости на выходных).
 * Возвращает массив, выровненный по weekCells.
 */
export function computeWeeklyAggregation(
  loadings: SectionLoading[],
  defaultCapacity: number,
  dateCapacityOverrides: Record<string, number>,
  weekCells: WeekCell[]
): WeeklyAggregation[] {
  return weekCells.map((week) => {
    let rateSum = 0
    let capacity = 0
    for (const dateStr of week.workingDates) {
      capacity += dateCapacityOverrides[dateStr] ?? defaultCapacity

      for (const loading of loadings) {
        if (isDateInRange(dateStr, loading.startDate, loading.endDate)) {
          rateSum += loading.rate
        }
      }
    }

    const divisor = week.workingDates.length || 1
    return { rateSum: rateSum / divisor, capacity: capacity / divisor }
  })
}
