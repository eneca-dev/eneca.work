/**
 * Budget Cell Component
 *
 * Ячейка с бюджетами для строки иерархии.
 * Отображает индивидуальные бюджеты с возможностью редактирования и создания.
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
  /** Компактный режим */
  compact?: boolean
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
  compact,
  className,
}: BudgetCellProps) {
  // Фильтруем только активные бюджеты
  const activeBudgets = budgets.filter((b) => b.is_active)

  // Если нет бюджетов - показываем только кнопку создания
  if (activeBudgets.length === 0) {
    return (
      <div className={cn('flex items-center', className)}>
        <BudgetCreatePopover
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          existingBudgets={budgets}
          trigger={
            <button
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'transition-colors'
              )}
            >
              <Plus className="h-3 w-3" />
              <span>Добавить</span>
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', compact ? 'gap-0.5' : 'gap-1', className)}>
      {/* Budget list with edit capability */}
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
          compact={compact}
        />
      ))}

      {/* Add button (shown on hover via CSS in parent) */}
      <div className="flex justify-end mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <BudgetCreatePopover
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          existingBudgets={budgets}
          trigger={
            <button
              className={cn(
                'w-4 h-4 flex items-center justify-center rounded',
                'text-muted-foreground/50 hover:text-foreground hover:bg-muted',
                'transition-colors'
              )}
              title="Добавить бюджет"
            >
              <Plus className="h-3 w-3" />
            </button>
          }
        />
      </div>
    </div>
  )
}
