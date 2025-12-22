'use client'

import { useCallback, useState, useMemo } from 'react'
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
import { Loader2, LayoutGrid, AlertCircle, Database, ChevronDown } from 'lucide-react'
import { InlineFilter, type FilterOption } from '@/modules/inline-filter'
import { useKanbanFiltersStore, KANBAN_FILTER_CONFIG } from '../stores'
import { useKanbanFilterOptions } from '../filters/useFilterOptions'
import { useKanbanSectionsInfinite, useStageStatuses, useUpdateStageStatusOptimistic } from '../hooks'
import type { KanbanStage, KanbanSection, StageStatus, KanbanBoard as KanbanBoardType } from '../types'
import { KanbanHeader } from './KanbanHeader'
import { KanbanSwimlane } from './KanbanSwimlane'
import { KanbanCardPreview } from './KanbanCard'

// ============================================================================
// Local View State
// ============================================================================

interface ViewSettings {
  showEmptySwimlanes: boolean
  collapsedSections: string[]
}

// ============================================================================
// Component
// ============================================================================

export function KanbanBoard() {
  // State: загрузить все данные без фильтров
  const [loadAll, setLoadAll] = useState(false)

  // Фильтры
  const { filterString, setFilterString, getQueryParams } = useKanbanFiltersStore()
  const { options: filterOptions } = useKanbanFilterOptions()

  // Получаем параметры фильтра
  const queryParams = useMemo(() => getQueryParams(), [filterString, getQueryParams])

  // Проверяем, применены ли фильтры
  const filtersApplied = useMemo(() => {
    return Object.keys(queryParams).length > 0
  }, [queryParams])

  // Определяем, нужно ли загружать данные
  const shouldFetchData = filtersApplied || loadAll

  // Infinite query для загрузки данных с пагинацией
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useKanbanSectionsInfinite(filtersApplied ? queryParams : undefined, {
    enabled: shouldFetchData,
  })

  // Собираем все секции из всех страниц
  const sections = useMemo(() => {
    return data?.pages.flat() ?? []
  }, [data])

  // Загружаем статусы этапов из БД
  const { statuses, isLoading: statusesLoading } = useStageStatuses()

  // Mutation для обновления статуса этапа (с оптимистичным обновлением)
  const { mutate: updateStatus } = useUpdateStageStatusOptimistic(
    filtersApplied ? queryParams : undefined
  )

  // Local view state
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showEmptySwimlanes: true,
    collapsedSections: [],
  })

  const [activeCard, setActiveCard] = useState<{
    stage: KanbanStage
    section: KanbanSection
  } | null>(null)

  // Build board from sections
  const board: KanbanBoardType | null = useMemo(() => {
    if (!sections || sections.length === 0) return null
    return {
      projectId: sections[0]?.projectId || '',
      projectName: sections[0]?.projectName || '',
      sections,
    }
  }, [sections])

  // Handle "Load All" button click
  const handleLoadAll = useCallback(() => {
    setLoadAll(true)
  }, [])

  // Toggle section collapse
  const toggleSectionCollapse = useCallback((sectionId: string) => {
    setViewSettings((prev) => ({
      ...prev,
      collapsedSections: prev.collapsedSections.includes(sectionId)
        ? prev.collapsedSections.filter((id) => id !== sectionId)
        : [...prev.collapsedSections, sectionId],
    }))
  }, [])

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
      const { active, over } = event

      if (!over) {
        setActiveCard(null)
        return
      }

      // Parse IDs: format is "sectionId:stageId" for active, "sectionId:status" for over
      const [activeSectionId, activeStageId] = (active.id as string).split(':')
      const [overSectionId, overStatus] = (over.id as string).split(':')

      // Only allow drops within the same section
      if (activeSectionId !== overSectionId) {
        setActiveCard(null)
        return
      }

      // Оптимистичное обновление статуса этапа:
      // 1. onMutate синхронно обновит кеш через flushSync
      // 2. setActiveCard(null) скроет DragOverlay
      // 3. Карточка уже в новой колонке (благодаря optimistic update)
      // 4. Запрос идёт на сервер в фоне, при ошибке - автоматический откат
      updateStatus({
        stageId: activeStageId,
        sectionId: activeSectionId,
        newStatus: overStatus as StageStatus,
      })

      // Убираем DragOverlay - карточка уже в новой колонке
      setActiveCard(null)
    },
    [updateStatus]
  )

  // Empty state - before data fetch (no filters, no loadAll)
  if (!shouldFetchData) {
    return (
      <div className="flex flex-col h-full">
        <FilterToolbar
          filterString={filterString}
          setFilterString={setFilterString}
          filterOptions={filterOptions}
          sectionsCount={0}
          showFiltersHint
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-lg font-medium mb-2">
              Выберите данные для отображения
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Используйте фильтр выше для поиска проектов.
            </p>
            <p className="text-xs text-muted-foreground mb-6 font-mono bg-muted/50 px-3 py-2 rounded">
              подразделение:"ОВ" проект:"Название"
            </p>
            <button
              onClick={handleLoadAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Database size={16} />
              Загрузить всё
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading || statusesLoading) {
    return (
      <div className="flex flex-col h-full">
        <FilterToolbar
          filterString={filterString}
          setFilterString={setFilterString}
          filterOptions={filterOptions}
          sectionsCount={0}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Загрузка доски...</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <FilterToolbar
          filterString={filterString}
          setFilterString={setFilterString}
          filterOptions={filterOptions}
          sectionsCount={0}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <span className="text-sm">{error instanceof Error ? error.message : 'Ошибка загрузки данных'}</span>
          </div>
        </div>
      </div>
    )
  }

  // Empty state - after data fetch (no results)
  if (!board || board.sections.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <FilterToolbar
          filterString={filterString}
          setFilterString={setFilterString}
          filterOptions={filterOptions}
          sectionsCount={0}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <LayoutGrid className="h-12 w-12 opacity-50" />
            <span className="text-sm">Нет данных для отображения</span>
            <span className="text-xs">Попробуйте изменить фильтры</span>
          </div>
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
      <FilterToolbar
        filterString={filterString}
        setFilterString={setFilterString}
        filterOptions={filterOptions}
        sectionsCount={board.sections.length}
      />

      {/* Column Headers */}
      <KanbanHeader statuses={statuses} />

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
              activeSectionId={activeCard?.section.id ?? null}
            />
          ))}

          {/* Load More Button */}
          {hasNextPage && (
            <div className="flex justify-center py-4 border-t bg-card/50">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Загрузить ещё
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* DragOverlay - показывает копию карточки, следующую за курсором */}
        {/* Оригинальная карточка скрыта (opacity: 0), когда drag заканчивается, */}
        {/* DragOverlay исчезает, а карточка уже в новой колонке благодаря optimistic update */}
        <DragOverlay dropAnimation={null}>
          {activeCard && (
            <KanbanCardPreview
              stage={activeCard.stage}
              section={activeCard.section}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ============================================================================
// Filter Toolbar Component
// ============================================================================

interface FilterToolbarProps {
  filterString: string
  setFilterString: (value: string) => void
  filterOptions: FilterOption[]
  sectionsCount: number
  showFiltersHint?: boolean
}

function FilterToolbar({
  filterString,
  setFilterString,
  filterOptions,
  sectionsCount,
  showFiltersHint = false,
}: FilterToolbarProps) {
  return (
    <div className="flex-shrink-0 px-4 py-3 border-b bg-card">
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <h1 className="text-lg font-semibold">Канбан</h1>
          <p className="text-xs text-muted-foreground">
            {showFiltersHint ? 'Выберите фильтры' : `Разделов: ${sectionsCount}`}
          </p>
        </div>
        <div className="flex-1 min-w-0">
          <InlineFilter
            config={KANBAN_FILTER_CONFIG}
            value={filterString}
            onChange={setFilterString}
            options={filterOptions}
          />
        </div>
      </div>
    </div>
  )
}
