/**
 * Aggregate Bars — утилиты для агрегации загрузок X/Y
 *
 * X = сумма активных ставок на день
 * Y = плановая ёмкость (задаётся пользователем на уровне ObjectSection)
 */

import { formatMinskDate } from '@/lib/timezone-utils'
import type { SectionLoading, DayCell } from '../types'

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
