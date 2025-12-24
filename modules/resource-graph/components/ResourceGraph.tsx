/**
 * Resource Graph - Main Component
 *
 * Главный компонент модуля графика ресурсов с timeline
 * Использует InlineFilter для фильтрации в стиле GitHub Projects
 */

'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Database, ChevronsUpDown, ChevronsDownUp } from 'lucide-react'
import { addDays, startOfDay } from 'date-fns'
import { useResourceGraphData, useCompanyCalendarEvents } from '../hooks'
import { useDisplaySettingsStore, useFiltersStore, useUIStateStore, RESOURCE_GRAPH_FILTER_CONFIG } from '../stores'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { useFilterOptions } from '../filters'
import { ResourceGraphTimeline, TimelineHeader, generateDayCells } from './timeline'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../constants'
import { cn } from '@/lib/utils'
import type { TimelineRange } from '../types'
import { InlineFilter, parseFilterString, tokensToQueryParams } from '@/modules/inline-filter'
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
  const today = startOfDay(new Date())
  const start = addDays(today, -DAYS_BEFORE_TODAY)
  const end = addDays(today, DAYS_AFTER_TODAY - 1)
  return { start, end, totalDays: TOTAL_DAYS }
}

export function ResourceGraph() {
  const [loadAll, setLoadAll] = useState(false)

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

  // Filters store
  const { filterString, setFilterString } = useFiltersStore()
  const { settings } = useDisplaySettingsStore()
  const { collapseAll, expandNode } = useUIStateStore()

  // Load filter options for autocomplete
  const { options: filterOptions, isLoading: loadingOptions } = useFilterOptions()

  // Parse filter string to query params
  const queryParams = useMemo(() => {
    const parsed = parseFilterString(filterString, RESOURCE_GRAPH_FILTER_CONFIG)
    return tokensToQueryParams(parsed.tokens, RESOURCE_GRAPH_FILTER_CONFIG)
  }, [filterString])

  // Check if any filters are applied
  const filtersApplied = useMemo(() => {
    return Object.keys(queryParams).length > 0
  }, [queryParams])

  // Determine if we should fetch data
  const shouldFetchData = filtersApplied || loadAll

  // Data fetching
  const { data, isLoading, error } = useResourceGraphData(queryParams, {
    enabled: shouldFetchData,
  })

  const handleLoadAll = useCallback(() => {
    setLoadAll(true)
  }, [])

  // Expand all nodes in the tree
  const handleExpandAll = useCallback(() => {
    if (!data) return
    data.forEach((project) => {
      expandNode('project', project.id)
      project.stages.forEach((stage) => {
        expandNode('stage', stage.id)
        stage.objects.forEach((obj) => {
          expandNode('object', obj.id)
          obj.sections.forEach((section) => {
            expandNode('section', section.id)
            section.decompositionStages.forEach((ds) => {
              expandNode('decomposition_stage', ds.id)
            })
          })
        })
      })
    })
  }, [data, expandNode])

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
          <div className="flex-1 min-w-0 pr-4">
            <InlineFilter
              config={RESOURCE_GRAPH_FILTER_CONFIG}
              value={filterString}
              onChange={setFilterString}
              options={filterOptions}
            />
          </div>
        </div>

        {/* Timeline Header - Dates row (sticky with main header) */}
        {shouldFetchData && !error && (
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
                <TooltipProvider>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={handleExpandAll}
                        >
                          <ChevronsUpDown className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Развернуть всё</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={handleCollapseAll}
                        >
                          <ChevronsDownUp className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Свернуть всё</TooltipContent>
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
        {/* Empty state */}
        {!shouldFetchData && (
          <div className="flex h-full items-center justify-center">
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
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors'
                )}
              >
                <Database size={16} />
                Загрузить всё
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {shouldFetchData && error && !isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-destructive mb-2">Ошибка загрузки данных</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
        )}

        {/* Timeline Content (rows only, header is in sticky area) */}
        {shouldFetchData && !error && (
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
