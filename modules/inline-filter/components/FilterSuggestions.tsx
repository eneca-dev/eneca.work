'use client'

/**
 * Компонент выпадающего списка подсказок для InlineFilter
 *
 * Включает полную поддержку A11y:
 * - role="listbox" для списка
 * - role="option" для каждой подсказки
 * - aria-selected для выбранного элемента
 * - aria-activedescendant для keyboard navigation
 *
 * Для ключевых подсказок есть toggle-кнопка «исключить» (⊘) справа.
 * При нажатии вставляется исключающий фильтр: -ключ:
 */

import * as React from 'react'
import { Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterConfig, FilterKeyColor } from '../types'

// ============================================================================
// Константы
// ============================================================================

/** Маппинг цветов на Tailwind классы */
export const COLOR_MAP: Record<FilterKeyColor, string> = {
  violet: 'text-violet-400',
  blue: 'text-blue-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
  rose: 'text-rose-400',
  cyan: 'text-cyan-400',
  gray: 'text-gray-400',
}

export const DEFAULT_COLOR = 'text-gray-400'

// ============================================================================
// Типы
// ============================================================================

export interface FilterSuggestion {
  type: 'key' | 'value'
  label: string
  insertText: string
  key?: string
  negated?: boolean
}

export interface FilterSuggestionsProps {
  /** Список подсказок */
  suggestions: FilterSuggestion[]
  /** Индекс выбранной подсказки */
  selectedIndex: number
  /** Конфигурация фильтра (для иконок и цветов) */
  config: FilterConfig
  /** Callback при выборе подсказки */
  onSelect: (suggestion: FilterSuggestion) => void
  /** Показать сообщение "Нет результатов" */
  showNoResults?: boolean
  /** Текст для "Нет результатов" */
  noResultsText?: string
  /** ID для A11y */
  id?: string
}

// ============================================================================
// Компонент
// ============================================================================

export function FilterSuggestions({
  suggestions,
  selectedIndex,
  config,
  onSelect,
  showNoResults = false,
  noResultsText = '',
  id = 'filter-suggestions',
}: FilterSuggestionsProps) {
  if (suggestions.length === 0 && !showNoResults) {
    return null
  }

  return (
    <div
      id={id}
      role="listbox"
      aria-label="Варианты фильтров"
      className={cn(
        'absolute left-0 right-0 top-full z-[100] mt-1',
        'rounded-md border bg-popover py-1 shadow-lg',
        'animate-in fade-in-0 slide-in-from-top-1 duration-100'
      )}
    >
      {suggestions.length > 0 ? (
        suggestions.map((suggestion, idx) => {
          const keyConfig = config.keys[suggestion.key ?? '']
          const color = keyConfig?.color ? COLOR_MAP[keyConfig.color] : DEFAULT_COLOR
          const IconComponent = keyConfig?.icon
          const isSelected = idx === selectedIndex
          const optionId = `${id}-option-${idx}`
          const isKeySuggestion = suggestion.type === 'key'

          return (
            <div
              key={`${suggestion.type}-${idx}-${suggestion.label}`}
              className={cn(
                'flex w-full items-center text-sm',
                'transition-colors duration-75',
                isSelected
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
            >
              {/* Основная кнопка — выбор подсказки */}
              <button
                id={optionId}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(suggestion)
                }}
                className="flex flex-1 items-center gap-2 px-3 py-1.5 text-left min-w-0"
              >
                {isKeySuggestion ? (
                  <>
                    {IconComponent && <IconComponent className={cn('h-4 w-4 shrink-0', suggestion.negated ? 'text-red-400' : color)} />}
                    {suggestion.negated && <span className="text-red-400 font-medium text-xs shrink-0">НЕ</span>}
                    <span className={cn('font-medium', suggestion.negated ? 'text-red-400' : color)}>
                      {suggestion.negated ? suggestion.label.replace(/^-/, '') : suggestion.label}:
                    </span>
                  </>
                ) : (
                  <>
                    {IconComponent && <IconComponent className={cn('h-4 w-4 shrink-0', suggestion.negated ? 'text-red-400' : color)} />}
                    {suggestion.negated && <span className="text-red-400 font-medium text-xs shrink-0">НЕ</span>}
                    <span className={cn('truncate', suggestion.negated && 'line-through text-muted-foreground')}>{suggestion.label}</span>
                  </>
                )}
              </button>

              {/* Кнопка-toggle «Исключить» — только для ключей */}
              {isKeySuggestion && (
                <button
                  type="button"
                  title={suggestion.negated ? 'Включить' : 'Исключить'}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    // Создаём перевёрнутую версию подсказки
                    const baseKey = suggestion.key ?? suggestion.label.replace(/^-/, '')
                    const flipped: FilterSuggestion = suggestion.negated
                      ? { ...suggestion, negated: false, label: baseKey, insertText: `${baseKey}:` }
                      : { ...suggestion, negated: true, label: `-${baseKey}`, insertText: `-${baseKey}:` }
                    onSelect(flipped)
                  }}
                  className={cn(
                    'shrink-0 p-1.5 mr-1 rounded',
                    'transition-colors duration-75',
                    suggestion.negated
                      ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                      : 'text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10'
                  )}
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        })
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          Нет результатов{noResultsText ? ` для «${noResultsText}»` : ''}
        </div>
      )}
    </div>
  )
}
