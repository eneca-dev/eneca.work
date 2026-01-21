'use client'

import { useState, useMemo, useCallback } from 'react'
import { Loader2, LayoutGrid, SearchX, AlertCircle, Database, ChevronDown } from 'lucide-react'
import { InlineFilter, type FilterOption, type FilterConfig, type FilterQueryParams } from '@/modules/inline-filter'
import { useKanbanFiltersStore, useKanbanUIStore, KANBAN_FILTER_CONFIG } from '../stores'
import { useKanbanFilterOptions } from '../filters/useFilterOptions'
import { useKanbanSectionsInfinite, useUpdateStageStatusOptimistic, useDragHandlers } from '../hooks'
import type { KanbanBoard as KanbanBoardType } from '../types'
import { KanbanSwimlane } from './KanbanSwimlane'

// ============================================================================
// Internal Props (for embedding in TasksView)
// ============================================================================

interface KanbanBoardInternalProps {
  /** Filter string from parent */
  filterString: string
  /** Parsed query params from parent */
  queryParams: FilterQueryParams
  /** Filter config from parent */
  filterConfig: FilterConfig
}

/**
 * KanbanBoardInternal - версия без своего FilterToolbar
 *
 * Используется в TasksView для встраивания в общую страницу с табами
 */
export function KanbanBoardInternal({ filterString, queryParams }: KanbanBoardInternalProps) {
  // State: загрузить все данные без фильтров
  const [loadAll, setLoadAll] = useState(false)

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

  // Mutation для обновления статуса этапа (с оптимистичным обновлением)
  const { mutate: updateStatus } = useUpdateStageStatusOptimistic(
    filtersApplied ? queryParams : undefined
  )

  // Handle "Load All" button click
  const handleLoadAll = useCallback(() => {
    setLoadAll(true)
  }, [])

  // UI state из Zustand store (сохраняется между переключениями вкладок)
  const { collapsedSections, showEmptySwimlanes, toggleSectionCollapse } = useKanbanUIStore()

  // HTML5 Drag and Drop handlers
  const { draggedCard, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useDragHandlers({
    onUpdateStatus: updateStatus,
  })

  // Build board from sections
  const board: KanbanBoardType | null = useMemo(() => {
    if (!sections || sections.length === 0) return null
    return {
      projectId: sections[0]?.projectId || '',
      projectName: sections[0]?.projectName || '',
      sections,
    }
  }, [sections])

  // HTML5 Drag and Drop Handlers
  const handleDragStart = useCallback((stageId: string, sectionId: string, e: React.DragEvent) => {
    setDraggedCard({ stageId, sectionId })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ stageId, sectionId }))
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0)
    }
  }, [])

  const handleDragOver = useCallback((targetSectionId: string, e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedCard) {
      e.dataTransfer.dropEffect = 'none'
      return
    }
    if (draggedCard.sectionId !== targetSectionId) {
      e.dataTransfer.dropEffect = 'none'
      return
    }
    e.dataTransfer.dropEffect = 'move'
  }, [draggedCard])

  const handleDrop = useCallback((targetSectionId: string, targetStatus: StageStatus, e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedCard) return
    if (draggedCard.sectionId !== targetSectionId) {
      setDraggedCard(null)
      return
    }
    updateStatus({
      stageId: draggedCard.stageId,
      sectionId: draggedCard.sectionId,
      newStatus: targetStatus,
    })
    setDraggedCard(null)
  }, [draggedCard, updateStatus])

  const handleDragEnd = useCallback(() => {
    setDraggedCard(null)
  }, [])

  // Empty state - before data fetch (no filters, no loadAll)
  if (!shouldFetchData) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
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
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Загрузка...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <span className="text-sm">{error instanceof Error ? error.message : 'Ошибка загрузки данных'}</span>
        </div>
      </div>
    )
  }

  // Empty state - after fetch with no results
  if (!board || board.sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <SearchX className="h-12 w-12 opacity-50" />
          <span className="text-sm">Нет данных для отображения</span>
          <span className="text-xs">Попробуйте изменить фильтры</span>
        </div>
      </div>
    )
  }

  // Filter sections based on view settings
  const sectionsToShow = showEmptySwimlanes
    ? board.sections
    : board.sections.filter((s) => s.stages.length > 0)

  return (
    <div className="flex flex-col h-full">
      {/* Swimlanes */}
      <div className="flex-1 overflow-x-auto overflow-y-auto [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [scrollbar-width:none]">
        <div className="min-w-fit">
          {sectionsToShow.map((section) => (
            <KanbanSwimlane
              key={section.id}
              section={section}
              isCollapsed={collapsedSections.includes(section.id)}
              onToggleCollapse={() => toggleSectionCollapse(section.id)}
              draggedCard={draggedCard}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
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
      </div>
    </div>
  )
}

// ============================================================================
// Local View State
// ============================================================================

interface ViewSettings {
  showEmptySwimlanes: boolean
  collapsedSections: string[]
}

// ============================================================================
// Standalone Component (original with own filter bar)
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

  // Mutation для обновления статуса этапа (с оптимистичным обновлением)
  const { mutate: updateStatus } = useUpdateStageStatusOptimistic(
    filtersApplied ? queryParams : undefined
  )

  // Local view state
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showEmptySwimlanes: true,
    collapsedSections: [],
  })

  // HTML5 Drag and Drop handlers
  const { draggedCard, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useDragHandlers({
    onUpdateStatus: updateStatus,
  })

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
  if (isLoading) {
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

      {/* Swimlanes */}
      <div className="flex-1 overflow-x-auto overflow-y-auto [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [scrollbar-width:none]">
        <div className="min-w-fit">
          {sectionsToShow.map((section) => (
            <KanbanSwimlane
              key={section.id}
              section={section}
              isCollapsed={viewSettings.collapsedSections.includes(section.id)}
              onToggleCollapse={() => toggleSectionCollapse(section.id)}
              draggedCard={draggedCard}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
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
      </div>
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
