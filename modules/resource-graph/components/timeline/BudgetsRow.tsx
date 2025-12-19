'use client'

import { useState } from 'react'
import { ChevronRight, Wallet, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { BudgetCreateModal } from '@/modules/modals'
import { useDeactivateBudget, type BudgetCurrent } from '@/modules/budgets'
import type { DayCell } from './TimelineHeader'
import type { TimelineRange } from '../../types'
import { TimelineGrid } from './shared'
import { calculateBarPosition } from './TimelineBar'
import { SectionPeriodFrame } from './SectionPeriodFrame'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'

// ============================================================================
// Constants
// ============================================================================

const BUDGET_ROW_HEIGHT = 28

// ============================================================================
// Types
// ============================================================================

interface BudgetsRowProps {
  sectionId: string
  sectionName: string
  dayCells: DayCell[]
  depth: number
  range: TimelineRange
  sectionStartDate: string | null
  sectionEndDate: string | null
  /** Бюджеты раздела (загружаются в родительском компоненте) */
  budgets: BudgetCurrent[] | undefined
  /** Идёт загрузка бюджетов */
  budgetsLoading: boolean
  /** Callback для перезагрузки данных */
  onRefetch?: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * Строка бюджетов раздела — свёрнутая по умолчанию
 * При развороте показывает список бюджетов с прогрессом освоения
 */
export function BudgetsRow({
  sectionId,
  sectionName,
  dayCells,
  depth,
  range,
  sectionStartDate,
  sectionEndDate,
  budgets,
  budgetsLoading: isLoading,
  onRefetch: refetch,
}: BudgetsRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // Подсчёт общей статистики
  const totalPlanned = budgets?.reduce((sum, b) => sum + (b.planned_amount || 0), 0) ?? 0
  const totalSpent = budgets?.reduce((sum, b) => sum + (b.spent_amount || 0), 0) ?? 0
  const budgetCount = budgets?.length ?? 0
  const totalPercentage = totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0

  // Цвет общего процента
  const getTotalProgressColor = () => {
    if (totalPercentage >= 90) return 'text-red-500'
    if (totalPercentage >= 70) return 'text-amber-500'
    return 'text-emerald-500'
  }

  // Форматирование суммы
  const formatAmount = (amount: number) => {
    return Math.round(amount).toLocaleString('ru-RU')
  }

  return (
    <>
      {/* Заголовок строки бюджетов */}
      <div
        className="flex border-b border-border/50 hover:bg-muted/30 transition-colors"
        style={{ height: BUDGET_ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar */}
        <div
          className="flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-20 bg-background"
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
          >
            <ChevronRight
              className={cn(
                'w-3 h-3 text-muted-foreground transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </button>

          {/* Icon */}
          <Wallet className="w-3.5 h-3.5 text-amber-500 shrink-0" />

          {/* Label */}
          <span className="text-[11px] text-muted-foreground font-medium shrink-0">
            Бюджеты
          </span>

          {/* Loading */}
          {isLoading && (
            <Loader2 className="w-3 h-3 text-muted-foreground animate-spin ml-auto" />
          )}

          {/* Summary - compact */}
          {!isLoading && budgetCount > 0 && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    'text-[10px] font-medium ml-auto tabular-nums shrink-0',
                    getTotalProgressColor()
                  )}>
                    {totalPercentage}%
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="space-y-1">
                    <div>Всего бюджетов: {budgetCount}</div>
                    <div>Освоено: {formatAmount(totalSpent)} BYN ({totalPercentage}%)</div>
                    <div>Запланировано: {formatAmount(totalPlanned)} BYN</div>
                    <div>Остаток: {formatAmount(totalPlanned - totalSpent)} BYN</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {!isLoading && budgetCount === 0 && (
            <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">
              нет
            </span>
          )}

          {/* Add budget button */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsCreateModalOpen(true)
                  }}
                  className={cn(
                    'p-0.5 rounded transition-all shrink-0',
                    'hover:bg-primary/10 hover:text-primary',
                    'text-muted-foreground/50',
                    budgetCount === 0 ? 'ml-1' : 'ml-2'
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Добавить бюджет
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Timeline - показываем период раздела */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
          <SectionPeriodFrame
            startDate={sectionStartDate}
            endDate={sectionEndDate}
            range={range}
          />
        </div>
      </div>

      {/* Развёрнутый список бюджетов */}
      {isExpanded && budgets && budgets.length > 0 && (
        <>
          {budgets.map((budget) => (
            <BudgetItemRow
              key={budget.budget_id}
              budget={budget}
              dayCells={dayCells}
              depth={depth + 1}
              timelineWidth={timelineWidth}
              totalWidth={totalWidth}
              range={range}
              sectionStartDate={sectionStartDate}
              sectionEndDate={sectionEndDate}
              onRefetch={refetch}
            />
          ))}
        </>
      )}

      {/* Модалка создания бюджета */}
      <BudgetCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refetch()}
        entityType="section"
        entityId={sectionId}
        entityName={sectionName}
      />
    </>
  )
}

// ============================================================================
// Budget Item Row
// ============================================================================

interface BudgetItemRowProps {
  budget: {
    budget_id: string
    name: string
    planned_amount: number
    spent_amount: number
    spent_percentage: number
    type_name: string | null
    type_color: string | null
  }
  dayCells: DayCell[]
  depth: number
  timelineWidth: number
  totalWidth: number
  range: TimelineRange
  sectionStartDate: string | null
  sectionEndDate: string | null
  onRefetch?: () => void
}

function BudgetItemRow({ budget, dayCells, depth, timelineWidth, totalWidth, range, sectionStartDate, sectionEndDate, onRefetch }: BudgetItemRowProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const deactivateMutation = useDeactivateBudget()

  const handleDelete = () => {
    deactivateMutation.mutate(budget.budget_id, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false)
        onRefetch?.()
      },
    })
  }

  const formatAmount = (amount: number) => {
    return Math.round(amount).toLocaleString('ru-RU')
  }

  // Цвет прогресса
  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '#ef4444' // red - перерасход близко
    if (percentage >= 70) return '#f59e0b' // amber - внимание
    return '#22c55e' // green - норма
  }

  const progressColor = getProgressColor(budget.spent_percentage)
  const typeColor = budget.type_color || '#6b7280'

  // Позиция прогресс-бара в пределах периода раздела
  const barPosition = calculateBarPosition(sectionStartDate, sectionEndDate, range)

  return (
    <div
      className="group flex border-b border-border/30 hover:bg-muted/20 transition-colors"
      style={{ height: BUDGET_ROW_HEIGHT, minWidth: totalWidth }}
    >
      {/* Sidebar */}
      <div
        className="flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-20 bg-background group-hover:bg-muted/20"
        style={{
          width: SIDEBAR_WIDTH,
          paddingLeft: 8 + depth * 16,
        }}
      >
        {/* Spacer */}
        <div className="w-4 shrink-0" />

        {/* Type indicator */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: typeColor }}
        />

        {/* Name */}
        <span className="text-[11px] text-muted-foreground truncate flex-1 min-w-0" title={budget.name}>
          {budget.type_name || budget.name}
        </span>

        {/* Amount */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] tabular-nums shrink-0 ml-auto" style={{ color: progressColor }}>
                {formatAmount(budget.spent_amount)} / {formatAmount(budget.planned_amount)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="space-y-1">
                <div className="font-medium">{budget.name}</div>
                <div>Освоено: {formatAmount(budget.spent_amount)} BYN ({Math.round(budget.spent_percentage)}%)</div>
                <div>Запланировано: {formatAmount(budget.planned_amount)} BYN</div>
                <div>Остаток: {formatAmount(budget.planned_amount - budget.spent_amount)} BYN</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Delete button */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <button
                    className={cn(
                      'p-0.5 rounded transition-all shrink-0 ml-1',
                      'text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10',
                      'opacity-0 group-hover:opacity-100'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Удалить бюджет
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Удалить бюджет?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Бюджет «{budget.name}» будет деактивирован.
                <br />
                <span className="text-amber-600 dark:text-amber-400">
                  Связь с журналом работ будет потеряна.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs h-8">Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deactivateMutation.isPending}
                className="bg-red-500 hover:bg-red-600 text-xs h-8"
              >
                {deactivateMutation.isPending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Удаление...
                  </>
                ) : (
                  'Удалить'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Timeline - progress bar в пределах периода раздела */}
      <div className="relative" style={{ width: timelineWidth }}>
        <TimelineGrid dayCells={dayCells} />

        {/* Progress bar - позиционируется по датам раздела */}
        {barPosition && (
          <div
            className="absolute inset-y-0 flex items-center px-2"
            style={{
              left: barPosition.left,
              width: barPosition.width,
            }}
          >
            <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(budget.spent_percentage, 100)}%`,
                  backgroundColor: progressColor,
                  opacity: 0.7,
                }}
              />
            </div>
            {/* Percentage label */}
            <span
              className="text-[9px] font-medium tabular-nums ml-1 shrink-0"
              style={{ color: progressColor }}
            >
              {Math.round(budget.spent_percentage)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
