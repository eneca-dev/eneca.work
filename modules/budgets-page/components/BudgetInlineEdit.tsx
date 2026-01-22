/**
 * Budget Inline Edit Component
 *
 * Компактный inline редактор суммы бюджета и % от родителя.
 * Используется в колонке "Выделенный" таблицы бюджетов.
 *
 * Сохранение: по Enter или при потере фокуса (blur).
 * Отмена: по Escape.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader2, Plus, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpdateBudgetAmount, useCreateBudget } from '@/modules/budgets'
import type { BudgetInfo, BudgetPageEntityType } from '../types'
import { BudgetPartsEditor } from './BudgetPartsEditor'
import { parseAmount, formatNumber, calculatePercentage, calculateAmount } from '../utils'

// Debug logging (отключить в production)
const DEBUG = false
const log = (action: string, data?: Record<string, unknown>) => {
  if (DEBUG) {
    console.log(`[InlineEdit] ${action}`, data ?? '')
  }
}

// ============================================================================
// Types
// ============================================================================

interface BudgetInlineEditProps {
  /** Бюджеты узла */
  budgets: BudgetInfo[]
  /** Тип сущности */
  entityType: BudgetPageEntityType
  /** ID сущности */
  entityId: string
  /** Название сущности */
  entityName: string
  /** Подсветка перерасхода */
  isOverBudget?: boolean
  /** Компактный режим */
  compact?: boolean
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetInlineEdit({
  budgets,
  entityType,
  entityId,
  entityName,
  isOverBudget = false,
  compact = false,
}: BudgetInlineEditProps) {
  // Берём первый активный бюджет (в V2 один бюджет на сущность)
  const budget = budgets.find((b) => b.is_active)
  const hasBudget = !!budget

  // Родительский бюджет
  const parentAmount = budget?.parent_planned_amount || 0
  const hasParent = parentAmount > 0

  // Локальные значения для редактирования
  const [localAmount, setLocalAmount] = useState('')
  const [localPercent, setLocalPercent] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Hooks
  const { mutate: updateAmount, isPending: isUpdating } = useUpdateBudgetAmount()
  const { mutate: createBudget, isPending: isCreating } = useCreateBudget()

  // Синхронизация с серверными данными (когда не редактируем и нет pending запроса)
  // isPending = true означает оптимистичный рендер — показываем локальное значение
  useEffect(() => {
    if (!isEditing && !isUpdating && budget) {
      log('SYNC from server', { budgetId: budget.budget_id, amount: budget.planned_amount })
      setLocalAmount(formatNumber(budget.planned_amount))
      if (hasParent) {
        setLocalPercent(calculatePercentage(budget.planned_amount, parentAmount).toString())
      }
    }
  }, [budget, isEditing, isUpdating, hasParent, parentAmount])

  // Сохранение на сервер
  const saveToServer = useCallback(() => {
    if (!budget) return

    const newAmount = parseAmount(localAmount)

    // Сохраняем только если значение изменилось
    if (newAmount >= 0 && newAmount !== budget.planned_amount) {
      log('SAVE to server', { budgetId: budget.budget_id, amount: newAmount })
      updateAmount({
        budget_id: budget.budget_id,
        total_amount: newAmount,
      })
    } else {
      log('SKIP save (no change)', { newAmount, serverAmount: budget.planned_amount })
    }
  }, [budget, localAmount, updateAmount])

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

  // Изменение суммы
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '')
    setLocalAmount(raw)

    const newAmount = parseAmount(raw)
    if (hasParent && newAmount >= 0) {
      setLocalPercent(calculatePercentage(newAmount, parentAmount).toString())
    }
  }, [hasParent, parentAmount])

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

  // Изменение процента
  const handlePercentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d,\.]/g, '')
    setLocalPercent(raw)

    const newPercent = parseFloat(raw.replace(',', '.')) || 0
    if (hasParent && newPercent >= 0) {
      setLocalAmount(formatNumber(calculateAmount(newPercent, parentAmount)))
    }
  }, [hasParent, parentAmount])

  // Потеря фокуса → сохранение
  const handleBlur = useCallback(() => {
    log('BLUR → save')
    saveToServer()
    setIsEditing(false)
  }, [saveToServer])

  // Создание бюджета
  const handleCreate = useCallback(() => {
    createBudget({
      entity_type: entityType,
      entity_id: entityId,
      name: 'Бюджет',
      total_amount: 0,
    })
  }, [createBudget, entityType, entityId])

  // Обработка клавиш
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      log('ENTER → save & blur')
      ;(e.target as HTMLInputElement).blur() // blur вызовет handleBlur → saveToServer
    } else if (e.key === 'Escape') {
      e.preventDefault()
      log('ESCAPE → revert')
      // Отмена: возвращаем серверное значение без сохранения
      if (budget) {
        setLocalAmount(formatNumber(budget.planned_amount))
        if (hasParent) {
          setLocalPercent(calculatePercentage(budget.planned_amount, parentAmount).toString())
        }
      }
      setIsEditing(false)
      ;(e.target as HTMLInputElement).blur()
    }
  }, [budget, hasParent, parentAmount])

  // Если нет бюджета - показываем кнопку создания
  if (!hasBudget) {
    return (
      <button
        onClick={handleCreate}
        disabled={isCreating}
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded',
          'text-[10px] text-muted-foreground hover:text-foreground',
          'hover:bg-muted transition-colors',
          'opacity-0 group-hover:opacity-100'
        )}
        title={`Создать бюджет для: ${entityName}`}
      >
        {isCreating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            <Plus className="w-3 h-3" />
            <span>Бюджет</span>
          </>
        )}
      </button>
    )
  }

  const isPending = isUpdating || isCreating

  return (
    <div className="flex items-center gap-1">
      {/* Сумма */}
      <div className="relative">
        <input
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
            'w-[70px] h-5 px-1 text-[11px] tabular-nums text-right',
            'bg-transparent border-0 outline-none',
            'hover:bg-muted/50 focus:bg-muted/70 rounded',
            'transition-colors',
            isPending && 'opacity-50',
            isOverBudget ? 'text-destructive font-medium' : 'text-primary font-medium'
          )}
          placeholder="0"
        />
        {isPending && (
          <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 h-2.5 w-2.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Процент от родителя */}
      {hasParent && (
        <div className="relative flex items-center">
          <input
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
              'w-[40px] h-5 px-1 pr-3 text-[10px] tabular-nums text-right',
              'bg-transparent border-0 outline-none',
              'hover:bg-muted/50 focus:bg-muted/70 rounded',
              'transition-colors text-muted-foreground',
              isPending && 'opacity-50'
            )}
            placeholder="0"
          />
          <span className="absolute right-1 text-[9px] text-muted-foreground pointer-events-none">%</span>
        </div>
      )}

      {/* Кнопка частей */}
      <BudgetPartsEditor
        budgetId={budget.budget_id}
        totalAmount={budget.planned_amount}
        trigger={
          <button
            className={cn(
              'p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground',
              'hover:bg-muted transition-colors',
              'opacity-0 group-hover:opacity-100'
            )}
            title="Части бюджета"
            onClick={(e) => e.stopPropagation()}
          >
            <PieChart className="w-3 h-3" />
          </button>
        }
      />
    </div>
  )
}
