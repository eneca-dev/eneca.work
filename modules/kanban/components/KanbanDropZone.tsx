'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { KanbanStage, KanbanSection, KanbanColumn, StageStatus } from '../types'
import { KanbanCard } from './KanbanCard'

interface DraggedCard {
  stageId: string
  sectionId: string
}

interface KanbanDropZoneProps {
  column: KanbanColumn
  sectionId: string
  stages: KanbanStage[]
  section: KanbanSection
  // HTML5 Drag and Drop
  draggedCard: DraggedCard | null
  onDragStart: (stageId: string, sectionId: string, e: React.DragEvent) => void
  onDragOver: (targetSectionId: string, e: React.DragEvent) => void
  onDrop: (targetSectionId: string, targetStatus: StageStatus, e: React.DragEvent) => void
  onDragEnd: () => void
}

export function KanbanDropZone({
  column,
  sectionId,
  stages,
  section,
  draggedCard,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: KanbanDropZoneProps) {
  const [isOver, setIsOver] = useState(false)

  const stagesInColumn = stages.filter((s) => s.status === column.id)

  // Проверяем, можно ли дропнуть сюда карточку
  const isDragActive = draggedCard !== null
  const isDropAllowed = !isDragActive || draggedCard?.sectionId === sectionId

  // HTML5 Drag handlers
  const handleDragOver = (e: React.DragEvent) => {
    onDragOver(sectionId, e)
    setIsOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Только если выходим за пределы контейнера (не в дочерний элемент)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    onDrop(sectionId, column.id as StageStatus, e)
    setIsOver(false)
  }

  return (
    <div
      className={cn(
        'flex-1 relative',
        'p-2 transition-colors duration-200',
        'overflow-visible',
        // Подсветка при наведении (только если дроп разрешён)
        isOver && isDropAllowed && 'ring-2 ring-primary/20 ring-inset'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={cn(
          'flex flex-col gap-2 h-full relative',
          'p-2',
          'overflow-visible',
          column.bgColor,
          // Подсветка при наведении (только если дроп разрешён)
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
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              isDragging={draggedCard?.stageId === stage.id}
            />
          ))
        )}
      </div>
    </div>
  )
}
