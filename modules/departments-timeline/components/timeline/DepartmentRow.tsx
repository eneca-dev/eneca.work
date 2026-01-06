/**
 * Department Row Component
 *
 * Строка отдела на таймлайне с раскрываемыми командами
 */

'use client'

import { Fragment, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { formatMinskDate } from '@/lib/timezone-utils'
import { useDepartmentsTimelineUIStore, useRowExpanded } from '../../stores'
import { useConfirmTeamActivity, useConfirmMultipleTeamsActivity } from '../../hooks'
import { FreshnessIndicator } from '@/modules/planning/components/timeline/FreshnessIndicator'
import { TeamRow } from './TeamRow'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, DEPARTMENT_ROW_HEIGHT } from '../../constants'
import type { Department, TeamFreshness, DayCell } from '../../types'

interface DepartmentRowProps {
  department: Department
  departmentIndex: number
  dayCells: DayCell[]
  freshnessData?: Record<string, TeamFreshness>
}

export function DepartmentRow({
  department,
  departmentIndex,
  dayCells,
  freshnessData,
}: DepartmentRowProps) {
  const { isExpanded, toggle } = useRowExpanded('department', department.id)

  // Mutations for freshness
  const confirmActivityMutation = useConfirmTeamActivity()
  const confirmMultipleActivityMutation = useConfirmMultipleTeamsActivity()

  // Callbacks for freshness confirmation
  const handleConfirmActivity = async (teamId: string) => {
    try {
      await confirmActivityMutation.mutateAsync(teamId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  const handleConfirmMultipleActivity = async (teamIds: string[]) => {
    try {
      await confirmMultipleActivityMutation.mutateAsync(teamIds)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  // Calculate department freshness (max days since update across all teams)
  const departmentFreshness = useMemo(() => {
    if (!department.teams || department.teams.length === 0 || !freshnessData) {
      return undefined
    }

    const teamFreshness = department.teams
      .map((team) => freshnessData[team.id])
      .filter((f): f is TeamFreshness => f !== undefined && f.daysSinceUpdate !== undefined)

    if (teamFreshness.length === 0) return undefined

    const oldestTeam = teamFreshness.reduce((max, current) =>
      (current.daysSinceUpdate ?? 0) > (max.daysSinceUpdate ?? 0) ? current : max
    )

    return {
      daysSinceUpdate: oldestTeam.daysSinceUpdate,
      lastUpdate: oldestTeam.lastUpdate ? new Date(oldestTeam.lastUpdate) : null,
    }
  }, [department.teams, freshnessData])

  // Calculate total department capacity (sum of employment rates)
  const totalDepartmentCapacity = useMemo(() => {
    return department.teams.reduce((sum, team) => {
      return sum + team.employees.reduce((teamSum, emp) => {
        return teamSum + (emp.employmentRate || 1)
      }, 0)
    }, 0)
  }, [department.teams])

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  return (
    <>
      {/* Department header row */}
      <div className="group/row min-w-full relative border-b border-border">
        <div
          className="flex transition-colors cursor-pointer hover:bg-muted/50"
          style={{ height: DEPARTMENT_ROW_HEIGHT }}
          onClick={toggle}
        >
          {/* Sidebar - sticky left */}
          <div
            className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20 group-hover/row:bg-accent"
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
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">
                  {department.name}
                </div>
                {department.departmentHeadName && (
                  <div className="text-xs text-muted-foreground truncate">
                    Руководитель: {department.departmentHeadName}
                  </div>
                )}
              </div>
            </div>

            {/* Right: freshness indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {departmentFreshness && (
                <FreshnessIndicator
                  teamId={department.teams[0]?.id || department.id}
                  teamName={department.name}
                  daysSinceUpdate={departmentFreshness.daysSinceUpdate}
                  lastUpdate={departmentFreshness.lastUpdate}
                  theme="light"
                  size="sm"
                  onConfirm={handleConfirmActivity}
                  teamIds={department.teams.map((t) => t.id)}
                  onConfirmMultiple={handleConfirmMultipleActivity}
                  tooltipSide={departmentIndex === 0 ? 'left' : 'top'}
                />
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
              const departmentWorkload = department.dailyWorkloads?.[dateKey] || 0

              // Calculate load percentage
              const loadPercentage =
                !isWeekend && !isSpecialDayOff && totalDepartmentCapacity > 0
                  ? Math.round((departmentWorkload / totalDepartmentCapacity) * 100)
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
                    height: DEPARTMENT_ROW_HEIGHT,
                  }}
                >
                  {/* Workload bar */}
                  {loadPercentage > 0 && (
                    <div
                      className="absolute bottom-1 left-1 right-1 flex items-end justify-center"
                      title={`Загрузка: ${loadPercentage}%`}
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
                        style={{ height: DEPARTMENT_ROW_HEIGHT - 12 }}
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

      {/* Teams (expanded) */}
      {isExpanded && (
        <>
          {department.teams.map((team) => (
            <TeamRow
              key={team.id}
              team={team}
              dayCells={dayCells}
              freshnessData={freshnessData}
              onConfirmActivity={handleConfirmActivity}
            />
          ))}
        </>
      )}
    </>
  )
}
