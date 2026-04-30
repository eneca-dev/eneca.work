'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpdateBudgetAmount, useCreateBudget } from '@/modules/budgets'
import { useHasPermission } from '@/modules/permissions'
import type { BudgetInfo, BudgetPageEntityType } from '../types'
import { parseAmount, formatNumber, calculatePercentage } from '../utils'

interface BudgetInlineEditProps {
  budgets: BudgetInfo[]
  entityType: BudgetPageEntityType
  entityId: string
  entityName: string
  isOverBudget?: boolean
}

export function BudgetInlineEdit({
  budgets,
  entityType,
  entityId,
  entityName,
  isOverBudget = false,
}: BudgetInlineEditProps) {
  const canCreate = useHasPermission('budgets.create')
  const canEdit = useHasPermission('budgets.edit')

  const budget = budgets.find((b) => b.is_active)
  const hasBudget = !!budget

  // Процент показывается только если у родителя ненулевой бюджет
  const parentAmount = budget?.parent_planned_amount || 0
  const hasParent = parentAmount > 0

  const [localAmount, setLocalAmount] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const escapePressedRef = useRef(false)

  const { mutate: updateAmount, isPending: isUpdating } = useUpdateBudgetAmount()
  const { mutate: createBudget, isPending: isCreating } = useCreateBudget()

  // Синхронизация с сервером когда не редактируем
  useEffect(() => {
    if (!isEditing && !isUpdating && budget) {
      setLocalAmount(formatNumber(budget.planned_amount))
    }
  }, [budget, isEditing, isUpdating])

  const saveToServer = useCallback(() => {
    if (!budget) return
    const newAmount = parseAmount(localAmount)
    if (newAmount >= 0 && newAmount !== budget.planned_amount) {
      updateAmount({
        budget_id: budget.budget_id,
        total_amount: newAmount,
        previous_amount: budget.planned_amount,
      })
    }
  }, [budget, localAmount, updateAmount])

  const handleFocus = useCallback(() => setIsEditing(true), [])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement
    if (input.selectionStart === input.selectionEnd) input.select()
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalAmount(e.target.value.replace(/[^\d]/g, ''))
  }, [])

  const handleBlur = useCallback(() => {
    if (!escapePressedRef.current) {
      saveToServer()
    }
    escapePressedRef.current = false
    setIsEditing(false)
  }, [saveToServer])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      escapePressedRef.current = true
      if (budget) setLocalAmount(formatNumber(budget.planned_amount))
      setIsEditing(false)
      ;(e.target as HTMLInputElement).blur()
    }
  }, [budget])

  const handleCreate = useCallback(() => {
    createBudget({ entity_type: entityType, entity_id: entityId, name: 'Бюджет', total_amount: 0 })
  }, [createBudget, entityType, entityId])

  if (!hasBudget) {
    if (!canCreate) return null
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
        {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : (
          <><Plus className="w-3 h-3" /><span>Бюджет</span></>
        )}
      </button>
    )
  }

  const isPending = isUpdating || isCreating

  // Процент считаем из текущего локального значения (обновляется в реальном времени при вводе)
  const currentAmount = isEditing ? parseAmount(localAmount) : (budget.planned_amount || 0)
  const displayPercent = hasParent && parentAmount > 0
    ? calculatePercentage(currentAmount, parentAmount)
    : null

  return (
    <div className="flex items-center gap-1">
      {/* Сумма — редактируемая */}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={localAmount}
          onChange={handleChange}
          onFocus={handleFocus}
          onMouseUp={handleMouseUp}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          disabled={isPending || !canEdit}
          className={cn(
            'w-[70px] h-5 px-1 text-[11px] tabular-nums text-right',
            'bg-transparent border-0 outline-none',
            'transition-colors',
            canEdit && 'hover:bg-muted/50 focus:bg-muted/70 rounded',
            !canEdit && 'cursor-default',
            isPending && 'opacity-50',
            isOverBudget ? 'text-destructive font-medium' : 'text-primary font-medium'
          )}
          placeholder="0"
        />
        {isPending && (
          <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 h-2.5 w-2.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Процент от родителя — только для чтения, обновляется при вводе суммы */}
      {displayPercent !== null && (
        <span className="text-[10px] tabular-nums text-muted-foreground/70 min-w-[32px] text-right">
          {displayPercent}%
        </span>
      )}
    </div>
  )
}
