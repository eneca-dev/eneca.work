'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type { DecompositionItem, TimelineRange, WorkLog } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { TimelineGrid, ProgressCircle } from '../shared'
import { WorkLogMarkers } from '../WorkLogMarkers'
import { ProgressHistoryMarkers } from '../ProgressHistoryMarkers'
import { SectionPeriodFrame } from '../SectionPeriodFrame'
import { WorkLogCreateModal, ProgressUpdateDialog } from '@/modules/modals'
import { formatHoursCompact, formatBudgetAmount } from '../../../utils'
import { ROW_HEIGHT, ITEM_ROW_HEIGHT_WITH_HISTORY, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../../constants'
import { useDeleteDecompositionItem } from '../../../hooks'

// Dynamic import для TaskSidebar
const TaskSidebar = dynamic(
  () => import('@/modules/modals/components/task/TaskSidebar').then(mod => mod.TaskSidebar),
  { ssr: false }
)

// ============================================================================
// Decomposition Item Row
// ============================================================================

interface DecompositionItemRowProps {
  item: DecompositionItem
  dayCells: DayCell[]
  range: TimelineRange
  /** Work logs для этого раздела (фильтруем по itemId) */
  workLogs?: WorkLog[]
  /** ID раздела (для модалки создания отчёта) */
  sectionId: string
  /** Название раздела (для модалки создания отчёта) */
  sectionName: string
  /** Дата начала этапа */
  stageStartDate?: string | null
  /** Дата окончания этапа */
  stageEndDate?: string | null
  /** Callback для обновления данных после создания отчёта */
  onWorkLogCreated?: () => void
  /** Callback для обновления данных после изменения прогресса */
  onProgressUpdated?: () => void
}

/**
 * Строка задачи декомпозиции - без дат, но с work logs
 */
export function DecompositionItemRow({
  item,
  dayCells,
  range,
  workLogs,
  sectionId,
  sectionName,
  stageStartDate,
  stageEndDate,
  onWorkLogCreated,
  onProgressUpdated,
}: DecompositionItemRowProps) {
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false)
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false)
  const [isTaskSidebarOpen, setIsTaskSidebarOpen] = useState(false)
  const label = item.description || 'Без описания'

  // Mutation for deleting task
  const deleteTask = useDeleteDecompositionItem()

  // Handler for delete with confirmation
  const handleDelete = useCallback(() => {
    if (window.confirm(`Удалить задачу "${label}"?\nВсе связанные отчёты будут удалены.`)) {
      deleteTask.mutate({
        itemId: item.id,
        sectionId,
      }, {
        onSuccess: () => {
          onProgressUpdated?.()
        },
      })
    }
  }, [deleteTask, item.id, sectionId, label, onProgressUpdated])

  // Фильтруем work logs только для этого item
  const itemWorkLogs = useMemo(() => {
    return workLogs?.filter(log => log.itemId === item.id) || []
  }, [workLogs, item.id])

  // Считаем фактические часы из work logs
  const actualHours = useMemo(() => {
    return itemWorkLogs.reduce((sum, log) => sum + log.hours, 0)
  }, [itemWorkLogs])

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 4

  // Прогресс (0-100)
  const progress = item.progress ?? 0

  // Используем расширенную высоту если есть история прогресса
  const hasProgressHistory = item.progressHistory && item.progressHistory.length > 0
  const rowHeight = hasProgressHistory ? ITEM_ROW_HEIGHT_WITH_HISTORY : ROW_HEIGHT

  return (
    <>
      <div
        className={cn(
          'flex border-b border-border/50 group/item'
        )}
        style={{ height: rowHeight, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left */}
        <div
          className="flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-40 bg-background"
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Spacer for alignment */}
          <div className="w-5 shrink-0" />

          {/* Progress Circle - кликабельный */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsProgressDialogOpen(true)}
                  className={cn(
                    'rounded-full transition-all shrink-0',
                    'hover:ring-2 hover:ring-primary/30 hover:scale-110',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50'
                  )}
                >
                  <ProgressCircle
                    progress={progress}
                    size={22}
                    strokeWidth={2.5}
                    color={item.status.color || undefined}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Готовность: {progress}%
                {item.progressDelta !== null && item.progressDelta !== 0 && (
                  <> ({item.progressDelta > 0 ? '+' : ''}{item.progressDelta}%)</>
                )}
                {' — нажмите для изменения'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Label - кликабельный */}
          <button
            className={cn(
              'text-[11px] text-muted-foreground truncate flex-1 min-w-0 text-left',
              'hover:text-foreground transition-colors cursor-pointer'
            )}
            title={`${label} — нажмите для просмотра`}
            onClick={(e) => {
              e.stopPropagation()
              setIsTaskSidebarOpen(true)
            }}
          >
            {label}
          </button>

          {/* Hours: план / факт */}
          <div className="flex items-center gap-1 shrink-0 text-[10px] tabular-nums">
            {actualHours > 0 && (
              <span className="text-emerald-500 font-medium">
                {formatHoursCompact(actualHours)}
              </span>
            )}
            {actualHours > 0 && item.plannedHours > 0 && (
              <span className="text-muted-foreground/50">/</span>
            )}
            {item.plannedHours > 0 && (
              <span className="text-muted-foreground">
                {formatHoursCompact(item.plannedHours)}
              </span>
            )}
          </div>

          {/* Budget indicator - compact */}
          {item.budget && item.budget.total > 0 && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex items-center gap-0.5 shrink-0 text-[9px] tabular-nums px-1 py-0.5 rounded',
                      item.budget.percentage >= 100
                        ? 'text-red-500 bg-red-500/10'
                        : item.budget.percentage >= 80
                          ? 'text-amber-500 bg-amber-500/10'
                          : 'text-muted-foreground bg-muted/30'
                    )}
                  >
                    <Wallet className="w-2.5 h-2.5" />
                    <span className="font-medium">{Math.round(item.budget.percentage)}%</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="space-y-0.5">
                    <div>Бюджет: {formatBudgetAmount(item.budget.total)}</div>
                    <div>Израсходовано: {formatBudgetAmount(item.budget.spent)} ({Math.round(item.budget.percentage)}%)</div>
                    <div>Остаток: {formatBudgetAmount(item.budget.remaining)}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Кнопка добавления отчёта */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsWorkLogModalOpen(true)}
                  className={cn(
                    'p-0.5 rounded transition-all',
                    'text-muted-foreground/50 hover:text-green-500 hover:bg-green-500/10',
                    'opacity-0 group-hover/item:opacity-100'
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Добавить отчёт
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Кнопка удаления задачи */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleDelete}
                  disabled={deleteTask.isPending}
                  className={cn(
                    'p-0.5 rounded transition-all',
                    'text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10',
                    'opacity-0 group-hover/item:opacity-100',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Удалить задачу
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Timeline area - isolate + overflow-hidden to contain elements */}
        <div className="relative isolate overflow-hidden" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
          {/* Stage period frame (semi-transparent) */}
          <div className="absolute inset-0 opacity-30 saturate-50">
            <SectionPeriodFrame
              startDate={stageStartDate}
              endDate={stageEndDate}
              range={range}
              color="#64748b"
            />
          </div>
          {itemWorkLogs.length > 0 && (
            <WorkLogMarkers
              workLogs={itemWorkLogs}
              range={range}
              timelineWidth={timelineWidth}
            />
          )}

          {/* Progress History Markers - показываем изменения прогресса по дням */}
          {item.progressHistory && item.progressHistory.length > 0 && (
            <ProgressHistoryMarkers
              progressHistory={item.progressHistory}
              range={range}
              timelineWidth={timelineWidth}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <WorkLogCreateModal
        isOpen={isWorkLogModalOpen}
        onClose={() => setIsWorkLogModalOpen(false)}
        sectionId={sectionId}
        sectionName={sectionName}
        defaultItemId={item.id}
        onSuccess={onWorkLogCreated}
      />

      <ProgressUpdateDialog
        isOpen={isProgressDialogOpen}
        onClose={() => setIsProgressDialogOpen(false)}
        itemId={item.id}
        itemName={label}
        currentProgress={progress}
        onSuccess={() => {
          setIsProgressDialogOpen(false)
          onProgressUpdated?.()
        }}
      />

      <TaskSidebar
        isOpen={isTaskSidebarOpen}
        onClose={() => setIsTaskSidebarOpen(false)}
        task={item}
        taskId={item.id}
        sectionId={sectionId}
        stageId={item.stageId}
        onSuccess={() => {
          onProgressUpdated?.()
        }}
      />
    </>
  )
}
