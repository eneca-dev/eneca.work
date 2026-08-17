/**
 * Department Row (content) Component — одна строка отдела на таймлайне разделов.
 * Раскрытие проектов/разделов/сотрудников — через flatten + виртуализатор.
 */

'use client'

import { useMemo } from 'react'
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { useSectionsPageUIStore } from '../../stores/useSectionsPageUIStore'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DEPARTMENT_ROW_HEIGHT } from '../../constants'
import { WEEK_CELL_WIDTH } from '@/modules/resource-graph/constants'
import { AggregatedBarsOverlay } from '../AggregatedBarsOverlay'
import { WeeklyAggregatedBarsOverlay } from '../WeeklyAggregatedBarsOverlay'
import { getCellClassNames, getWeekCellClassNames } from '../../utils/cell-utils'
import type { Department, DayCell, SectionLoading } from '../../types'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

interface DepartmentRowContentProps {
  department: Department
  dayCells: DayCell[]
  /** Видимые колонки дня (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
  /** Недельные ячейки — задано только в недельном режиме */
  weekCells?: WeekCell[]
}

export function DepartmentRowContent({
  department,
  dayCells,
  columns,
  weekCells,
}: DepartmentRowContentProps) {
  const isWeeklyMode = weekCells !== undefined
  const isExpanded = useSectionsPageUIStore((s) => s.isExpanded(`department-${department.id}`))
  const toggle = useSectionsPageUIStore((s) => s.toggle)

  const handleToggle = () => {
    toggle(`department-${department.id}`)
  }

  const timelineWidth = isWeeklyMode
    ? weekCells.length * WEEK_CELL_WIDTH
    : dayCells.length * DAY_CELL_WIDTH
  const dayCols: VirtualColumn[] =
    columns ?? dayCells.map((_, idx) => ({ index: idx, start: idx * DAY_CELL_WIDTH, size: DAY_CELL_WIDTH }))
  const weekCols: VirtualColumn[] =
    columns ?? (weekCells ?? []).map((_, idx) => ({ index: idx, start: idx * WEEK_CELL_WIDTH, size: WEEK_CELL_WIDTH }))

  // X: агрегация всех загрузок из всех проектов и разделов отдела
  const allDepartmentLoadings = useMemo((): SectionLoading[] => {
    return department.projects.flatMap(p =>
      p.objectSections.flatMap(os => os.loadings)
    )
  }, [department.projects])

  // Y: суммарная ёмкость всех разделов всех проектов отдела
  const totalDepartmentCapacity = useMemo(() => {
    return department.projects.reduce((sum, p) =>
      sum + p.objectSections.reduce((s, os) => s + (os.defaultCapacity ?? 0), 0)
    , 0)
  }, [department.projects])

  // Агрегация по всем разделам всех проектов отдела (источник — серверные capacityOverrides)
  const allSections = useMemo(
    () => department.projects.flatMap((p) => p.objectSections),
    [department.projects]
  )

  // Compute per-date aggregated capacity across all sections of all projects
  const departmentDateCapacityOverrides = useMemo(() => {
    const allDates = new Set(
      allSections.flatMap((os) => Object.keys(os.capacityOverrides ?? {}))
    )
    if (allDates.size === 0) return {}
    const result: Record<string, number> = {}
    for (const dateStr of allDates) {
      result[dateStr] = allSections.reduce((sum, os) => {
        return sum + (os.capacityOverrides?.[dateStr] ?? (os.defaultCapacity ?? 0))
      }, 0)
    }
    return result
  }, [allSections])

  return (
    <div className="group/row min-w-full relative border-b border-border">
      <div
        className="flex transition-colors"
        style={{ height: DEPARTMENT_ROW_HEIGHT }}
      >
        {/* Sidebar - sticky left */}
        <div
          className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-10 cursor-pointer hover:bg-accent transition-colors"
          style={{ width: SIDEBAR_WIDTH }}
          onClick={handleToggle}
        >
          {/* Left: expand icon + department name */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <Building2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">
                {department.name}
              </div>
              {department.departmentHeadName && (
                <div className="text-xs text-muted-foreground truncate">
                  {department.departmentHeadName}
                </div>
              )}
            </div>
          </div>

          {/* Right: metrics */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
              {department.totalProjects} пр. · {department.totalSections} разд. · {department.totalEmployees} сотр.
            </div>
          </div>
        </div>

        {/* Timeline cells with department-level capacity aggregation */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {allDepartmentLoadings.length > 0 && (
            isWeeklyMode ? (
              <WeeklyAggregatedBarsOverlay
                loadings={allDepartmentLoadings}
                defaultCapacity={totalDepartmentCapacity}
                dateCapacityOverrides={departmentDateCapacityOverrides}
                weekCells={weekCells}
                weekCellWidth={WEEK_CELL_WIDTH}
                columns={columns}
                rowHeight={DEPARTMENT_ROW_HEIGHT}
                editable={false}
              />
            ) : (
              <AggregatedBarsOverlay
                loadings={allDepartmentLoadings}
                defaultCapacity={totalDepartmentCapacity}
                dateCapacityOverrides={departmentDateCapacityOverrides}
                dayCells={dayCells}
                columns={columns}
                rowHeight={DEPARTMENT_ROW_HEIGHT}
                editable={false}
              />
            )
          )}
          {!isWeeklyMode && dayCols.map((col) => {
            const cell = dayCells[col.index]
            if (!cell) return null
            return (
              <div
                key={col.index}
                className={`${getCellClassNames(cell)} absolute top-0 bottom-0`}
                style={{ left: col.start, width: col.size }}
              />
            )
          })}
          {isWeeklyMode && weekCols.map((col) => {
            const week = weekCells?.[col.index]
            if (!week) return null
            return (
              <div
                key={col.index}
                className={`${getWeekCellClassNames(week, col.index)} absolute top-0 bottom-0`}
                style={{ left: col.start, width: col.size }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
