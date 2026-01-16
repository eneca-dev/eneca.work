'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Clock, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { KanbanStage, KanbanSection, KanbanTask } from '../types'
import { getColumnById } from '../constants'
import { WorkLogCreateModal, TaskSidebar } from '@/modules/modals'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import { useKanbanFiltersStore } from '../stores'
import { Input } from '@/components/ui/input'

interface TaskItemProps {
  task: KanbanTask
  section: KanbanSection
  stage: KanbanStage
}

function TaskItem({ task, section, stage }: TaskItemProps) {
  // Модалки
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false)
  const [isTaskSidebarOpen, setIsTaskSidebarOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Для инвалидации кеша после успешного сохранения
  const queryClient = useQueryClient()
  const { getQueryParams } = useKanbanFiltersStore()

  return (
    <>
      <div className="flex items-center gap-2 py-2">
        {/* Task description - клик открывает TaskSidebar */}
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
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-6 h-6 -rotate-90">
              {/* Background circle */}
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-muted"
              />
              {/* Progress circle */}
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={2 * Math.PI * 10}
                strokeDashoffset={2 * Math.PI * 10 - (task.progress / 100) * (2 * Math.PI * 10)}
                className={cn(
                  'transition-all duration-500',
                  task.progress === 100
                    ? 'text-emerald-500'
                    : task.progress > 50
                      ? 'text-primary'
                      : task.progress > 0
                        ? 'text-amber-500'
                        : 'text-muted-foreground/30'
                )}
                strokeLinecap="round"
              />
            </svg>
            {/* Percentage text - клик открывает TaskSidebar */}
            <span
              className="absolute text-[7px] font-medium text-foreground cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                setIsTaskSidebarOpen(true)
              }}
              title="Нажмите для редактирования задачи"
            >
              {task.progress}%
            </span>
          </div>
        </div>
      </div>

      {/* WorkLog Create Modal */}
      <WorkLogCreateModal
        isOpen={isWorkLogModalOpen}
        onClose={() => setIsWorkLogModalOpen(false)}
        onSuccess={() => {
          setIsWorkLogModalOpen(false)

          // Инвалидируем кеш канбана - данные перезагрузятся с сервера
          // Это обновит actualHours задачи после создания отчёта
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

          // Инвалидируем кеш канбана - данные перезагрузятся с сервера
          // Это обновит plannedHours, progress и другие поля задачи
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
          // Поля, которых нет в KanbanTask, передаём как null
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

// CPI (Cost Performance Index) indicator
function getCPIStatus(cpi: number | null) {
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

// Compact circular progress component for card
function CompactCircularProgress({
  progress,
  stage
}: {
  progress: number
  stage?: KanbanStage
}) {
  const radius = 12
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  // Calculate tooltip content
  const getTooltipContent = () => {
    if (!stage || !stage.tasks.length) {
      return <p>Прогресс: {progress}%</p>
    }

    const totalPlannedHours = stage.tasks.reduce((sum, t) => sum + t.plannedHours, 0)
    const completedHours = stage.tasks.reduce(
      (sum, t) => sum + (t.plannedHours * t.progress) / 100,
      0
    )

    return (
      <div className="text-xs space-y-1">
        <div className="font-semibold">Расчёт прогресса этапа:</div>
        <div>Выполнено: {completedHours.toFixed(1)} ч</div>
        <div>Всего плановых: {totalPlannedHours} ч</div>
        <div className="pt-1 border-t border-border/50">
          Прогресс: {progress}%
        </div>
        <div className="text-muted-foreground text-[10px] pt-1">
          Рассчитывается как сумма произведений плановых часов каждой задачи на её процент готовности
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-flex items-center justify-center flex-shrink-0 cursor-help">
            <svg className="w-7 h-7 -rotate-90">
              {/* Background circle */}
              <circle
                cx="14"
                cy="14"
                r={radius}
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                className="text-muted"
              />
              {/* Progress circle */}
              <circle
                cx="14"
                cy="14"
                r={radius}
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={cn(
                  'transition-all duration-500',
                  progress === 100
                    ? 'text-emerald-500'
                    : progress > 50
                      ? 'text-primary'
                      : progress > 0
                        ? 'text-amber-500'
                        : 'text-muted-foreground/30'
                )}
                strokeLinecap="round"
              />
            </svg>
            {/* Percentage text */}
            <span className="absolute text-[8px] font-medium text-foreground pointer-events-none">
              {progress}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px]">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface KanbanCardProps {
  stage: KanbanStage
  section: KanbanSection
  // HTML5 Drag and Drop
  onDragStart: (stageId: string, sectionId: string, e: React.DragEvent) => void
  onDragEnd: () => void
  isDragging: boolean
}

export function KanbanCard({
  stage,
  section,
  onDragStart,
  onDragEnd,
  isDragging
}: KanbanCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const column = getColumnById(stage.status)

  // HTML5 Drag handlers
  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(stage.id, section.id, e)
  }

  const tasksCount = stage.tasks.length

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (tasksCount > 0) {
      setIsExpanded(!isExpanded)
    }
  }

  // Get unique work categories for avatars
  const uniqueCategories = Array.from(
    new Set(stage.tasks.map((t) => t.workCategory).filter(Boolean))
  ).slice(0, 3)

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative',
        'w-full max-w-full',
        'bg-card rounded-lg border shadow-sm',
        'hover:shadow-md hover:border-primary/30',
        'cursor-grab active:cursor-grabbing',
        'overflow-hidden',
        // Уменьшаем прозрачность при перетаскивании
        // Карточка остаётся на месте, но визуально "подсвечивается" что она активна
        isDragging && 'opacity-50 ring-2 ring-primary/50'
      )}
    >
      {/* Card Header */}
      <div className="p-3 pl-4">
        {/* Title row */}
        <div className="flex items-start gap-2 mb-2">
          <h4 className="flex-1 text-sm font-medium leading-tight line-clamp-2 text-foreground">
            {stage.name}
          </h4>

          {/* Expand/Collapse button */}
          {tasksCount > 0 && (
            <button
              onClick={handleToggle}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                'flex-shrink-0 p-0.5 rounded hover:bg-muted/50 transition-colors',
                'text-muted-foreground hover:text-foreground',
                'cursor-pointer'
              )}
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isExpanded && 'rotate-180'
                )}
              />
            </button>
          )}
        </div>

        {/* Info row - avatars, hours, progress */}
        <div className="flex items-center justify-between gap-3">
          {/* Avatars */}
          <div className="flex -space-x-2">
            {uniqueCategories.length > 0 ? (
              uniqueCategories.map((category, idx) => (
                <TooltipProvider key={idx}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-8 w-8 border-2 border-background cursor-default">
                        <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-medium">
                          {category?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="text-xs">{category}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-8 w-8 border-2 border-background cursor-default">
                      <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                        {stage.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="text-xs">{stage.name}</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Hours and Progress */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* CPI Indicator */}
            {(() => {
              const cpiStatus = getCPIStatus(stage.cpi)
              const CPIIcon = cpiStatus.icon
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        'flex items-center justify-center w-6 h-6 rounded-full',
                        cpiStatus.bgColor
                      )}>
                        <CPIIcon className={cn('w-3.5 h-3.5', cpiStatus.color)} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        <div className="font-semibold">{cpiStatus.label}</div>
                        <div>{cpiStatus.description}</div>
                        {stage.cpi !== null && (
                          <div className="text-muted-foreground text-[10px] pt-1 border-t border-border/50">
                            EV (заработано): {((stage.plannedHours * stage.progress) / 100).toFixed(1)} ч
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })()}

            <div className="text-right">
              <div className="text-[10px] text-muted-foreground leading-tight">
                Факт/План
              </div>
              <div className="text-xs font-medium text-foreground">
                {stage.actualHours}/{stage.plannedHours} ч
              </div>
            </div>

            {/* Circular Progress */}
            <CompactCircularProgress progress={stage.progress} stage={stage} />
          </div>
        </div>
      </div>

      {/* Expanded Tasks List */}
      {isExpanded && tasksCount > 0 && (
        <div className="px-3 pl-4 pb-3 border-t border-border/50">
          <div className="pt-2 space-y-0.5">
            {stage.tasks
              .sort((a, b) => a.order - b.order)
              .map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  section={section}
                  stage={stage}
                />
              ))}
          </div>
        </div>
      )}

      {/* Status indicator line */}
      <div
        className={cn(
          'absolute left-0 top-2 rounded-full',
          'w-0.5',
          isExpanded ? 'bottom-2' : 'bottom-2',
          column?.id === 'done' && 'bg-green-500',
          column?.id === 'review' && 'bg-pink-500',
          column?.id === 'in_progress' && 'bg-blue-500',
          column?.id === 'paused' && 'bg-amber-500',
          column?.id === 'planned' && 'bg-violet-500',
          column?.id === 'backlog' && 'bg-gray-400'
        )}
      />
    </div>
  )
}

