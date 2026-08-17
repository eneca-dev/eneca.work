/**
 * Утилиты для редактирования ёмкости (capacity) разделов
 */

import { eachDayOfInterval } from 'date-fns'
import { parseMinskDate, formatMinskDate } from '@/lib/timezone-utils'

/** Разворачивает диапазон дат в список строк "YYYY-MM-DD" (включительно) */
export function expandDateRange(startDate: string, endDate: string): string[] {
  return eachDayOfInterval({
    start: parseMinskDate(startDate),
    end: parseMinskDate(endDate),
  }).map(formatMinskDate)
}
