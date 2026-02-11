/**
 * Departments Timeline - Main Component
 *
 * Отдел → Проект → Объект/Раздел → Сотрудники
 * Безличные загрузки убраны.
 */

'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { ChevronsUpDown, ChevronsDownUp, Plus } from 'lucide-react'
import { addDays } from 'date-fns'
import { getTodayMinsk } from '@/lib/timezone-utils'
import { useCompanyCalendarEvents } from '../hooks'
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
import { CreateDeptLoadingModal } from './hierarchy'
import { DeptTimelineProvider } from '../context'

// Mock data for prototype
import { MOCK_DEPARTMENTS } from '../mock/data'

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
 * DepartmentsTimelineInternal — прототип с моковыми данными
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null)

  const handleCreateLoading = useCallback((sectionId: string) => {
    setTargetSectionId(sectionId)
    setIsCreateModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsCreateModalOpen(false)
    setTargetSectionId(null)
  }, [])

  const timelineContextValue = useMemo(() => ({
    onCreateLoading: handleCreateLoading,
  }), [handleCreateLoading])

  // Use mock data directly
  const departments = MOCK_DEPARTMENTS

  // Expand all nodes in the tree (batch operation)
  const handleExpandAll = useCallback(() => {
    const nodesByType: Partial<Record<'department' | 'project' | 'object' | 'section' | 'employee', string[]>> = {
      department: [],
      project: [],
      object: [],
    }

    departments.forEach((dept) => {
      nodesByType.department!.push(dept.id)
      dept.projects.forEach((proj) => {
        nodesByType.project!.push(proj.id)
        proj.objectSections.forEach((os) => {
          nodesByType.object!.push(os.id)
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
    <DeptTimelineProvider value={timelineContextValue}>
    <div className="h-full flex flex-col bg-background">
      {/* Timeline Header - Dates row (sticky) */}
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
                Отделы / Проекты
              </span>
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => { setTargetSectionId(null); setIsCreateModalOpen(true) }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Создать загрузку</TooltipContent>
                  </Tooltip>
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
            <TimelineHeader dayCells={dayCells} cellWidth={DAY_CELL_WIDTH} />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Timeline Content */}
        <div
          ref={contentScrollRef}
          onScroll={handleContentScroll}
          className="overflow-auto h-full"
        >
          <div style={{ minWidth: totalWidth }}>
            {departments.map((department) => (
              <DepartmentRow
                key={department.id}
                department={department}
                dayCells={dayCells}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Create loading modal (prototype) */}
      <CreateDeptLoadingModal
        open={isCreateModalOpen}
        onClose={handleCloseModal}
        initialSectionId={targetSectionId}
      />
    </div>
    </DeptTimelineProvider>
  )
}
