/**
 * Department Row Component
 *
 * Строка отдела на таймлайне разделов
 */

'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { useSectionsPageUIStore } from '../../stores/useSectionsPageUIStore'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DEPARTMENT_ROW_HEIGHT } from '../../constants'
import { ProjectRow } from './ProjectRow'
import type { Department, DayCell } from '../../types'

interface DepartmentRowProps {
  department: Department
  departmentIndex: number
  dayCells: DayCell[]
}

export function DepartmentRow({
  department,
  departmentIndex,
  dayCells,
}: DepartmentRowProps) {
  const isExpanded = useSectionsPageUIStore((s) => s.isExpanded(`department-${department.id}`))
  const toggle = useSectionsPageUIStore((s) => s.toggle)

  const handleToggle = () => {
    toggle(`department-${department.id}`)
  }

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  return (
    <>
      {/* Department header row */}
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
                {department.totalProjects} пр. · {department.totalSections} разд. · {department.totalLoadings} загр.
              </div>
            </div>
          </div>

          {/* Timeline cells - empty for department level */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            {dayCells.map((cell, i) => {
              const isWeekend = cell.isWeekend && !cell.isWorkday
              const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff

              return (
                <div
                  key={`${department.id}-${cell.dateKey}-${i}`}
                  className={cn(
                    'border-r border-border/30',
                    isWeekend && 'bg-muted/20',
                    isSpecialDayOff && 'bg-red-50/30 dark:bg-red-950/10'
                  )}
                  style={{ width: DAY_CELL_WIDTH, height: DEPARTMENT_ROW_HEIGHT }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Projects (when expanded) */}
      {isExpanded &&
        department.projects.map((project, projectIndex) => (
          <ProjectRow
            key={project.id}
            project={project}
            projectIndex={projectIndex}
            departmentId={department.id}
            dayCells={dayCells}
          />
        ))}
    </>
  )
}
