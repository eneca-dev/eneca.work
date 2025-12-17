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
import { Loader2, LayoutGrid, RefreshCw, FilterX, Building2, FolderKanban, ChevronsDownUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
    toggleCollapseAll,
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

  // Check if all sections are collapsed
  const allCollapsed = board?.sections.every((s) =>
    viewSettings.collapsedSections.includes(s.id)
  )

  return (
    <div className="flex flex-col h-full">
      {/* Filters Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Organization Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 h-9">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <Building2 className="h-4 w-4" />
                <span>Организация</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => console.log('Filter: all')}>
                Все
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Filter: non-production')}>
                Непроизводственные отделы
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Filter: production')}>
                Производственные отделы
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Filter: eneka')}>
                ЭНЭКА - СП Групп
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Project Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 h-9">
                <FolderKanban className="h-4 w-4" />
                <span>Проект</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[320px]">
              <DropdownMenuItem onClick={() => console.log('Project: all')}>
                Все
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Project: proj1')}>
                11-PUZ-07-YY/25-УЧПТ THE VIEW
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Project: proj2')}>
                11-ГП-04/25-А-Пионерская 41, БАТ офис
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Project: proj3')}>
                11-ГП-04/25-С-Пионерская 41, БАТ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Project: proj4')}>
                11-ПР-05/25-П-Мангазея (Северный речной порт)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Project: proj5')}>
                12-П-29/25-С Технониколь (Термомасло)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset Filters */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-9"
            onClick={() => console.log('Reset filters clicked')}
          >
            <FilterX className="h-4 w-4" />
            <span>Сбросить фильтры</span>
          </Button>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-9"
            onClick={() => {
              console.log('Refresh clicked')
              loadBoard()
            }}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Обновить</span>
          </Button>

          {/* Collapse All */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-9"
            onClick={toggleCollapseAll}
          >
            <ChevronsDownUp className="h-4 w-4" />
            <span>{allCollapsed ? 'Развернуть всё' : 'Свернуть всё'}</span>
          </Button>
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [scrollbar-width:none]">
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
