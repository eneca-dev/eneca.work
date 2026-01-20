'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { KanbanStage, KanbanSection } from '../types'
import { getColumnById } from '../constants'
import { StageModal } from '@/modules/modals'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import { useKanbanFiltersStore } from '../stores'
import { TaskItem, getCPIStatus, CompactCircularProgress } from './kanban'
import { convertToDecompositionStage } from '../utils'

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
  const [isStageModalOpen, setIsStageModalOpen] = useState(false)

  // Для инвалидации кеша после сохранения в модалке
  const queryClient = useQueryClient()
  const { getQueryParams } = useKanbanFiltersStore()

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

  // Get unique responsibles for avatars
  const uniqueResponsibles = Array.from(
    stage.tasks
      .filter((t) => t.responsible)
      .reduce((map, task) => {
        if (task.responsible) {
          map.set(task.responsible.userId, task.responsible)
        }
        return map
      }, new Map<string, { userId: string; firstName: string; lastName: string }>())
      .values()
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
          <button
            className="flex-1 text-sm font-medium leading-tight line-clamp-2 text-foreground text-left hover:text-primary transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              setIsStageModalOpen(true)
            }}
          >
            {stage.name}
          </button>

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
          {/* Avatars - ответственные за задачи */}
          <div className="flex -space-x-2">
            {uniqueResponsibles.length > 0 ? (
              uniqueResponsibles.map((responsible) => (
                <TooltipProvider key={responsible.userId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-8 w-8 border-2 border-background cursor-default">
                        <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-medium">
                          {responsible.firstName[0]}{responsible.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="text-xs">{responsible.firstName} {responsible.lastName}</span>
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
                    <span className="text-xs">Нет ответственных</span>
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

      {/* Stage Modal */}
      <StageModal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        stage={convertToDecompositionStage(stage)}
        stageId={stage.id}
        sectionId={section.id}
        onSuccess={() => {
          setIsStageModalOpen(false)
          // Инвалидируем кеш канбана после сохранения
          queryClient.invalidateQueries({
            queryKey: queryKeys.kanban.infinite(getQueryParams())
          })
        }}
      />
    </div>
  )
}

