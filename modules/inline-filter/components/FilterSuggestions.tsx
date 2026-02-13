'use client'

/**
 * Компонент выпадающего списка подсказок для InlineFilter
 *
 * Включает полную поддержку A11y:
 * - role="listbox" для списка
 * - role="option" для каждой подсказки
 * - aria-selected для выбранного элемента
 * - aria-activedescendant для keyboard navigation
 */

import * as React from 'react'
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

          return (
            <button
              key={`${suggestion.type}-${idx}-${suggestion.label}`}
              id={optionId}
              type="button"
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(suggestion)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left',
                'transition-colors duration-75',
                isSelected
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
            >
              {suggestion.type === 'key' ? (
                <>
                  {IconComponent && <IconComponent className={cn('h-4 w-4', color)} />}
                  <span className={cn('font-medium', color)}>{suggestion.label}:</span>
                </>
              ) : (
                <>
                  {IconComponent && <IconComponent className={cn('h-4 w-4', color)} />}
                  <span className="truncate">{suggestion.label}</span>
                </>
              )}
            </button>
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
