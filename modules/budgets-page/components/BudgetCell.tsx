/**
 * Budget Cell Component
 *
 * Ячейка с бюджетами - inline редактирование суммы и процента.
 * Если несколько бюджетов - показываем вертикально.
 */

'use client'

import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BudgetAmountEdit } from './BudgetAmountEdit'
import { BudgetCreatePopover } from './BudgetCreatePopover'
import type { BudgetInfo, BudgetPageEntityType } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetCellProps {
  /** Индивидуальные бюджеты узла */
  budgets: BudgetInfo[]
  /** Тип сущности */
  entityType: BudgetPageEntityType
  /** ID сущности */
  entityId: string
  /** Название сущности */
  entityName: string
  /** CSS класс */
  className?: string
  /** Показывать только основной бюджет */
  showOnlyMain?: boolean
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetCell({
  budgets,
  entityType,
  entityId,
  entityName,
  className,
  showOnlyMain = false,
}: BudgetCellProps) {
  // Фильтруем бюджеты
  let displayBudgets = budgets.filter((b) => b.is_active)

  // Если нужен только основной - берём первый или с type_name "Основной"
  if (showOnlyMain && displayBudgets.length > 0) {
    const mainBudget = displayBudgets.find(b => b.type_name === 'Основной') || displayBudgets[0]
    displayBudgets = [mainBudget]
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Budget items with inline editing */}
      {displayBudgets.length > 0 ? (
        <div className="flex flex-col gap-1 flex-1">
          {displayBudgets.map((budget) => (
            <BudgetAmountEdit
              key={budget.budget_id}
              budgetId={budget.budget_id}
              currentAmount={budget.planned_amount}
              spentAmount={budget.spent_amount}
              color={budget.type_color || '#6b7280'}
              label={budget.type_name || budget.name}
              spentPercentage={budget.spent_percentage}
              parentPlannedAmount={budget.parent_planned_amount}
              compact
              hideColorDot={showOnlyMain}
            />
          ))}
        </div>
      ) : (
        <span className="text-[11px] text-slate-600">—</span>
      )}

      {/* Add button - скрываем если showOnlyMain */}
      {!showOnlyMain && (
        <BudgetCreatePopover
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          existingBudgets={budgets}
          trigger={
            <button
              className={cn(
                'w-5 h-5 flex items-center justify-center rounded shrink-0',
                'text-slate-600 hover:text-slate-400 hover:bg-slate-800',
                'transition-colors opacity-0 group-hover:opacity-100'
              )}
              title="Добавить бюджет"
            >
              <Plus className="h-3 w-3" />
            </button>
          }
        />
      )}
    </div>
  )
}
