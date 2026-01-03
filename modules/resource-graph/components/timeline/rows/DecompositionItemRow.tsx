'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Plus, Trash2 } from 'lucide-react'
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
import { SectionPeriodFrame } from '../SectionPeriodFrame'
import { WorkLogCreateModal, ProgressUpdateDialog } from '@/modules/modals'
import { formatHoursCompact } from '../../../utils'
import { ROW_HEIGHT, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../../constants'
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

  return (
    <>
      <div
        className={cn(
          'flex border-b border-border/50 group/item'
        )}
        style={{ height: ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left */}
        <div
          className="flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-20 bg-background"
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
                Готовность: {progress}% — нажмите для изменения
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

        {/* Timeline area */}
        <div className="relative" style={{ width: timelineWidth }}>
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
