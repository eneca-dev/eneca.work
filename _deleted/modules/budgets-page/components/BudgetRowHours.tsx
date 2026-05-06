/**
 * Budget Row Hours Component
 *
 * Отображение часов (плановые / приведённые / % от родителя).
 */

'use client'

import { cn } from '@/lib/utils'
import { HoursInput } from './HoursInput'
import { ItemHoursEdit } from './ItemHoursEdit'

interface BudgetRowHoursProps {
  /** Тип узла */
  nodeType: 'project' | 'object' | 'section' | 'decomposition_stage' | 'decomposition_item'
  /** ID узла (для редактирования задачи) */
  nodeId: string
  /** Плановые часы */
  plannedHours: number
  /** Приведённые часы (с коэффициентом) */
  adjustedHours: number
  /** Процент от родительских часов */
  percentOfParentHours: number | null
  /** Callback для обновления данных */
  onSuccess?: () => void
}

/** Форматирует число с разделителями тысяч */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

export function BudgetRowHours({
  nodeType,
  nodeId,
  plannedHours,
  adjustedHours,
  percentOfParentHours,
  onSuccess,
}: BudgetRowHoursProps) {
  const isItem = nodeType === 'decomposition_item'
  const isSection = nodeType === 'section'
  const isTopLevel = nodeType === 'project' || nodeType === 'object'

  return (
    <div className="flex items-center shrink-0 border-l border-border/30">
      {/* Плановые часы */}
      <div className="w-[72px] px-2 text-right">
        {isItem ? (
          <ItemHoursEdit
            itemId={nodeId}
            value={plannedHours}
            onSuccess={onSuccess}
          />
        ) : (
          <HoursInput
            value={plannedHours}
            readOnly
            dimIfZero
            bold={isSection || isTopLevel}
          />
        )}
      </div>

      {/* С коэффициентом (приведённые часы) */}
      <div className="w-[72px] px-2 text-right">
        {adjustedHours > 0 ? (
          <span className={cn(
            'text-[12px] tabular-nums',
            isSection || isTopLevel ? 'text-foreground/80 font-medium' : 'text-muted-foreground'
          )}>
            {formatNumber(Math.round(adjustedHours))}
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground/50 tabular-nums">0</span>
        )}
      </div>

      {/* % от родителя (доля часов от родительских) */}
      <div className="w-[52px] px-1 text-right">
        {percentOfParentHours !== null ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {percentOfParentHours}%
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/30">—</span>
        )}
      </div>
    </div>
  )
}
