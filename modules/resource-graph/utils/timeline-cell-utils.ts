/**
 * Timeline Cell Utilities
 *
 * Shared utilities for converting DayCells to TimelineUnits and working with colors/ranges.
 * Used by departments-timeline and sections-page EmployeeRow components.
 */

import { formatMinskDate } from '@/lib/timezone-utils'
import type { DayCell } from '../components/timeline/TimelineHeader'
import type { TimelineUnit } from '@/types/planning'
import type { TimelineRange } from '../types'
import { DAY_CELL_WIDTH } from '../constants'

/**
 * Converts DayCell array to TimelineUnit array for compatibility with loading-bars-utils
 */
export function dayCellsToTimelineUnits(dayCells: DayCell[]): TimelineUnit[] {
  return dayCells.map((cell, index) => ({
    date: cell.date,
    label: cell.dayOfMonth.toString(),
    dateKey: formatMinskDate(cell.date),
    dayOfMonth: cell.dayOfMonth,
    dayOfWeek: cell.dayOfWeek,
    isWeekend: cell.isWeekend,
    isWorkingDay: cell.isWorkday,
    isHoliday: cell.isHoliday,
    holidayName: cell.holidayName || undefined,
    isToday: cell.isToday,
    isMonthStart: cell.isMonthStart,
    monthName: cell.monthName,
    left: index * DAY_CELL_WIDTH,
    width: DAY_CELL_WIDTH,
  }))
}

/**
 * Converts any CSS color string (hex, rgb, rgba) to rgba with given alpha.
 * Handles rgba prefix explicitly to correctly replace existing alpha values.
 */
export function hexToRgba(color: string, alpha: number): string {
  if (color.startsWith('rgba')) {
    const match = color.match(/[\d.]+/g)
    if (match && match.length >= 3) {
      return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`
    }
  }
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g)
    if (match && match.length >= 3) {
      return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`
    }
  }
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Calculates TimelineRange from DayCell array
 */
export function calculateTimelineRange(dayCells: DayCell[]): TimelineRange {
  if (dayCells.length === 0) {
    const today = new Date()
    return { start: today, end: today, totalDays: 0 }
  }
  return {
    start: dayCells[0].date,
    end: dayCells[dayCells.length - 1].date,
    totalDays: dayCells.length,
  }
}
