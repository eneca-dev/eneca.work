/**
 * Departments Timeline - Main Component
 *
 * Главный компонент модуля таймлайна отделов
 * Использует тот же timeline что и resource-graph
 */

'use client'

import { useMemo, useCallback, useRef } from 'react'
import { ChevronsUpDown, ChevronsDownUp } from 'lucide-react'
import { addDays } from 'date-fns'
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
import { TimelineHeader, generateDayCells } from '@/modules/resource-graph/components/timeline'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DAYS_BEFORE_TODAY, DAYS_AFTER_TODAY, TOTAL_DAYS } from '../constants'
import type { TimelineRange } from '../types'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { DepartmentRow } from './timeline/DepartmentRow'
import { Skeleton } from '@/components/ui/skeleton'

function calculateTimelineRange(): TimelineRange {
  const today = getTodayMinsk()
  const start = addDays(today, -DAYS_BEFORE_TODAY)
  const end = addDays(today, DAYS_AFTER_TODAY - 1)
  return { start, end, totalDays: TOTAL_DAYS }
}

// ============================================================================
// Internal Props (for embedding in TasksView)
// ============================================================================

interface DepartmentsTimelineInternalProps {
  /** Parsed query params from parent */
  queryParams: FilterQueryParams
}

/**
 * DepartmentsTimelineInternal - версия без своего header/filter
 *
 * Используется в TasksView для встраивания в общую страницу с табами
 */
export function DepartmentsTimelineInternal({ queryParams }: DepartmentsTimelineInternalProps) {
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

  // Timeline range and cells
  const range = useMemo(() => calculateTimelineRange(), [])
  const dayCells = useMemo(
    () => generateDayCells(range, calendarEvents),
    [range, calendarEvents]
  )
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // UI state
  const { collapseAll, expandAll } = useDepartmentsTimelineUIStore()

  // Data fetching with external query params
  const { data: departments, isLoading, error } = useDepartmentsData(queryParams)

  // Load freshness data
  const { data: freshnessData } = useTeamsFreshness()

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
                  freshnessData={freshnessData}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
