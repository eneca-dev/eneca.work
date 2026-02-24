/**
 * Employee Row Component
 *
 * Строка сотрудника с цветными барами загрузок (несколько loadings на одной строке)
 */

'use client'

import { useMemo, useState, Fragment, useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Box, Layers, MessageSquare, UserPlus } from 'lucide-react'
import { formatMinskDate, parseMinskDate } from '@/lib/timezone-utils'
import { dayCellsToTimelineUnits, hexToRgba, calculateTimelineRange } from '@/modules/resource-graph/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { useSectionsPageActions } from '../../context'
import { useUpdateLoadingDates } from '../../hooks'
import { openLoadingModalNewCreate } from '@/modules/modals'
import {
  loadingsToPeriods,
  calculateBarRenders,
  calculateBarTop,
  formatBarTooltip,
  splitPeriodByNonWorkingDays,
  BASE_BAR_HEIGHT,
  BAR_GAP,
  COMMENT_HEIGHT,
  COMMENT_GAP,
} from '../../utils/loading-bars-utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, EMPLOYEE_ROW_HEIGHT } from '../../constants'
import type { SectionLoading, DayCell, TimelineRange } from '../../types'
import type { TimelineUnit } from '@/types/planning'
import { getCellClassNames } from '../../utils/cell-utils'
import { useTimelineResize } from '@/modules/resource-graph/hooks'

interface EmployeeRowProps {
  employee: {
    employeeId: string
    employeeName: string
    employeeAvatarUrl: string | null
    employeeDepartmentName: string | null
    employeePosition: string | null
    employeeCategory: string | null
    employeeEmploymentRate: number | null
    loadings: SectionLoading[]
  }
  sectionId: string
  sectionName: string
  projectId: string
  projectName: string
  objectId: string
  objectName: string
  dayCells: DayCell[]
  stages?: Array<{ id: string; name: string; order: number | null }>
}


// Get initials for avatar
function getInitials(name?: string): string {
  if (!name) return '??'
  const trimmed = name.trim()
  if (!trimmed) return '??'
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return trimmed.substring(0, 2).toUpperCase()
}


/**
 * Loading Bar Component with drag-to-resize
 */
interface LoadingBarProps {
  bar: ReturnType<typeof calculateBarRenders>[0]
  barRenders: ReturnType<typeof calculateBarRenders>
  timeUnits: TimelineUnit[]
  timelineRange: TimelineRange
  onLoadingClick: (loading: SectionLoading) => void
  onLoadingResize: (loadingId: string, startDate: string, finishDate: string) => void
}

function LoadingBar({
  bar,
  barRenders,
  timeUnits,
  timelineRange,
  onLoadingClick,
  onLoadingResize,
}: LoadingBarProps) {
  // Refs for containers (to update transform without re-render)
  const textRef = useRef<HTMLDivElement>(null)
  const rateBadgeRef = useRef<HTMLDivElement>(null)
  const commentRef = useRef<HTMLDivElement>(null)

  // Convert Date to ISO string for useTimelineResize
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
      onLoadingResize(bar.period.id, newStartDate, newEndDate)
    },
    minDays: 1,
    disabled: false,
  })

  const isClippedLeft = parseMinskDate(startDateString) < timelineRange.start
  const isClippedRight = parseMinskDate(endDateString) > timelineRange.end

  // Handle click with wasRecentlyDragging check
  const handleClick = useCallback(() => {
    if (bar.period.type !== 'loading') return

    // Don't open modal if just finished dragging
    if (wasRecentlyDragging()) return

    onLoadingClick(bar.period.loading)
  }, [bar.period, onLoadingClick, wasRecentlyDragging])

  // Use preview position if resizing, otherwise original
  const displayLeft = previewPosition?.left ?? bar.left
  const displayWidth = previewPosition?.width ?? bar.width

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

  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)

  // Split period by non-working days (weekends + holidays) for diagonal stripe overlay
  const nonWorkingSegments = useMemo(() => {
    const startIdx = timeUnits.findIndex(u => u.dateKey === formatMinskDate(bar.period.startDate))
    const endIdx = timeUnits.findIndex(u => u.dateKey === formatMinskDate(bar.period.endDate))

    // Если загрузка выходит за пределы видимого диапазона — используем границы видимой части бара
    const effectiveStartIdx = startIdx === -1 ? bar.startIdx : startIdx
    const effectiveEndIdx = endIdx === -1 ? bar.endIdx : endIdx

    if (effectiveStartIdx > effectiveEndIdx || effectiveStartIdx >= timeUnits.length) return []

    const segments: Array<{ startIdx: number; endIdx: number }> = []
    let currentSegmentStart: number | null = null

    for (let idx = effectiveStartIdx; idx <= effectiveEndIdx; idx++) {
      const unit = timeUnits[idx]
      if (!unit) continue
      // Не рабочий день: обычный выходной (сб/вс) ИЛИ праздник ИЛИ перенесённый выходной
      const isNonWorking = !unit.isWorkingDay

      if (isNonWorking) {
        if (currentSegmentStart === null) {
          currentSegmentStart = idx
        }
      } else {
        if (currentSegmentStart !== null) {
          segments.push({
            startIdx: currentSegmentStart,
            endIdx: idx - 1,
          })
          currentSegmentStart = null
        }
      }
    }

    // Close last segment
    if (currentSegmentStart !== null) {
      segments.push({
        startIdx: currentSegmentStart,
        endIdx: effectiveEndIdx,
      })
    }

    return segments
  }, [bar.period.startDate, bar.period.endDate, bar.startIdx, bar.endIdx, timeUnits])

  // Extract display info from period
  const sectionText = bar.period.sectionName || bar.period.objectName || ''
  const stageText = bar.period.stageName || ''

  return (
    <Fragment>
      {/* Main bar */}
      <div
        className={cn(
          'absolute pointer-events-auto flex items-center',
          !isResizing && 'transition-all duration-200',
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

        {/* Sticky rate badge (always visible, vertically centered) */}
        <div
          ref={rateBadgeRef}
          className="absolute left-0.5 top-0 bottom-0 flex items-center flex-shrink-0 transition-transform duration-150 ease-out"
          style={{ zIndex: 10 }}
        >
          <span className="inline-flex items-center justify-center w-[36px] h-[20px] bg-black/20 text-white text-[10px] font-semibold tabular-nums rounded shadow-sm">
            {bar.period.rate || 1}
          </span>
        </div>

        {/* Bar content with smooth scrolling text */}
        <div
          ref={textRef}
          className="absolute left-[42px] top-0 bottom-0 flex flex-col justify-center items-start gap-0.5 transition-transform duration-200 ease-out"
          style={{ zIndex: 2, maxWidth: displayWidth - 48 }}
        >
          {/* Line 1: Section name with icon */}
          {sectionText && (
            <div className="flex items-center gap-1 w-full overflow-hidden">
              <Box size={11} className="text-white flex-shrink-0" />
              <span className="text-[10px] font-semibold text-white truncate leading-tight">
                {sectionText}
              </span>
            </div>
          )}

          {/* Line 2: Stage name with icon */}
          {stageText && (
            <div className="flex items-center gap-1 w-full overflow-hidden">
              <Layers size={10} className="text-white/90 flex-shrink-0" />
              <span className="text-[9px] font-medium text-white/90 truncate leading-tight">
                {stageText}
              </span>
            </div>
          )}
        </div>

        {/* Non-working days overlay */}
        {nonWorkingSegments.map((segment, segmentIdx) => {
          const segmentStartLeft = timeUnits[segment.startIdx]?.left ?? 0
          // Позиция относительно текущего displayLeft, чтобы штриховка не съезжала во время resize
          const overlayLeft = segmentStartLeft - displayLeft

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
        })}
      </div>

      {/* Comment below bar */}
      {bar.period.type === 'loading' && bar.period.comment && (
        <div
          className={cn('absolute pointer-events-none', !isResizing && 'transition-all duration-200')}
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
  sectionId,
  sectionName,
  projectId,
  projectName,
  objectId,
  objectName,
  dayCells,
  stages,
}: EmployeeRowProps) {
  const [isHoveredAvatar, setIsHoveredAvatar] = useState(false)
  const { onEditLoading } = useSectionsPageActions()

  // Mutation hook для обновления дат загрузки
  const updateLoadingDates = useUpdateLoadingDates()

  // Timeline range для useTimelineResize
  const timelineRange = useMemo(() => calculateTimelineRange(dayCells), [dayCells])

  // Обработчик клика на loading bar для редактирования
  const handleLoadingClick = useCallback((loading: SectionLoading) => {
    onEditLoading(
      loading.id,
      {
        id: loading.id,
        employee_id: loading.employeeId,
        start_date: loading.startDate,
        end_date: loading.endDate,
        rate: loading.rate,
        comment: loading.comment || null,
        stage_id: loading.stageId,
      },
      {
        projectId,
        projectName,
        objectId,
        objectName,
        sectionId,
        sectionName,
      },
      stages
    )
  }, [onEditLoading, projectId, projectName, objectId, objectName, sectionId, sectionName, stages])

  // Callback для обработки resize загрузки
  const handleLoadingResize = useCallback(
    (loadingId: string, startDate: string, finishDate: string) => {
      updateLoadingDates.mutate({
        loadingId,
        employeeId: employee.employeeId,
        startDate,
        finishDate,
      })
    },
    [employee.employeeId, updateLoadingDates]
  )

  // Обработчик создания новой загрузки для сотрудника
  const handleCreateLoading = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    // Открываем модалку создания загрузки с предзаполненным сотрудником и разделом
    openLoadingModalNewCreate({
      employeeId: employee.employeeId,
      sectionId: sectionId,
    })
  }, [employee.employeeId, sectionId])

  // Convert dayCells to TimelineUnits for loading bar utils
  const timeUnits = useMemo(() => dayCellsToTimelineUnits(dayCells), [dayCells])

  // Convert loadings to periods
  const allPeriods = useMemo(() => {
    return loadingsToPeriods(employee.loadings)
  }, [employee.loadings])

  // Calculate bar renders
  const barRenders = useMemo(() => {
    return calculateBarRenders(allPeriods, dayCells, DAY_CELL_WIDTH)
  }, [allPeriods, dayCells])

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

  const employmentRate = employee.employeeEmploymentRate ?? 1

  return (
    <div className="group/employee min-w-full relative border-b border-border/30">
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

          {/* Left: avatar + name (indented) */}
          <div className="flex items-center gap-2 min-w-0 pl-10">
            <TooltipProvider>
              <Tooltip open={isHoveredAvatar}>
                <TooltipTrigger asChild>
                  <Avatar
                    className="h-8 w-8 flex-shrink-0 cursor-pointer"
                    onMouseEnter={() => setIsHoveredAvatar(true)}
                    onMouseLeave={() => setIsHoveredAvatar(false)}
                  >
                    <AvatarImage src={employee.employeeAvatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(employee.employeeName)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {employee.employeeName}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium truncate">
                  {employee.employeeName || 'Не указан'}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {employee.employeePosition || 'Без должности'}
                {employee.employeeCategory && employee.employeeCategory !== 'Не применяется' && (
                  <span className="text-primary font-medium"> · {employee.employeeCategory}</span>
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
                    {employmentRate}
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
              <LoadingBar
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
          {dayCells.map((cell, i) => (
            <div
              key={i}
              className={getCellClassNames(cell)}
              style={{
                width: DAY_CELL_WIDTH,
                height: actualRowHeight,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
