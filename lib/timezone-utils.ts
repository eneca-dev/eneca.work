/**
 * Утилиты для работы с датами в фиксированном часовом поясе Минск (Europe/Minsk, UTC+3)
 *
 * Все даты в приложении должны интерпретироваться и отображаться в часовом поясе Минска,
 * независимо от часового пояса браузера пользователя.
 */

import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

// Константа часового пояса Минска
const MINSK_TZ = 'Europe/Minsk'

/**
 * Парсит строку даты (YYYY-MM-DD или ISO) как дату в часовом поясе Минска
 *
 * @param dateString - Строка даты в формате "YYYY-MM-DD" или ISO формате
 * @returns Date объект, представляющий полночь указанной даты в Минске
 *
 * @example
 * parseMinskDate("2024-12-22")
 * // → Date, представляющий 22 декабря 2024 00:00 по Минскому времени
 *
 * parseMinskDate("2024-12-22T15:30:00+03:00")
 * // → Date, корректно обработанный с учетом timezone
 */
export function parseMinskDate(dateString: string): Date {
  // Удаляем время если есть, берем только дату
  const dateOnly = dateString.split('T')[0]

  // Добавляем "Z" чтобы строка интерпретировалась как UTC (независимо от браузера)
  // Затем toZonedTime конвертирует UTC → Minsk timezone
  return toZonedTime(`${dateOnly}T00:00:00Z`, MINSK_TZ)
}

/**
 * Форматирует Date объект в строку YYYY-MM-DD в часовом поясе Минска
 *
 * @param date - Date объект для форматирования
 * @returns Строка в формате "YYYY-MM-DD", представляющая дату в Минске
 *
 * @example
 * const date = new Date("2024-12-22T03:00:00Z") // 22 дек 03:00 UTC = 22 дек 06:00 Минск
 * formatMinskDate(date) // → "2024-12-22"
 */
export function formatMinskDate(date: Date): string {
  return formatInTimeZone(date, MINSK_TZ, 'yyyy-MM-dd')
}

/**
 * Получает день недели (0-6) для даты в часовом поясе Минска
 *
 * @param date - Date объект
 * @returns Номер дня недели (0 = воскресенье, 6 = суббота)
 *
 * @example
 * const date = new Date("2024-12-22T00:00:00Z") // Воскресенье в UTC
 * getMinskDayOfWeek(date) // → 0 (воскресенье, если это воскресенье в Минске)
 */
export function getMinskDayOfWeek(date: Date): number {
  // Конвертируем дату в время Минска
  const minskDate = toZonedTime(date, MINSK_TZ)
  return minskDate.getDay()
}

/**
 * Получает текущую дату в часовом поясе Минска (без времени)
 *
 * @returns Date объект (UTC), представляющий сегодняшнюю дату в Минске
 *
 * @example
 * getTodayMinsk() // → Date для сегодняшней даты в Минске
 */
export function getTodayMinsk(): Date {
  const now = new Date()
  const minskDateStr = formatInTimeZone(now, MINSK_TZ, 'yyyy-MM-dd')
  return parseMinskDate(minskDateStr)
}

/**
 * Получает день месяца (1-31) для даты в часовом поясе Минска
 */
export function getMinskDate(date: Date): number {
  const minskDate = toZonedTime(date, MINSK_TZ)
  return minskDate.getDate()
}

/**
 * Получает месяц (0-11) для даты в часовом поясе Минска
 */
export function getMinskMonth(date: Date): number {
  const minskDate = toZonedTime(date, MINSK_TZ)
  return minskDate.getMonth()
}

/**
 * Получает год для даты в часовом поясе Минска
 */
export function getMinskFullYear(date: Date): number {
  const minskDate = toZonedTime(date, MINSK_TZ)
  return minskDate.getFullYear()
}

/**
 * Форматирует дату с произвольным форматом в часовом поясе Минска
 *
 * @example
 * formatMinsk(date, 'dd.MM.yyyy') // → "22.12.2024"
 * formatMinsk(date, 'd MMMM yyyy', { locale: ru }) // → "22 декабря 2024"
 */
export function formatMinsk(date: Date, formatStr: string, options?: { locale?: Locale }): string {
  return formatInTimeZone(date, MINSK_TZ, formatStr, options)
}

/**
 * Экспортируем константу часового пояса для использования в других модулях
 */
export { MINSK_TZ }

// Типы для локали date-fns
type Locale = Parameters<typeof formatInTimeZone>[3] extends { locale?: infer L } ? L : never
