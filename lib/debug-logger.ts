/**
 * Debug Logger
 *
 * Логгер для отладки с поддержкой включения/выключения через переменную окружения.
 * Использует NEXT_PUBLIC_DEBUG_MODE для определения режима.
 *
 * @example
 * ```ts
 * import { debugLog, debugGroup, debugTable } from '@/lib/debug-logger'
 *
 * debugLog.info('filter-permissions', 'Loading context', { userId: '123' })
 * debugLog.warn('filter-permissions', 'No permissions found')
 * debugLog.error('filter-permissions', 'Failed to load', error)
 *
 * debugGroup('Filter Resolution', () => {
 *   debugLog.info('scope', 'Resolving scope', data)
 * })
 *
 * debugTable('Permissions', permissionsArray)
 * ```
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  data?: unknown
}

// Глобальное хранилище логов для debug панели
const logHistory: LogEntry[] = []
const MAX_LOG_HISTORY = 100

/**
 * Проверяет, включён ли debug режим
 */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    // Server-side
    return process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'
  }
  // Client-side - также проверяем localStorage для runtime переключения
  const envEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'
  const localStorageEnabled = localStorage.getItem('debug_mode') === 'true'
  return envEnabled || localStorageEnabled
}

/**
 * Включает/выключает debug режим в runtime
 */
export function setDebugEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    if (enabled) {
      localStorage.setItem('debug_mode', 'true')
    } else {
      localStorage.removeItem('debug_mode')
    }
  }
}

/**
 * Получить историю логов
 */
export function getLogHistory(): LogEntry[] {
  return [...logHistory]
}

/**
 * Очистить историю логов
 */
export function clearLogHistory(): void {
  logHistory.length = 0
}

// Цвета для разных модулей
const moduleColors: Record<string, string> = {
  'filter-permissions': '#1e7260',
  'scope-resolver': '#7c3aed',
  'mandatory-filters': '#ea580c',
  'debug-panel': '#0891b2',
  rls: '#dc2626',
  auth: '#2563eb',
  cache: '#16a34a',
}

function getModuleColor(module: string): string {
  return moduleColors[module] || '#6b7280'
}

function formatTimestamp(): string {
  return new Date().toISOString().split('T')[1].split('.')[0]
}

function addToHistory(entry: LogEntry): void {
  logHistory.push(entry)
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift()
  }
  // Emit event for debug panel
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('debug-log', { detail: entry }))
  }
}

/**
 * Основной объект логгера
 */
export const debugLog = {
  info(module: string, message: string, data?: unknown): void {
    if (!isDebugEnabled()) return
    const timestamp = formatTimestamp()
    const color = getModuleColor(module)

    console.log(
      `%c[${timestamp}] %c[${module}] %c${message}`,
      'color: #6b7280',
      `color: ${color}; font-weight: bold`,
      'color: inherit',
      data !== undefined ? data : ''
    )

    addToHistory({ timestamp, level: 'info', module, message, data })
  },

  warn(module: string, message: string, data?: unknown): void {
    if (!isDebugEnabled()) return
    const timestamp = formatTimestamp()
    const color = getModuleColor(module)

    console.warn(
      `%c[${timestamp}] %c[${module}] %c${message}`,
      'color: #6b7280',
      `color: ${color}; font-weight: bold`,
      'color: #f59e0b',
      data !== undefined ? data : ''
    )

    addToHistory({ timestamp, level: 'warn', module, message, data })
  },

  error(module: string, message: string, data?: unknown): void {
    if (!isDebugEnabled()) return
    const timestamp = formatTimestamp()
    const color = getModuleColor(module)

    console.error(
      `%c[${timestamp}] %c[${module}] %c${message}`,
      'color: #6b7280',
      `color: ${color}; font-weight: bold`,
      'color: #ef4444',
      data !== undefined ? data : ''
    )

    addToHistory({ timestamp, level: 'error', module, message, data })
  },

  debug(module: string, message: string, data?: unknown): void {
    if (!isDebugEnabled()) return
    const timestamp = formatTimestamp()
    const color = getModuleColor(module)

    console.debug(
      `%c[${timestamp}] %c[${module}] %c${message}`,
      'color: #6b7280',
      `color: ${color}; font-weight: bold`,
      'color: #9ca3af',
      data !== undefined ? data : ''
    )

    addToHistory({ timestamp, level: 'debug', module, message, data })
  },
}

/**
 * Группировка логов
 */
export function debugGroup(label: string, fn: () => void): void {
  if (!isDebugEnabled()) {
    fn()
    return
  }
  console.group(`%c${label}`, 'color: #1e7260; font-weight: bold')
  fn()
  console.groupEnd()
}

/**
 * Вывод данных в виде таблицы
 */
export function debugTable(label: string, data: unknown[]): void {
  if (!isDebugEnabled()) return
  console.log(`%c${label}:`, 'color: #1e7260; font-weight: bold')
  console.table(data)
}

/**
 * Измерение времени выполнения
 */
export function debugTime(label: string): () => void {
  if (!isDebugEnabled()) return () => {}

  const start = performance.now()
  debugLog.debug('timing', `⏱️ Start: ${label}`)

  return () => {
    const duration = performance.now() - start
    debugLog.debug('timing', `⏱️ End: ${label}`, `${duration.toFixed(2)}ms`)
  }
}
