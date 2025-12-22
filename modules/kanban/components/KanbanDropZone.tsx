'use client'

import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { KanbanStage, KanbanSection, KanbanColumn } from '../types'
import { KanbanCard } from './KanbanCard'

interface KanbanDropZoneProps {
  column: KanbanColumn
  sectionId: string
  stages: KanbanStage[]
  section: KanbanSection
  activeSectionId?: string | null // ID активного раздела при перетаскивании
}

export function KanbanDropZone({
  column,
  sectionId,
  stages,
  section,
  activeSectionId,
}: KanbanDropZoneProps) {
  const droppableId = `${sectionId}:${column.id}`
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { sectionId, status: column.id },
  })

  const stagesInColumn = stages.filter((s) => s.status === column.id)

  // Проверяем, можно ли дропнуть сюда карточку
  const isDragActive = activeSectionId !== null && activeSectionId !== undefined
  const isDropAllowed = !isDragActive || activeSectionId === sectionId

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 relative',
        'p-2 transition-colors duration-200',
        'overflow-visible',
        // Обычное состояние при наведении (только если дроп разрешён)
        isOver && isDropAllowed && 'ring-2 ring-primary/20 ring-inset'
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-2 h-full relative',
          'p-2',
          'overflow-visible',
          column.bgColor,
          // Обычное состояние при наведении (только если дроп разрешён)
          isOver && isDropAllowed && 'ring-2 ring-primary/30 ring-inset'
        )}
      >
        {stagesInColumn.length === 0 ? (
          <div
            className={cn(
              'flex-1 flex items-center justify-center',
              'text-xs text-muted-foreground',
              'min-h-[80px]'
            )}
          >
            {isOver && isDropAllowed && 'Отпустите здесь'}
          </div>
        ) : (
          stagesInColumn.map((stage) => (
            <KanbanCard
              key={stage.id}
              stage={stage}
              section={section}
            />
          ))
        )}
      </div>
    </div>
  )
}
