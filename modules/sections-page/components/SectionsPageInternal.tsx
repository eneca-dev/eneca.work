/**
 * Sections Page Internal Component
 *
 * Главный компонент страницы "Разделы"
 * Отображает иерархию: Отделы → Проекты → Разделы → Загрузки
 */

'use client'

import { useMemo, useCallback, useRef, useEffect } from 'react'
import { ChevronsUpDown, ChevronsDownUp, Database } from 'lucide-react'
import { differenceInDays } from 'date-fns'
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
import { TimelineHeader, generateDayCells, resolveTimelineRange } from '@/modules/resource-graph/components/timeline'
import { ScissorsToggle } from '@/components/shared/timeline'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DAYS_BEFORE_TODAY, DAYS_AFTER_TODAY } from '../constants'
import { DepartmentRowContent } from './rows/DepartmentRow'
import { ProjectRowContent } from './rows/ProjectRow'
import { ObjectSectionRowContent } from './rows/ObjectSectionRow'
import { EmployeeRow } from './rows/EmployeeRow'
import { flattenSections, type SectFlatRow } from './flatten-sections'
import { VirtualList, type VirtualColumn } from '@/modules/shared/virtualized-tree'
import { Skeleton } from '@/components/ui/skeleton'
import { openLoadingModalNewCreate, openLoadingModalNewEdit, usePrefetchProjectsList, usePrefetchProjectTrees } from '@/modules/modals'
import { useShallow } from 'zustand/react/shallow'
import type { FilterQueryParams } from '@/modules/cache'
import { useCompanyCalendarEvents } from '@/modules/resource-graph/hooks'

interface SectionsPageInternalProps {
  queryParams?: FilterQueryParams
  /** Whether "load all" is enabled (persisted in tabs store) */
  loadAllEnabled: boolean
  /** Called when user clicks "Загрузить всё" */
  onLoadAll: () => void
}

export function SectionsPageInternal({ queryParams, loadAllEnabled, onLoadAll }: SectionsPageInternalProps) {
  // Проверяем, применены ли фильтры
  const filtersApplied = useMemo(() => {
    return queryParams && Object.keys(queryParams).length > 0
  }, [queryParams])

  // Idle-префетч списка проектов для модалки «Создать загрузку»: греем в простое
  // ПОСЛЕ загрузки страницы → модалка открывается мгновенно, страницу не замедляем.
  // Единственное холодное место модалки (сотрудники уже в кэше, деревья — лениво).
  const prefetchProjectsList = usePrefetchProjectsList()
  useEffect(() => {
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(() => prefetchProjectsList(), { timeout: 3000 })
      return () => window.cancelIdleCallback?.(id)
    }
    const id = setTimeout(() => prefetchProjectsList(), 1500)
    return () => clearTimeout(id)
  }, [prefetchProjectsList])

  // Idle-префетч деревьев РАСКРЫТЫХ проектов (их id переживают перезагрузку в localStorage):
  // открываешь «Создать загрузку» на разделе раскрытого проекта → дерево уже тёплое →
  // модалка открывается с содержимым мгновенно. Греется последовательно, в простое.
  const expandedProjectIds = useSectionsPageUIStore(
    useShallow((s) =>
      s.expandedNodes
        .filter((n) => n.startsWith('project-'))
        .map((n) => n.slice('project-'.length))
    )
  )
  usePrefetchProjectTrees(expandedProjectIds)

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
      /** Команда исполнителя (для permission gating в модалке) */
      employee_team_id?: string | null
      /** Отдел исполнителя (для permission gating в модалке) */
      employee_department_id?: string | null
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
  const shouldFetchData = filtersApplied || loadAllEnabled

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

  // Custom date range from store
  const customDateRange = useSectionsPageUIStore((s) => s.customDateRange)
  const setCustomDateRange = useSectionsPageUIStore((s) => s.setCustomDateRange)

  // Timeline range and cells
  const range = useMemo(
    () => resolveTimelineRange(customDateRange, { daysBefore: DAYS_BEFORE_TODAY, daysAfter: DAYS_AFTER_TODAY }),
    [customDateRange]
  )

  const { data: calendarEvents = [] } = useCompanyCalendarEvents()

  const dayCells = useMemo(
    () => generateDayCells(range, calendarEvents),
    [range, calendarEvents]
  )

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // UI state
  const expandAll = useSectionsPageUIStore((s) => s.expandAll)
  const collapseAll = useSectionsPageUIStore((s) => s.collapseAll)
  // Состояние раскрытия — для flatten (toggle создаёт новый массив → пересчёт).
  const expandedNodes = useSectionsPageUIStore((s) => s.expandedNodes)

  // Data fetching with external query params
  const { data: departments, isLoading, error } = useSectionsHierarchy(
    filtersApplied ? queryParams : {},
    { enabled: shouldFetchData }
  )

  // Плоский список строк для виртуализации (отдел→проект→объект-раздел→сотрудник).
  const flatRows = useMemo<SectFlatRow[]>(() => {
    if (!departments) return []
    return flattenSections(departments, new Set(expandedNodes))
  }, [departments, expandedNodes])

  // Рендер одной плоской строки по типу (columns — видимые колонки дня).
  const renderRow = useCallback(
    (row: SectFlatRow, _index: number, columns?: VirtualColumn[]) => {
      switch (row.kind) {
        case 'dept':
          return <DepartmentRowContent department={row.dept} dayCells={dayCells} columns={columns} />
        case 'project':
          return <ProjectRowContent project={row.project} dayCells={dayCells} columns={columns} />
        case 'objectSection':
          return (
            <ObjectSectionRowContent
              objectSection={row.objectSection}
              projectId={row.projectId}
              dayCells={dayCells}
              columns={columns}
            />
          )
        case 'employee':
          return (
            <EmployeeRow
              employee={row.employee}
              sectionId={row.sectionId}
              sectionName={row.sectionName}
              projectId={row.projectId}
              projectName={row.projectName}
              objectId={row.objectId}
              objectName={row.objectName}
              dayCells={dayCells}
              columns={columns}
            />
          )
        default: {
          const _exhaustive: never = row
          void _exhaustive
          return null
        }
      }
    },
    [dayCells]
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

  // Calculate "today" offset in pixels from the start of the timeline
  const todayOffsetDays = useMemo(() => {
    const today = getTodayMinsk()
    return differenceInDays(today, range.start)
  }, [range.start])

  // Scroll to show today with a small margin (7 days) to maximize forward view
  const handleScrollToToday = useCallback(() => {
    const scrollLeft = Math.max(0, (todayOffsetDays - 7) * DAY_CELL_WIDTH)
    if (contentScrollRef.current) contentScrollRef.current.scrollLeft = scrollLeft
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = scrollLeft
  }, [todayOffsetDays])

  // Scroll header to today as soon as it renders (fires when shouldFetchData becomes true)
  useEffect(() => {
    if (!shouldFetchData || !headerScrollRef.current) return
    const scrollLeft = Math.max(0, (todayOffsetDays - 7) * DAY_CELL_WIDTH)
    headerScrollRef.current.scrollLeft = scrollLeft
  }, [shouldFetchData, todayOffsetDays])

  // Scroll content to today-7 when data finishes loading
  useEffect(() => {
    if (isLoading || !contentScrollRef.current) return
    const scrollLeft = Math.max(0, (todayOffsetDays - 7) * DAY_CELL_WIDTH)
    contentScrollRef.current.scrollLeft = scrollLeft
  }, [isLoading, todayOffsetDays])

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
            onClick={onLoadAll}
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
                  <ScissorsToggle />
                  {/* TODO: временно скрыты кнопки "Развернуть всё" / "Свернуть всё"
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
                  */}
                </div>
                {/* Timeline header with dates */}
                <TimelineHeader
                  dayCells={dayCells}
                  datePopoverConfig={{
                    customRange: customDateRange,
                    onRangeChange: setCustomDateRange,
                    onScrollToToday: handleScrollToToday,
                    defaultDaysBefore: DAYS_BEFORE_TODAY,
                    defaultDaysAfter: DAYS_AFTER_TODAY,
                  }}
                />
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

          {/* Timeline Content (виртуализировано X+Y — bug-VT-15) */}
          {!error && !isLoading && departments && departments.length > 0 && (
            <VirtualList
              items={flatRows}
              getKey={(r) => r.key}
              renderItem={renderRow}
              estimateSize={44}
              overscan={10}
              positionWithTop
              minContentWidth={totalWidth}
              scrollElementRef={contentScrollRef}
              onScroll={handleContentScroll}
              className="h-full"
              columnCount={dayCells.length}
              columnWidth={DAY_CELL_WIDTH}
              columnScrollMargin={SIDEBAR_WIDTH}
              columnOverscan={4}
            />
          )}
        </div>
      </div>
    </SectionsPageProvider>
  )
}
