// Cache for date formatting to avoid repeated string operations
const dateFormatCache = new Map<number, string>()

export function getWorkingDaysInRange(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    // Only include weekdays (0 = Sunday, 6 = Saturday)
    // Uncomment this line if you want to exclude weekends
    // if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
    days.push(new Date(currentDate))
    // }

    // Move to the next day
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return days
}

export function formatDate(date: Date): string {
  // Use timestamp as cache key
  const timestamp = date.getTime()

  if (dateFormatCache.has(timestamp)) {
    return dateFormatCache.get(timestamp)!
  }

  const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

  // Cache the result
  dateFormatCache.set(timestamp, formatted)

  return formatted
}

export function formatDateForInput(date: Date): string {
  return formatDate(date)
}

