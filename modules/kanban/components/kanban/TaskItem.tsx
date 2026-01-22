'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { WorkLogCreateModal, TaskSidebar } from '@/modules/modals'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import { useKanbanFiltersStore } from '../../stores'
import type { KanbanStage, KanbanSection, KanbanTask } from '../../types'
import { CircularProgress } from './CircularProgress'

// ============================================================================
// CPI Status Helper
// ============================================================================

interface CPIStatus {
  color: string
  bgColor: string
  icon: typeof TrendingUp
  label: string
  description: string
}

/**
 * Get CPI (Cost Performance Index) status for visual indicator
 */
export function getCPIStatus(cpi: number | null): CPIStatus {
  if (cpi === null || cpi === undefined) {
    return {
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/20',
      icon: Minus,
      label: 'Нет данных',
      description: 'Нет фактических часов для расчета эффективности',
    }
  }

  if (cpi >= 1.0) {
    return {
      color: 'text-emerald-600 dark:text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      icon: TrendingUp,
      label: 'Эффективно',
      description: `CPI: ${cpi.toFixed(2)} — Работаем эффективнее плана`,
    }
  }

  if (cpi >= 0.8) {
    return {
      color: 'text-amber-600 dark:text-amber-500',
      bgColor: 'bg-amber-500/10',
      icon: Minus,
      label: 'Приемлемо',
      description: `CPI: ${cpi.toFixed(2)} — Небольшой перерасход времени`,
    }
  }

  return {
    color: 'text-red-600 dark:text-red-500',
    bgColor: 'bg-red-500/10',
    icon: TrendingDown,
    label: 'Критично',
    description: `CPI: ${cpi.toFixed(2)} — Значительный перерасход времени`,
  }
}

// ============================================================================
// TaskItem Component
// ============================================================================

interface TaskItemProps {
  task: KanbanTask
  section: KanbanSection
  stage: KanbanStage
}

/**
 * Task item row inside a kanban card
 *
 * Displays task description, hours, progress indicator, and CPI badge.
 * Clicking opens modals for editing or logging work.
 */
export function TaskItem({ task, section, stage }: TaskItemProps) {
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false)
  const [isTaskSidebarOpen, setIsTaskSidebarOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const queryClient = useQueryClient()
  const { getQueryParams } = useKanbanFiltersStore()

  return (
    <>
      <div className="flex items-center gap-2 py-2">
        {/* Task description - click opens TaskSidebar */}
        <span
          className={cn(
            'flex-1 text-xs truncate cursor-pointer hover:text-primary transition-colors',
            task.progress === 100
              ? 'text-muted-foreground line-through'
              : 'text-foreground'
          )}
          title={`${task.description} (клик для редактирования)`}
          onClick={(e) => {
            e.stopPropagation()
            setIsTaskSidebarOpen(true)
          }}
        >
          {task.description}
        </span>

        {/* Hours and Progress */}
        <div
          className="flex items-center gap-2 flex-shrink-0 relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* CPI Indicator for Task */}
          {task.actualHours > 0 && (() => {
            const cpiStatus = getCPIStatus(task.cpi)
            const CPIIcon = cpiStatus.icon
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      'flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0',
                      cpiStatus.bgColor
                    )}>
                      <CPIIcon className={cn('w-2.5 h-2.5', cpiStatus.color)} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-semibold">{cpiStatus.label}</div>
                      <div className="text-[10px]">{cpiStatus.description}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })()}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsWorkLogModalOpen(true)
                  }}
                >
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {task.actualHours}/{task.plannedHours} ч
                  </span>
                  {isHovered && (
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Внести отчёт</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Mini Circular Progress */}
          <CircularProgress
            progress={task.progress}
            variant="task"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              setIsTaskSidebarOpen(true)
            }}
          />
        </div>
      </div>

      {/* WorkLog Create Modal */}
      <WorkLogCreateModal
        isOpen={isWorkLogModalOpen}
        onClose={() => setIsWorkLogModalOpen(false)}
        onSuccess={() => {
          setIsWorkLogModalOpen(false)
          queryClient.invalidateQueries({
            queryKey: queryKeys.kanban.infinite(getQueryParams())
          })
        }}
        sectionId={section.id}
        sectionName={section.name}
        defaultItemId={task.id}
      />

      {/* Task Sidebar */}
      <TaskSidebar
        isOpen={isTaskSidebarOpen}
        onClose={() => setIsTaskSidebarOpen(false)}
        onSuccess={() => {
          setIsTaskSidebarOpen(false)
          queryClient.invalidateQueries({
            queryKey: queryKeys.kanban.infinite(getQueryParams())
          })
        }}
        task={{
          id: task.id,
          description: task.description,
          plannedHours: task.plannedHours,
          plannedDueDate: task.dueDate || null,
          progress: task.progress,
          order: task.order,
          responsible: task.responsible ? {
            id: task.responsible.userId,
            firstName: task.responsible.firstName,
            lastName: task.responsible.lastName,
            name: null,
          } : {
            id: null,
            firstName: null,
            lastName: null,
            name: null,
          },
          status: {
            id: null,
            name: null,
            color: null,
          },
          difficulty: {
            id: null,
            abbr: null,
            name: null,
          },
          workCategoryId: null,
          workCategoryName: task.workCategory || null,
        }}
        taskId={task.id}
        sectionId={section.id}
        stageId={stage.id}
      />
    </>
  )
}
