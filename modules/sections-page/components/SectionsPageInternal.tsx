/**
 * Sections Page Internal Component
 *
 * Главный компонент страницы "Разделы"
 * Отображает иерархию: Отделы → Проекты → Разделы → Загрузки
 */

'use client'

import { useMemo, useCallback, useRef, useState } from 'react'
import { ChevronsUpDown, ChevronsDownUp, Database } from 'lucide-react'
import { addDays } from 'date-fns'
import { getTodayMinsk } from '@/lib/timezone-utils'
import { useSectionsHierarchy } from '../hooks'
import { useSectionsPageUIStore } from '../stores/useSectionsPageUIStore'
import { SectionsPageProvider } from '../context'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { TimelineHeader, generateDayCells } from '@/modules/resource-graph/components/timeline'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DAYS_BEFORE_TODAY, DAYS_AFTER_TODAY, TOTAL_DAYS } from '../constants'
import { DepartmentRow } from './rows/DepartmentRow'
import { Skeleton } from '@/components/ui/skeleton'
import { openLoadingModalNewCreate, openLoadingModalNewEdit } from '@/modules/modals'
import type { TimelineRange, DayCell } from '../types'
import type { FilterQueryParams } from '@/modules/cache'
import type { CompanyCalendarEvent } from '@/modules/resource-graph/types'

function calculateTimelineRange(): TimelineRange {
  const today = getTodayMinsk()
  const start = addDays(today, -DAYS_BEFORE_TODAY)
  const end = addDays(today, DAYS_AFTER_TODAY - 1)
  return { start, end, totalDays: TOTAL_DAYS }
}

interface SectionsPageInternalProps {
  queryParams?: FilterQueryParams
}

export function SectionsPageInternal({ queryParams }: SectionsPageInternalProps) {
  // State: загрузить все данные без фильтров
  const [loadAll, setLoadAll] = useState(false)

  // Проверяем, применены ли фильтры
  const filtersApplied = useMemo(() => {
    return queryParams && Object.keys(queryParams).length > 0
  }, [queryParams])

  // Context action for editing
  const handleEditLoading = useCallback((
    loadingId: string,
    loading: {
      id: string
      employee_id: string
      start_date: string
      end_date: string
      rate: number
      comment: string | null
      stage_id?: string | null
    },
    breadcrumbs: {
      projectId: string
      projectName: string
      objectId: string
      objectName: string
      sectionId: string
      sectionName: string
    },
    stages?: Array<{ id: string; name: string; order: number | null }>
  ) => {
    // Формируем breadcrumbs для модалки с правильными ID
    const modalBreadcrumbs: Array<{
      id: string
      name: string
      type: 'project' | 'object' | 'section' | 'decomposition_stage'
    }> = [
      { id: breadcrumbs.projectId, name: breadcrumbs.projectName, type: 'project' },
      { id: breadcrumbs.objectId, name: breadcrumbs.objectName, type: 'object' },
      { id: breadcrumbs.sectionId, name: breadcrumbs.sectionName, type: 'section' },
    ]

    // Если загрузка связана с этапом декомпозиции - добавляем его в breadcrumbs
    if (loading.stage_id && stages) {
      const stage = stages.find(s => s.id === loading.stage_id)
      if (stage) {
        modalBreadcrumbs.push({
          id: stage.id,
          name: stage.name,
          type: 'decomposition_stage',
        })
      }
    }

    openLoadingModalNewEdit(
      loadingId,
      breadcrumbs.sectionId,
      {
        loading: {
          ...loading,
          section_id: loading.stage_id || breadcrumbs.sectionId, // Используем stage_id если есть
        },
        breadcrumbs: modalBreadcrumbs,
        projectId: breadcrumbs.projectId,
      }
    )
  }, [])

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

  // Timeline range and cells
  const range = useMemo(() => calculateTimelineRange(), [])

  // TODO: Load calendar events from server
  const calendarEvents: CompanyCalendarEvent[] = []

  const dayCells = useMemo(
    () => generateDayCells(range, calendarEvents),
    [range, calendarEvents]
  )
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // UI state
  const expandAll = useSectionsPageUIStore((s) => s.expandAll)
  const collapseAll = useSectionsPageUIStore((s) => s.collapseAll)

  // Data fetching with external query params
  const { data: departments, isLoading, error } = useSectionsHierarchy(
    filtersApplied ? queryParams : {},
    { enabled: shouldFetchData }
  )

  // Expand all nodes in the tree (batch operation)
  const handleExpandAll = useCallback(() => {
    if (!departments) return

    const nodeIds: string[] = []

    departments.forEach((department) => {
      nodeIds.push(`department-${department.id}`)
      department.projects.forEach((project) => {
        nodeIds.push(`project-${project.id}`)
        project.objectSections.forEach((objectSection) => {
          nodeIds.push(`objectSection-${objectSection.id}`)
        })
      })
    })

    expandAll(nodeIds)
  }, [departments, expandAll])

  // Collapse all nodes
  const handleCollapseAll = useCallback(() => {
    collapseAll()
  }, [collapseAll])

  // Scroll to today's date
  const handleScrollToToday = useCallback(() => {
    if (!contentScrollRef.current) return

    // Find today's date index
    const todayIndex = dayCells.findIndex((cell) => cell.isToday)
    if (todayIndex === -1) return

    // Calculate scroll position to center today's date
    const cellPosition = todayIndex * DAY_CELL_WIDTH
    const containerWidth = contentScrollRef.current.clientWidth
    const scrollPosition = cellPosition - containerWidth / 2 + DAY_CELL_WIDTH / 2

    contentScrollRef.current.scrollTo({
      left: Math.max(0, scrollPosition),
      behavior: 'smooth',
    })
  }, [dayCells])

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
            Используйте фильтр выше для поиска отделов и разделов.
          </p>
          <p className="text-xs text-muted-foreground mb-6 font-mono bg-muted/50 px-3 py-2 rounded">
            подразделение:"ОВ" отдел:"Название"
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
    <SectionsPageProvider
      onEditLoading={handleEditLoading}
    >
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
                    Отделы / Проекты / Разделы
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
                <TimelineHeader dayCells={dayCells} onScrollToToday={handleScrollToToday} />
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

          {/* Loading state */}
          {isLoading && (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && departments && departments.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">Нет данных для отображения</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Попробуйте изменить фильтры
                </p>
              </div>
            </div>
          )}

          {/* Timeline Content */}
          {!error && !isLoading && departments && departments.length > 0 && (
            <div
              ref={contentScrollRef}
              onScroll={handleContentScroll}
              className="overflow-auto h-full"
            >
              <div style={{ minWidth: totalWidth }}>
                {departments.map((department, index) => (
                  <DepartmentRow
                    key={department.id}
                    department={department}
                    departmentIndex={index}
                    dayCells={dayCells}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionsPageProvider>
  )
}
