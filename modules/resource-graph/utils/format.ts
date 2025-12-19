/**
 * Resource Graph - Format Utilities
 *
 * Утилиты форматирования для отображения данных в Timeline
 */

import { format, parseISO } from 'date-fns'

// ============================================================================
// Hours Formatting
// ============================================================================

/**
 * Компактный формат часов (10ч, 10.5ч)
 *
 * @example
 * formatHoursCompact(10) // "10ч"
 * formatHoursCompact(10.5) // "10.5ч"
 */
export function formatHoursCompact(hours: number): string {
  if (hours % 1 === 0) return `${hours}ч`
  return `${hours.toFixed(1)}ч`
}

// ============================================================================
// Budget Formatting
// ============================================================================

/**
 * Компактный формат суммы бюджета (1.2M ₽, 123K ₽)
 *
 * @example
 * formatBudgetAmount(1234567) // "1.2M ₽"
 * formatBudgetAmount(123456) // "123K ₽"
 * formatBudgetAmount(999) // "999 ₽"
 */
export function formatBudgetAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M ₽`
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K ₽`
  }
  return `${Math.round(amount)} ₽`
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Форматирование даты в короткий формат (ДД.ММ)
 *
 * @example
 * formatDateShort('2024-01-15') // "15.01"
 * formatDateShort(null) // "—"
 */
export function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd.MM')
  } catch {
    return '—'
  }
}

/**
 * Форматирование даты в полный формат (ДД.ММ.ГГГГ)
 *
 * @example
 * formatDateFull('2024-01-15') // "15.01.2024"
 * formatDateFull(null) // "—"
 */
export function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy')
  } catch {
    return '—'
  }
}

// ============================================================================
// Rate/Percentage Formatting
// ============================================================================

/**
 * Форматирование ставки загрузки
 *
 * @example
 * formatRate(1) // "100%"
 * formatRate(0.5) // "50%"
 */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

// ============================================================================
// Name Formatting
// ============================================================================

/**
 * Получение инициалов из имени и фамилии
 *
 * @example
 * getInitials('Иван', 'Петров') // "ИП"
 * getInitials(null, 'Петров') // "П"
 * getInitials(null, null) // "?"
 */
export function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.charAt(0)?.toUpperCase() || ''
  const last = lastName?.charAt(0)?.toUpperCase() || ''
  return first + last || '?'
}

// ============================================================================
// Progress Color
// ============================================================================

/**
 * Цвет прогресса на основе значения (0-100)
 *
 * @example
 * getProgressColor(85) // "#22c55e" (green)
 * getProgressColor(60) // "#f59e0b" (amber)
 * getProgressColor(30) // "#f97316" (orange)
 * getProgressColor(10) // "#ef4444" (red)
 */
export function getProgressColor(progress: number): string {
  if (progress >= 80) return '#22c55e' // green
  if (progress >= 50) return '#f59e0b' // amber
  if (progress >= 20) return '#f97316' // orange
  return '#ef4444' // red
}
