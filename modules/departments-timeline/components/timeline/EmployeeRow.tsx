/**
 * Employee Row Component
 *
 * Строка сотрудника на таймлайне с полосками загрузок
 */

'use client'

import { useMemo, useState, Fragment, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { FolderKanban, Building2, MessageSquare, UserPlus } from 'lucide-react'
import { formatMinskDate, parseMinskDate } from '@/lib/timezone-utils'
import { dayCellsToTimelineUnits, hexToRgba, calculateTimelineRange } from '@/modules/resource-graph/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { openLoadingModalNewEdit, openLoadingModalNewCreate } from '@/modules/modals'
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
import type { Employee, DayCell, Loading, TimelineRange } from '../../types'
import type { TimelineUnit, Loading as PlanningLoading } from '@/types/planning'
import { useTimelineResize } from '@/modules/resource-graph/hooks'
import { useUpdateLoadingDates } from '../../hooks'

interface EmployeeRowProps {
  employee: Employee
  employeeIndex: number
  dayCells: DayCell[]
  isTeamLead: boolean
}

/**
 * Loading Bar с поддержкой drag-to-resize
 */
interface LoadingBarWithResizeProps {
  bar: ReturnType<typeof calculateBarRenders>[0]
  barRenders: ReturnType<typeof calculateBarRenders>
  timeUnits: TimelineUnit[]
  timelineRange: TimelineRange
  onLoadingClick: (loading: Loading) => void
  onLoadingResize: (loadingId: string, startDate: string, finishDate: string) => void
}

function LoadingBarWithResize({
  bar,
  barRenders,
  timeUnits,
  timelineRange,
  onLoadingClick,
  onLoadingResize,
}: LoadingBarWithResizeProps) {
  // Refs for containers (to update transform without re-render)
  const textRef = useRef<HTMLDivElement>(null)
  const commentRef = useRef<HTMLDivElement>(null)
  const rateBadgeRef = useRef<HTMLDivElement>(null)

  // Используем useTimelineResize только для loading (не для других типов периодов)
  const canResize = bar.period.type === 'loading'

  // Конвертируем Date в ISO string для useTimelineResize
  const startDateString = bar.period.startDate instanceof Date
    ? formatMinskDate(bar.period.startDate)
    : bar.period.startDate
  const endDateString = bar.period.endDate instanceof Date
    ? formatMinskDate(bar.period.endDate)
    : bar.period.endDate

  const {
    leftHandleProps,
    rightHandleProps,
    isResizing,
    previewPosition,
    previewDates,
    wasRecentlyDragging,
  } = useTimelineResize({
    startDate: startDateString,
    endDate: endDateString,
    range: timelineRange,
    onResize: (newStartDate, newEndDate) => {
      if (canResize) {
        onLoadingResize(bar.period.id, newStartDate, newEndDate)
      }
    },
    minDays: 1,
    disabled: !canResize,
  })

  const isClippedLeft = parseMinskDate(startDateString) < timelineRange.start
  const isClippedRight = parseMinskDate(endDateString) > timelineRange.end

  // Обработчик клика с проверкой wasRecentlyDragging
  const handleClick = useCallback(() => {
    if (bar.period.type !== 'loading') return

    // Не открываем модалку если только что закончили drag
    if (wasRecentlyDragging()) return

    // BarPeriod содержит все необходимые поля Loading; startDate/endDate - Date объекты,
    // модал (useLoadingModal) обрабатывает оба варианта (string и Date)
    onLoadingClick(bar.period as unknown as Loading)
  }, [bar.period, onLoadingClick, wasRecentlyDragging])

  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)

  // Используем preview позицию если есть, иначе оригинальную
  const displayLeft = previewPosition?.left ?? bar.left
  const displayWidth = previewPosition?.width ?? bar.width

  // Показываем preview даты в tooltip во время resize
  const displayStartDate = isResizing && previewDates ? previewDates.startDate : startDateString
  const displayEndDate = isResizing && previewDates ? previewDates.endDate : endDateString

  // Unified scroll effect: single listener updates text, comment, and rate badge
  useEffect(() => {
    const container = textRef.current?.closest('.overflow-auto')
    if (!container) return

    const update = () => {
      const scrollLeft = container.scrollLeft
      const overlap = Math.max(0, scrollLeft - displayLeft)

      if (textRef.current) textRef.current.style.transform = `translateX(${overlap}px)`
      if (commentRef.current) commentRef.current.style.transform = `translateX(${overlap}px)`
      if (rateBadgeRef.current) {
        const clampedOffset = Math.min(overlap, Math.max(0, displayWidth - 48))
        rateBadgeRef.current.style.transform = `translateX(${clampedOffset}px)`
      }
    }

    update()
    container.addEventListener('scroll', update, { passive: true })
    return () => container.removeEventListener('scroll', update)
  }, [displayLeft, displayWidth])

  return (
    <Fragment>
      {/* Main bar */}
      <div
        className={cn(
          'absolute transition-all duration-200 pointer-events-auto flex items-center',
          bar.period.type === 'loading' && 'cursor-pointer hover:brightness-110',
          isResizing && 'ring-2 ring-primary/50 z-50'
        )}
        style={{
          left: displayLeft,
          width: displayWidth,
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
        onClick={handleClick}
      >
        {/* Resize handles */}
        {canResize && (
          <>
            {/* Left handle */}
            {!isClippedLeft && (
              <div
                {...leftHandleProps}
                className="absolute top-0 bottom-0 -left-1 w-2 cursor-ew-resize hover:bg-white/20 transition-colors"
                style={{ zIndex: 20 }}
              />
            )}
            {/* Right handle */}
            {!isClippedRight && (
              <div
                {...rightHandleProps}
                className="absolute top-0 bottom-0 -right-1 w-2 cursor-ew-resize hover:bg-white/20 transition-colors"
                style={{ zIndex: 20 }}
              />
            )}
          </>
        )}

        {/* Sticky rate badge (always visible, stops at right edge) */}
        <div
          ref={rateBadgeRef}
          className="absolute left-0.5 top-0 bottom-0 flex items-center flex-shrink-0 transition-transform duration-150 ease-out"
          style={{ zIndex: 10 }}
        >
          <span className="inline-flex items-center justify-center w-[36px] h-[20px] bg-black/20 text-white text-[10px] font-semibold tabular-nums rounded shadow-sm">
            {bar.period.rate || 1}
          </span>
        </div>

        {/* Bar content */}
        <div
          ref={textRef}
          className="absolute left-[42px] top-0 bottom-0 flex items-center transition-transform duration-200 ease-out"
          style={{ zIndex: 2 }}
        >
          {bar.period.type === 'loading' && (() => {
            const labelParts = getBarLabelParts(bar.period, displayWidth)
            const maxLines = 2

            if (labelParts.displayMode === 'icon-only') {
              return (
                <div className="flex items-center gap-1">
                  <FolderKanban size={11} className="text-white" />
                </div>
              )
            }

            if (labelParts.displayMode === 'minimal' || labelParts.displayMode === 'compact') {
              let lineCount = 0
              return (
                <div className="flex items-center gap-1 overflow-hidden w-full h-full">
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
              <div className="flex items-center gap-1.5 overflow-hidden w-full">
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
          className="absolute pointer-events-none transition-all duration-200"
          style={{
            top: top + BASE_BAR_HEIGHT,
            left: displayLeft,
            width: displayWidth,
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
            className="absolute pointer-events-auto cursor-pointer overflow-hidden"
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
            <div
              ref={commentRef}
              className="flex items-center gap-1 px-2 transition-transform duration-200 ease-out"
              style={{ height: COMMENT_HEIGHT }}
            >
              <MessageSquare size={11} className="text-white flex-shrink-0" />
              <span className="text-[10px] leading-tight truncate text-white font-medium">
                {bar.period.comment}
              </span>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  )
}

export function EmployeeRow({
  employee,
  employeeIndex,
  dayCells,
  isTeamLead,
}: EmployeeRowProps) {
  const [isHoveredAvatar, setIsHoveredAvatar] = useState(false)

  // Mutation hook для обновления дат загрузки
  const updateLoadingDates = useUpdateLoadingDates()

  // Timeline range для useTimelineResize
  const timelineRange = useMemo(() => calculateTimelineRange(dayCells), [dayCells])

  // Callback для обработки resize загрузки
  const handleLoadingResize = useCallback(
    (loadingId: string, startDate: string, finishDate: string) => {
      updateLoadingDates.mutate({
        loadingId,
        employeeId: employee.id,
        startDate,
        finishDate,
      })
    },
    [employee.id, updateLoadingDates]
  )

  // Обработчик клика на loading bar для открытия модалки редактирования
  const handleLoadingClick = useCallback((loading: Loading) => {
    // Проверяем что есть sectionId (это главное для открытия модалки)
    if (!loading.sectionId) {
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

    // Открываем LoadingModalNew через global modal store с breadcrumbs и loading объектом
    openLoadingModalNewEdit(loading.id, loading.sectionId, {
      loading: {
        id: loading.id,
        employee_id: loading.employeeId || employee.id,
        start_date: loading.startDate,
        end_date: loading.endDate,
        rate: loading.rate,
        comment: loading.comment || null,
        section_id: loading.stageId, // stageId - это loading_stage в БД
      },
      breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : undefined,
      projectId: loading.projectId,
    })
  }, [])

  // Обработчик создания новой загрузки для сотрудника
  const handleCreateLoading = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    // Открываем LoadingModalNew с предзаполненным employeeId
    openLoadingModalNewCreate({
      employeeId: employee.id,
    })
  }, [employee.id])

  // Convert dayCells to TimelineUnits for loading bar utils
  const timeUnits = useMemo(() => dayCellsToTimelineUnits(dayCells), [dayCells])

  // Convert loadings to periods
  const allPeriods = useMemo(() => {
    // Маппим departments-timeline Loading (string dates) → planning Loading (Date)
    const planningLoadings: PlanningLoading[] = (employee.loadings ?? []).map((l) => ({
      ...l,
      startDate: new Date(l.startDate),
      endDate: new Date(l.endDate),
      createdAt: l.createdAt ? new Date(l.createdAt) : new Date(0),
      updatedAt: l.updatedAt ? new Date(l.updatedAt) : new Date(0),
    }))
    return loadingsToPeriods(planningLoadings)
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
          className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20"
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
              <Tooltip open={isHoveredAvatar}>
                <TooltipTrigger asChild>
                  <Avatar
                    className="h-8 w-8 flex-shrink-0 cursor-pointer"
                    onMouseEnter={() => setIsHoveredAvatar(true)}
                    onMouseLeave={() => setIsHoveredAvatar(false)}
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
                {employee.categoryName && employee.categoryName !== 'Не применяется' && (
                  <span className="text-primary font-medium"> · {employee.categoryName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: rate */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary cursor-default">
                    {employee.employmentRate || 1}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Ставка
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Timeline cells with loading bars */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {/* Loading bars overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
            {barRenders.map((bar, idx) => (
              <LoadingBarWithResize
                key={`${bar.period.id}-${idx}`}
                bar={bar}
                barRenders={barRenders}
                timeUnits={timeUnits}
                timelineRange={timelineRange}
                onLoadingClick={handleLoadingClick}
                onLoadingResize={handleLoadingResize}
              />
            ))}
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
                  !cell.isToday && isSpecialDayOff && 'bg-amber-50 dark:bg-amber-950/30',
                  !cell.isToday && isWeekend && 'bg-muted/50',
                  // Сегодня - применяется последним, но за загрузками
                  cell.isToday && 'bg-green-50/50 dark:bg-green-700/25',
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
