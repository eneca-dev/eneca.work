/**
 * Team Row (content) Component
 *
 * Рендерит ОДНУ строку команды на таймлайне (sidebar + ячейки).
 * Сотрудники раскрываются через flatten + виртуализатор (см. flatten-departments.ts),
 * а не вложенным рендером. Подтверждение свежести — через собственную мутацию.
 */

'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Users, ArrowLeftRight } from 'lucide-react'
import { formatMinskDate } from '@/lib/timezone-utils'
import { useRowExpanded } from '../../stores'
import { useConfirmTeamActivity } from '../../hooks'
import { FreshnessIndicator } from '@/components/shared/timeline'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, TEAM_ROW_HEIGHT } from '../../constants'
import type { Team, TeamFreshness, DayCell } from '../../types'
import type { DayInfo } from '@/modules/resource-graph/types'
import { aggregateMonthlyWorkload, type MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'
import type { TimelineScaleMode } from '@/components/shared/timeline'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

interface TeamRowContentProps {
  team: Team
  dayCells: DayCell[]
  /** Видимые колонки дня (горизонтальная виртуализация). undefined → рендерим все. */
  columns?: VirtualColumn[]
  freshnessData?: Record<string, TeamFreshness>
  timelineScale: TimelineScaleMode
  monthCells: MonthCell[]
  monthCellWidth: number
  calendarMap?: Map<string, Partial<DayInfo>>
}

export function TeamRowContent({
  team,
  dayCells,
  columns,
  freshnessData,
  timelineScale,
  monthCells,
  monthCellWidth,
  calendarMap,
}: TeamRowContentProps) {
  const isMonthlyMode = timelineScale === 'month'
  const { isExpanded, toggle } = useRowExpanded('team', team.id)

  // Подтверждение свежести команды (раньше колбэк прокидывался из DepartmentRow;
  // во flat-модели у каждой строки своя мутация — React Query дедупит).
  const confirmActivityMutation = useConfirmTeamActivity()
  const handleConfirmActivity = async (teamId: string) => {
    try {
      await confirmActivityMutation.mutateAsync(teamId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  // Get freshness for this team
  const teamFreshness = freshnessData?.[team.id]

  // Calculate team capacity
  const totalTeamCapacity = useMemo(() => {
    return team.employees.reduce((sum, emp) => {
      return sum + (emp.employmentRate || 1)
    }, 0)
  }, [team.employees])

  const formatWorkload = (value: number) =>
    parseFloat(value.toFixed(2)).toString()

  const timelineWidth = isMonthlyMode
    ? monthCells.length * monthCellWidth
    : dayCells.length * DAY_CELL_WIDTH

  // Видимые колонки дня (окно горизонтальной виртуализации); fallback — все дни.
  const dayCols: VirtualColumn[] = !isMonthlyMode
    ? columns ?? dayCells.map((_, idx) => ({ index: idx, start: idx * DAY_CELL_WIDTH, size: DAY_CELL_WIDTH }))
    : []

  return (
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
            {team.isGuestTeam ? (
              <ArrowLeftRight className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
            ) : (
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className={cn(
                'font-medium text-sm truncate',
                team.isGuestTeam && 'text-amber-700 dark:text-amber-400'
              )}>
                {team.name}
              </div>
              {team.isGuestTeam ? (
                <div className="text-[10px] text-muted-foreground truncate">
                  Из других отделов · доступ через грант
                </div>
              ) : team.teamLeadName && (
                <div className="text-[10px] text-muted-foreground truncate">
                  Лид: {team.teamLeadName}
                </div>
              )}
            </div>
          </div>

          {/* Right: capacity + freshness indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {totalTeamCapacity > 0 && (
              <span
                className="text-xs font-medium text-muted-foreground tabular-nums"
                title="Сумма ставок сотрудников команды"
              >
                {formatWorkload(totalTeamCapacity)}
              </span>
            )}
            {!team.isGuestTeam && (
              <FreshnessIndicator
                teamId={team.id}
                teamName={team.name}
                daysSinceUpdate={teamFreshness?.daysSinceUpdate}
                lastUpdate={teamFreshness?.lastUpdate ? new Date(teamFreshness.lastUpdate) : null}
                theme="light"
                size="sm"
                onConfirm={handleConfirmActivity}
              />
            )}
          </div>
        </div>

        {/* Timeline cells */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {isMonthlyMode ? (
            monthCells.map((cell, i) => {
              const monthWorkload = aggregateMonthlyWorkload(team.dailyWorkloads, cell, calendarMap)
              const loadPercentage = totalTeamCapacity > 0
                ? Math.round((monthWorkload / totalTeamCapacity) * 100)
                : 0

              return (
                <div
                  key={`${cell.year}-${cell.month}`}
                  className={cn(
                    'border-r border-border/30 relative',
                    i % 2 === 1 && 'bg-black/[0.02] dark:bg-white/[0.02]',
                    cell.isCurrentMonth && 'bg-primary/[0.03]'
                  )}
                  style={{ width: monthCellWidth, height: TEAM_ROW_HEIGHT }}
                >
                  {loadPercentage > 0 && (
                    <div
                      className="absolute bottom-1 left-1 right-1 flex items-end justify-center"
                      title={`Загрузка команды: ${loadPercentage}%`}
                    >
                      <div
                        className={cn(
                          'w-full rounded-sm border relative overflow-hidden',
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
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <span
                            className={cn(
                              'text-[9px] font-semibold leading-none',
                              loadPercentage > 100
                                ? 'text-red-700 dark:text-red-300'
                                : loadPercentage >= 90
                                  ? 'text-primary'
                                  : 'text-amber-700 dark:text-amber-400'
                            )}
                          >
                            {formatWorkload(monthWorkload)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            dayCols.map((col) => {
              const cell = dayCells[col.index]
              if (!cell) return null
              const isWeekend = cell.isWeekend && !cell.isWorkday
              const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff
              const dateKey = formatMinskDate(cell.date)
              const teamWorkload = team.dailyWorkloads?.[dateKey] || 0
              const loadPercentage =
                !isWeekend && !isSpecialDayOff && totalTeamCapacity > 0
                  ? Math.round((teamWorkload / totalTeamCapacity) * 100)
                  : 0

              return (
                <div
                  key={col.index}
                  className={cn(
                    'absolute top-0 border-r border-border/50',
                    !cell.isToday && isSpecialDayOff && 'bg-amber-50 dark:bg-amber-950/30',
                    !cell.isToday && isWeekend && 'bg-muted/50',
                    cell.isToday && 'bg-green-300/60 dark:bg-green-700/25',
                  )}
                  style={{
                    left: col.start,
                    width: col.size,
                    height: TEAM_ROW_HEIGHT,
                  }}
                >
                  {loadPercentage > 0 && (
                    <div
                      className="absolute bottom-1 left-1 right-1 flex items-end justify-center"
                      title={`Загрузка команды: ${loadPercentage}%`}
                    >
                      <div
                        className={cn(
                          'w-full rounded-sm border relative overflow-hidden',
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
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <span
                            className={cn(
                              'text-[8px] font-semibold leading-none',
                              loadPercentage > 100
                                ? 'text-red-700 dark:text-red-300'
                                : loadPercentage >= 90
                                  ? 'text-primary'
                                  : 'text-amber-700 dark:text-amber-400'
                            )}
                          >
                            {formatWorkload(teamWorkload)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
