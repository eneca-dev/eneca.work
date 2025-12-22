'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
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
import { AddReportModal } from './AddReportModal'
import { useKanbanStore } from '../stores/kanban-store'
import { Input } from '@/components/ui/input'

interface TaskItemProps {
  task: KanbanTask
  section: KanbanSection
  stage: KanbanStage
}

function TaskItem({ task, section, stage }: TaskItemProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isEditingPlannedHours, setIsEditingPlannedHours] = useState(false)
  const [tempPlannedHours, setTempPlannedHours] = useState(task.plannedHours.toString())
  const [isEditingProgress, setIsEditingProgress] = useState(false)
  const [tempProgress, setTempProgress] = useState(task.progress.toString())

  const updateTaskPlannedHours = useKanbanStore((state) => state.updateTaskPlannedHours)
  const updateTaskProgress = useKanbanStore((state) => state.updateTaskProgress)

  const handleSavePlannedHours = () => {
    const newHours = parseFloat(tempPlannedHours)
    if (!isNaN(newHours) && newHours >= 0) {
      updateTaskPlannedHours(section.id, stage.id, task.id, newHours)
    }
    setIsEditingPlannedHours(false)
  }

  const handleCancelEdit = () => {
    setTempPlannedHours(task.plannedHours.toString())
    setIsEditingPlannedHours(false)
  }

  const handleSaveProgress = () => {
    const newProgress = parseFloat(tempProgress)
    if (!isNaN(newProgress) && newProgress >= 0 && newProgress <= 100) {
      updateTaskProgress(section.id, stage.id, task.id, newProgress)
    }
    setIsEditingProgress(false)
  }

  const handleCancelProgressEdit = () => {
    setTempProgress(task.progress.toString())
    setIsEditingProgress(false)
  }

  return (
    <>
      <div className="flex items-center gap-2 py-2">
        {/* Task description */}
        <span
          className={cn(
            'flex-1 text-xs truncate',
            task.progress === 100
              ? 'text-muted-foreground line-through'
              : 'text-foreground'
          )}
          title={task.description}
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
                    setIsModalOpen(true)
                  }}
                >
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {task.actualHours}/
                    {isEditingPlannedHours ? (
                      <Input
                        type="number"
                        value={tempPlannedHours}
                        onChange={(e) => setTempPlannedHours(e.target.value)}
                        onBlur={handleSavePlannedHours}
                        onKeyDown={(e) => {
                          e.stopPropagation()
                          if (e.key === 'Enter') {
                            handleSavePlannedHours()
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-block w-12 h-5 text-[11px] px-1 py-0 text-center"
                        autoFocus
                        min="0"
                        step="0.5"
                      />
                    ) : (
                      <span
                        className="hover:underline cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsEditingPlannedHours(true)
                        }}
                      >
                        {task.plannedHours}
                      </span>
                    )}{' '}
                    ч
                  </span>
                  {isHovered && !isEditingPlannedHours && (
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
            {/* Percentage text - editable */}
            {isEditingProgress ? (
              <Input
                type="number"
                value={tempProgress}
                onChange={(e) => setTempProgress(e.target.value)}
                onBlur={handleSaveProgress}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    handleSaveProgress()
                  } else if (e.key === 'Escape') {
                    handleCancelProgressEdit()
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="absolute w-10 h-5 text-[7px] px-0.5 py-0 text-center"
                autoFocus
                min="0"
                max="100"
                step="10"
              />
            ) : (
              <span
                className="absolute text-[7px] font-medium text-foreground cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEditingProgress(true)
                  setTempProgress(task.progress.toString())
                }}
                title="Нажмите для изменения прогресса"
              >
                {task.progress}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Add Report Modal */}
      <AddReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={task}
        section={section}
        stage={stage}
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
}

export function KanbanCard({ stage, section }: KanbanCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `${section.id}:${stage.id}`,
      data: { stage, section },
    })

  const column = getColumnById(stage.status)

  const style = {
    transform: CSS.Translate.toString(transform),
    // ВАЖНО: Всегда transition: 'none' для transform, чтобы избежать "отскока" после drag
    // При завершении драга карточка уже будет в новой колонке (благодаря optimistic update)
    // и не должна анимированно возвращаться к transform: translate(0, 0)
    transition: 'none',
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
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative',
        'w-full max-w-full',
        'bg-card rounded-lg border shadow-sm',
        'hover:shadow-md hover:border-primary/30',
        'cursor-grab active:cursor-grabbing',
        'overflow-hidden',
        // КРИТИЧНО: Полностью скрываем карточку при drag
        // DragOverlay покажет копию карточки, следующую за курсором
        // Когда drop происходит, DragOverlay исчезает, а карточка уже в новой колонке
        isDragging && 'opacity-0'
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
                <Avatar
                  key={idx}
                  className="h-8 w-8 border-2 border-background"
                >
                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-medium">
                    {category?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))
            ) : (
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                  {stage.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
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

// ============================================================================
// KanbanCardPreview - статичная версия карточки для DragOverlay
// ============================================================================

interface KanbanCardPreviewProps {
  stage: KanbanStage
  section: KanbanSection
}

/**
 * Статичная версия карточки для отображения в DragOverlay
 * Не содержит drag логики, только визуальное представление
 */
export function KanbanCardPreview({ stage, section }: KanbanCardPreviewProps) {
  const column = getColumnById(stage.status)

  // Get unique work categories for avatars
  const uniqueCategories = Array.from(
    new Set(stage.tasks.map((t) => t.workCategory).filter(Boolean))
  ).slice(0, 3)

  return (
    <div
      className={cn(
        'group relative',
        'w-[280px]', // Фиксированная ширина для overlay
        'bg-card rounded-lg border shadow-lg', // shadow-lg для поднятого эффекта
        'cursor-grabbing',
        'overflow-hidden',
        'ring-2 ring-primary/30' // Подсветка при drag
      )}
    >
      {/* Card Header */}
      <div className="p-3 pl-4">
        {/* Title row */}
        <div className="flex items-start gap-2 mb-2">
          <h4 className="flex-1 text-sm font-medium leading-tight line-clamp-2 text-foreground">
            {stage.name}
          </h4>
        </div>

        {/* Info row - avatars, hours, progress */}
        <div className="flex items-center justify-between gap-3">
          {/* Avatars */}
          <div className="flex -space-x-2">
            {uniqueCategories.length > 0 ? (
              uniqueCategories.map((category, idx) => (
                <Avatar
                  key={idx}
                  className="h-8 w-8 border-2 border-background"
                >
                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-medium">
                    {category?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))
            ) : (
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                  {stage.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Hours and Progress */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* CPI Indicator */}
            {(() => {
              const cpiStatus = getCPIStatus(stage.cpi)
              const CPIIcon = cpiStatus.icon
              return (
                <div className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full',
                  cpiStatus.bgColor
                )}>
                  <CPIIcon className={cn('w-3.5 h-3.5', cpiStatus.color)} />
                </div>
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

            {/* Circular Progress - simplified */}
            <div className="relative inline-flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 -rotate-90">
                <circle
                  cx="14"
                  cy="14"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="14"
                  cy="14"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 10}
                  strokeDashoffset={2 * Math.PI * 10 * (1 - stage.progress / 100)}
                  className={cn(
                    stage.progress === 100
                      ? 'text-emerald-500'
                      : stage.progress > 50
                        ? 'text-primary'
                        : stage.progress > 0
                          ? 'text-amber-500'
                          : 'text-muted-foreground/30'
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[8px] font-medium text-foreground">
                {stage.progress}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status indicator line */}
      <div
        className={cn(
          'absolute left-0 top-2 bottom-2 rounded-full',
          'w-0.5',
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
