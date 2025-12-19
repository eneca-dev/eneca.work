'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Plus } from 'lucide-react'
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
import { WorkLogCreateModal, ProgressUpdateDialog } from '@/modules/modals'
import { formatHoursCompact } from '../../../utils'
import { ROW_HEIGHT, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../../constants'

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
  /** Callback для обновления данных после создания отчёта */
  onWorkLogCreated?: () => void
  /** Callback для обновления данных после изменения прогресса */
  onProgressUpdated?: () => void
  /** Родительский этап наведён (для подсветки связанных элементов) */
  isParentHovered?: boolean
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
  onWorkLogCreated,
  onProgressUpdated,
  isParentHovered,
}: DecompositionItemRowProps) {
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false)
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false)
  const [isTaskSidebarOpen, setIsTaskSidebarOpen] = useState(false)
  const label = item.description || 'Без описания'

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
  const depth = 5

  // Прогресс (0-100)
  const progress = item.progress ?? 0

  return (
    <>
      <div
        className={cn(
          'flex border-b border-border/50 hover:bg-muted/30 transition-colors group/item',
          isParentHovered && 'bg-primary/5'
        )}
        style={{ height: ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left */}
        <div
          className={cn(
            'flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-20',
            isParentHovered ? 'bg-primary/5' : 'bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Spacer for alignment */}
          <div className="w-5 shrink-0" />

          {/* Progress Circle - кликабельный */}
          <TooltipProvider delayDuration={200}>
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
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsWorkLogModalOpen(true)}
                  className={cn(
                    'p-0.5 rounded transition-all',
                    'text-muted-foreground/50 hover:text-green-500 hover:bg-green-500/10',
                    'opacity-0 group-hover:opacity-100'
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
        </div>

        {/* Timeline area */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
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
