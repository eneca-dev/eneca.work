import { eachDayOfInterval, isWeekend, parseISO, isSameDay } from "date-fns"
import type { CalendarEvent } from "@/modules/calendar/types"

/**
 * Calculate the number of working days in a date range, excluding:
 * - Weekends (Saturday, Sunday)
 * - Public holidays (Праздник events)
 * - Accounting for transferred days (Перенос events)
 *
 * @param startDate - Start date in YYYY-MM-DD format or Date object
 * @param endDate - End date in YYYY-MM-DD format or Date object
 * @param calendarEvents - Array of global calendar events
 * @returns Number of working days in the range (inclusive)
 */
export function calculateWorkingDays(
  startDate: string | Date,
  endDate: string | Date,
  calendarEvents: CalendarEvent[] = []
): number {
  // Parse dates
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate

  // Validate dates
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0
  }

  if (start > end) {
    return 0
  }

  // Filter only global events (Праздник and Перенос)
  const globalEvents = calendarEvents.filter(
    (event) =>
      event.calendar_event_is_global &&
      (event.calendar_event_type === "Праздник" || event.calendar_event_type === "Перенос")
  )

  // Get all days in the range (inclusive)
  const allDays = eachDayOfInterval({ start, end })

  // Count working days
  let workingDaysCount = 0

  for (const day of allDays) {
    if (isWorkingDay(day, globalEvents)) {
      workingDaysCount++
    }
  }

  return workingDaysCount
}

/**
 * Check if a specific date is a working day
 *
 * Priority order:
 * 1. Перенос events (calendar_event_is_weekday determines if working/non-working)
 * 2. Праздник events (always non-working)
 * 3. Default weekend check (Saturday/Sunday are non-working)
 *
 * @param date - Date to check
 * @param globalEvents - Array of global calendar events
 * @returns true if the date is a working day, false otherwise
 */
function isWorkingDay(date: Date, globalEvents: CalendarEvent[]): boolean {
  // Find events for this specific date
  const eventsForDate = globalEvents.filter((event) => {
    const eventDate = parseISO(event.calendar_event_date_start)
    return isSameDay(date, eventDate)
  })

  // Priority 1: Check for "Перенос" events first
  const transferEvent = eventsForDate.find((event) => event.calendar_event_type === "Перенос")
  if (transferEvent && transferEvent.calendar_event_is_weekday !== null) {
    // If calendar_event_is_weekday is true, this day becomes a working day
    // If calendar_event_is_weekday is false, this day becomes a non-working day (holiday)
    return transferEvent.calendar_event_is_weekday
  }

  // Priority 2: Check for "Праздник" events
  const holidayEvent = eventsForDate.find((event) => event.calendar_event_type === "Праздник")
  if (holidayEvent) {
    return false // Holidays are non-working days
  }

  // Priority 3: Default check - weekends are non-working days
  return !isWeekend(date)
}
