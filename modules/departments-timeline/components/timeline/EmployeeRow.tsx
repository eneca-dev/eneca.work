/**
 * Employee Row Component
 *
 * Строка сотрудника на таймлайне с полосками загрузок
 */

'use client'

import { useMemo, useState, Fragment, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { FolderKanban, Building2, MessageSquare, UserPlus } from 'lucide-react'
import { formatMinskDate, getTodayMinsk } from '@/lib/timezone-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { openLoadingModal2Edit, openLoadingModal2Create } from '@/modules/modals'
import {
  loadingsToPeriods,
  calculateBarRenders,
  calculateBarTop,
  formatBarTooltip,
  getBarLabelParts,
  splitPeriodByNonWorkingDays,
  BASE_BAR_HEIGHT,
  BAR_GAP,
  COMMENT_HEIGHT,
  COMMENT_GAP,
} from '../../utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, EMPLOYEE_ROW_HEIGHT } from '../../constants'
import type { Employee, DayCell, Loading } from '../../types'
import type { TimelineUnit } from '@/types/planning'

interface EmployeeRowProps {
  employee: Employee
  employeeIndex: number
  dayCells: DayCell[]
  isTeamLead: boolean
}

// Convert DayCell to TimelineUnit for compatibility with loading-bars-utils
function dayCellsToTimelineUnits(dayCells: DayCell[]): TimelineUnit[] {
  const today = getTodayMinsk()

  return dayCells.map((cell, index) => {
    // Determine if it's a working day
    // Working day = not a weekend AND not a holiday AND not a transferred day off
    // OR it's a transferred workday (weekend that became working)
    const isDefaultWeekend = cell.isWeekend
    const isWorking = cell.isTransferredWorkday ||
      (!isDefaultWeekend && !cell.isHoliday && !cell.isTransferredDayOff)

    return {
      date: cell.date,
      dateKey: formatMinskDate(cell.date),
      dayOfMonth: cell.dayOfMonth,
      dayOfWeek: cell.dayOfWeek,
      isWeekend: cell.isWeekend,
      isWorkingDay: isWorking,
      isHoliday: cell.isHoliday,
      holidayName: cell.holidayName || undefined,
      isToday: cell.isToday,
      isMonthStart: cell.isMonthStart,
      monthName: cell.monthName,
      left: index * DAY_CELL_WIDTH,
      width: DAY_CELL_WIDTH,
    }
  })
}

// Helper to convert color to rgba
function hexToRgba(color: string, alpha: number): string {
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g)
    if (match && match.length >= 3) {
      return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`
    }
  }
  let hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function EmployeeRow({
  employee,
  employeeIndex,
  dayCells,
  isTeamLead,
}: EmployeeRowProps) {
  const [hoveredAvatar, setHoveredAvatar] = useState(false)

  // Обработчик клика на loading bar для открытия модалки редактирования
  const handleLoadingClick = useCallback((loading: Loading) => {
    console.time('⏱️ [EmployeeRow] handleLoadingClick')
    console.log('🔵 [EmployeeRow] handleLoadingClick вызван для loading:', loading.id)

    // Проверяем что есть sectionId (это главное для открытия модалки)
    if (!loading.sectionId) {
      console.warn('⚠️ Не могу открыть модалку: отсутствует sectionId', {
        loadingId: loading.id,
        stageId: loading.stageId,
      })
      return
    }

    // Строим breadcrumbs из данных loading
    const breadcrumbs: Array<{
      id: string
      name: string
      type: 'project' | 'object' | 'section' | 'decomposition_stage'
    }> = []

    if (loading.projectId && loading.projectName) {
      breadcrumbs.push({
        id: loading.projectId,
        name: loading.projectName,
        type: 'project',
      })
    }

    if (loading.objectId && loading.objectName) {
      breadcrumbs.push({
        id: loading.objectId,
        name: loading.objectName,
        type: 'object',
      })
    }

    if (loading.sectionId && loading.sectionName) {
      breadcrumbs.push({
        id: loading.sectionId,
        name: loading.sectionName,
        type: 'section',
      })
    }

    if (loading.stageId && loading.stageName) {
      breadcrumbs.push({
        id: loading.stageId,
        name: loading.stageName,
        type: 'decomposition_stage',
      })
    }

    console.log('📋 [EmployeeRow] Breadcrumbs построены:', breadcrumbs)

    // Открываем LoadingModal2 через global modal store с breadcrumbs и loading объектом
    openLoadingModal2Edit(loading.id, loading.sectionId, {
      loading: {
        id: loading.id,
        employee_id: loading.employeeId || '',
        start_date: loading.startDate,
        end_date: loading.endDate,
        rate: loading.rate,
        comment: loading.comment || null,
        section_id: loading.stageId, // stageId - это loading_stage в БД
      },
      breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : undefined,
      projectId: loading.projectId,
    })

    console.timeEnd('⏱️ [EmployeeRow] handleLoadingClick')
    console.log('🟢 [EmployeeRow] openLoadingModal2Edit вызван с полным loading объектом')
  }, [])

  // Обработчик создания новой загрузки для сотрудника
  const handleCreateLoading = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    // Открываем LoadingModal2 с предзаполненным employeeId
    openLoadingModal2Create({
      employeeId: employee.id,
    })
  }, [employee.id])

  // Convert dayCells to TimelineUnits for loading bar utils
  const timeUnits = useMemo(() => dayCellsToTimelineUnits(dayCells), [dayCells])

  // Convert loadings to periods
  const allPeriods = useMemo(() => {
    return loadingsToPeriods(employee.loadings)
  }, [employee.loadings])

  // Calculate bar renders
  const barRenders = useMemo(() => {
    return calculateBarRenders(allPeriods, timeUnits, DAY_CELL_WIDTH, false) // false = light theme
  }, [allPeriods, timeUnits])

  // Calculate dynamic row height based on loadings
  const actualRowHeight = useMemo(() => {
    if (barRenders.length === 0) return EMPLOYEE_ROW_HEIGHT

    let maxBottom = 0
    barRenders.forEach((bar) => {
      const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)
      let totalBarHeight = top + BASE_BAR_HEIGHT
      if (bar.period.type === 'loading' && bar.period.comment) {
        totalBarHeight += COMMENT_GAP + COMMENT_HEIGHT
      }
      maxBottom = Math.max(maxBottom, totalBarHeight)
    })

    return Math.max(EMPLOYEE_ROW_HEIGHT, maxBottom + 8)
  }, [barRenders])

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  // Get initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name[0]?.toUpperCase() || '?'
  }

  return (
    <div className="group/employee min-w-full relative border-b border-border/50">
      <div
        className="flex transition-colors"
        style={{ height: actualRowHeight }}
      >
        {/* Sidebar - sticky left */}
        <div
          className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20 group-hover/employee:bg-accent"
          style={{ width: SIDEBAR_WIDTH, height: actualRowHeight }}
        >
          {/* Create loading button - positioned at right edge of sidebar */}
          <button
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-30 opacity-0 group-hover/employee:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-1 hover:bg-muted rounded-r text-[9px] text-muted-foreground hover:text-foreground bg-background border-r border-t border-b border-border"
            onClick={handleCreateLoading}
          >
            <UserPlus className="w-3 h-3" />
            <span>Загрузка</span>
          </button>

          {/* Left: avatar + name (indented more) */}
          <div className="flex items-center gap-2 min-w-0 pl-10">
            <TooltipProvider>
              <Tooltip open={hoveredAvatar}>
                <TooltipTrigger asChild>
                  <Avatar
                    className="h-8 w-8 flex-shrink-0 cursor-pointer"
                    onMouseEnter={() => setHoveredAvatar(true)}
                    onMouseLeave={() => setHoveredAvatar(false)}
                  >
                    <AvatarImage src={employee.avatarUrl} />
                    <AvatarFallback className="text-xs">
                      {getInitials(employee.fullName || employee.name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {employee.fullName || employee.name}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium truncate">
                  {employee.fullName || employee.name || 'Не указан'}
                </span>
                {isTeamLead && (
                  <span className="inline-flex items-center justify-center rounded-sm text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                    ★
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {employee.position || 'Без должности'}
              </div>
            </div>
          </div>

          {/* Right: team + rate */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {employee.teamName && (
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground truncate max-w-[100px]">
                {employee.teamName}
              </span>
            )}
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
              {employee.employmentRate || 1} ставка
            </span>
          </div>
        </div>

        {/* Timeline cells with loading bars */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {/* Loading bars overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
            {barRenders.map((bar, idx) => {
              const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)

              return (
                <Fragment key={`${bar.period.id}-${idx}`}>
                  {/* Main bar */}
                  <div
                    className={cn(
                      'absolute transition-all duration-200 pointer-events-auto flex items-center',
                      bar.period.type === 'loading' && 'cursor-pointer hover:brightness-110'
                    )}
                    style={{
                      left: bar.left,
                      width: bar.width,
                      height: BASE_BAR_HEIGHT,
                      top,
                      backgroundColor: bar.color,
                      opacity: 0.8,
                      border: `2px solid ${bar.color}`,
                      paddingLeft: 6,
                      paddingRight: 6,
                      overflow: 'hidden',
                      filter: 'brightness(1.1)',
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      borderBottomLeftRadius: bar.period.comment ? 0 : 4,
                      borderBottomRightRadius: bar.period.comment ? 0 : 4,
                    }}
                    title={formatBarTooltip(bar.period)}
                    onClick={() => bar.period.type === 'loading' && handleLoadingClick(bar.period)}
                  >
                    {/* Bar content */}
                    <div className="relative w-full h-full flex items-center" style={{ zIndex: 2 }}>
                      {bar.period.type === 'loading' && (() => {
                        const labelParts = getBarLabelParts(bar.period, bar.width)
                        const maxLines = 2

                        if (labelParts.displayMode === 'icon-only') {
                          return (
                            <div className="flex items-center gap-1">
                              <span className="px-1 py-0.5 bg-black/15 text-white text-[9px] font-semibold rounded">
                                {bar.period.rate || 1}
                              </span>
                              <FolderKanban size={11} className="text-white" />
                            </div>
                          )
                        }

                        if (labelParts.displayMode === 'minimal' || labelParts.displayMode === 'compact') {
                          let lineCount = 0
                          return (
                            <div className="flex items-start gap-1 overflow-hidden w-full h-full">
                              <span className="mt-0.5 px-1 py-0.5 bg-black/15 text-white text-[9px] font-semibold rounded flex-shrink-0">
                                {bar.period.rate || 1}
                              </span>
                              <div className="flex flex-col justify-center items-start overflow-hidden flex-1" style={{ gap: 2 }}>
                                {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
                                  <div className="flex items-center gap-1 w-full overflow-hidden">
                                    <FolderKanban size={11} className="text-white flex-shrink-0" />
                                    <span className="text-[10px] font-semibold text-white truncate" title={labelParts.project}>
                                      {labelParts.project}
                                    </span>
                                  </div>
                                )})()}
                                {labelParts.object && lineCount < maxLines && (() => { lineCount++; return (
                                  <div className="flex items-center gap-1 w-full overflow-hidden">
                                    <Building2 size={10} className="text-white/90 flex-shrink-0" />
                                    <span className="text-[9px] font-medium text-white/90 truncate" title={labelParts.object}>
                                      {labelParts.object}
                                    </span>
                                  </div>
                                )})()}
                              </div>
                            </div>
                          )
                        }

                        // Full mode
                        let lineCount = 0
                        return (
                          <div className="flex items-start gap-1.5 overflow-hidden w-full">
                            <span className="mt-0.5 px-1.5 py-0.5 bg-black/15 text-white text-[10px] font-semibold rounded flex-shrink-0">
                              {bar.period.rate || 1}
                            </span>
                            <div className="flex flex-col justify-center overflow-hidden flex-1" style={{ gap: 1 }}>
                              {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
                                <div className="flex items-center gap-1 overflow-hidden">
                                  <FolderKanban size={11} className="text-white flex-shrink-0" />
                                  <span className="text-[10px] font-semibold text-white truncate" title={labelParts.project}>
                                    {labelParts.project}
                                  </span>
                                </div>
                              )})()}
                              {labelParts.object && lineCount < maxLines && (() => { lineCount++; return (
                                <div className="flex items-center gap-1 overflow-hidden">
                                  <Building2 size={10} className="text-white/90 flex-shrink-0" />
                                  <span className="text-[9px] font-medium text-white/90 truncate" title={labelParts.object}>
                                    {labelParts.object}
                                  </span>
                                </div>
                              )})()}
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Non-working days overlay */}
                    {(() => {
                      const nonWorkingSegments = splitPeriodByNonWorkingDays(bar.startIdx, bar.endIdx, timeUnits)
                      const HORIZONTAL_GAP = 6

                      return nonWorkingSegments.map((segment, segmentIdx) => {
                        const barStartLeft = timeUnits[bar.startIdx]?.left ?? 0
                        const segmentStartLeft = timeUnits[segment.startIdx]?.left ?? 0
                        const overlayLeft = segmentStartLeft - barStartLeft - HORIZONTAL_GAP / 2

                        let overlayWidth = 0
                        for (let idx = segment.startIdx; idx <= segment.endIdx; idx++) {
                          overlayWidth += timeUnits[idx]?.width ?? DAY_CELL_WIDTH
                        }
                        overlayWidth -= 3

                        return (
                          <div
                            key={`non-working-${segmentIdx}`}
                            className="absolute pointer-events-none"
                            style={{
                              left: overlayLeft,
                              width: overlayWidth,
                              top: -3,
                              bottom: -3,
                              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255, 255, 255, 0.1) 4px, rgba(255, 255, 255, 0.1) 15px)',
                              borderTop: `3px dashed ${bar.color}`,
                              borderBottom: `3px dashed ${bar.color}`,
                              zIndex: 1,
                            }}
                          />
                        )
                      })
                    })()}
                  </div>

                  {/* Comment below bar */}
                  {bar.period.type === 'loading' && bar.period.comment && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: top + BASE_BAR_HEIGHT,
                        left: bar.left,
                        width: bar.width,
                        height: COMMENT_GAP + COMMENT_HEIGHT,
                        zIndex: 3,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: -2,
                          left: 3,
                          right: 3,
                          height: COMMENT_GAP,
                          borderTop: '2px dashed #ffffff',
                          opacity: 1,
                        }}
                      />
                      <div
                        className="absolute flex items-center gap-1 px-2 pointer-events-auto cursor-pointer"
                        style={{
                          top: COMMENT_GAP - 2,
                          left: 0,
                          right: 0,
                          height: COMMENT_HEIGHT,
                          backgroundColor: hexToRgba(bar.color, 0.5),
                          borderLeft: `2px solid ${bar.color}`,
                          borderRight: `2px solid ${bar.color}`,
                          borderBottom: `2px solid ${bar.color}`,
                          borderBottomLeftRadius: 4,
                          borderBottomRightRadius: 4,
                          opacity: 0.8,
                          filter: 'brightness(1.1)',
                        }}
                        title={bar.period.comment}
                      >
                        <MessageSquare size={11} className="text-white flex-shrink-0" />
                        <span className="text-[10px] leading-tight truncate text-white font-medium">
                          {bar.period.comment}
                        </span>
                      </div>
                    </div>
                  )}
                </Fragment>
              )
            })}
          </div>

          {/* Background cells */}
          {dayCells.map((cell, i) => {
            const isWeekend = cell.isWeekend && !cell.isWorkday
            const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff

            return (
              <div
                key={i}
                className={cn(
                  'border-r border-border/30 relative',
                  cell.isToday && 'bg-primary/10',
                  !cell.isToday && isSpecialDayOff && 'bg-amber-50 dark:bg-amber-950/30',
                  !cell.isToday && isWeekend && 'bg-muted/50',
                  'group-hover/employee:bg-muted/20',
                )}
                style={{
                  width: DAY_CELL_WIDTH,
                  height: actualRowHeight,
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
