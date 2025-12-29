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
import type { BudgetEntityType } from '@/modules/budgets/types'
import type { BudgetInfo } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetCellProps {
  /** Индивидуальные бюджеты узла */
  budgets: BudgetInfo[]
  /** Тип сущности */
  entityType: BudgetEntityType
  /** ID сущности */
  entityId: string
  /** Название сущности */
  entityName: string
  /** CSS класс */
  className?: string
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
}: BudgetCellProps) {
  // Фильтруем только активные бюджеты
  const activeBudgets = budgets.filter((b) => b.is_active)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Budget items with inline editing */}
      {activeBudgets.length > 0 ? (
        <div className="flex flex-col gap-1">
          {activeBudgets.map((budget) => (
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
            />
          ))}
        </div>
      ) : (
        <span className="text-[11px] text-slate-600">—</span>
      )}

      {/* Add button */}
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
    </div>
  )
}
