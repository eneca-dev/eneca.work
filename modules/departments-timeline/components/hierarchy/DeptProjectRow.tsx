/**
 * DeptProjectRow — строка проекта (2-й уровень иерархии)
 *
 * Collapsible: в свёрнутом виде показывает агрегацию X/Y,
 * в развёрнутом — список Объект/Раздел.
 */

'use client'

import { useMemo } from 'react'
import { FolderKanban, ChevronDown, ChevronRight } from 'lucide-react'
import { useRowExpanded, useDepartmentsTimelineUIStore } from '../../stores'
import { formatMinskDate } from '@/lib/timezone-utils'
import { getCellClassNames } from '../../utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'
import { AggregatedBarsOverlay } from './AggregatedBarsOverlay'
import { DeptObjectSectionRow } from './DeptObjectSectionRow'
import type { DeptHierarchyProject } from '../../types/hierarchy'
import type { DeptEmployeeLeaf } from '../../types/hierarchy'
import type { DayCell } from '../../types'

const PROJECT_ROW_HEIGHT = 44

interface DeptProjectRowProps {
  project: DeptHierarchyProject
  dayCells: DayCell[]
}

export function DeptProjectRow({ project, dayCells }: DeptProjectRowProps) {
  const { isExpanded, toggle } = useRowExpanded('project', project.id)
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  // Collect all employees from children
  const allEmployees = useMemo(() => {
    const result: DeptEmployeeLeaf[] = []
    for (const os of project.objectSections) {
      result.push(...os.employees)
    }
    return result
  }, [project.objectSections])

  // Default capacity: sum of children defaults
  const defaultCapacity = useMemo(() =>
    project.objectSections.reduce((sum, os) => sum + os.capacity, 0),
    [project.objectSections]
  )

  // Per-date aggregated overrides: for each date, sum children's effective capacity
  const allOverrides = useDepartmentsTimelineUIStore((s) => s.capacityOverrides)
  const dateCapacityOverrides = useMemo(() => {
    const result: Record<string, number> = {}
    for (const cell of dayCells) {
      const dateStr = formatMinskDate(cell.date)
      let hasOverride = false
      let total = 0
      for (const os of project.objectSections) {
        const osOverrides = allOverrides[os.id]
        if (osOverrides && dateStr in osOverrides) {
          hasOverride = true
          total += osOverrides[dateStr]
        } else {
          total += os.capacity
        }
      }
      if (hasOverride) {
        result[dateStr] = total
      }
    }
    return result
  }, [project.objectSections, allOverrides, dayCells])

  return (
    <>
      {/* Project header row */}
      <div className="group/row min-w-full relative border-b border-border">
        <div
          className="flex transition-colors cursor-pointer hover:bg-muted/20"
          style={{ height: PROJECT_ROW_HEIGHT }}
          onClick={toggle}
        >
          {/* Sidebar */}
          <div
            className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <div className="flex items-center gap-2 min-w-0 pl-5">
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <FolderKanban className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                {project.name}
              </span>
            </div>

            {/* Aggregated metrics */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                {project.employeeCount} сотруд
              </span>
            </div>
          </div>

          {/* Timeline cells + aggregated overlay (only when collapsed) */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            {!isExpanded && (
              <AggregatedBarsOverlay
                employees={allEmployees}
                defaultCapacity={defaultCapacity}
                dateCapacityOverrides={dateCapacityOverrides}
                dayCells={dayCells}
                rowHeight={PROJECT_ROW_HEIGHT}
              />
            )}
            {dayCells.map((cell, i) => (
              <div
                key={i}
                className={getCellClassNames(cell)}
                style={{ width: DAY_CELL_WIDTH, height: PROJECT_ROW_HEIGHT }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Object/Sections (expanded) */}
      {isExpanded && (
        <>
          {project.objectSections.map((os) => (
            <DeptObjectSectionRow
              key={os.id}
              objectSection={os}
              dayCells={dayCells}
              projectName={project.name}
            />
          ))}
        </>
      )}
    </>
  )
}
