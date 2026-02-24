/**
 * Budget Bars Component
 *
 * Отображает прогресс-бары по типам бюджетов.
 * Каждый бар показывает процент освоения (spent/planned).
 */

'use client'

import { cn } from '@/lib/utils'
import { formatAmount } from '../utils'
import type { AggregatedBudgetsByType } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetBarsProps {
  /** Агрегированные бюджеты по типам */
  budgets: AggregatedBudgetsByType[]
  /** Компактный режим (меньше отступов) */
  compact?: boolean
  /** CSS класс контейнера */
  className?: string
}

interface SingleBarProps {
  /** Название типа бюджета */
  label: string
  /** Цвет типа */
  color: string
  /** Процент освоения */
  percentage: number
  /** Плановая сумма */
  planned: number
  /** Освоенная сумма */
  spent: number
  /** Компактный режим */
  compact?: boolean
}

// ============================================================================
// Single Bar
// ============================================================================

function SingleBar({ label, color, percentage, planned, spent, compact }: SingleBarProps) {
  // Ограничиваем процент для визуализации (может быть больше 100% при перерасходе)
  const visualPercentage = Math.min(percentage, 100)
  const isOverBudget = percentage > 100

  return (
    <div className={cn('flex items-center gap-2', compact ? 'gap-1.5' : 'gap-2')}>
      {/* Label */}
      <span
        className={cn(
          'text-xs font-medium shrink-0 truncate',
          compact ? 'w-12' : 'w-16'
        )}
        style={{ color }}
        title={label}
      >
        {label}
      </span>

      {/* Progress bar container */}
      <div
        className={cn(
          'flex-1 bg-muted/30 rounded-full overflow-hidden',
          compact ? 'h-2' : 'h-2.5'
        )}
      >
        {/* Filled portion */}
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

      {/* Percentage + amounts tooltip */}
      <span
        className={cn(
          'text-xs tabular-nums shrink-0',
          isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'
        )}
        title={`${formatAmount(spent)} / ${formatAmount(planned)} BYN`}
      >
        {percentage}%
      </span>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetBars({ budgets, compact, className }: BudgetBarsProps) {
  if (!budgets || budgets.length === 0) {
    return (
      <div className={cn('text-xs text-muted-foreground italic', className)}>
        Нет бюджетов
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', compact ? 'gap-1' : 'gap-1.5', className)}>
      {budgets.map((budget) => (
        <SingleBar
          key={budget.type_id}
          label={budget.type_name}
          color={budget.type_color}
          percentage={budget.percentage}
          planned={budget.total_planned}
          spent={budget.total_spent}
          compact={compact}
        />
      ))}
    </div>
  )
}
