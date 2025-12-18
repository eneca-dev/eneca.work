'use client'

/**
 * DecompositionRow - Компактная строка задачи
 */

import { useState, useCallback, useEffect } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import type { Decomposition, WorkCategory, DifficultyLevel } from './types'
import { getProgressBarColor } from './utils'

// ============================================================================
// Types
// ============================================================================

interface DecompositionRowProps {
  decomposition: Decomposition
  workCategories: WorkCategory[]
  difficultyLevels: DifficultyLevel[]
  actualHours: number
  onUpdate: (updates: Partial<Decomposition>) => void
  onDelete: () => void
}

// ============================================================================
// Component
// ============================================================================

export function DecompositionRow({
  decomposition,
  workCategories,
  difficultyLevels,
  actualHours,
  onUpdate,
  onDelete,
}: DecompositionRowProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [localDescription, setLocalDescription] = useState(decomposition.description)
  const [localPlannedHours, setLocalPlannedHours] = useState(String(decomposition.plannedHours))
  const [localProgress, setLocalProgress] = useState(String(decomposition.progress))

  // Sync local state with props when decomposition changes
  useEffect(() => {
    setLocalDescription(decomposition.description)
    setLocalPlannedHours(String(decomposition.plannedHours))
    setLocalProgress(String(decomposition.progress))
  }, [decomposition.description, decomposition.plannedHours, decomposition.progress])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: decomposition.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Handle description blur - delete task if description is empty
  const handleDescriptionBlur = useCallback(() => {
    setEditingField(null)
    const trimmed = localDescription.trim()
    if (!trimmed) {
      // Delete task if description is empty
      onDelete()
      return
    }
    if (trimmed !== decomposition.description) {
      onUpdate({ description: trimmed })
    }
  }, [localDescription, decomposition.description, onUpdate, onDelete])

  // Handle planned hours blur
  const handlePlannedHoursBlur = useCallback(() => {
    setEditingField(null)
    const hours = parseFloat(localPlannedHours) || 0
    if (hours !== decomposition.plannedHours) {
      onUpdate({ plannedHours: hours })
    }
  }, [localPlannedHours, decomposition.plannedHours, onUpdate])

  // Handle progress blur
  const handleProgressBlur = useCallback(() => {
    setEditingField(null)
    const progress = Math.min(100, Math.max(0, parseInt(localProgress) || 0))
    if (progress !== decomposition.progress) {
      onUpdate({ progress })
    }
  }, [localProgress, decomposition.progress, onUpdate])

  // Find current category
  const currentCategory = workCategories.find(
    (cat) => cat.work_category_name === decomposition.typeOfWork
  )

  // Find current difficulty
  const currentDifficulty = difficultyLevels.find(
    (diff) => diff.difficulty_abbr === decomposition.difficulty
  )

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'group border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors',
        isDragging && 'shadow-lg'
      )}
    >
      {/* Drag Handle */}
      <td className="w-6 px-0.5 py-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-700/50 rounded"
        >
          <GripVertical className="h-3 w-3 text-slate-600" />
        </button>
      </td>

      {/* Description */}
      <td className="px-1.5 py-1 min-w-[150px]">
        {editingField === 'description' ? (
          <Input
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDescriptionBlur()
              if (e.key === 'Escape') {
                setLocalDescription(decomposition.description)
                setEditingField(null)
              }
            }}
            className="h-5 text-[11px] px-1 bg-slate-800/80"
            autoFocus
          />
        ) : (
          <div
            onClick={() => setEditingField('description')}
            className="text-[11px] cursor-text hover:bg-slate-700/30 px-1 py-0.5 rounded min-h-[20px] truncate"
          >
            {decomposition.description || (
              <span className="text-slate-600 italic">Описание...</span>
            )}
          </div>
        )}
      </td>

      {/* Type of Work */}
      <td className="w-[110px] px-1.5 py-1">
        <Select
          value={currentCategory?.work_category_id || ''}
          onValueChange={(value) => {
            const cat = workCategories.find((c) => c.work_category_id === value)
            if (cat) {
              onUpdate({ typeOfWork: cat.work_category_name })
            }
          }}
        >
          <SelectTrigger className="h-5 text-[10px] px-1.5 bg-transparent border-slate-700/50">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {workCategories.map((cat) => (
              <SelectItem key={cat.work_category_id} value={cat.work_category_id} className="text-xs">
                {cat.work_category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Difficulty */}
      <td className="w-[55px] px-1.5 py-1">
        <Select
          value={currentDifficulty?.difficulty_id || ''}
          onValueChange={(value) => {
            const diff = difficultyLevels.find((d) => d.difficulty_id === value)
            if (diff) {
              onUpdate({ difficulty: diff.difficulty_abbr })
            }
          }}
        >
          <SelectTrigger
            className="h-5 text-[10px] px-1 bg-transparent border-slate-700/50 justify-center"
          >
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {difficultyLevels.map((diff) => (
              <SelectItem key={diff.difficulty_id} value={diff.difficulty_id} className="text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{diff.difficulty_abbr}</span>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">
                      {diff.difficulty_definition}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Hours: Actual/Planned combined */}
      <td className="w-[70px] px-1.5 py-1">
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center gap-0.5">
                <span className="text-[10px] text-slate-500">
                  {actualHours > 0 ? actualHours.toFixed(0) : '—'}
                </span>
                <span className="text-[10px] text-slate-700">/</span>
                {editingField === 'plannedHours' ? (
                  <Input
                    type="number"
                    value={localPlannedHours}
                    onChange={(e) => setLocalPlannedHours(e.target.value)}
                    onBlur={handlePlannedHoursBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePlannedHoursBlur()
                      if (e.key === 'Escape') {
                        setLocalPlannedHours(String(decomposition.plannedHours))
                        setEditingField(null)
                      }
                    }}
                    className="w-8 h-4 text-[10px] text-center p-0 bg-slate-800"
                    autoFocus
                    min={0}
                    step={0.5}
                  />
                ) : (
                  <span
                    onClick={() => {
                      setLocalPlannedHours(String(decomposition.plannedHours))
                      setEditingField('plannedHours')
                    }}
                    className="text-[10px] cursor-text hover:bg-slate-700/40 px-0.5 rounded"
                  >
                    {decomposition.plannedHours}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">
              Факт / План часов
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </td>

      {/* Progress */}
      <td className="w-[80px] px-1.5 py-1">
        <div className="flex items-center gap-1">
          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all', getProgressBarColor(decomposition.progress))}
              style={{ width: `${decomposition.progress}%` }}
            />
          </div>
          {editingField === 'progress' ? (
            <Input
              type="number"
              value={localProgress}
              onChange={(e) => setLocalProgress(e.target.value)}
              onBlur={handleProgressBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleProgressBlur()
                if (e.key === 'Escape') {
                  setLocalProgress(String(decomposition.progress))
                  setEditingField(null)
                }
              }}
              className="w-8 h-4 text-[10px] text-right p-0.5 bg-slate-800"
              autoFocus
              min={0}
              max={100}
            />
          ) : (
            <span
              onClick={() => {
                setLocalProgress(String(decomposition.progress))
                setEditingField('progress')
              }}
              className="text-[10px] cursor-text px-0.5 rounded hover:bg-slate-700/40 w-6 text-right"
            >
              {decomposition.progress}%
            </span>
          )}
        </div>
      </td>

      {/* Delete */}
      <td className="w-8 px-1 py-1">
        <button
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/10 hover:text-red-400 rounded transition-all"
          onClick={onDelete}
          title="Удалить"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  )
}
