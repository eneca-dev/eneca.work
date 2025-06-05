export function getDaysInMonth(year: number, month: number): Date[] {
  const date = new Date(year, month, 1)
  const days: Date[] = []

  // Get days from previous month to fill the first week
  const firstDay = date.getDay()
  const prevMonthDays = firstDay === 0 ? 6 : firstDay - 1 // Adjust for Monday as first day

  if (prevMonthDays > 0) {
    const prevMonth = new Date(year, month, 0)
    const prevMonthLastDay = prevMonth.getDate()

    for (let i = prevMonthDays - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i))
    }
  }

  // Get days from current month
  while (date.getMonth() === month) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }

  // Get days from next month to fill the last week
  const lastDay = days[days.length - 1].getDay()
  const nextMonthDays = lastDay === 0 ? 0 : 7 - lastDay

  for (let i = 1; i <= nextMonthDays; i++) {
    days.push(new Date(year, month + 1, i))
  }

  return days
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear()
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  })
}

export function getMonthDays(date: Date): Date[] {
  return getDaysInMonth(date.getFullYear(), date.getMonth())
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export function getEventColor(eventType: string): string {
  switch (eventType) {
    case "Отгул":
      return "bg-orange-200 text-orange-800"
    case "Больничный":
      return "bg-red-200 text-red-800"
    case "Перенос":
      return "bg-purple-200 text-purple-800"
    case "Отпуск":
      return "bg-blue-200 text-blue-800"
    case "Праздник":
      return "bg-green-200 text-green-800"
    case "Событие":
      return "bg-yellow-200 text-yellow-800"
    default:
      return "bg-gray-200 text-gray-800"
  }
}
