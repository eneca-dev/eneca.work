'use client'

/**
 * StageHeader - Компактный заголовок этапа с выровненными колонками
 */

import { useState, useCallback, useMemo } from 'react'
// REPORTING DISABLED: Clock icon (was used for hours metric)
import { ChevronDown, ChevronRight, GripVertical, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Stage, StageStatus, Employee } from './types'
import { getProgressBarColor, formatDisplayDate, formatISODateString, parseISODateString } from './utils'

// ============================================================================
// Types
// ============================================================================

interface StageHeaderProps {
  stage: Stage
  employees: Employee[]
  stageStatuses: StageStatus[]
  isExpanded: boolean
  onToggleExpand: () => void
  onUpdateName: (name: string) => void
  onUpdateDateRange: (start: string | null, end: string | null) => void
  onUpdateStatus: (statusId: string | null) => void
  onDelete: () => void
  onOpenResponsiblesDialog: () => void
  onRemoveResponsible: (userId: string) => void
  // REPORTING DISABLED: plannedHours and actualHours props
  plannedHours?: number
  actualHours?: number
  progress: number
  tasksCount: number
  dragHandleProps?: {
    attributes: Record<string, unknown>
    listeners: Record<string, unknown>
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatDateForInput(dateString: string | null): string {
  if (!dateString) return ''
  const date = parseISODateString(dateString)
  if (!date) return ''
  return date.toISOString().split('T')[0]
}

function parseDateFromInput(inputValue: string): string | null {
  if (!inputValue) return null
  const date = new Date(inputValue)
  if (isNaN(date.getTime())) return null
  return formatISODateString(date)
}

// ============================================================================
// Component
// ============================================================================

export function StageHeader({
  stage,
  employees,
  stageStatuses,
  isExpanded,
  onToggleExpand,
  onUpdateName,
  onUpdateDateRange,
  onUpdateStatus,
  onDelete,
  onOpenResponsiblesDialog,
  onRemoveResponsible,
  // REPORTING DISABLED: plannedHours and actualHours not displayed
  // plannedHours,
  // actualHours,
  progress,
  tasksCount,
  dragHandleProps,
}: StageHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [localName, setLocalName] = useState(stage.name)
  const [isEditingDates, setIsEditingDates] = useState(false)

  // Handle name blur
  const handleNameBlur = useCallback(() => {
    setIsEditingName(false)
    if (localName.trim() && localName !== stage.name) {
      onUpdateName(localName.trim())
    } else {
      setLocalName(stage.name)
    }
  }, [localName, stage.name, onUpdateName])

  // Handle date changes
  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStart = parseDateFromInput(e.target.value)
      onUpdateDateRange(newStart, stage.endDate)
    },
    [stage.endDate, onUpdateDateRange]
  )

  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newEnd = parseDateFromInput(e.target.value)
      onUpdateDateRange(stage.startDate, newEnd)
    },
    [stage.startDate, onUpdateDateRange]
  )

  // Find current status
  const currentStatus = stageStatuses.find((s) => s.id === stage.statusId)

  // Get responsible employees
  const responsibleEmployees = useMemo(
    () => employees.filter((emp) => (stage.responsibles || []).includes(emp.user_id)),
    [employees, stage.responsibles]
  )

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/30 group">
      {/* Drag Handle - fixed width */}
      <div className="w-5 flex-shrink-0">
        {dragHandleProps && (
          <button
            {...dragHandleProps.attributes}
            {...(dragHandleProps.listeners as React.HTMLAttributes<HTMLButtonElement>)}
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded opacity-40 hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Expand/Collapse - fixed width */}
      <button
        onClick={onToggleExpand}
        className="w-5 flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors flex items-center justify-center"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Responsibles - fixed width for alignment */}
      <TooltipProvider>
        <div className="w-[72px] flex-shrink-0 flex items-center -space-x-1.5">
          {responsibleEmployees.slice(0, 3).map((emp) => (
            <Tooltip key={emp.user_id} delayDuration={200}>
              <TooltipTrigger asChild>
                <div
                  className="relative cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveResponsible(emp.user_id)
                  }}
                >
                  {emp.avatar_url ? (
                    <img
                      src={emp.avatar_url}
                      alt={emp.full_name}
                      className="h-5 w-5 rounded-full object-cover border border-border hover:border-red-500/50 transition-colors"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium text-foreground border border-border hover:border-red-500/50 transition-colors">
                      {emp.first_name?.[0]}{emp.last_name?.[0]}
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">
                <p>{emp.full_name}</p>
                <p className="text-muted-foreground">Клик для удаления</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {responsibleEmployees.length > 3 && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground border border-border">
                  +{responsibleEmployees.length - 3}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">
                {responsibleEmployees.slice(3).map(e => e.full_name).join(', ')}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                onClick={onOpenResponsiblesDialog}
                className="h-5 w-5 rounded-full bg-muted hover:bg-muted flex items-center justify-center border border-dashed border-border hover:border-amber-500/50 transition-colors"
              >
                <Plus className="h-3 w-3 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              Добавить ответственного
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Stage Name - flexible width */}
      <div className="flex-1 min-w-[100px] max-w-[180px]">
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
            className="h-6 text-xs px-1.5 bg-muted/80"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-xs font-medium text-left hover:bg-muted/40 px-1.5 py-0.5 rounded truncate block w-full"
            title={stage.name}
          >
            {stage.name}
          </button>
        )}
      </div>

      {/* Dates - fixed width for alignment */}
      <div className="w-[145px] flex-shrink-0 flex items-center gap-1 text-[10px]">
        {isEditingDates ? (
          <>
            <input
              type="date"
              value={formatDateForInput(stage.startDate)}
              onChange={handleStartDateChange}
              onBlur={() => setIsEditingDates(false)}
              className="h-5 px-1 text-[10px] bg-muted border border-border rounded w-[65px]"
            />
            <span className="text-muted-foreground">—</span>
            <input
              type="date"
              value={formatDateForInput(stage.endDate)}
              onChange={handleEndDateChange}
              onBlur={() => setIsEditingDates(false)}
              className="h-5 px-1 text-[10px] bg-muted border border-border rounded w-[65px]"
            />
          </>
        ) : (
          <button
            onClick={() => setIsEditingDates(true)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/40 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap"
          >
            {formatDisplayDate(stage.startDate)} — {formatDisplayDate(stage.endDate)}
          </button>
        )}
      </div>

      {/* Status - fixed width for alignment */}
      <div className="w-[100px] flex-shrink-0">
        <Select
          value={stage.statusId || 'none'}
          onValueChange={(value) => onUpdateStatus(value === 'none' ? null : value)}
        >
          <SelectTrigger
            className="w-full h-6 text-[10px] px-2 border"
            style={currentStatus ? {
              backgroundColor: `${currentStatus.color}1A`,
              borderColor: `${currentStatus.color}59`,
              color: currentStatus.color,
            } : undefined}
          >
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">
              <span className="text-muted-foreground">—</span>
            </SelectItem>
            {stageStatuses.map((status) => (
              <SelectItem key={status.id} value={status.id} className="text-xs">
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  {status.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metrics - fixed width for alignment */}
      <TooltipProvider>
        <div className="w-[130px] flex-shrink-0 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          {/* Tasks */}
          <span className="w-4 text-center">{tasksCount}</span>

          {/* REPORTING DISABLED: Hours actual/planned */}
          {/* <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-0.5 w-[50px] justify-end">
                <Clock className="h-3 w-3" />
                <span className="font-mono">
                  {actualHours.toFixed(0)}/{plannedHours}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              Факт / План часов
            </TooltipContent>
          </Tooltip> */}

          {/* Progress */}
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 w-[50px]">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full transition-all', getProgressBarColor(progress))}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="w-6 text-right">{progress}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              Прогресс этапа
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Delete - fixed width */}
      <div className="w-6 flex-shrink-0">
        <button
          onClick={onDelete}
          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 rounded transition-all"
          title="Удалить этап"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
