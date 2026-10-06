import { ru } from 'date-fns/locale'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { formatMinskDate, MINSK_TZ } from '@/lib/timezone-utils'

export type EmploymentBoardDateMode = 'today' | 'dated'

const BOARD_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
}

function getDaysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function boardDateToUtcDate(date: string): Date {
  const match = BOARD_DATE_PATTERN.exec(date)
  if (!match) throw new RangeError(`Некорректная дата доски: ${date}`)

  const result = new Date(0)
  result.setUTCHours(0, 0, 0, 0)
  result.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return result
}

export function isValidEmploymentBoardDate(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const match = BOARD_DATE_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= getDaysInMonth(year, month)
}

export function assertEmploymentBoardDate(value: unknown): asserts value is string {
  if (!isValidEmploymentBoardDate(value)) {
    throw new RangeError(`Некорректная дата доски: ${String(value)}`)
  }
}

export function getCurrentMinskDate(now = new Date()): string {
  return formatMinskDate(now)
}

export function getEmploymentBoardDateMode(
  selectedDate: string,
  currentMinskDate = getCurrentMinskDate(),
): EmploymentBoardDateMode {
  assertEmploymentBoardDate(selectedDate)
  assertEmploymentBoardDate(currentMinskDate)
  return selectedDate === currentMinskDate ? 'today' : 'dated'
}

export function formatEmploymentBoardDateLabel(
  selectedDate: string,
  currentMinskDate = getCurrentMinskDate(),
): string {
  assertEmploymentBoardDate(selectedDate)
  assertEmploymentBoardDate(currentMinskDate)

  if (selectedDate === currentMinskDate) return 'Сегодня'

  const selectedYear = Number(selectedDate.slice(0, 4))
  const currentYear = Number(currentMinskDate.slice(0, 4))
  const format = selectedYear === currentYear ? 'd MMMM' : 'd MMMM yyyy'

  return formatInTimeZone(boardDateToUtcDate(selectedDate), MINSK_TZ, format, { locale: ru })
}

export function getMillisecondsUntilNextMinskDay(now = new Date()): number {
  const currentDate = getCurrentMinskDate(now)
  const nextDate = boardDateToUtcDate(currentDate)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)

  const nextDateKey = [
    String(nextDate.getUTCFullYear()).padStart(4, '0'),
    String(nextDate.getUTCMonth() + 1).padStart(2, '0'),
    String(nextDate.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const nextMidnight = fromZonedTime(`${nextDateKey}T00:00:00`, MINSK_TZ)

  return Math.max(0, nextMidnight.getTime() - now.getTime())
}
