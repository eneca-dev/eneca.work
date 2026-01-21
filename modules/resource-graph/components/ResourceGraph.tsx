/**
 * Resource Graph - Main Component
 *
 * Главный компонент модуля графика ресурсов с timeline
 * Использует InlineFilter для фильтрации в стиле GitHub Projects
 */

'use client'

import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { ChevronsUpDown, ChevronsDownUp, ChevronDown, Database } from 'lucide-react'
import { addDays } from 'date-fns'
import { getTodayMinsk } from '@/lib/timezone-utils'
import { useResourceGraphData, useCompanyCalendarEvents, usePrefetchSectionsBatch } from '../hooks'
import { useDisplaySettingsStore, useFiltersStore, useUIStateStore, RESOURCE_GRAPH_FILTER_CONFIG } from '../stores'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { useFilterOptions } from '../filters'
import { ResourceGraphTimeline, TimelineHeader, generateDayCells } from './timeline'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../constants'
import type { TimelineRange } from '../types'
import { InlineFilter, parseFilterString, tokensToQueryParams, type FilterConfig, type FilterQueryParams } from '@/modules/inline-filter'
import { LockedFiltersBadge } from '@/modules/permissions'
import { UserSync } from '@/components/UserSync'
import {
  CheckpointEditModal,
  useIsModalOpen,
  useModalData,
  closeModal,
  type CheckpointEditData
} from '@/modules/modals'

// Timeline config - 180 дней (полгода)
const DAYS_BEFORE_TODAY = 30  // Месяц назад
const DAYS_AFTER_TODAY = 150  // 5 месяцев вперёд
const TOTAL_DAYS = DAYS_BEFORE_TODAY + DAYS_AFTER_TODAY

function calculateTimelineRange(): TimelineRange {
  const today = getTodayMinsk()
  const start = addDays(today, -DAYS_BEFORE_TODAY)
  const end = addDays(today, DAYS_AFTER_TODAY - 1)
  return { start, end, totalDays: TOTAL_DAYS }
}

// ============================================================================
// Internal Props (for embedding in TasksView)
// ============================================================================

interface ResourceGraphInternalProps {
  /** Filter string from parent */
  filterString: string
  /** Parsed query params from parent */
  queryParams: FilterQueryParams
  /** Filter config from parent */
  filterConfig: FilterConfig
}

/**
 * ResourceGraphInternal - версия без своего header/filter
 *
 * Используется в TasksView для встраивания в общую страницу с табами
 */
export function ResourceGraphInternal({ queryParams }: ResourceGraphInternalProps) {
  // State: загрузить все данные без фильтров
  const [loadAll, setLoadAll] = useState(false)

  // Проверяем, применены ли фильтры
  const filtersApplied = useMemo(() => {
    return Object.keys(queryParams).length > 0
  }, [queryParams])

  // Определяем, нужно ли загружать данные
  const shouldFetchData = filtersApplied || loadAll

  // Handle "Load All" button click
  const handleLoadAll = useCallback(() => {
    setLoadAll(true)
  }, [])

  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const isScrollingSyncRef = useRef(false)

  // Global checkpoint edit modal state
  const isCheckpointEditModalOpen = useIsModalOpen('checkpoint-edit')
  const checkpointEditData = useModalData() as CheckpointEditData | null

  // Sync scroll between header and content
  const handleHeaderScroll = useCallback(() => {
    if (isScrollingSyncRef.current) return
    if (headerScrollRef.current && contentScrollRef.current) {
      isScrollingSyncRef.current = true
      contentScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false
      })
    }
  }, [])

  const handleContentScroll = useCallback(() => {
    if (isScrollingSyncRef.current) return
    if (headerScrollRef.current && contentScrollRef.current) {
      isScrollingSyncRef.current = true
      headerScrollRef.current.scrollLeft = contentScrollRef.current.scrollLeft
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false
      })
    }
  }, [])

  // Load company calendar events (holidays and transfers) - cached for 24h
  const { data: calendarEvents = [] } = useCompanyCalendarEvents()

  // Timeline range and cells
  const range = useMemo(() => calculateTimelineRange(), [])
  const dayCells = useMemo(
    () => generateDayCells(range, calendarEvents),
    [range, calendarEvents]
  )
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // Auto-scroll to today on mount
  useEffect(() => {
    // Позиция "сегодня" на timeline (DAYS_BEFORE_TODAY дней от начала)
    const todayScrollPosition = DAYS_BEFORE_TODAY * DAY_CELL_WIDTH

    // Небольшая задержка чтобы DOM успел отрисоваться
    requestAnimationFrame(() => {
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = todayScrollPosition
      }
      if (contentScrollRef.current) {
        contentScrollRef.current.scrollLeft = todayScrollPosition
      }
    })
  }, []) // Один раз при монтировании

  // UI state
  const { collapseAll, expandAll, expandToSections } = useUIStateStore()

  // Data fetching with external query params
  const { data, isLoading, error } = useResourceGraphData(
    filtersApplied ? queryParams : undefined,
    { enabled: shouldFetchData }
  )

  // Background prefetch of sections batch data after initial load
  usePrefetchSectionsBatch(data, { enabled: !isLoading && !!data })

  // Expand all nodes in the tree (batch operation)
  const handleExpandAll = useCallback(() => {
    if (!data) return

    const nodesByType: Partial<Record<import('../types').TreeNodeType, string[]>> = {
      project: [],
      object: [],
      section: [],
      decomposition_stage: [],
    }

    data.forEach((project) => {
      nodesByType.project!.push(project.id)
      project.objects.forEach((obj) => {
        nodesByType.object!.push(obj.id)
        obj.sections.forEach((section) => {
          nodesByType.section!.push(section.id)
          section.decompositionStages.forEach((ds) => {
            nodesByType.decomposition_stage!.push(ds.id)
          })
        })
      })
    })

    expandAll(nodesByType)
  }, [data, expandAll])

  // Expand to sections level (projects + objects only)
  const handleExpandToSections = useCallback(() => {
    if (!data) return

    const projectIds: string[] = []
    const objectIds: string[] = []

    data.forEach((project) => {
      projectIds.push(project.id)
      project.objects.forEach((obj) => {
        objectIds.push(obj.id)
      })
    })

    expandToSections({ project: projectIds, object: objectIds })
  }, [data, expandToSections])

  // Collapse all nodes
  const handleCollapseAll = useCallback(() => {
    collapseAll()
  }, [collapseAll])

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
            Используйте фильтр выше для поиска проектов и разделов.
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Timeline Header - Dates row (sticky) */}
      {!error && (
        <header className="sticky top-0 z-20 bg-card border-b shadow-sm">
          <div
            ref={headerScrollRef}
            onScroll={handleHeaderScroll}
            className="bg-background overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex" style={{ minWidth: totalWidth }}>
              {/* Sidebar header - sticky left */}
              <div
                className="shrink-0 flex items-center justify-between px-3 py-1.5 border-r border-border bg-card sticky left-0 z-20"
                style={{ width: SIDEBAR_WIDTH }}
              >
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Структура
                </span>
                {/* Unified button group - expand controls */}
                <TooltipProvider delayDuration={200}>
                  <div className="flex items-center bg-muted/40 rounded-md border border-border/50">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-1 hover:bg-muted/80 rounded-l-md transition-colors text-muted-foreground hover:text-foreground"
                          onClick={handleExpandToSections}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">До разделов</TooltipContent>
                    </Tooltip>
                    <div className="w-px h-4 bg-border/50" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-1 hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                          onClick={handleExpandAll}
                        >
                          <ChevronsUpDown className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Развернуть всё</TooltipContent>
                    </Tooltip>
                    <div className="w-px h-4 bg-border/50" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-1 hover:bg-muted/80 rounded-r-md transition-colors text-muted-foreground hover:text-foreground"
                          onClick={handleCollapseAll}
                        >
                          <ChevronsDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Свернуть всё</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>
              {/* Timeline header with dates */}
              <TimelineHeader dayCells={dayCells} />
            </div>
          </div>
        </header>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Error state */}
        {error && !isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-destructive mb-2">Ошибка загрузки данных</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
        )}

        {/* Timeline Content */}
        {!error && (
          <ResourceGraphTimeline
            ref={contentScrollRef}
            onScroll={handleContentScroll}
            projects={data || []}
            dayCells={dayCells}
            range={range}
            isLoading={isLoading}
            hideHeader
          />
        )}
      </div>

      {/* Global Checkpoint Edit Modal */}
      {isCheckpointEditModalOpen && checkpointEditData?.checkpointId && (
        <CheckpointEditModal
          isOpen={isCheckpointEditModalOpen}
          onClose={closeModal}
          checkpointId={checkpointEditData.checkpointId}
        />
      )}
    </div>
  )
}

// ============================================================================
// Standalone Component (original with own filter bar)
// ============================================================================

export function ResourceGraph() {
  // Данные грузятся сразу (без пустого экрана)

  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const isScrollingSyncRef = useRef(false)

  // Global checkpoint edit modal state
  const isCheckpointEditModalOpen = useIsModalOpen('checkpoint-edit')
  const checkpointEditData = useModalData() as CheckpointEditData | null

  // Sync scroll between header and content
  const handleHeaderScroll = useCallback(() => {
    if (isScrollingSyncRef.current) return
    if (headerScrollRef.current && contentScrollRef.current) {
      isScrollingSyncRef.current = true
      contentScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false
      })
    }
  }, [])

  const handleContentScroll = useCallback(() => {
    if (isScrollingSyncRef.current) return
    if (headerScrollRef.current && contentScrollRef.current) {
      isScrollingSyncRef.current = true
      headerScrollRef.current.scrollLeft = contentScrollRef.current.scrollLeft
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false
      })
    }
  }, [])

  // Load company calendar events (holidays and transfers) - cached for 24h
  const { data: calendarEvents = [] } = useCompanyCalendarEvents()

  // Timeline range and cells (recalculated when calendar events load)
  const range = useMemo(() => calculateTimelineRange(), [])
  const dayCells = useMemo(
    () => generateDayCells(range, calendarEvents),
    [range, calendarEvents]
  )
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // Auto-scroll to today on mount
  useEffect(() => {
    // Позиция "сегодня" на timeline (DAYS_BEFORE_TODAY дней от начала)
    const todayScrollPosition = DAYS_BEFORE_TODAY * DAY_CELL_WIDTH

    // Небольшая задержка чтобы DOM успел отрисоваться
    requestAnimationFrame(() => {
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = todayScrollPosition
      }
      if (contentScrollRef.current) {
        contentScrollRef.current.scrollLeft = todayScrollPosition
      }
    })
  }, []) // Один раз при монтировании

  // Filters store
  const { filterString, setFilterString } = useFiltersStore()
  const { settings } = useDisplaySettingsStore()
  const { collapseAll, expandAll, expandToSections } = useUIStateStore()

  // Load filter options for autocomplete
  const { options: filterOptions, isLoading: loadingOptions } = useFilterOptions()

  // Parse filter string to query params
  const queryParams = useMemo(() => {
    const parsed = parseFilterString(filterString, RESOURCE_GRAPH_FILTER_CONFIG)
    return tokensToQueryParams(parsed.tokens, RESOURCE_GRAPH_FILTER_CONFIG)
  }, [filterString])

  // Data fetching - всегда загружаем данные (фильтры применяются на сервере)
  const { data, isLoading, error } = useResourceGraphData(queryParams)

  // Background prefetch of sections batch data after initial load
  usePrefetchSectionsBatch(data, { enabled: !isLoading && !!data })

  // Expand all nodes in the tree (batch operation)
  const handleExpandAll = useCallback(() => {
    if (!data) return

    const nodesByType: Partial<Record<import('../types').TreeNodeType, string[]>> = {
      project: [],
      object: [],
      section: [],
      decomposition_stage: [],
    }

    data.forEach((project) => {
      nodesByType.project!.push(project.id)
      project.objects.forEach((obj) => {
        nodesByType.object!.push(obj.id)
        obj.sections.forEach((section) => {
          nodesByType.section!.push(section.id)
          section.decompositionStages.forEach((ds) => {
            nodesByType.decomposition_stage!.push(ds.id)
          })
        })
      })
    })

    expandAll(nodesByType)
  }, [data, expandAll])

  // Expand to sections level (projects + objects only)
  const handleExpandToSections = useCallback(() => {
    if (!data) return

    const projectIds: string[] = []
    const objectIds: string[] = []

    data.forEach((project) => {
      projectIds.push(project.id)
      project.objects.forEach((obj) => {
        objectIds.push(obj.id)
      })
    })

    expandToSections({ project: projectIds, object: objectIds })
  }, [data, expandToSections])

  // Collapse all nodes
  const handleCollapseAll = useCallback(() => {
    collapseAll()
  }, [collapseAll])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* User Sync */}
      <UserSync />

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-card border-b shadow-sm">
        {/* Main toolbar with InlineFilter - aligned to sidebar */}
        <div className="flex items-center py-2">
          {/* Left: Title aligned with sidebar */}
          <div
            className="shrink-0 flex items-center px-3"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <h1 className="text-lg font-semibold">Планирование</h1>
          </div>

          {/* InlineFilter - takes remaining space */}
          <div className="flex-1 min-w-0 flex items-center gap-2 pr-4">
            <div className="flex-1 min-w-0">
              <InlineFilter
                config={RESOURCE_GRAPH_FILTER_CONFIG}
                value={filterString}
                onChange={setFilterString}
                options={filterOptions}
              />
            </div>
            {/* Badge showing locked filters for non-admin users */}
            <LockedFiltersBadge />
          </div>
        </div>

        {/* Timeline Header - Dates row (sticky with main header) */}
        {!error && (
          <div
            ref={headerScrollRef}
            onScroll={handleHeaderScroll}
            className="border-t border-border/50 bg-background overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex" style={{ minWidth: totalWidth }}>
              {/* Sidebar header - sticky left */}
              <div
                className="shrink-0 flex items-center justify-between px-3 py-1.5 border-r border-border bg-card sticky left-0 z-20"
                style={{ width: SIDEBAR_WIDTH }}
              >
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Структура
                </span>
                {/* Unified button group - expand controls */}
                <TooltipProvider delayDuration={200}>
                  <div className="flex items-center bg-muted/40 rounded-md border border-border/50">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-1 hover:bg-muted/80 rounded-l-md transition-colors text-muted-foreground hover:text-foreground"
                          onClick={handleExpandToSections}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">До разделов</TooltipContent>
                    </Tooltip>
                    <div className="w-px h-4 bg-border/50" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-1 hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
                          onClick={handleExpandAll}
                        >
                          <ChevronsUpDown className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Развернуть всё</TooltipContent>
                    </Tooltip>
                    <div className="w-px h-4 bg-border/50" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-1 hover:bg-muted/80 rounded-r-md transition-colors text-muted-foreground hover:text-foreground"
                          onClick={handleCollapseAll}
                        >
                          <ChevronsDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Свернуть всё</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>
              {/* Timeline header with dates */}
              <TimelineHeader dayCells={dayCells} />
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Error state */}
        {error && !isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-destructive mb-2">Ошибка загрузки данных</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
        )}

        {/* Timeline Content (rows only, header is in sticky area) */}
        {!error && (
          <ResourceGraphTimeline
            ref={contentScrollRef}
            onScroll={handleContentScroll}
            projects={data || []}
            dayCells={dayCells}
            range={range}
            isLoading={isLoading}
            hideHeader
          />
        )}
      </div>

      {/* Global Checkpoint Edit Modal */}
      {isCheckpointEditModalOpen && checkpointEditData?.checkpointId && (
        <CheckpointEditModal
          isOpen={isCheckpointEditModalOpen}
          onClose={closeModal}
          checkpointId={checkpointEditData.checkpointId}
        />
      )}
    </div>
  )
}
