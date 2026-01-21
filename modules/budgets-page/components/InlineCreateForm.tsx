/**
 * Inline Create Form Component
 *
 * Общий компонент для инлайн создания сущностей.
 * Используется для stages и items.
 */

'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface InlineCreateFormProps {
  /** Placeholder для input */
  placeholder: string
  /** Callback для submit (возвращает Promise) */
  onSubmit: (value: string) => Promise<void>
  /** Callback для отмены */
  onCancel: () => void
  /** Вариант стиля */
  variant?: 'stage' | 'item'
  /** Дополнительные классы для контейнера */
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export function InlineCreateForm({
  placeholder,
  onSubmit,
  onCancel,
  variant = 'stage',
  className,
}: InlineCreateFormProps) {
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(async () => {
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      onCancel()
      return
    }

    setIsSubmitting(true)
    setError(null)

    // Retry logic for "Failed to fetch" errors
    const maxRetries = 2
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await onSubmit(trimmedValue)
        onCancel()
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Ошибка сохранения')

        // Only retry on network errors
        const isNetworkError = lastError.message === 'Failed to fetch' ||
          lastError.message.includes('network') ||
          lastError.message.includes('fetch')

        if (!isNetworkError || attempt === maxRetries) {
          break
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
      }
    }

    setError(lastError?.message || 'Ошибка сохранения')
    setIsSubmitting(false)
  }, [value, onSubmit, onCancel])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === 'Escape') {
        onCancel()
      }
    },
    [handleSubmit, onCancel]
  )

  // Стили в зависимости от варианта
  const containerStyles = variant === 'stage'
    ? 'bg-muted/60'
    : 'bg-card/40'

  const inputStyles = variant === 'stage'
    ? 'text-foreground placeholder:text-muted-foreground'
    : 'text-foreground/80 placeholder:text-muted-foreground/50'

  const checkButtonStyles = variant === 'stage'
    ? 'hover:bg-teal-500/20 text-teal-400'
    : 'hover:bg-muted text-muted-foreground'

  return (
    <div className={cn('flex items-center gap-1 px-2 py-1 rounded', containerStyles, className)}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Небольшая задержка чтобы кнопки успели обработать клик
          setTimeout(() => {
            if (!isSubmitting && !value.trim()) {
              onCancel()
            }
          }, 150)
        }}
        placeholder={placeholder}
        disabled={isSubmitting}
        className={cn(
          'flex-1 min-w-[150px] bg-transparent border-none outline-none',
          'text-[12px]',
          inputStyles,
          isSubmitting && 'opacity-50'
        )}
      />

      {error && (
        <span className="text-[10px] text-destructive truncate max-w-[100px]" title={error}>
          {error}
        </span>
      )}

      {isSubmitting ? (
        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
      ) : (
        <>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className={cn(
              'p-0.5 rounded transition-colors',
              value.trim()
                ? checkButtonStyles
                : 'text-muted-foreground/50 cursor-not-allowed'
            )}
            title="Создать (Enter)"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="Отмена (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
