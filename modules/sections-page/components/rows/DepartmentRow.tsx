/**
 * Department Row (content) Component — одна строка отдела на таймлайне разделов.
 * Раскрытие проектов/разделов/сотрудников — через flatten + виртуализатор.
 */

'use client'

import { useMemo } from 'react'
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { useSectionsPageUIStore, useMultipleSectionsCapacityOverrides } from '../../stores/useSectionsPageUIStore'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DEPARTMENT_ROW_HEIGHT } from '../../constants'
import { AggregatedBarsOverlay } from '../AggregatedBarsOverlay'
import { getCellClassNames } from '../../utils/cell-utils'
import type { Department, DayCell, SectionLoading } from '../../types'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

interface DepartmentRowContentProps {
  department: Department
  dayCells: DayCell[]
  /** Видимые колонки дня (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
}

export function DepartmentRowContent({
  department,
  dayCells,
  columns,
}: DepartmentRowContentProps) {
  const isExpanded = useSectionsPageUIStore((s) => s.isExpanded(`department-${department.id}`))
  const toggle = useSectionsPageUIStore((s) => s.toggle)

  const handleToggle = () => {
    toggle(`department-${department.id}`)
  }

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const dayCols: VirtualColumn[] =
    columns ?? dayCells.map((_, idx) => ({ index: idx, start: idx * DAY_CELL_WIDTH, size: DAY_CELL_WIDTH }))

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

  // rerender-derived-state: подписка только на overrides релевантных разделов (useShallow)
  const allSections = useMemo(
    () => department.projects.flatMap((p) => p.objectSections),
    [department.projects]
  )
  const sectionIds = useMemo(() => allSections.map((os) => os.sectionId), [allSections])
  const capacityOverrides = useMultipleSectionsCapacityOverrides(sectionIds)

  // Compute per-date aggregated capacity across all sections of all projects
  const departmentDateCapacityOverrides = useMemo(() => {
    const allDates = new Set(
      allSections.flatMap((os) => Object.keys(capacityOverrides[os.sectionId] ?? {}))
    )
    if (allDates.size === 0) return {}
    const result: Record<string, number> = {}
    for (const dateStr of allDates) {
      result[dateStr] = allSections.reduce((sum, os) => {
        return sum + (capacityOverrides[os.sectionId]?.[dateStr] ?? (os.defaultCapacity ?? 0))
      }, 0)
    }
    return result
  }, [allSections, capacityOverrides])

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
            <AggregatedBarsOverlay
              loadings={allDepartmentLoadings}
              defaultCapacity={totalDepartmentCapacity}
              dateCapacityOverrides={departmentDateCapacityOverrides}
              dayCells={dayCells}
              columns={columns}
              rowHeight={DEPARTMENT_ROW_HEIGHT}
              editable={false}
            />
          )}
          {dayCols.map((col) => {
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
        </div>
      </div>
    </div>
  )
}
