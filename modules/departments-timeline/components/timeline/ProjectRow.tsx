/**
 * Project Row Component
 *
 * Строка проекта на таймлайне с раскрываемыми сотрудниками
 * Используется в режиме группировки "По проектам"
 */

'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, FolderKanban } from 'lucide-react'
import { formatMinskDate } from '@/lib/timezone-utils'
import { useRowExpanded } from '../../stores'
import { EmployeeRow } from './EmployeeRow'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, PROJECT_ROW_HEIGHT } from '../../constants'
import type { ProjectGroup, DayCell } from '../../types'

interface ProjectRowProps {
  project: ProjectGroup
  dayCells: DayCell[]
}

export function ProjectRow({
  project,
  dayCells,
}: ProjectRowProps) {
  const { isExpanded, toggle } = useRowExpanded('project', project.projectId)

  // Calculate project capacity (sum of employee rates)
  const totalProjectCapacity = useMemo(() => {
    return project.employees.reduce((sum, emp) => {
      return sum + (emp.employmentRate || 1)
    }, 0)
  }, [project.employees])

  // Sort employees alphabetically
  const sortedEmployees = useMemo(() => {
    return [...project.employees].sort((a, b) =>
      (a.fullName || a.name).localeCompare(b.fullName || b.name)
    )
  }, [project.employees])

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const employeesCount = project.employees.length

  return (
    <>
      {/* Project header row */}
      <div className="group/row min-w-full relative border-b border-border">
        <div
          className="flex transition-colors cursor-pointer"
          style={{ height: PROJECT_ROW_HEIGHT }}
          onClick={toggle}
        >
          {/* Sidebar - sticky left (same style as TeamRow) */}
          <div
            className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-muted sticky left-0 z-20"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {/* Left: expand icon + project info (indented like TeamRow) */}
            <div className="flex items-center gap-2 min-w-0 pl-5">
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
              </div>

              {/* Project icon */}
              <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              <div className="font-medium text-sm truncate min-w-0">
                {project.projectName}
              </div>
            </div>

            {/* Right: employees count */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {employeesCount} чел.
              </span>
            </div>
          </div>

          {/* Timeline cells */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            {dayCells.map((cell, i) => {
              const isWeekend = cell.isWeekend && !cell.isWorkday
              const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff

              // Get workload for this day
              const dateKey = formatMinskDate(cell.date)
              const projectWorkload = project.dailyWorkloads?.[dateKey] || 0

              // Calculate load percentage
              const loadPercentage =
                !isWeekend && !isSpecialDayOff && totalProjectCapacity > 0
                  ? Math.round((projectWorkload / totalProjectCapacity) * 100)
                  : 0

              return (
                <div
                  key={i}
                  className={cn(
                    'border-r border-border/50 relative',
                    cell.isToday && 'bg-primary/10',
                    !cell.isToday && isSpecialDayOff && 'bg-amber-50 dark:bg-amber-950/30',
                    !cell.isToday && isWeekend && 'bg-muted/50',
                  )}
                  style={{
                    width: DAY_CELL_WIDTH,
                    height: PROJECT_ROW_HEIGHT,
                  }}
                >
                  {/* Workload bar (same style as TeamRow) */}
                  {loadPercentage > 0 && (
                    <div
                      className="absolute bottom-1 left-1 right-1 flex items-end justify-center"
                      title={`Загрузка проекта: ${loadPercentage}%`}
                    >
                      <div
                        className={cn(
                          'w-full rounded-sm border',
                          loadPercentage > 100
                            ? 'border-red-500'
                            : loadPercentage >= 90
                              ? 'border-primary'
                              : 'border-amber-500'
                        )}
                        style={{ height: PROJECT_ROW_HEIGHT - 10 }}
                      >
                        <div
                          className={cn(
                            'absolute bottom-0 left-0 right-0 rounded-sm',
                            loadPercentage > 100
                              ? 'bg-red-500'
                              : loadPercentage >= 90
                                ? 'bg-primary'
                                : 'bg-amber-500'
                          )}
                          style={{
                            height: `${Math.min(loadPercentage, 100)}%`,
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Employees (expanded) */}
      {isExpanded && (
        <>
          {sortedEmployees.map((employee, index) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              employeeIndex={index}
              dayCells={dayCells}
              isTeamLead={false}
            />
          ))}
        </>
      )}
    </>
  )
}
