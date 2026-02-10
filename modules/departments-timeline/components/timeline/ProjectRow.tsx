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
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatMinskDate } from '@/lib/timezone-utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useRowExpanded } from '../../stores'
import { EmployeeRow } from './EmployeeRow'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, PROJECT_ROW_HEIGHT } from '../../constants'
import type { ProjectGroup, DayCell, TeamFreshness } from '../../types'

interface ProjectRowProps {
  project: ProjectGroup
  dayCells: DayCell[]
  freshnessData?: Record<string, TeamFreshness>
}

export function ProjectRow({
  project,
  dayCells,
  freshnessData,
}: ProjectRowProps) {
  const { isExpanded, toggle } = useRowExpanded('project', project.projectId)

  // Calculate project freshness from team freshness data
  const projectFreshness = useMemo(() => {
    if (!project.employees.length || !freshnessData) return undefined

    // Get unique teamIds from project employees
    const uniqueTeamIds = Array.from(new Set(
      project.employees
        .map(emp => emp.teamId)
        .filter((id): id is string => Boolean(id))
    ))

    if (uniqueTeamIds.length === 0) return undefined

    // Get freshness for all teams
    const teamFreshnessValues = uniqueTeamIds
      .map(teamId => freshnessData[teamId])
      .filter((f): f is TeamFreshness =>
        f !== undefined && f.daysSinceUpdate !== undefined
      )

    if (teamFreshnessValues.length === 0) return undefined

    // Return min daysSinceUpdate (freshest team = most recent activity)
    const freshestTeam = teamFreshnessValues.reduce((min, current) =>
      (current.daysSinceUpdate ?? 0) < (min.daysSinceUpdate ?? 0)
        ? current
        : min
    )

    return {
      daysSinceUpdate: freshestTeam.daysSinceUpdate,
      lastUpdate: freshestTeam.lastUpdate ? new Date(freshestTeam.lastUpdate) : null,
    }
  }, [project.employees, freshnessData])

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

  // Helper: склонение "день/дня/дней"
  const getDaysText = (days: number) => {
    if (days === 1) return 'день'
    if (days >= 2 && days <= 4) return 'дня'
    return 'дней'
  }

  // Helper: склонение "загрузка/загрузки/загрузок"
  const getLoadingText = (count: number) => {
    const roundedCount = Math.round(count)
    if (roundedCount === 1) return 'загрузка'
    if (roundedCount >= 2 && roundedCount <= 4) return 'загрузки'
    return 'загрузок'
  }

  // Helper: определение цвета точки (как в FreshnessIndicator)
  const getFreshnessColor = (daysSinceUpdate?: number) => {
    if (daysSinceUpdate === undefined) return 'bg-slate-400'
    if (daysSinceUpdate < 3) return 'bg-emerald-500'  // 0-2 дня
    if (daysSinceUpdate <= 5) return 'bg-amber-500'   // 3-5 дней
    return 'bg-red-500'                                // 6+ дней
  }

  // Helper: текст tooltip (как в FreshnessIndicator)
  const getFreshnessTooltip = () => {
    if (!projectFreshness || projectFreshness.daysSinceUpdate === undefined || !projectFreshness.lastUpdate) {
      return 'Нет данных об обновлениях'
    }

    const { daysSinceUpdate, lastUpdate } = projectFreshness

    // Если давно не обновлялось
    if (daysSinceUpdate > 200) {
      return 'Не обновлялось'
    }

    // Статусная строка
    const statusLine = daysSinceUpdate === 0
      ? 'Обновлено сегодня'
      : `Обновлено ${daysSinceUpdate} ${getDaysText(daysSinceUpdate)} назад`

    // Строка с датой
    const dateLine = `Дата: ${format(lastUpdate, 'dd.MM.yyyy, HH:mm', { locale: ru })}`

    return `${statusLine}\n${dateLine}`
  }

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

            {/* Right: freshness indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {projectFreshness && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0 cursor-default',
                          getFreshnessColor(projectFreshness.daysSinceUpdate)
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={12}
                      collisionPadding={16}
                      className="max-w-xs px-2 py-1.5 whitespace-pre-line text-xs border-2 z-[999999] bg-popover text-popover-foreground border-border"
                    >
                      {getFreshnessTooltip()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
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
                      title={`${projectWorkload} ${getLoadingText(projectWorkload)}`}
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
