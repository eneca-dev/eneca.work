/**
 * Budget Amount Edit Component
 *
 * Inline редактор с двумя полями: сумма (BYN) и процент (%).
 * Поля всегда видимы и редактируемы. При вводе в одно — автоматически рассчитывается другое.
 * Процент рассчитывается от parent_planned_amount.
 *
 * Сохранение: по Enter или при потере фокуса (blur).
 * Отмена: по Escape.
 *
 * Включает кнопку для открытия BudgetPartsEditor (управление частями бюджета).
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpdateBudgetAmount } from '@/modules/budgets'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BudgetPartsEditor } from './BudgetPartsEditor'
import { parseAmount, formatNumber, calculatePercentage, calculateAmount } from '../utils'

// Debug logging (отключить в production)
const DEBUG = false
const log = (action: string, data?: Record<string, unknown>) => {
  if (DEBUG) {
    console.log(`[AmountEdit] ${action}`, data ?? '')
  }
}

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
  /** Процент освоения (от своего planned_amount) */
  spentPercentage: number
  /** Сумма родительского бюджета для расчёта % */
  parentPlannedAmount: number
  /** Компактный режим */
  compact?: boolean
  /** Скрыть цветную точку */
  hideColorDot?: boolean
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
  parentPlannedAmount,
  compact,
  hideColorDot = false,
}: BudgetAmountEditProps) {
  // Локальные значения для редактирования
  const [localAmount, setLocalAmount] = useState('')
  const [localPercent, setLocalPercent] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const amountRef = useRef<HTMLInputElement>(null)
  const percentRef = useRef<HTMLInputElement>(null)

  const { mutate: updateAmount, isPending } = useUpdateBudgetAmount()

  const hasParent = parentPlannedAmount > 0

  // Sync с серверными данными (когда не редактируем и нет pending запроса)
  // isPending = true означает оптимистичный рендер — показываем локальное значение
  useEffect(() => {
    if (!isEditing && !isPending) {
      log('SYNC from server', { budgetId, amount: currentAmount })
      setLocalAmount(formatNumber(currentAmount))
      setLocalPercent(
        hasParent ? calculatePercentage(currentAmount, parentPlannedAmount).toString() : ''
      )
    }
  }, [currentAmount, parentPlannedAmount, hasParent, isEditing, isPending, budgetId])

  // Сохранение на сервер
  const saveToServer = useCallback(() => {
    const newAmount = parseAmount(localAmount)

    // Сохраняем только если значение изменилось
    if (newAmount >= 0 && newAmount !== currentAmount) {
      log('SAVE to server', { budgetId, amount: newAmount })
      updateAmount({
        budget_id: budgetId,
        total_amount: newAmount,
      })
    } else {
      log('SKIP save (no change)', { newAmount, serverAmount: currentAmount })
    }
  }, [budgetId, localAmount, currentAmount, updateAmount])

  // Ограничиваем процент освоения для визуализации
  const visualPercentage = Math.min(spentPercentage, 100)
  const isOverBudget = spentPercentage > 100

  // Фокус на поле суммы
  const handleAmountFocus = useCallback(() => {
    log('FOCUS amount')
    setIsEditing(true)
  }, [])

  // MouseUp на поле суммы - select all
  const handleAmountMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement
    if (input.selectionStart === input.selectionEnd) {
      input.select()
    }
  }, [])

  // Изменение суммы → пересчёт процента
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '')
    setLocalAmount(raw)

    const newAmount = parseAmount(raw)
    if (hasParent && newAmount >= 0) {
      const newPercent = calculatePercentage(newAmount, parentPlannedAmount)
      setLocalPercent(newPercent.toString())
    }
  }, [hasParent, parentPlannedAmount])

  // Фокус на поле процента
  const handlePercentFocus = useCallback(() => {
    setIsEditing(true)
  }, [])

  // MouseUp на поле процента - select all
  const handlePercentMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement
    if (input.selectionStart === input.selectionEnd) {
      input.select()
    }
  }, [])

  // Изменение процента → пересчёт суммы
  const handlePercentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d,\.]/g, '')
    setLocalPercent(raw)

    const newPercent = parseFloat(raw.replace(',', '.')) || 0
    if (hasParent && newPercent >= 0) {
      const newAmount = calculateAmount(newPercent, parentPlannedAmount)
      setLocalAmount(formatNumber(newAmount))
    }
  }, [hasParent, parentPlannedAmount])

  // Потеря фокуса → сохранение
  const handleBlur = useCallback(() => {
    log('BLUR → save')
    saveToServer()
    setIsEditing(false)
  }, [saveToServer])

  // Обработка клавиш
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        log('ENTER → save & blur')
        ;(e.target as HTMLInputElement).blur() // blur вызовет handleBlur → saveToServer
      } else if (e.key === 'Escape') {
        e.preventDefault()
        log('ESCAPE → revert')
        // Отмена: возвращаем серверное значение без сохранения
        setLocalAmount(formatNumber(currentAmount))
        setLocalPercent(
          hasParent ? calculatePercentage(currentAmount, parentPlannedAmount).toString() : ''
        )
        setIsEditing(false)
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [currentAmount, hasParent, parentPlannedAmount]
  )

  // Tooltip content
  const tooltipContent = (
    <div className="text-[11px] space-y-0.5">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">
        Освоено: {formatNumber(spentAmount)} / {formatNumber(currentAmount)} BYN
      </div>
      <div className={cn(
        'font-mono',
        isOverBudget ? 'text-red-400' : 'text-muted-foreground'
      )}>
        {spentPercentage}% от плана
      </div>
    </div>
  )

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Color dot with tooltip - скрываем если hideColorDot */}
      {!hideColorDot && (
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
          <TooltipContent side="left" className="max-w-52">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Amount input - borderless */}
      <div className="relative">
        <input
          ref={amountRef}
          type="text"
          inputMode="numeric"
          value={localAmount}
          onChange={handleAmountChange}
          onFocus={handleAmountFocus}
          onMouseUp={handleAmountMouseUp}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          disabled={isPending}
          className={cn(
            'w-20 h-6 px-1 pr-7 text-xs tabular-nums text-right',
            'bg-transparent border-0 outline-none',
            'hover:bg-slate-800/50 focus:bg-slate-800/70 rounded',
            'transition-colors',
            isPending && 'opacity-50',
            isOverBudget && 'text-destructive',
            !isOverBudget && 'text-slate-200'
          )}
          placeholder="0"
        />
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 pointer-events-none">
          BYN
        </span>
        {isPending && (
          <Loader2 className="absolute right-7 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Percent input - only if has parent */}
      {hasParent && (
        <div className="relative">
          <input
            ref={percentRef}
            type="text"
            inputMode="decimal"
            value={localPercent}
            onChange={handlePercentChange}
            onFocus={handlePercentFocus}
            onMouseUp={handlePercentMouseUp}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            disabled={isPending}
            className={cn(
              'w-12 h-6 px-1 pr-4 text-xs tabular-nums text-right',
              'bg-transparent border-0 outline-none',
              'hover:bg-slate-800/50 focus:bg-slate-800/70 rounded',
              'transition-colors text-slate-400',
              isPending && 'opacity-50'
            )}
            placeholder="0"
          />
          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 pointer-events-none">
            %
          </span>
        </div>
      )}

      {/* Spacer для прижатия прогресс-бара к правому краю */}
      <div className="flex-1" />

      {/* Parts editor button */}
      <BudgetPartsEditor
        budgetId={budgetId}
        totalAmount={currentAmount}
        trigger={
          <button
            className={cn(
              'p-1 rounded text-slate-500 hover:text-slate-300',
              'hover:bg-slate-800 transition-colors',
              'opacity-0 group-hover:opacity-100'
            )}
            title="Управление частями"
            onClick={(e) => e.stopPropagation()}
          >
            <PieChart className="w-3 h-3" />
          </button>
        }
      />

      {/* Mini progress bar - прижат к правому краю */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'w-16 bg-slate-800 rounded-full overflow-hidden cursor-help shrink-0',
              'h-[4px]'
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
        <TooltipContent side="top" className="max-w-52">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
