/**
 * Resource Graph - Main Component
 *
 * Главный компонент модуля графика ресурсов с timeline
 * Использует InlineFilter для фильтрации в стиле GitHub Projects
 */

'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Database } from 'lucide-react'
import { addDays, startOfDay } from 'date-fns'
import { useResourceGraphData, useCompanyCalendarEvents } from '../hooks'
import { useDisplaySettingsStore, useFiltersStore, RESOURCE_GRAPH_FILTER_CONFIG } from '../stores'
import { useFilterOptions } from '../filters'
import { ResourceGraphTimeline, TimelineHeader, generateDayCells } from './timeline'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../constants'
import { cn } from '@/lib/utils'
import type { TimelineRange } from '../types'
import { InlineFilter, parseFilterString, tokensToQueryParams } from '@/modules/inline-filter'

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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-card border-b shadow-sm">
        {/* Main toolbar with InlineFilter */}
        <div className="px-4 py-3 flex items-center gap-4">
          {/* Left: Title & Stats */}
          <div className="shrink-0">
            <h1 className="text-lg font-semibold">График ресурсов</h1>
            <p className="text-xs text-muted-foreground">
              {shouldFetchData
                ? `Проектов: ${data?.length || 0}${loadAll && !filtersApplied ? ' (все)' : ''}`
                : 'Выберите фильтры'}
            </p>
          </div>

          {/* InlineFilter */}
          <div className="flex-1 min-w-0">
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
                className="shrink-0 flex items-center px-3 py-2 border-r border-border bg-card sticky left-0 z-20"
                style={{ width: SIDEBAR_WIDTH }}
              >
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Структура
                </span>
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
    </div>
  )
}
