'use client'

/**
 * InlineFilter — минималистичный инлайн-фильтр в стиле GitHub
 *
 * Простой input с автокомплитом, подсветкой применённых фильтров
 *
 * @example
 * const config: FilterConfig = {
 *   keys: {
 *     'проект': {
 *       field: 'project_id',
 *       label: 'Проект',
 *       icon: FolderKanban,
 *       color: 'amber',
 *     },
 *   }
 * }
 * <InlineFilter config={config} value={filter} onChange={setFilter} options={options} />
 */

import * as React from 'react'
import { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterConfig, FilterOption } from '../types'
import { parseFilterString } from '../parser'
import { useFilterContext, type FilterInputContext } from '../hooks/useFilterContext'
import { FilterSuggestions, COLOR_MAP, DEFAULT_COLOR, type FilterSuggestion } from './FilterSuggestions'

// ============================================================================
// Константы
// ============================================================================

/** Задержка закрытия dropdown после blur (мс) */
const BLUR_CLOSE_DELAY_MS = 150

/** Максимальное количество подсказок в dropdown */
const MAX_SUGGESTIONS = 8

/** Дефолтная задержка debounce (мс) */
const DEFAULT_DEBOUNCE_MS = 300

export interface InlineFilterProps {
  /** Конфигурация фильтра */
  config: FilterConfig
  /** Текущее значение строки фильтра */
  value: string
  /** Callback при изменении */
  onChange: (value: string) => void
  /** Опции для автокомплита (id, name, key) */
  options?: FilterOption[]
  /** Placeholder */
  placeholder?: string
  /** Дополнительные классы */
  className?: string
  /** Задержка debounce в мс */
  debounceMs?: number
}

export function InlineFilter({
  config,
  value,
  onChange,
  options = [],
  placeholder,
  className,
  debounceMs = 300,
}: InlineFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsId = useId()
  const [localValue, setLocalValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)

  // Debounced value для onChange
  const [debouncedValue] = useDebounceValue(localValue, debounceMs)

  // Синхронизация с внешним value
  useEffect(() => {
    if (value !== localValue && !isFocused) {
      setLocalValue(value)
    }
  }, [value, isFocused, localValue])

  // Вызываем onChange при изменении debounced value
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue)
    }
  }, [debouncedValue, onChange, value])

  // Определяем контекст ввода для автокомплита (используем хук)
  const inputContext = useFilterContext({
    value: localValue,
    cursorPosition,
    config,
  })

  // Генерируем подсказки
  const suggestions = useMemo(() => {
    const items: Array<{ type: 'key' | 'value'; label: string; insertText: string; key?: string }> = []

    if (inputContext.type === 'key' || inputContext.type === 'empty') {
      // Подсказки ключей
      const partial = inputContext.type === 'key' ? inputContext.partial.toLowerCase() : ''
      Object.entries(config.keys).forEach(([key, keyConfig]) => {
        const label = keyConfig.label ?? key
        if (!partial || key.toLowerCase().includes(partial) || label.toLowerCase().includes(partial)) {
          items.push({
            type: 'key',
            label: key,
            insertText: `${key}:`,
            key: key,
          })
        }
      })
    } else if (inputContext.type === 'value') {
      // Подсказки значений - показываем сразу после выбора ключа
      const keyOptions = options.filter((opt) => opt.key === inputContext.key)
      const partial = inputContext.partialValue.toLowerCase()

      keyOptions.forEach((opt) => {
        if (!partial || opt.name.toLowerCase().includes(partial)) {
          const needsQuotes = opt.name.includes(' ')
          items.push({
            type: 'value',
            label: opt.name,
            insertText: needsQuotes ? `"${opt.name}"` : opt.name,
            key: inputContext.key,
          })
        }
      })
    }

    return items.slice(0, 8) // Лимит подсказок
  }, [inputContext, config, options])

  // Обработка выбора подсказки
  const applySuggestion = useCallback(
    (suggestion: (typeof suggestions)[0]) => {
      const beforeCursor = localValue.slice(0, cursorPosition)
      const afterCursor = localValue.slice(cursorPosition)

      let newValue: string
      let newCursorPos: number

      if (suggestion.type === 'key') {
        // Заменяем частичный ключ
        const partialMatch = beforeCursor.match(/(\S+)$/)
        const replaceStart = partialMatch ? beforeCursor.length - partialMatch[0].length : beforeCursor.length
        newValue = beforeCursor.slice(0, replaceStart) + suggestion.insertText + afterCursor
        newCursorPos = replaceStart + suggestion.insertText.length
      } else {
        // Заменяем частичное значение
        const partialMatch = beforeCursor.match(/(\S+):(?:"([^"]*)|(\S*))?$/)
        if (partialMatch) {
          const keyWithColon = partialMatch[1] + ':'
          const replaceStart = beforeCursor.lastIndexOf(keyWithColon) + keyWithColon.length
          newValue = beforeCursor.slice(0, replaceStart) + suggestion.insertText + ' ' + afterCursor.trimStart()
          newCursorPos = replaceStart + suggestion.insertText.length + 1
        } else {
          newValue = localValue + suggestion.insertText + ' '
          newCursorPos = newValue.length
        }
      }

      setLocalValue(newValue)
      setCursorPosition(newCursorPos)
      setSelectedSuggestionIndex(0)

      // Для значения закрываем, для ключа - оставляем открытыми
      if (suggestion.type === 'value') {
        setShowSuggestions(false)
      } else {
        // Для ключа оставляем открытым чтобы показать значения
        setShowSuggestions(true)
      }

      // Восстанавливаем фокус и позицию курсора
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
      })
    },
    [localValue, cursorPosition]
  )

  // Обработка клавиатуры
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedSuggestionIndex((i) => (i + 1) % suggestions.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedSuggestionIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          applySuggestion(suggestions[selectedSuggestionIndex])
          break
        case 'Escape':
          setShowSuggestions(false)
          break
      }
    },
    [showSuggestions, suggestions, selectedSuggestionIndex, applySuggestion]
  )

  // Очистка всех фильтров
  const clearAll = useCallback(() => {
    setLocalValue('')
    setCursorPosition(0)
    onChange('')
    inputRef.current?.focus()
  }, [onChange])

  // Парсим токены для подсветки
  const parsedTokens = useMemo(
    () => parseFilterString(localValue, config).tokens,
    [localValue, config]
  )
  const filterCount = parsedTokens.length

  // Создаём подсвеченный текст с цветными ключами
  const highlightedContent = useMemo(() => {
    if (!localValue || parsedTokens.length === 0) return null

    const parts: React.ReactNode[] = []
    let lastIndex = 0

    // Находим позиции всех токенов в строке
    parsedTokens.forEach((token, idx) => {
      const tokenStart = localValue.indexOf(token.raw, lastIndex)
      if (tokenStart === -1) return

      // Добавляем текст до токена (пробелы и т.д.)
      if (tokenStart > lastIndex) {
        parts.push(
          <span key={`text-${idx}`} className="text-foreground">
            {localValue.slice(lastIndex, tokenStart)}
          </span>
        )
      }

      // Получаем цвет для ключа из конфига
      const keyConfig = config.keys[token.key]
      const color = keyConfig?.color ? COLOR_MAP[keyConfig.color] : DEFAULT_COLOR

      // Разбиваем токен на ключ и значение
      const colonIndex = token.raw.indexOf(':')
      const keyPart = token.raw.slice(0, colonIndex + 1)
      const valuePart = token.raw.slice(colonIndex + 1)

      // Простая подсветка: ключ цветной, значение обычное
      parts.push(
        <span key={`token-${idx}`}>
          <span className={color}>{keyPart}</span>
          <span className="text-sky-300">{valuePart}</span>
        </span>
      )

      lastIndex = tokenStart + token.raw.length
    })

    // Добавляем оставшийся текст
    if (lastIndex < localValue.length) {
      parts.push(
        <span key="text-end" className="text-foreground">
          {localValue.slice(lastIndex)}
        </span>
      )
    }

    return parts
  }, [localValue, parsedTokens])

  // Определяем есть ли результаты для текущего контекста
  const hasNoResults = inputContext.type === 'value' && suggestions.length === 0 && inputContext.partialValue.length > 0

  // Обработчик изменения input
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const newCursorPos = e.target.selectionStart ?? newValue.length
    setLocalValue(newValue)
    setCursorPosition(newCursorPos)
    setShowSuggestions(true)
    setSelectedSuggestionIndex(0)
  }, [])

  // Обновляем позицию курсора при кликах и навигации
  const handleSelect = useCallback(() => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart ?? localValue.length)
    }
  }, [localValue.length])

  return (
    <div className={cn('relative w-full', className)}>
      {/* Основной контейнер */}
      <div
        className={cn(
          'flex items-center',
          'rounded-md border bg-background',
          'transition-colors duration-150',
          isFocused
            ? 'border-primary ring-1 ring-primary/30'
            : 'border-border hover:border-muted-foreground/40'
        )}
      >
        {/* Иконка поиска */}
        <div className="flex items-center pl-3 text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>

        {/* Input с подсветкой */}
        <div className="relative flex-1 overflow-hidden">
          {/* Слой подсветки (визуально поверх, но не блокирует клики) */}
          {highlightedContent && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center px-2 py-1.5 text-sm whitespace-pre"
              aria-hidden="true"
            >
              {highlightedContent}
            </div>
          )}

          {/* Настоящий input */}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showSuggestions && isFocused && suggestions.length > 0}
            aria-haspopup="listbox"
            aria-controls={suggestionsId}
            aria-activedescendant={
              showSuggestions && suggestions.length > 0
                ? `${suggestionsId}-option-${selectedSuggestionIndex}`
                : undefined
            }
            value={localValue}
            onChange={handleInputChange}
            onSelect={handleSelect}
            onFocus={() => {
              setIsFocused(true)
              setShowSuggestions(true)
              handleSelect()
            }}
            onBlur={() => {
              setIsFocused(false)
              setTimeout(() => setShowSuggestions(false), 150)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? 'Filter...'}
            className={cn(
              'relative w-full bg-transparent px-2 py-1.5 text-sm outline-none',
              'placeholder:text-muted-foreground/60',
              // Прозрачный текст когда есть подсветка
              highlightedContent ? 'text-transparent' : 'text-foreground'
            )}
            style={{ caretColor: 'hsl(var(--foreground))' }}
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* Счётчик фильтров + кнопка очистки */}
        {filterCount > 0 && (
          <div className="flex items-center gap-1 pr-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {filterCount}
            </span>
            <button
              type="button"
              onClick={clearAll}
              className={cn(
                'rounded p-0.5 text-muted-foreground/60',
                'hover:text-foreground hover:bg-muted',
                'transition-colors duration-100'
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Dropdown подсказок */}
      {showSuggestions && isFocused && (suggestions.length > 0 || hasNoResults) && (
        <FilterSuggestions
          suggestions={suggestions}
          selectedIndex={selectedSuggestionIndex}
          config={config}
          onSelect={applySuggestion}
          showNoResults={hasNoResults}
          noResultsText={inputContext.type === 'value' ? inputContext.partialValue : ''}
          id={suggestionsId}
        />
      )}
    </div>
  )
}
