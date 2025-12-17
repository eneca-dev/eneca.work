'use client'

import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { KanbanStage, KanbanSection } from '../types'
import type { KanbanColumn } from '../types'
import { KanbanCard } from './KanbanCard'

interface KanbanDropZoneProps {
  column: KanbanColumn
  sectionId: string
  stages: KanbanStage[]
  section: KanbanSection
}

export function KanbanDropZone({
  column,
  sectionId,
  stages,
  section,
}: KanbanDropZoneProps) {
  const droppableId = `${sectionId}:${column.id}`
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { sectionId, status: column.id },
  })

  const stagesInColumn = stages.filter((s) => s.status === column.id)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1',
        'p-2 transition-colors duration-200',
        'overflow-hidden',
        isOver && 'ring-2 ring-primary/20 ring-inset'
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-2 h-full',
          'p-2',
          'overflow-hidden',
          column.bgColor,
          isOver && 'ring-2 ring-primary/30 ring-inset'
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
            {isOver ? 'Отпустите здесь' : ''}
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
