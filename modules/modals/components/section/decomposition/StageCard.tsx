'use client'

/**
 * StageCard - Карточка этапа с заголовком и таблицей задач
 */

import { useState, useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui/card'
import { StageHeader } from './StageHeader'
import { StageResponsibles } from './StageResponsibles'
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
  isSelected: boolean
  onToggleSelect: () => void
  onUpdateStage: (updates: Partial<Stage>) => void
  onDeleteStage: () => void
  onAddResponsible: () => void
  onRemoveResponsible: (userId: string) => void
  onAddDecomposition: () => void
  onUpdateDecomposition: (decompositionId: string, updates: Partial<Decomposition>) => void
  onDeleteDecomposition: (decompositionId: string) => void
  onReorderDecompositions?: (stageId: string, reordered: Decomposition[]) => void
  onOpenLog?: (itemId: string) => void
  selectedItems: Set<string>
  onToggleSelectItem: (itemId: string) => void
  onToggleSelectAllItems: () => void
  defaultExpanded?: boolean
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
  isSelected,
  onToggleSelect,
  onUpdateStage,
  onDeleteStage,
  onAddResponsible,
  onRemoveResponsible,
  onAddDecomposition,
  onUpdateDecomposition,
  onDeleteDecomposition,
  onReorderDecompositions,
  onOpenLog,
  selectedItems,
  onToggleSelectItem,
  onToggleSelectAllItems,
  defaultExpanded = true,
}: StageCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

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
    <Card
      ref={setNodeRef}
      style={style}
      className={`mb-3 overflow-hidden group ${isDragging ? 'shadow-lg ring-2 ring-primary/50' : ''}`}
    >
      {/* Header */}
      <StageHeader
        stage={stage}
        stageStatuses={stageStatuses}
        isExpanded={isExpanded}
        isSelected={isSelected}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        onToggleSelect={onToggleSelect}
        onUpdateName={(name) => onUpdateStage({ name })}
        onUpdateDateRange={(startDate, endDate) => onUpdateStage({ startDate, endDate })}
        onUpdateStatus={(statusId) => onUpdateStage({ statusId })}
        onDelete={onDeleteStage}
        plannedHours={plannedHours}
        actualHours={actualHours}
        progress={progress}
        tasksCount={stage.decompositions.length}
        dragHandleProps={{ attributes, listeners }}
      />

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border/40">
          {/* Responsibles */}
          <div className="px-4 py-2 border-b border-border/20 bg-muted/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Ответственные:</span>
              <StageResponsibles
                responsibles={stage.responsibles}
                employees={employees}
                onAdd={onAddResponsible}
                onRemove={onRemoveResponsible}
                compact
              />
            </div>
          </div>

          {/* Decomposition Table */}
          <DecompositionTable
            decompositions={stage.decompositions}
            workCategories={workCategories}
            difficultyLevels={difficultyLevels}
            actualHoursByItemId={actualHoursByItemId}
            selectedItems={selectedItems}
            onToggleSelectItem={onToggleSelectItem}
            onToggleSelectAll={onToggleSelectAllItems}
            onUpdateDecomposition={onUpdateDecomposition}
            onDeleteDecomposition={onDeleteDecomposition}
            onAddDecomposition={onAddDecomposition}
            onOpenLog={onOpenLog}
            onReorderDecompositions={
              onReorderDecompositions
                ? (reordered) => onReorderDecompositions(stage.id, reordered)
                : undefined
            }
            stageId={stage.id}
          />
        </div>
      )}
    </Card>
  )
}
