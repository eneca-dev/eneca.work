/**
 * Hours Input Component
 *
 * Inline редактор плановых часов для задач с optimistic updates.
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface HoursInputProps {
  /** Текущее значение часов */
  value: number
  /** Callback при изменении */
  onChange?: (newValue: number) => void
  /** Только для чтения */
  readOnly?: boolean
  /** Показывать серым если 0 */
  dimIfZero?: boolean
  /** Выделить жирным */
  bold?: boolean
  /** Подсветить белым (для редактируемых полей) */
  highlighted?: boolean
  /** CSS класс */
  className?: string
}

export function HoursInput({
  value,
  onChange,
  readOnly = false,
  dimIfZero = true,
  bold = false,
  highlighted = false,
  className,
}: HoursInputProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value.toString())
  const [optimisticValue, setOptimisticValue] = useState<number | null>(null)
  const [isPending, setIsPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Отображаемое значение: оптимистичное → редактируемое → серверное
  const displayValue = optimisticValue !== null ? optimisticValue : value

  // Sync с внешним значением (когда не редактируем и нет pending)
  useEffect(() => {
    if (!isEditing && !isPending) {
      setLocalValue(value.toString())
      setOptimisticValue(null)
    }
  }, [value, isEditing, isPending])

  // Focus при входе в режим редактирования
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleClick = useCallback(() => {
    if (!readOnly && onChange) {
      setIsEditing(true)
    }
  }, [readOnly, onChange])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '')
    setLocalValue(raw)
  }, [])

  const handleSave = useCallback(async () => {
    const newValue = parseInt(localValue, 10) || 0
    setIsEditing(false)

    if (newValue !== value && onChange) {
      // Optimistic update - показываем сразу
      setOptimisticValue(newValue)
      setIsPending(true)

      try {
        await onChange(newValue)
      } finally {
        setIsPending(false)
        // optimisticValue сбросится при следующем sync с сервером
      }
    }
  }, [localValue, value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setLocalValue(value.toString())
      setIsEditing(false)
    }
  }, [handleSave, value])

  const formattedValue = new Intl.NumberFormat('ru-RU').format(displayValue)
  const isZero = displayValue === 0

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={localValue}
        onChange={handleChange}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-14 h-5 px-1 text-[12px] tabular-nums text-right',
          'bg-slate-800 border border-slate-600 rounded outline-none',
          'focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30',
          className
        )}
      />
    )
  }

  return (
    <span
      onClick={handleClick}
      className={cn(
        'text-[12px] tabular-nums cursor-default',
        isZero && dimIfZero && 'text-slate-600',
        !isZero && !highlighted && 'text-slate-400',
        !isZero && highlighted && 'text-slate-100',
        bold && !isZero && 'font-medium text-slate-200',
        !readOnly && onChange && 'cursor-pointer hover:text-cyan-400',
        isPending && 'opacity-50',
        className
      )}
    >
      {formattedValue}
    </span>
  )
}
