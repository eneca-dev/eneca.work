'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { KanbanSection } from '../types'
import { KANBAN_COLUMNS, SECTION_STATUSES } from '../constants'
import { KanbanDropZone } from './KanbanDropZone'

interface KanbanSwimlaneProps {
  section: KanbanSection
  isCollapsed: boolean
  onToggleCollapse: () => void
}

// Circular progress component
function CircularProgress({ progress }: { progress: number }) {
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-10 h-10 -rotate-90">
        {/* Background circle */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
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
      <span className="absolute text-[10px] font-medium text-foreground">
        {progress}%
      </span>
    </div>
  )
}

export function KanbanSwimlane({
  section,
  isCollapsed,
  onToggleCollapse,
}: KanbanSwimlaneProps) {
  const statusConfig = SECTION_STATUSES[section.status]

  // Get initials for avatar
  const getInitials = () => {
    if (!section.responsible) return section.name.substring(0, 2).toUpperCase()
    const { firstName, lastName } = section.responsible
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  return (
    <div
      className={cn(
        'border-b border-border/50 last:border-b-0',
        'transition-all duration-300 ease-out'
      )}
    >
      {/* Swimlane Header */}
      <div
        className={cn(
          'sticky left-0 z-10',
          'flex items-center gap-3 px-4 py-3',
          'bg-muted/30 hover:bg-muted/50',
          'cursor-pointer select-none',
          'transition-colors duration-150'
        )}
        onClick={onToggleCollapse}
      >
        {/* Collapse Toggle */}
        <button
          className="flex-shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse()
          }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Avatar */}
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
            {getInitials()}
          </AvatarFallback>
        </Avatar>

        {/* Section Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="font-semibold text-sm text-foreground cursor-pointer hover:underline hover:text-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                // TODO: Open section modal
                console.log('Open section modal for:', section.id)
              }}
            >
              {section.name}
            </h3>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0',
                statusConfig.bgColor,
                statusConfig.color
              )}
            >
              {section.stages.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {section.projectName} • {section.stageName} • {section.objectName}
          </p>
        </div>

        {/* Stats - Right side */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Hours */}
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Факт/План</div>
            <div className="text-sm font-medium text-foreground">
              {section.totalActualHours}/{section.totalPlannedHours} ч
            </div>
          </div>

          {/* Circular Progress */}
          <CircularProgress progress={section.overallProgress} />
        </div>
      </div>

      {/* Swimlane Content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-out',
          isCollapsed ? 'max-h-0' : 'max-h-[800px]'
        )}
      >
        <div className="flex items-stretch gap-0 min-h-[100px] p-2">
          {KANBAN_COLUMNS.map((column) => (
            <KanbanDropZone
              key={column.id}
              column={column}
              sectionId={section.id}
              stages={section.stages}
              section={section}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
