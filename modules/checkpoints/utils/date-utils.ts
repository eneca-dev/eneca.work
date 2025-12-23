/**
 * Форматировать Date в локальный формат YYYY-MM-DD
 * @param date - Date object
 * @returns Строка в формате YYYY-MM-DD
 */
export function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Парсить дату из строки ISO в Date
 * @param dateStr - Строка даты (ISO format или YYYY-MM-DD)
 * @returns Date object или null если не валидна
 */
export function parseDateSafe(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * Проверить, является ли дата в прошлом
 * @param dateStr - Строка даты (ISO format)
 * @returns true если дата в прошлом
 */
export function isPastDate(dateStr: string): boolean {
  const date = parseDateSafe(dateStr)
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

/**
 * Проверить, является ли дата сегодня
 * @param dateStr - Строка даты (ISO format)
 * @returns true если дата сегодня
 */
export function isToday(dateStr: string): boolean {
  const date = parseDateSafe(dateStr)
  if (!date) return false
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}
