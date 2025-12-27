/**
 * Budget Amount Edit Component
 *
 * Компактный inline click-to-edit для редактирования плановой суммы бюджета.
 * Использует цветные точки с тултипами вместо текстовых лейблов.
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpdateBudgetAmount } from '@/modules/budgets'
import { formatAmount } from '../utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ============================================================================
// Types
// ============================================================================

interface BudgetAmountEditProps {
  /** ID бюджета для обновления */
  budgetId: string
  /** Текущая плановая сумма */
  currentAmount: number
  /** Потраченная сумма */
  spentAmount: number
  /** Цвет типа бюджета */
  color: string
  /** Название типа */
  label: string
  /** Процент освоения */
  spentPercentage: number
  /** Компактный режим */
  compact?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Парсит введённую строку в число (поддержка пробелов, запятых)
 */
function parseAmount(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Форматирует число для input
 */
function formatInputAmount(amount: number): string {
  if (amount === 0) return ''
  return new Intl.NumberFormat('ru-RU').format(amount)
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetAmountEdit({
  budgetId,
  currentAmount,
  spentAmount,
  color,
  label,
  spentPercentage,
  compact,
}: BudgetAmountEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { mutate: updateAmount, isPending } = useUpdateBudgetAmount()

  // Ограничиваем процент для визуализации
  const visualPercentage = Math.min(spentPercentage, 100)
  const isOverBudget = spentPercentage > 100

  // Auto-focus и select при входе в режим редактирования
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Обработка начала редактирования
  const handleStartEdit = useCallback(() => {
    setInputValue(formatInputAmount(currentAmount))
    setIsEditing(true)
  }, [currentAmount])

  // Сохранение
  const handleSubmit = useCallback(() => {
    const newAmount = parseAmount(inputValue)

    if (newAmount > 0 && newAmount !== currentAmount) {
      updateAmount({
        budget_id: budgetId,
        planned_amount: newAmount,
      })
    }

    setIsEditing(false)
  }, [inputValue, currentAmount, budgetId, updateAmount])

  // Отмена
  const handleCancel = useCallback(() => {
    setInputValue('')
    setIsEditing(false)
  }, [])

  // Обработка клавиш
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSubmit, handleCancel]
  )

  // Режим редактирования
  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        {/* Color dot */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Progress bar (disabled while editing) */}
        <div className="flex-1 bg-muted/30 rounded-full overflow-hidden h-1.5">
          <div
            className="h-full rounded-full"
            style={{
              width: `${visualPercentage}%`,
              backgroundColor: isOverBudget ? '#ef4444' : color,
              opacity: 0.5,
            }}
          />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.replace(/[^\d\s,\.]/g, ''))}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-20 h-5 px-1.5 text-[11px] tabular-nums rounded border text-right',
            'bg-background border-primary/50 outline-none',
            'focus:ring-1 focus:ring-primary/30'
          )}
          placeholder="Сумма"
        />
      </div>
    )
  }

  // Tooltip content
  const tooltipContent = (
    <div className="text-[11px] space-y-0.5">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">
        Освоено: {formatAmount(spentAmount)} / {formatAmount(currentAmount)} BYN
      </div>
      <div className={cn(
        'font-mono',
        isOverBudget ? 'text-red-400' : 'text-muted-foreground'
      )}>
        {spentPercentage}% от плана
      </div>
    </div>
  )

  // Режим просмотра
  return (
    <div className="flex items-center gap-1.5">
      {/* Color dot with tooltip */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'w-2 h-2 rounded-full shrink-0 cursor-help',
              'ring-1 ring-transparent hover:ring-foreground/20 transition-shadow'
            )}
            style={{ backgroundColor: color }}
          />
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-48">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>

      {/* Progress bar */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex-1 bg-muted/30 rounded-full overflow-hidden cursor-help',
              compact ? 'h-1' : 'h-1.5'
            )}
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                isOverBudget && 'animate-pulse'
              )}
              style={{
                width: `${visualPercentage}%`,
                backgroundColor: isOverBudget ? '#ef4444' : color,
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-48">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>

      {/* Editable amount */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleStartEdit()
        }}
        disabled={isPending}
        className={cn(
          'text-[11px] tabular-nums shrink-0 px-1 rounded transition-colors',
          'hover:bg-muted cursor-pointer',
          'focus:outline-none focus:ring-1 focus:ring-primary/30',
          isPending && 'opacity-50'
        )}
        title="Нажмите для редактирования"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span className={isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'}>
            {formatAmount(currentAmount)}
          </span>
        )}
      </button>

      {/* Spent percentage - compact */}
      <span
        className={cn(
          'text-[10px] tabular-nums shrink-0 w-7 text-right',
          isOverBudget ? 'text-destructive' : 'text-muted-foreground/70'
        )}
      >
        {spentPercentage}%
      </span>
    </div>
  )
}
