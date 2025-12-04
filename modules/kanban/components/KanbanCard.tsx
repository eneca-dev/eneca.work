'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ChevronDown, ChevronRight, Clock } from 'lucide-react'
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

  const updateTaskPlannedHours = useKanbanStore((state) => state.updateTaskPlannedHours)

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
            {/* Percentage text */}
            <span className="absolute text-[7px] font-medium text-foreground">
              {task.progress}%
            </span>
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

// Compact circular progress component for card
function CompactCircularProgress({ progress }: { progress: number }) {
  const radius = 12
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0">
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
      <span className="absolute text-[8px] font-medium text-foreground">
        {progress}%
      </span>
    </div>
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
  }

  const tasksCount = stage.tasks.length

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
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
      className={cn(
        'group relative',
        'bg-card rounded-lg border shadow-sm',
        'transition-all duration-200 ease-out',
        'hover:shadow-md hover:border-primary/30',
        isDragging && 'opacity-50 shadow-lg scale-[1.02] z-50'
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'absolute left-0 top-0 bottom-0 w-6',
          'flex items-center justify-center',
          'opacity-0 group-hover:opacity-100',
          'transition-opacity duration-150',
          'cursor-grab active:cursor-grabbing',
          'text-muted-foreground hover:text-foreground',
          'rounded-l-lg hover:bg-muted/50'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Card Header - clickable to expand */}
      <div
        className={cn(
          'p-3 pl-4 cursor-pointer',
          tasksCount > 0 && 'hover:bg-muted/30 transition-colors'
        )}
        onClick={handleToggle}
      >
        {/* Title row with expand toggle */}
        <div className="flex items-start gap-2 mb-2">
          {tasksCount > 0 && (
            <button
              className="flex-shrink-0 p-0.5 -ml-1 rounded hover:bg-muted transition-colors"
              onClick={handleToggle}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}
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
                  className="h-6 w-6 border-2 border-background"
                >
                  <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-medium">
                    {category?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))
            ) : (
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                  {stage.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Hours and Progress */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground leading-tight">
                Факт/План
              </div>
              <div className="text-xs font-medium text-foreground">
                {stage.actualHours}/{stage.plannedHours} ч
              </div>
            </div>

            {/* Circular Progress */}
            <CompactCircularProgress progress={stage.progress} />
          </div>
        </div>
      </div>

      {/* Expanded Tasks List */}
      {isExpanded && tasksCount > 0 && (
        <div className="px-3 pb-3 border-t border-border/50">
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
          column?.id === 'done' && 'bg-emerald-500',
          column?.id === 'review' && 'bg-purple-500',
          column?.id === 'in_progress' && 'bg-amber-500',
          column?.id === 'paused' && 'bg-orange-500',
          column?.id === 'planned' && 'bg-blue-500',
          column?.id === 'backlog' && 'bg-slate-400'
        )}
      />
    </div>
  )
}
