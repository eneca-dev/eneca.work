/**
 * Team Row Component
 *
 * Строка команды на таймлайне с раскрываемыми сотрудниками
 */

'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import { formatMinskDate } from '@/lib/timezone-utils'
import { useRowExpanded } from '../../stores'
import { FreshnessIndicator } from '@/components/shared/timeline'
import { EmployeeRow } from './EmployeeRow'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, TEAM_ROW_HEIGHT } from '../../constants'
import type { Team, TeamFreshness, DayCell } from '../../types'

interface TeamRowProps {
  team: Team
  dayCells: DayCell[]
  freshnessData?: Record<string, TeamFreshness>
  onConfirmActivity: (teamId: string) => Promise<{ success: boolean; error?: string }>
}

export function TeamRow({
  team,
  dayCells,
  freshnessData,
  onConfirmActivity,
}: TeamRowProps) {
  const { isExpanded, toggle } = useRowExpanded('team', team.id)

  // Get freshness for this team
  const teamFreshness = freshnessData?.[team.id]

  // Calculate team capacity
  const totalTeamCapacity = useMemo(() => {
    return team.employees.reduce((sum, emp) => {
      return sum + (emp.employmentRate || 1)
    }, 0)
  }, [team.employees])

  // Sort employees: team lead first, then alphabetically
  const sortedEmployees = useMemo(() => {
    const employees = [...team.employees]
    const leadIndex = team.teamLeadId
      ? employees.findIndex((e) => e.id === team.teamLeadId)
      : -1
    if (leadIndex > 0) {
      const [lead] = employees.splice(leadIndex, 1)
      employees.unshift(lead)
    }
    return employees
  }, [team.employees, team.teamLeadId])

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  return (
    <>
      {/* Team header row */}
      <div className="group/row min-w-full relative border-b border-border">
        <div
          className="flex transition-colors cursor-pointer"
          style={{ height: TEAM_ROW_HEIGHT }}
          onClick={toggle}
        >
          {/* Sidebar - sticky left */}
          <div
            className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-muted sticky left-0 z-20 hover:bg-accent transition-colors"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {/* Left: expand icon + team name (indented) */}
            <div className="flex items-center gap-2 min-w-0 pl-5">
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
              </div>
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">
                  {team.name}
                </div>
                {team.teamLeadName && (
                  <div className="text-[10px] text-muted-foreground truncate">
                    Лид: {team.teamLeadName}
                  </div>
                )}
              </div>
            </div>

            {/* Right: freshness indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <FreshnessIndicator
                teamId={team.id}
                teamName={team.name}
                daysSinceUpdate={teamFreshness?.daysSinceUpdate}
                lastUpdate={teamFreshness?.lastUpdate ? new Date(teamFreshness.lastUpdate) : null}
                theme="light"
                size="sm"
                onConfirm={onConfirmActivity}
              />
            </div>
          </div>

          {/* Timeline cells */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            {dayCells.map((cell, i) => {
              const isWeekend = cell.isWeekend && !cell.isWorkday
              const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff

              // Get workload for this day
              const dateKey = formatMinskDate(cell.date)
              const teamWorkload = team.dailyWorkloads?.[dateKey] || 0

              // Calculate load percentage
              const loadPercentage =
                !isWeekend && !isSpecialDayOff && totalTeamCapacity > 0
                  ? Math.round((teamWorkload / totalTeamCapacity) * 100)
                  : 0

              return (
                <div
                  key={i}
                  className={cn(
                    'border-r border-border/50 relative',
                    !cell.isToday && isSpecialDayOff && 'bg-amber-50 dark:bg-amber-950/30',
                    !cell.isToday && isWeekend && 'bg-muted/50',
                    // Сегодня - применяется последним, но за загрузками
                    cell.isToday && 'bg-green-50/50 dark:bg-green-700/25',
                  )}
                  style={{
                    width: DAY_CELL_WIDTH,
                    height: TEAM_ROW_HEIGHT,
                  }}
                >
                  {/* Workload bar */}
                  {loadPercentage > 0 && (
                    <div
                      className="absolute bottom-1 left-1 right-1 flex items-end justify-center"
                      title={`Загрузка команды: ${loadPercentage}%`}
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
                        style={{ height: TEAM_ROW_HEIGHT - 10 }}
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
              isTeamLead={employee.id === team.teamLeadId}
            />
          ))}
        </>
      )}
    </>
  )
}
