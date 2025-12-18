'use client'

/**
 * DecompositionTable - Таблица задач декомпозиции
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
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
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
  selectedItems: Set<string>
  onToggleSelectItem: (itemId: string) => void
  onToggleSelectAll: () => void
  onUpdateDecomposition: (decompositionId: string, updates: Partial<Decomposition>) => void
  onDeleteDecomposition: (decompositionId: string) => void
  onAddDecomposition: () => void
  onOpenLog?: (itemId: string) => void
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
  selectedItems,
  onToggleSelectItem,
  onToggleSelectAll,
  onUpdateDecomposition,
  onDeleteDecomposition,
  onAddDecomposition,
  onOpenLog,
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

  // Check if all items are selected
  const allSelected = decompositions.length > 0 && decompositions.every((d) => selectedItems.has(d.id))
  const someSelected = decompositions.some((d) => selectedItems.has(d.id)) && !allSelected

  if (decompositions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">Нет задач в этом этапе</p>
        <Button variant="outline" size="sm" onClick={onAddDecomposition}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить задачу
        </Button>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="w-10 px-2 py-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleSelectAll}
                  className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                />
              </th>
              <th className="w-8 px-1 py-2" />
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Описание</th>
              <th className="w-[140px] px-2 py-2 text-left font-medium text-muted-foreground">
                Тип работы
              </th>
              <th className="w-[80px] px-2 py-2 text-left font-medium text-muted-foreground">
                Слож.
              </th>
              <th className="w-[80px] px-2 py-2 text-right font-medium text-muted-foreground">
                План, ч
              </th>
              <th className="w-[80px] px-2 py-2 text-right font-medium text-muted-foreground">
                Факт, ч
              </th>
              <th className="w-[100px] px-2 py-2 text-left font-medium text-muted-foreground">
                Готовность
              </th>
              <th className="w-12 px-2 py-2" />
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
                  isSelected={selectedItems.has(decomposition.id)}
                  onToggleSelect={() => onToggleSelectItem(decomposition.id)}
                  onUpdate={(updates) => onUpdateDecomposition(decomposition.id, updates)}
                  onDelete={() => onDeleteDecomposition(decomposition.id)}
                  onOpenLog={onOpenLog}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>

      {/* Add button at bottom */}
      <div className="flex justify-start px-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddDecomposition}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4 mr-1" />
          Добавить задачу
        </Button>
      </div>
    </DndContext>
  )
}
