'use client'

import { useEffect, useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Loader2, LayoutGrid } from 'lucide-react'
import { useKanbanStore } from '../stores/kanban-store'
import type { KanbanStage, KanbanSection, StageStatus } from '../types'
import { KanbanHeader } from './KanbanHeader'
import { KanbanSwimlane } from './KanbanSwimlane'
import { KanbanCard } from './KanbanCard'

export function KanbanBoard() {
  const {
    board,
    isLoading,
    error,
    loadBoard,
    moveStage,
    viewSettings,
    toggleSectionCollapse,
  } = useKanbanStore()

  const [activeCard, setActiveCard] = useState<{
    stage: KanbanStage
    section: KanbanSection
  } | null>(null)

  // Load board on mount
  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { stage, section } = event.active.data.current as {
      stage: KanbanStage
      section: KanbanSection
    }
    setActiveCard({ stage, section })
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null)

      const { active, over } = event
      if (!over) return

      // Parse IDs: format is "sectionId:stageId" for active, "sectionId:status" for over
      const [activeSectionId, activeStageId] = (active.id as string).split(':')
      const [overSectionId, overStatus] = (over.id as string).split(':')

      // Only allow drops within the same section
      if (activeSectionId !== overSectionId) return

      // Move the stage to the new status
      moveStage(activeStageId, activeSectionId, overStatus as StageStatus)
    },
    [moveStage]
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Загрузка доски...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-destructive">
          <span className="text-sm">{error}</span>
        </div>
      </div>
    )
  }

  // Empty state
  if (!board || board.sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <LayoutGrid className="h-12 w-12 opacity-50" />
          <span className="text-sm">Нет данных для отображения</span>
        </div>
      </div>
    )
  }

  // Filter sections based on view settings
  const sectionsToShow = viewSettings.showEmptySwimlanes
    ? board.sections
    : board.sections.filter((s) => s.stages.length > 0)

  return (
    <div className="flex flex-col h-full">
      {/* Board Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {board.projectName}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {board.sections.length} раздел
              {board.sections.length === 1
                ? ''
                : board.sections.length < 5
                  ? 'а'
                  : 'ов'}
              {' • '}
              {board.sections.reduce((sum, s) => sum + s.stages.length, 0)} этап
              {board.sections.reduce((sum, s) => sum + s.stages.length, 0) === 1
                ? ''
                : board.sections.reduce((sum, s) => sum + s.stages.length, 0) < 5
                  ? 'а'
                  : 'ов'}
            </p>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <KanbanHeader />

      {/* Swimlanes */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-auto no-scrollbar-bg">
          {sectionsToShow.map((section) => (
            <KanbanSwimlane
              key={section.id}
              section={section}
              isCollapsed={viewSettings.collapsedSections.includes(section.id)}
              onToggleCollapse={() => toggleSectionCollapse(section.id)}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeCard && (
            <div className="opacity-90 rotate-2 scale-105">
              <KanbanCard
                stage={activeCard.stage}
                section={activeCard.section}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
