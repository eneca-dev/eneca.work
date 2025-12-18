'use client'

/**
 * DecompositionRow - Строка таблицы декомпозиции
 */

import { useState, useCallback } from 'react'
import { GripVertical, Trash2, Clock } from 'lucide-react'
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
import type { Decomposition, WorkCategory, DifficultyLevel } from './types'
import { getDifficultyColor, getProgressColor, getProgressBarColor } from './utils'

// ============================================================================
// Types
// ============================================================================

interface DecompositionRowProps {
  decomposition: Decomposition
  workCategories: WorkCategory[]
  difficultyLevels: DifficultyLevel[]
  actualHours: number
  isSelected: boolean
  onToggleSelect: () => void
  onUpdate: (updates: Partial<Decomposition>) => void
  onDelete: () => void
  onOpenLog?: (itemId: string) => void
}

// ============================================================================
// Component
// ============================================================================

export function DecompositionRow({
  decomposition,
  workCategories,
  difficultyLevels,
  actualHours,
  isSelected,
  onToggleSelect,
  onUpdate,
  onDelete,
  onOpenLog,
}: DecompositionRowProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [localDescription, setLocalDescription] = useState(decomposition.description)
  const [localPlannedHours, setLocalPlannedHours] = useState(String(decomposition.plannedHours))
  const [localProgress, setLocalProgress] = useState(String(decomposition.progress))

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

  // Handle description blur
  const handleDescriptionBlur = useCallback(() => {
    setEditingField(null)
    if (localDescription !== decomposition.description) {
      onUpdate({ description: localDescription })
    }
  }, [localDescription, decomposition.description, onUpdate])

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

  // Find current category name
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
      className={`group border-b border-border/40 hover:bg-muted/30 transition-colors ${
        isSelected ? 'bg-primary/5' : ''
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* Checkbox */}
      <td className="w-10 px-2 py-1.5">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </td>

      {/* Drag Handle */}
      <td className="w-8 px-1 py-1.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted/60 rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </td>

      {/* Description */}
      <td className="px-2 py-1.5 min-w-[200px]">
        {editingField === 'description' ? (
          <Input
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleDescriptionBlur()}
            className="h-7 text-sm"
            autoFocus
          />
        ) : (
          <div
            onClick={() => setEditingField('description')}
            className="text-sm cursor-text hover:bg-muted/40 px-1 py-0.5 rounded min-h-[24px]"
          >
            {decomposition.description || (
              <span className="text-muted-foreground italic">Введите описание...</span>
            )}
          </div>
        )}
      </td>

      {/* Type of Work */}
      <td className="w-[140px] px-2 py-1.5">
        <Select
          value={currentCategory?.work_category_id || ''}
          onValueChange={(value) => {
            const cat = workCategories.find((c) => c.work_category_id === value)
            if (cat) {
              onUpdate({ typeOfWork: cat.work_category_name })
            }
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Тип работы" />
          </SelectTrigger>
          <SelectContent>
            {workCategories.map((cat) => (
              <SelectItem key={cat.work_category_id} value={cat.work_category_id}>
                {cat.work_category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Difficulty */}
      <td className="w-[80px] px-2 py-1.5">
        <Select
          value={currentDifficulty?.difficulty_id || ''}
          onValueChange={(value) => {
            const diff = difficultyLevels.find((d) => d.difficulty_id === value)
            if (diff) {
              onUpdate({ difficulty: diff.difficulty_abbr })
            }
          }}
        >
          <SelectTrigger className={`h-7 text-xs ${getDifficultyColor(decomposition.difficulty)}`}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {difficultyLevels.map((diff) => (
              <SelectItem key={diff.difficulty_id} value={diff.difficulty_id}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{diff.difficulty_abbr}</span>
                    </TooltipTrigger>
                    <TooltipContent>{diff.difficulty_definition}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Planned Hours */}
      <td className="w-[80px] px-2 py-1.5">
        {editingField === 'plannedHours' ? (
          <Input
            type="number"
            value={localPlannedHours}
            onChange={(e) => setLocalPlannedHours(e.target.value)}
            onBlur={handlePlannedHoursBlur}
            onKeyDown={(e) => e.key === 'Enter' && handlePlannedHoursBlur()}
            className="h-7 text-xs text-right"
            autoFocus
            min={0}
            step={0.5}
          />
        ) : (
          <div
            onClick={() => {
              setLocalPlannedHours(String(decomposition.plannedHours))
              setEditingField('plannedHours')
            }}
            className="text-xs text-right cursor-text hover:bg-muted/40 px-1 py-0.5 rounded"
          >
            {decomposition.plannedHours}
          </div>
        )}
      </td>

      {/* Actual Hours */}
      <td className="w-[80px] px-2 py-1.5">
        <div className="text-xs text-right text-muted-foreground">
          {actualHours > 0 ? actualHours.toFixed(1) : '—'}
        </div>
      </td>

      {/* Progress */}
      <td className="w-[100px] px-2 py-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${getProgressBarColor(decomposition.progress)}`}
              style={{ width: `${decomposition.progress}%` }}
            />
          </div>
          {editingField === 'progress' ? (
            <Input
              type="number"
              value={localProgress}
              onChange={(e) => setLocalProgress(e.target.value)}
              onBlur={handleProgressBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleProgressBlur()}
              className="w-12 h-6 text-xs text-right p-1"
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
              className={`text-xs cursor-text px-1.5 py-0.5 rounded ${getProgressColor(
                decomposition.progress
              )}`}
            >
              {decomposition.progress}%
            </span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="w-12 px-2 py-1.5">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onOpenLog && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onOpenLog(decomposition.id)}
              title="Открыть журнал"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            title="Удалить задачу"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
