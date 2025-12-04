'use client'

import { useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import {
  Clock,
  Calendar,
  User,
  CheckCircle2,
  Circle,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { KanbanStage, KanbanSection, KanbanTask } from '../types'
import { getColumnById } from '../constants'
import { useKanbanStore } from '../stores/kanban-store'

interface StageDetailModalProps {
  stage: KanbanStage | null
  section: KanbanSection | null
  isOpen: boolean
  onClose: () => void
}

interface TaskItemProps {
  task: KanbanTask
  sectionId: string
  stageId: string
}

function TaskItem({ task, sectionId, stageId }: TaskItemProps) {
  const { updateTaskProgress } = useKanbanStore()

  const handleProgressChange = useCallback(
    (value: number[]) => {
      updateTaskProgress(sectionId, stageId, task.id, value[0])
    },
    [sectionId, stageId, task.id, updateTaskProgress]
  )

  const isCompleted = task.progress === 100

  return (
    <div
      className={cn(
        'p-4 rounded-lg border bg-card',
        'transition-all duration-200',
        isCompleted && 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Completion indicator */}
        <div className="flex-shrink-0 mt-0.5">
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Task description */}
          <p
            className={cn(
              'text-sm font-medium leading-relaxed',
              isCompleted && 'text-muted-foreground line-through'
            )}
          >
            {task.description}
          </p>

          {/* Task meta */}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
            {/* Work category */}
            {task.workCategory && (
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                <span>{task.workCategory}</span>
              </div>
            )}

            {/* Planned hours */}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{task.plannedHours}ч</span>
            </div>

            {/* Due date */}
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {format(new Date(task.dueDate), 'd MMM', { locale: ru })}
                </span>
              </div>
            )}
          </div>

          {/* Progress slider */}
          <div className="mt-3 flex items-center gap-3">
            <Slider
              value={[task.progress]}
              min={0}
              max={100}
              step={5}
              onValueChange={handleProgressChange}
              className={cn(
                'flex-1',
                '[&_[role=slider]]:h-4 [&_[role=slider]]:w-4',
                '[&_[role=slider]]:border-2',
                isCompleted && '[&_[role=slider]]:border-emerald-500'
              )}
            />
            <span
              className={cn(
                'text-sm font-medium w-10 text-right',
                isCompleted && 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {task.progress}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StageDetailModal({
  stage,
  section,
  isOpen,
  onClose,
}: StageDetailModalProps) {
  if (!stage || !section) return null

  const column = getColumnById(stage.status)
  const completedTasks = stage.tasks.filter((t) => t.progress === 100).length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold leading-tight">
                {stage.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {section.name}
              </p>
            </div>
            {column && (
              <span
                className={cn(
                  'flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium',
                  column.bgColor,
                  column.color
                )}
              >
                {column.title}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Stage stats */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-4 py-4 border-y">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {stage.progress}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Прогресс
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {stage.plannedHours}ч
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Плановые часы
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {completedTasks}/{stage.tasks.length}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Задач выполнено
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="flex-shrink-0 py-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Общий прогресс этапа</span>
            <span className="font-medium">{stage.progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                stage.progress === 100
                  ? 'bg-emerald-500'
                  : stage.progress > 50
                    ? 'bg-primary'
                    : stage.progress > 0
                      ? 'bg-amber-500'
                      : 'bg-muted-foreground/30'
              )}
              style={{ width: `${stage.progress}%` }}
            />
          </div>
        </div>

        {/* Tasks list */}
        <div className="flex-1 overflow-auto -mx-6 px-6">
          <div className="space-y-3 pb-4">
            {stage.tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Нет задач в этом этапе</p>
              </div>
            ) : (
              stage.tasks
                .sort((a, b) => a.order - b.order)
                .map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    sectionId={section.id}
                    stageId={stage.id}
                  />
                ))
            )}
          </div>
        </div>

        {/* Section responsible info */}
        {section.responsible && (
          <div className="flex-shrink-0 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>
                Ответственный за раздел:{' '}
                <span className="font-medium text-foreground">
                  {section.responsible.firstName} {section.responsible.lastName}
                </span>
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
