'use client'

/**
 * Хук для определения контекста ввода в инлайн-фильтре
 *
 * Определяет, что вводит пользователь:
 * - ключ фильтра (подразделение, проект, ...)
 * - значение для конкретного ключа
 * - ничего (пустой ввод)
 */

import { useMemo } from 'react'
import type { FilterConfig } from '../types'

// ============================================================================
// Типы контекста
// ============================================================================

export type FilterInputContext =
  | { type: 'empty' }
  | { type: 'key'; partial: string }
  | { type: 'value'; key: string; partialValue: string }

// ============================================================================
// Хук
// ============================================================================

export interface UseFilterContextOptions {
  /** Текущее значение строки фильтра */
  value: string
  /** Позиция курсора */
  cursorPosition: number
  /** Конфигурация фильтра */
  config: FilterConfig
}

/**
 * Определяет контекст ввода на основе позиции курсора
 *
 * @example
 * // Курсор после "подразделение:"
 * useFilterContext({ value: 'подразделение:', cursorPosition: 14, config })
 * // { type: 'value', key: 'подразделение', partialValue: '' }
 *
 * @example
 * // Курсор после "прое"
 * useFilterContext({ value: 'прое', cursorPosition: 4, config })
 * // { type: 'key', partial: 'прое' }
 */
export function useFilterContext({
  value,
  cursorPosition,
  config,
}: UseFilterContextOptions): FilterInputContext {
  return useMemo(() => {
    const beforeCursor = value.slice(0, cursorPosition)

    // Ищем ключ с двоеточием (даже без значения) - "ключ:" или "ключ:частичное"
    const keyWithColonMatch = beforeCursor.match(/(\S+):(?:"([^"]*)|(\S*))?$/)
    if (keyWithColonMatch) {
      const key = keyWithColonMatch[1]
      const partialValue = keyWithColonMatch[2] ?? keyWithColonMatch[3] ?? ''
      if (config.keys[key]) {
        return { type: 'value', key, partialValue }
      }
    }

    // Ищем частичный ключ (без двоеточия)
    const partialKey = beforeCursor.match(/(\S+)$/)
    if (partialKey && !partialKey[0].includes(':')) {
      return { type: 'key', partial: partialKey[1] }
    }

    return { type: 'empty' }
  }, [value, cursorPosition, config])
}
