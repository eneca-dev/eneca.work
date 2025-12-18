'use client'

/**
 * StageHeader - Заголовок этапа с названием, датами, статусом и метриками
 */

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, GripVertical, Trash2, Calendar, Clock } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Stage, StageStatus } from './types'
import { getStatusColor, getProgressBarColor, formatDisplayDate } from './utils'

// ============================================================================
// Types
// ============================================================================

interface StageHeaderProps {
  stage: Stage
  stageStatuses: StageStatus[]
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
  onUpdateName: (name: string) => void
  onUpdateDateRange: (start: string | null, end: string | null) => void
  onUpdateStatus: (statusId: string | null) => void
  onDelete: () => void
  plannedHours: number
  actualHours: number
  progress: number
  tasksCount: number
  dragHandleProps?: {
    attributes: Record<string, unknown>
    listeners: Record<string, unknown>
  }
}

// ============================================================================
// Component
// ============================================================================

export function StageHeader({
  stage,
  stageStatuses,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onUpdateName,
  onUpdateDateRange,
  onUpdateStatus,
  onDelete,
  plannedHours,
  actualHours,
  progress,
  tasksCount,
  dragHandleProps,
}: StageHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [localName, setLocalName] = useState(stage.name)

  // Handle name blur
  const handleNameBlur = useCallback(() => {
    setIsEditingName(false)
    if (localName.trim() && localName !== stage.name) {
      onUpdateName(localName.trim())
    } else {
      setLocalName(stage.name)
    }
  }, [localName, stage.name, onUpdateName])

  // Find current status
  const currentStatus = stageStatuses.find((s) => s.id === stage.statusId)

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/20 dark:bg-muted/10 border-b border-border/40">
      {/* Drag Handle */}
      {dragHandleProps && (
        <button
          {...dragHandleProps.attributes}
          {...dragHandleProps.listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted/60 rounded opacity-60 hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Checkbox */}
      <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />

      {/* Expand/Collapse Button */}
      <button
        onClick={onToggleExpand}
        className="p-1 hover:bg-muted/60 rounded transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Stage Name */}
      <div className="flex-1 min-w-0">
        {isEditingName ? (
          <Input
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameBlur()
              if (e.key === 'Escape') {
                setLocalName(stage.name)
                setIsEditingName(false)
              }
            }}
            className="h-7 text-sm font-medium"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-sm font-medium text-left hover:bg-muted/40 px-2 py-0.5 rounded truncate max-w-full"
          >
            {stage.name}
          </button>
        )}
      </div>

      {/* Dates */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {formatDisplayDate(stage.startDate)} — {formatDisplayDate(stage.endDate)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Период выполнения этапа</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Status */}
      <Select
        value={stage.statusId || 'none'}
        onValueChange={(value) => onUpdateStatus(value === 'none' ? null : value)}
      >
        <SelectTrigger
          className={`w-[130px] h-7 text-xs ${
            currentStatus ? getStatusColor(currentStatus.name) : ''
          }`}
        >
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">Без статуса</span>
          </SelectItem>
          {stageStatuses.map((status) => (
            <SelectItem key={status.id} value={status.id}>
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                {status.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {/* Tasks count */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{tasksCount} задач</span>
            </TooltipTrigger>
            <TooltipContent>Количество задач в этапе</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Hours */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {actualHours.toFixed(1)} / {plannedHours}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Факт / План (часов)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Progress */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 w-24">
                <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${getProgressBarColor(progress)}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="w-8 text-right">{progress}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Готовность этапа</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
        onClick={onDelete}
        title="Удалить этап"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
