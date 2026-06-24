/**
 * Departments Timeline - Main Component
 *
 * Главный компонент модуля таймлайна отделов
 * Использует тот же timeline что и resource-graph
 */

'use client'

import { useMemo, useCallback, useRef, useEffect } from 'react'
import { ChevronsUpDown, ChevronsDownUp, Database } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { getTodayMinsk } from '@/lib/timezone-utils'
import { useDepartmentsData, useTeamsFreshness, useCompanyCalendarEvents } from '../hooks'
import { useDepartmentsTimelineUIStore } from '../stores'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { TimelineHeader, generateDayCells, resolveTimelineRange, MonthlyHeader } from '@/modules/resource-graph/components/timeline'
import { ScissorsToggle, ScaleToggle } from '@/components/shared/timeline'
import { generateMonthCells } from '@/modules/resource-graph/utils/monthly-cell-utils'
import { buildCalendarMap } from '@/modules/resource-graph/utils'
import { MONTH_CELL_WIDTH, MONTHLY_MONTHS_BEFORE, MONTHLY_MONTHS_AFTER } from '@/modules/resource-graph/constants'
import { useIsAdmin } from '@/modules/permissions'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DAYS_BEFORE_TODAY, DAYS_AFTER_TODAY } from '../constants'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { DepartmentRowContent } from './timeline/DepartmentRow'
import { TeamRowContent } from './timeline/TeamRow'
import { EmployeeRow } from './timeline/EmployeeRow'
import { DepartmentGroupDivider } from './timeline/DepartmentGroupDivider'
import { TeamSubgroupDivider } from './timeline/TeamSubgroupDivider'
import { flattenDepartments, type DeptFlatRow } from './timeline/flatten-departments'
import { VirtualList, type VirtualColumn } from '@/modules/shared/virtualized-tree'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================================
// Internal Props (for embedding in TasksView)
// ============================================================================

interface DepartmentsTimelineInternalProps {
  /** Parsed query params from parent */
  queryParams: FilterQueryParams
  /** Whether "load all" is enabled (persisted in tabs store) */
  loadAllEnabled: boolean
  /** Called when user clicks "Загрузить всё" */
  onLoadAll: () => void
}

/**
 * DepartmentsTimelineInternal - версия без своего header/filter
 *
 * Используется в TasksView для встраивания в общую страницу с табами
 */
export function DepartmentsTimelineInternal({ queryParams, loadAllEnabled, onLoadAll }: DepartmentsTimelineInternalProps) {
  // Проверяем, применены ли фильтры
  const filtersApplied = useMemo(() => {
    return Object.keys(queryParams).length > 0
  }, [queryParams])

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

  // UI state (individual selectors to avoid full-store subscription)
  const collapseAll = useDepartmentsTimelineUIStore((s) => s.collapseAll)
  const expandAll = useDepartmentsTimelineUIStore((s) => s.expandAll)
  const customDateRange = useDepartmentsTimelineUIStore((s) => s.customDateRange)
  const setCustomDateRange = useDepartmentsTimelineUIStore((s) => s.setCustomDateRange)
  const timelineScale = useDepartmentsTimelineUIStore((s) => s.timelineScale)
  const setTimelineScale = useDepartmentsTimelineUIStore((s) => s.setTimelineScale)
  // Состояние раскрытия — для flatten (пересобирается при любом toggle, toggleNode создаёт новый объект).
  const expandedNodes = useDepartmentsTimelineUIStore((s) => s.expandedNodes)

  const isAdmin = useIsAdmin()
  const isMonthlyMode = timelineScale === 'month'

  // Load company calendar events (holidays and transfers) - cached for 24h
  const { data: calendarEvents = [] } = useCompanyCalendarEvents()

  // Timeline range and cells
  const range = useMemo(
    () => resolveTimelineRange(customDateRange, { daysBefore: DAYS_BEFORE_TODAY, daysAfter: DAYS_AFTER_TODAY }),
    [customDateRange]
  )
  const dayCells = useMemo(
    () => generateDayCells(range, calendarEvents),
    [range, calendarEvents]
  )

  // Calendar map for monthly workload filtering (skip weekends/holidays)
  const calendarMap = useMemo(
    () => buildCalendarMap(calendarEvents),
    [calendarEvents]
  )

  // Monthly cells (computed only in monthly mode)
  const monthCells = useMemo(() => {
    if (!isMonthlyMode) return []
    return generateMonthCells(
      0,
      MONTHLY_MONTHS_BEFORE,
      MONTHLY_MONTHS_AFTER,
      calendarEvents
    )
  }, [isMonthlyMode, calendarEvents])

  // Width calculations depend on scale
  const timelineWidth = isMonthlyMode
    ? monthCells.length * MONTH_CELL_WIDTH
    : dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // Index of current month for auto-scroll
  const currentMonthIndex = useMemo(
    () => monthCells.findIndex((c) => c.isCurrentMonth),
    [monthCells]
  )

  // Data fetching with external query params
  const { data: departments, isLoading, error } = useDepartmentsData(
    filtersApplied ? queryParams : {},
    { enabled: shouldFetchData }
  )

  // Group departments: «гражд» → общие → «пром».
  // Внутри каждой группы сохраняем порядок из исходных данных (алфавит с сервера).
  const groupedDepartments = useMemo(() => {
    if (!departments || departments.length === 0) {
      return { grazhd: [], general: [], prom: [] }
    }
    const grazhd: typeof departments = []
    const prom: typeof departments = []
    const general: typeof departments = []
    for (const d of departments) {
      const name = d.name.toLowerCase()
      if (name.includes('гражд')) grazhd.push(d)
      else if (name.includes('пром')) prom.push(d)
      else general.push(d)
    }
    return { grazhd, general, prom }
  }, [departments])

  // Load freshness data
  const { data: freshnessData } = useTeamsFreshness()

  // Плоский список строк для виртуализации (группы → отделы → команды → сотрудники).
  // Пересобирается при изменении данных или состояния раскрытия.
  const flatRows = useMemo<DeptFlatRow[]>(() => {
    const { grazhd, general, prom } = groupedDepartments
    return flattenDepartments(
      [
        { key: 'grazhd', label: 'Гражданское направление', items: grazhd ?? [] },
        { key: 'general', label: 'Общие отделы', items: general ?? [] },
        { key: 'prom', label: 'Промышленное направление', items: prom ?? [] },
      ],
      expandedNodes
    )
  }, [groupedDepartments, expandedNodes])

  // Рендер одной плоской строки по её типу (общие пропсы таймлайна замыкаются здесь).
  // columns — видимые колонки дня (горизонтальная виртуализация); undefined в месячном режиме.
  const renderRow = useCallback(
    (row: DeptFlatRow, _index: number, columns?: VirtualColumn[]) => {
      switch (row.kind) {
        case 'groupDivider':
          return <DepartmentGroupDivider label={row.label} width={totalWidth} />
        case 'subgroupDivider':
          return <TeamSubgroupDivider label={row.label} width={totalWidth} />
        case 'dept':
          return (
            <DepartmentRowContent
              department={row.dept}
              departmentIndex={row.index}
              dayCells={dayCells}
              columns={columns}
              freshnessData={freshnessData}
              timelineScale={timelineScale}
              monthCells={monthCells}
              monthCellWidth={MONTH_CELL_WIDTH}
              calendarMap={calendarMap}
            />
          )
        case 'team':
          return (
            <TeamRowContent
              team={row.team}
              dayCells={dayCells}
              columns={columns}
              freshnessData={freshnessData}
              timelineScale={timelineScale}
              monthCells={monthCells}
              monthCellWidth={MONTH_CELL_WIDTH}
              calendarMap={calendarMap}
            />
          )
        case 'employee':
          return (
            <EmployeeRow
              employee={row.employee}
              employeeIndex={0}
              dayCells={dayCells}
              columns={columns}
              isTeamLead={row.isTeamLead}
              timelineScale={timelineScale}
              monthCells={monthCells}
              monthCellWidth={MONTH_CELL_WIDTH}
            />
          )
        default: {
          // Exhaustiveness: при добавлении нового kind TS подсветит ошибку здесь.
          const _exhaustive: never = row
          void _exhaustive
          return null
        }
      }
    },
    [totalWidth, dayCells, freshnessData, timelineScale, monthCells, calendarMap]
  )

  // Expand all nodes in the tree (batch operation)
  const handleExpandAll = useCallback(() => {
    if (!departments) return

    const nodesByType: Partial<Record<'department' | 'team' | 'employee', string[]>> = {
      department: [],
      team: [],
      employee: [],
    }

    departments.forEach((department) => {
      nodesByType.department!.push(department.id)
      department.teams.forEach((team) => {
        nodesByType.team!.push(team.id)
        team.employees.forEach((employee) => {
          nodesByType.employee!.push(employee.id)
        })
      })
    })

    expandAll(nodesByType)
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
    if (isMonthlyMode) {
      // Scroll to current month (1 month margin left)
      const scrollLeft = Math.max(0, (currentMonthIndex - 1) * MONTH_CELL_WIDTH)
      headerScrollRef.current.scrollLeft = scrollLeft
    } else {
      const scrollLeft = Math.max(0, (todayOffsetDays - 7) * DAY_CELL_WIDTH)
      headerScrollRef.current.scrollLeft = scrollLeft
    }
  }, [shouldFetchData, todayOffsetDays, isMonthlyMode, currentMonthIndex])

  // Scroll content to today when data finishes loading
  useEffect(() => {
    if (isLoading || !contentScrollRef.current) return
    if (isMonthlyMode) {
      const scrollLeft = Math.max(0, (currentMonthIndex - 1) * MONTH_CELL_WIDTH)
      contentScrollRef.current.scrollLeft = scrollLeft
    } else {
      const scrollLeft = Math.max(0, (todayOffsetDays - 7) * DAY_CELL_WIDTH)
      contentScrollRef.current.scrollLeft = scrollLeft
    }
  }, [isLoading, todayOffsetDays, isMonthlyMode, currentMonthIndex])

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
            Используйте фильтр выше для поиска отделов и команд.
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
                  Отделы / Команды
                </span>
                <div className="flex items-center gap-1.5">
                  {isAdmin && (
                    <ScaleToggle value={timelineScale} onChange={setTimelineScale} />
                  )}
                  {!isMonthlyMode && <ScissorsToggle />}
                </div>
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
              {isMonthlyMode ? (
                <MonthlyHeader
                  monthCells={monthCells}
                  monthCellWidth={MONTH_CELL_WIDTH}
                />
              ) : (
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
              )}
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

        {/* Timeline Content (виртуализировано — bug-VT-15) */}
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
            // Горизонтальная виртуализация ячеек дня (только дневной режим; месяцы — их мало).
            columnCount={isMonthlyMode ? undefined : dayCells.length}
            columnWidth={DAY_CELL_WIDTH}
            columnScrollMargin={SIDEBAR_WIDTH}
            columnOverscan={4}
          />
        )}
      </div>
    </div>
  )
}
