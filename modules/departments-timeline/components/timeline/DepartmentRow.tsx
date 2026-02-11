/**
 * Department Row Component — строка отдела на таймлайне
 *
 * Collapsible: в свёрнутом виде агрегация X/Y, в развёрнутом — проекты.
 * Отдел → Проект → Объект/Раздел → Сотрудники
 */

'use client'

import { useMemo } from 'react'
import { Building2, ChevronDown, ChevronRight } from 'lucide-react'
import { useRowExpanded, useDepartmentsTimelineUIStore } from '../../stores'
import { formatMinskDate } from '@/lib/timezone-utils'
import { getCellClassNames } from '../../utils'
import { DeptProjectRow, AggregatedBarsOverlay } from '../hierarchy'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DEPARTMENT_ROW_HEIGHT } from '../../constants'
import type { DeptHierarchyDepartment } from '../../types/hierarchy'
import type { DeptEmployeeLeaf } from '../../types/hierarchy'
import type { DayCell } from '../../types'

interface DepartmentRowProps {
  department: DeptHierarchyDepartment
  dayCells: DayCell[]
}

export function DepartmentRow({
  department,
  dayCells,
}: DepartmentRowProps) {
  const { isExpanded, toggle } = useRowExpanded('department', department.id)
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  // Collect all employees from all projects
  const allEmployees = useMemo(() => {
    const result: DeptEmployeeLeaf[] = []
    for (const proj of department.projects) {
      for (const os of proj.objectSections) {
        result.push(...os.employees)
      }
    }
    return result
  }, [department.projects])

  // Default capacity: sum of all children defaults
  const defaultCapacity = useMemo(() => {
    let total = 0
    for (const proj of department.projects) {
      for (const os of proj.objectSections) {
        total += os.capacity
      }
    }
    return total
  }, [department.projects])

  // Per-date aggregated overrides from all children
  const allOverrides = useDepartmentsTimelineUIStore((s) => s.capacityOverrides)
  const dateCapacityOverrides = useMemo(() => {
    const result: Record<string, number> = {}
    for (const cell of dayCells) {
      const dateStr = formatMinskDate(cell.date)
      let hasOverride = false
      let total = 0
      for (const proj of department.projects) {
        for (const os of proj.objectSections) {
          const osOverrides = allOverrides[os.id]
          if (osOverrides && dateStr in osOverrides) {
            hasOverride = true
            total += osOverrides[dateStr]
          } else {
            total += os.capacity
          }
        }
      }
      if (hasOverride) {
        result[dateStr] = total
      }
    }
    return result
  }, [department.projects, allOverrides, dayCells])

  return (
    <>
      {/* Department header row */}
      <div className="group/row min-w-full relative border-b border-border">
        <div
          className="flex transition-colors cursor-pointer hover:bg-muted/20"
          style={{ height: DEPARTMENT_ROW_HEIGHT }}
          onClick={toggle}
        >
          {/* Sidebar - sticky left */}
          <div
            className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {/* Left: expand icon + department name */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
              </div>
              <Building2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span className="font-semibold text-sm truncate">
                {department.name}
              </span>
            </div>

            {/* Right: aggregated metrics */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                {department.employeeCount} сотруд
              </span>
            </div>
          </div>

          {/* Timeline cells + aggregated bars (only when collapsed) */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            {!isExpanded && (
              <AggregatedBarsOverlay
                employees={allEmployees}
                defaultCapacity={defaultCapacity}
                dateCapacityOverrides={dateCapacityOverrides}
                dayCells={dayCells}
                rowHeight={DEPARTMENT_ROW_HEIGHT}
              />
            )}
            {dayCells.map((cell, i) => (
              <div
                key={i}
                className={getCellClassNames(cell)}
                style={{
                  width: DAY_CELL_WIDTH,
                  height: DEPARTMENT_ROW_HEIGHT,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Projects (expanded) */}
      {isExpanded && (
        <>
          {department.projects.map((project) => (
            <DeptProjectRow
              key={project.id}
              project={project}
              dayCells={dayCells}
            />
          ))}
        </>
      )}
    </>
  )
}
