'use client'

/**
 * InlineFilter — компонент инлайн-фильтра в стиле GitHub Projects
 *
 * Дизайн: Industrial/IDE aesthetic — профессиональный инструмент для работы с данными
 * Вдохновение: GitHub search, VS Code command palette
 */

import * as React from 'react'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import { Search, X, Filter, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { FilterConfig, FilterOption, ParsedToken } from '../types'
import { parseFilterString } from '../parser'

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
  const [localValue, setLocalValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)

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

  // Парсим токены для отображения чипов
  const parsedTokens = useMemo(
    () => parseFilterString(localValue, config).tokens,
    [localValue, config]
  )

  // Определяем контекст ввода для автокомплита
  const inputContext = useMemo(() => {
    const cursorPos = inputRef.current?.selectionStart ?? localValue.length
    const beforeCursor = localValue.slice(0, cursorPos)

    // Ищем незавершённый токен (ключ: без закрывающей кавычки или пробела)
    const partialKeyMatch = beforeCursor.match(/(\S+):(?:"([^"]*)|(\S*))$/)
    if (partialKeyMatch) {
      const key = partialKeyMatch[1]
      const partialValue = partialKeyMatch[2] ?? partialKeyMatch[3] ?? ''
      if (config.keys[key]) {
        return { type: 'value' as const, key, partialValue }
      }
    }

    // Ищем частичный ключ (без двоеточия)
    const partialKey = beforeCursor.match(/(\S+)$/)
    if (partialKey && !partialKey[0].includes(':')) {
      return { type: 'key' as const, partial: partialKey[1] }
    }

    return { type: 'empty' as const }
  }, [localValue, config])

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
          })
        }
      })
    } else if (inputContext.type === 'value') {
      // Подсказки значений
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
      const cursorPos = inputRef.current?.selectionStart ?? localValue.length
      const beforeCursor = localValue.slice(0, cursorPos)
      const afterCursor = localValue.slice(cursorPos)

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
        const partialMatch = beforeCursor.match(/(\S+):(?:"([^"]*)|(\S*))$/)
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
      setShowSuggestions(false)
      setSelectedSuggestionIndex(0)

      // Восстанавливаем фокус и позицию курсора
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    },
    [localValue]
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

  // Удаление токена по клику на чип
  const removeToken = useCallback(
    (token: ParsedToken) => {
      const newValue = localValue.replace(token.raw, '').replace(/\s+/g, ' ').trim()
      setLocalValue(newValue)
      onChange(newValue)
    },
    [localValue, onChange]
  )

  // Очистка всех фильтров
  const clearAll = useCallback(() => {
    setLocalValue('')
    onChange('')
    inputRef.current?.focus()
  }, [onChange])

  const hasFilters = parsedTokens.length > 0

  // Получаем лейбл ключа из конфига
  const getKeyLabel = (key: string) => config.keys[key]?.label ?? key

  return (
    <div className={cn('relative w-full', className)}>
      {/* Основной контейнер фильтра */}
      <div
        className={cn(
          'group relative flex items-center gap-2',
          'rounded-lg border bg-background transition-all duration-200',
          'hover:border-muted-foreground/30',
          isFocused
            ? 'border-primary/50 ring-2 ring-primary/20 shadow-sm'
            : 'border-border',
          hasFilters && 'pb-2'
        )}
      >
        {/* Иконка фильтра */}
        <div className="flex items-center pl-3 text-muted-foreground">
          <Filter className="h-4 w-4" />
        </div>

        {/* Input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value)
              setShowSuggestions(true)
              setSelectedSuggestionIndex(0)
            }}
            onFocus={() => {
              setIsFocused(true)
              setShowSuggestions(true)
            }}
            onBlur={() => {
              setIsFocused(false)
              // Задержка чтобы клик по подсказке успел сработать
              setTimeout(() => setShowSuggestions(false), 150)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? 'Фильтр: подразделение:"ОВ" проект:"Название"'}
            className={cn(
              'w-full bg-transparent py-2.5 pr-8 text-sm outline-none',
              'font-mono tracking-tight',
              'placeholder:text-muted-foreground/50 placeholder:font-sans placeholder:tracking-normal'
            )}
            spellCheck={false}
            autoComplete="off"
          />

          {/* Кнопка очистки */}
          {localValue && (
            <button
              type="button"
              onClick={clearAll}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2',
                'rounded p-0.5 text-muted-foreground/50',
                'hover:text-muted-foreground hover:bg-muted',
                'transition-colors duration-150'
              )}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Подсказка с доступными ключами */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'mr-2 flex items-center gap-1 rounded px-2 py-1',
                'text-xs text-muted-foreground',
                'hover:bg-muted hover:text-foreground',
                'transition-colors duration-150'
              )}
            >
              <span className="hidden sm:inline">Поля</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-56 p-2"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="space-y-1">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Доступные фильтры
              </p>
              {Object.entries(config.keys).map(([key, keyConfig]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const insertion = localValue ? ` ${key}:` : `${key}:`
                    setLocalValue(localValue + insertion)
                    inputRef.current?.focus()
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded px-2 py-1.5',
                    'text-sm hover:bg-muted transition-colors'
                  )}
                >
                  <span className="font-mono text-xs">{key}:</span>
                  {keyConfig.label && (
                    <span className="text-xs text-muted-foreground">
                      {keyConfig.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Чипы токенов */}
        {hasFilters && (
          <div className="absolute bottom-1 left-10 right-2 flex flex-wrap gap-1">
            {parsedTokens.map((token, idx) => (
              <span
                key={`${token.key}-${token.value}-${idx}`}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                  'bg-primary/10 text-primary text-xs font-medium',
                  'border border-primary/20',
                  'animate-in fade-in-0 zoom-in-95 duration-150'
                )}
              >
                <span className="text-primary/60">{getKeyLabel(token.key)}:</span>
                <span>{token.value}</span>
                <button
                  type="button"
                  onClick={() => removeToken(token)}
                  className="ml-0.5 rounded hover:bg-primary/20 p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Dropdown подсказок */}
      {showSuggestions && suggestions.length > 0 && isFocused && (
        <div
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1',
            'rounded-lg border bg-popover shadow-lg',
            'animate-in fade-in-0 slide-in-from-top-2 duration-150'
          )}
        >
          <div className="p-1">
            {suggestions.map((suggestion, idx) => (
              <button
                key={`${suggestion.type}-${suggestion.label}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault() // Предотвращаем blur
                  applySuggestion(suggestion)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm',
                  'transition-colors duration-75',
                  idx === selectedSuggestionIndex
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                )}
              >
                {suggestion.type === 'key' ? (
                  <>
                    <span className="font-mono text-xs text-muted-foreground">
                      {suggestion.label}:
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {config.keys[suggestion.label]?.label}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {suggestion.key}:
                    </span>
                    <span>{suggestion.label}</span>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Подсказка по синтаксису */}
          <div className="border-t px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground">
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Tab</kbd>
              {' '}или{' '}
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Enter</kbd>
              {' '}— выбрать,{' '}
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Esc</kbd>
              {' '}— закрыть
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
