'use client'

/**
 * DecompositionTable - Компактная таблица задач
 */

import { useCallback } from 'react'
import { Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { DecompositionRow } from './DecompositionRow'
import type { Decomposition, WorkCategory, DifficultyLevel } from './types'

// ============================================================================
// Types
// ============================================================================

interface DecompositionTableProps {
  decompositions: Decomposition[]
  workCategories: WorkCategory[]
  difficultyLevels: DifficultyLevel[]
  actualHoursByItemId: Record<string, number>
  onUpdateDecomposition: (decompositionId: string, updates: Partial<Decomposition>) => void
  onDeleteDecomposition: (decompositionId: string) => void
  onAddDecomposition: () => void
  onReorderDecompositions?: (reordered: Decomposition[]) => void
  stageId: string
}

// ============================================================================
// Component
// ============================================================================

export function DecompositionTable({
  decompositions,
  workCategories,
  difficultyLevels,
  actualHoursByItemId,
  onUpdateDecomposition,
  onDeleteDecomposition,
  onAddDecomposition,
  onReorderDecompositions,
}: DecompositionTableProps) {
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id && onReorderDecompositions) {
        const oldIndex = decompositions.findIndex((d) => d.id === active.id)
        const newIndex = decompositions.findIndex((d) => d.id === over.id)
        const reordered = arrayMove(decompositions, oldIndex, newIndex)
        onReorderDecompositions(reordered)
      }
    },
    [decompositions, onReorderDecompositions]
  )

  if (decompositions.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <button
          onClick={onAddDecomposition}
          className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 px-2.5 py-1.5 rounded transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить задачу
        </button>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-800/60 bg-slate-900/50">
              <th className="w-6 px-0.5 py-1" />
              <th className="px-1.5 py-1 text-left font-medium text-slate-500">Описание</th>
              <th className="w-[110px] px-1.5 py-1 text-left font-medium text-slate-500">Тип</th>
              <th className="w-[55px] px-1.5 py-1 text-center font-medium text-slate-500">Сл.</th>
              <th className="w-[70px] px-1.5 py-1 text-center font-medium text-slate-500">Часы</th>
              <th className="w-[80px] px-1.5 py-1 text-left font-medium text-slate-500">%</th>
              <th className="w-8 px-1 py-1" />
            </tr>
          </thead>
          <tbody>
            <SortableContext
              items={decompositions.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              {decompositions.map((decomposition) => (
                <DecompositionRow
                  key={decomposition.id}
                  decomposition={decomposition}
                  workCategories={workCategories}
                  difficultyLevels={difficultyLevels}
                  actualHours={actualHoursByItemId[decomposition.id] || 0}
                  onUpdate={(updates) => onUpdateDecomposition(decomposition.id, updates)}
                  onDelete={() => onDeleteDecomposition(decomposition.id)}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>

      {/* Add button */}
      <div className="px-1.5 py-1 border-t border-slate-800/40">
        <button
          onClick={onAddDecomposition}
          className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 px-1.5 py-0.5 rounded transition-colors"
        >
          <Plus className="h-3 w-3" />
          Задача
        </button>
      </div>
    </DndContext>
  )
}
