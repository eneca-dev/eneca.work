'use client'

/**
 * StageCard - Компактная карточка этапа
 */

import { useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { StageHeader } from './StageHeader'
import { DecompositionTable } from './DecompositionTable'
import type { Stage, Decomposition, Employee, WorkCategory, DifficultyLevel, StageStatus } from './types'
import { calculateStagePlannedHours, calculateStageActualHours, calculateStageProgress } from './utils'

// ============================================================================
// Types
// ============================================================================

interface StageCardProps {
  stage: Stage
  employees: Employee[]
  workCategories: WorkCategory[]
  difficultyLevels: DifficultyLevel[]
  stageStatuses: StageStatus[]
  actualHoursByItemId: Record<string, number>
  isExpanded: boolean
  onToggleExpand: () => void
  onUpdateStage: (updates: Partial<Stage>) => void
  onDeleteStage: () => void
  onOpenResponsiblesDialog: () => void
  onRemoveResponsible: (userId: string) => void
  onAddDecomposition: () => void
  onUpdateDecomposition: (decompositionId: string, updates: Partial<Decomposition>) => void
  onDeleteDecomposition: (decompositionId: string) => void
  onReorderDecompositions?: (stageId: string, reordered: Decomposition[]) => void
}

// ============================================================================
// Component
// ============================================================================

export function StageCard({
  stage,
  employees,
  workCategories,
  difficultyLevels,
  stageStatuses,
  actualHoursByItemId,
  isExpanded,
  onToggleExpand,
  onUpdateStage,
  onDeleteStage,
  onOpenResponsiblesDialog,
  onRemoveResponsible,
  onAddDecomposition,
  onUpdateDecomposition,
  onDeleteDecomposition,
  onReorderDecompositions,
}: StageCardProps) {
  // Sortable setup
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Calculate metrics
  const plannedHours = useMemo(() => calculateStagePlannedHours(stage), [stage])
  const actualHours = useMemo(
    () => calculateStageActualHours(stage, actualHoursByItemId),
    [stage, actualHoursByItemId]
  )
  const progress = useMemo(() => calculateStageProgress(stage), [stage])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'mb-2 rounded-lg overflow-hidden',
        'border border-border/60',
        'bg-muted/40',
        isDragging && 'shadow-lg ring-1 ring-primary/50'
      )}
    >
      {/* Header with responsibles inline */}
      <StageHeader
        stage={stage}
        employees={employees}
        stageStatuses={stageStatuses}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onUpdateName={(name) => onUpdateStage({ name })}
        onUpdateDateRange={(startDate, endDate) => onUpdateStage({ startDate, endDate })}
        onUpdateStatus={(statusId) => onUpdateStage({ statusId })}
        onDelete={onDeleteStage}
        onOpenResponsiblesDialog={onOpenResponsiblesDialog}
        onRemoveResponsible={onRemoveResponsible}
        plannedHours={plannedHours}
        actualHours={actualHours}
        progress={progress}
        tasksCount={stage.decompositions.length}
        dragHandleProps={{ attributes, listeners }}
      />

      {/* Expanded Content - decomposition table only */}
      {isExpanded && (
        <DecompositionTable
          decompositions={stage.decompositions}
          workCategories={workCategories}
          difficultyLevels={difficultyLevels}
          actualHoursByItemId={actualHoursByItemId}
          onUpdateDecomposition={onUpdateDecomposition}
          onDeleteDecomposition={onDeleteDecomposition}
          onAddDecomposition={onAddDecomposition}
          onReorderDecompositions={
            onReorderDecompositions
              ? (reordered) => onReorderDecompositions(stage.id, reordered)
              : undefined
          }
          stageId={stage.id}
        />
      )}
    </div>
  )
}
