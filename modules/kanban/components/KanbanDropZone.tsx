'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StageCreateModal } from '@/modules/modals'
import type { KanbanStage, KanbanSection, KanbanColumn, StageStatus } from '../types'
import { COLUMN_MIN_WIDTH } from '../constants'
import { KanbanCard } from './KanbanCard'

// Цвета индикаторов для каждого статуса
const STATUS_INDICATOR_COLORS: Record<string, string> = {
  backlog: 'bg-slate-500',
  planned: 'bg-violet-500',
  in_progress: 'bg-blue-500',
  paused: 'bg-amber-500',
  review: 'bg-pink-500',
  done: 'bg-emerald-500',
}

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const stagesInColumn = stages.filter((s) => s.status === column.id)
  const indicatorColor = STATUS_INDICATOR_COLORS[column.id] || 'bg-slate-400'

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
      className="flex-shrink-0 relative p-1.5"
      style={{ width: COLUMN_MIN_WIDTH }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={cn(
          'flex flex-col h-full relative',
          'p-2.5 rounded-xl',
          'overflow-visible',
          'transition-all duration-200',
          // Только рамка, без фона
          'border',
          column.borderColor,
          // Подсветка при наведении (только если дроп разрешён)
          isOver && isDropAllowed && 'ring-2 ring-primary/40 ring-offset-1 ring-offset-background'
        )}
      >
        {/* Заголовок статуса внутри столбца */}
        <div className="group/header flex items-center gap-2 mb-2 pb-2 border-b border-inherit">
          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', indicatorColor)} />
          <span className={cn('text-xs font-medium', column.color)}>
            {column.title}
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsCreateModalOpen(true)
              }}
              className={cn(
                'p-0.5 rounded',
                'text-muted-foreground/40 hover:text-muted-foreground',
                'hover:bg-muted/50',
                'transition-all duration-150',
                'opacity-0 group-hover/header:opacity-100'
              )}
              title="Добавить этап"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-muted-foreground/60">
              {stagesInColumn.length}
            </span>
          </div>
        </div>

        {/* Карточки */}
        <div className="flex flex-col gap-2 flex-1">
          {stagesInColumn.length === 0 ? (
            <div
              className={cn(
                'flex-1 flex items-center justify-center',
                'text-xs text-muted-foreground/40',
                'min-h-[60px]',
                'border border-dashed border-muted-foreground/20 rounded-lg',
                'transition-colors duration-200',
                isOver && isDropAllowed && 'border-primary/50 bg-primary/5 text-muted-foreground'
              )}
            >
              {isOver && isDropAllowed ? 'Отпустите здесь' : ''}
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

      {/* Модалка создания этапа */}
      <StageCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => setIsCreateModalOpen(false)}
        sectionId={sectionId}
        sectionName={section.name}
        initialStatusKey={column.id}
      />
    </div>
  )
}
