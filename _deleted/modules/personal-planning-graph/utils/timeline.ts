import {
  format,
  differenceInDays,
  parseISO,
  addDays,
  startOfDay,
  getDay,
} from "date-fns"
import { ru } from "date-fns/locale"
import type { TimelineRange } from "../types"

// Timeline config: 2 weeks before + 4 weeks after = 6 weeks total
export const DAYS_BEFORE_TODAY = 14
export const DAYS_AFTER_TODAY = 28
export const DAYS_TO_SHOW = DAYS_BEFORE_TODAY + DAYS_AFTER_TODAY

// Calculate timeline range: 2 weeks before today + 4 weeks after
export function calculateTimelineRange(): TimelineRange {
  const today = startOfDay(new Date())
  const start = addDays(today, -DAYS_BEFORE_TODAY)
  const end = addDays(today, DAYS_AFTER_TODAY - 1)

  return {
    start,
    end,
    totalDays: DAYS_TO_SHOW,
  }
}

// Calculate bar position and width as percentages
export function calculateBarPosition(
  startDate: string | null,
  endDate: string | null,
  range: TimelineRange
): { left: number; width: number } | null {
  if (!startDate || !endDate) return null

  const start = startOfDay(parseISO(startDate))
  const end = startOfDay(parseISO(endDate))

  // Check if bar is within visible range
  if (end < range.start || start > range.end) return null

  // Clamp dates to visible range
  const visibleStart = start < range.start ? range.start : start
  const visibleEnd = end > range.end ? range.end : end

  const dayFromStart = differenceInDays(visibleStart, range.start)
  const duration = differenceInDays(visibleEnd, visibleStart) + 1

  // Return as percentages
  const left = (dayFromStart / range.totalDays) * 100
  const width = (duration / range.totalDays) * 100

  return { left, width }
}

// Check if date is a weekend (Saturday = 6, Sunday = 0)
export function isWeekend(date: Date): boolean {
  const day = getDay(date)
  return day === 0 || day === 6
}

// Snap start date to next weekday (if weekend, move to Monday)
export function snapStartToWeekday(date: Date): Date {
  const day = getDay(date)
  if (day === 0) return addDays(date, 1) // Sunday -> Monday
  if (day === 6) return addDays(date, 2) // Saturday -> Monday
  return date
}

// Snap end date to previous weekday (if weekend, move to Friday)
export function snapEndToWeekday(date: Date): Date {
  const day = getDay(date)
  if (day === 0) return addDays(date, -2) // Sunday -> Friday
  if (day === 6) return addDays(date, -1) // Saturday -> Friday
  return date
}

// Calculate bar position with weekend snapping
export function calculateBarPositionSnapped(
  startDate: string | null,
  endDate: string | null,
  range: TimelineRange
): { left: number; width: number } | null {
  if (!startDate || !endDate) return null

  let start = snapStartToWeekday(startOfDay(parseISO(startDate)))
  let end = snapEndToWeekday(startOfDay(parseISO(endDate)))

  // Ensure end is not before start after snapping
  if (end < start) return null

  // Check if bar is within visible range
  if (end < range.start || start > range.end) return null

  // Clamp dates to visible range
  const visibleStart = start < range.start ? range.start : start
  const visibleEnd = end > range.end ? range.end : end

  const dayFromStart = differenceInDays(visibleStart, range.start)
  const duration = differenceInDays(visibleEnd, visibleStart) + 1

  // Return as percentages
  const left = (dayFromStart / range.totalDays) * 100
  const width = (duration / range.totalDays) * 100

  return { left, width }
}

// Count working days between two dates (excluding weekends)
export function countWorkingDays(startDate: string, endDate: string): number {
  const start = startOfDay(parseISO(startDate))
  const end = startOfDay(parseISO(endDate))
  let count = 0

  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isWeekend(d)) {
      count++
    }
  }

  return count
}

// Calculate milestone position as percentage
export function calculateMilestonePosition(
  date: string,
  range: TimelineRange
): number | null {
  const milestoneDate = startOfDay(parseISO(date))

  // Check if milestone is within visible range
  if (milestoneDate < range.start || milestoneDate > range.end) return null

  const dayFromStart = differenceInDays(milestoneDate, range.start)
  return ((dayFromStart + 0.5) / range.totalDays) * 100 // Center on the day
}

// Day cell interface
export interface DayCell {
  date: Date
  dayOfMonth: number
  dayOfWeek: string
  isWeekend: boolean
  isToday: boolean
  isMonthStart: boolean
  monthName: string
}

// Generate day cells for timeline
export function generateDayCells(range: TimelineRange): DayCell[] {
  const cells: DayCell[] = []
  const today = startOfDay(new Date())

  for (let i = 0; i < range.totalDays; i++) {
    const date = addDays(range.start, i)
    const dayOfWeek = getDay(date)

    cells.push({
      date,
      dayOfMonth: date.getDate(),
      dayOfWeek: format(date, "EEEEEE", { locale: ru }),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isToday: differenceInDays(date, today) === 0,
      isMonthStart: date.getDate() === 1,
      monthName: format(date, "LLLL", { locale: ru }),
    })
  }

  return cells
}
