'use client'

import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  ChevronRight,
  FolderKanban,
  Layers,
  Box,
  ListTodo,
  Calendar,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type {
  Project,
  Stage,
  ProjectObject,
  Section,
  DecompositionStage,
  DecompositionItem,
  TimelineRange,
  WorkLog,
  Loading,
  ReadinessPoint,
} from '../../types'
import { TimelineBar, calculateBarPosition } from './TimelineBar'
import { ReadinessGraph } from './ReadinessGraph'
import { ActualReadinessBars } from './ActualReadinessBars'
import { WorkLogMarkers } from './WorkLogMarkers'
import { LoadingBadges } from './LoadingBadges'
import { LoadingBars, calculateLoadingsRowHeight } from './LoadingBars'
import { SectionPeriodFrame } from './SectionPeriodFrame'
import { PlannedReadinessArea } from './PlannedReadinessArea'
import { ActualReadinessArea } from './ActualReadinessArea'
import { useWorkLogs, useLoadings, useStageReadiness } from '../../hooks'
import type { DayCell } from './TimelineHeader'
import { ROW_HEIGHT, SECTION_ROW_HEIGHT, STAGE_ROW_HEIGHT, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'

// ============================================================================
// Grid Background
// ============================================================================

interface TimelineGridProps {
  dayCells: DayCell[]
}

export function TimelineGrid({ dayCells }: TimelineGridProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {dayCells.map((cell, i) => {
        // Логика цветов выходных:
        // - Праздники и дополнительные выходные (переносы) → желтоватый
        // - Стандартные выходные (Сб/Вс) → серый
        const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff
        const isRegularWeekend = cell.isWeekend && !cell.isWorkday && !isSpecialDayOff
        const showBackground = cell.isToday || isSpecialDayOff || isRegularWeekend

        if (!showBackground) return null

        return (
          <div
            key={i}
            className={cn(
              'absolute top-0 bottom-0',
              cell.isToday && 'bg-primary/5',
              !cell.isToday && isSpecialDayOff && 'bg-amber-50/50 dark:bg-amber-950/20',
              !cell.isToday && isRegularWeekend && 'bg-gray-100/50 dark:bg-gray-800/30'
            )}
            style={{
              left: i * DAY_CELL_WIDTH,
              width: DAY_CELL_WIDTH,
            }}
          />
        )
      })}
      {/* Вертикальные линии */}
      {dayCells.slice(0, -1).map((_, i) => (
        <div
          key={`line-${i}`}
          className="absolute top-0 bottom-0 w-px bg-border/30"
          style={{ left: (i + 1) * DAY_CELL_WIDTH }}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Row Components
// ============================================================================

interface BaseRowProps {
  depth: number
  isExpanded?: boolean
  onToggle?: () => void
  hasChildren?: boolean
  icon: React.ReactNode
  label: string
  children?: React.ReactNode
  // Timeline
  dayCells: DayCell[]
  range: TimelineRange
  barStartDate?: string | null
  barEndDate?: string | null
  barColor?: string | null
  barLabel?: string
  // Optional extra content in sidebar (after label)
  sidebarExtra?: React.ReactNode
  // Optional extra content in timeline area (work logs, etc.)
  timelineContent?: React.ReactNode
  // Optional custom height (defaults to ROW_HEIGHT)
  height?: number
}

function BaseRow({
  depth,
  isExpanded,
  onToggle,
  hasChildren,
  icon,
  label,
  children,
  dayCells,
  range,
  barStartDate,
  barEndDate,
  barColor,
  barLabel,
  sidebarExtra,
  timelineContent,
  height = ROW_HEIGHT,
}: BaseRowProps) {
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  return (
    <>
      <div
        className={cn(
          'flex border-b border-border/50 hover:bg-muted/30 transition-colors',
          depth === 0 && 'bg-muted/20'
        )}
        style={{ height, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left при горизонтальном скролле */}
        <div
          className={cn(
            'flex items-center gap-1 shrink-0 border-r border-border px-2',
            'sticky left-0 z-10',
            depth === 0 ? 'bg-card' : 'bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={onToggle}
              className="p-0.5 hover:bg-muted rounded transition-colors"
            >
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          ) : (
            <div className="w-5" />
          )}
          {/* Icon */}
          <span className="text-muted-foreground">{icon}</span>
          {/* Label */}
          <span className="text-sm truncate flex-1 min-w-0" title={label}>
            {label}
          </span>
          {/* Extra content (avatar, status, etc.) */}
          {sidebarExtra && (
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {sidebarExtra}
            </div>
          )}
        </div>

        {/* Timeline area - fixed width */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
          {barStartDate && barEndDate && (
            <TimelineBar
              startDate={barStartDate}
              endDate={barEndDate}
              range={range}
              color={barColor}
              label={barLabel}
            />
          )}
          {/* Extra timeline content (work logs, etc.) */}
          {timelineContent}
        </div>
      </div>

      {/* Children */}
      {isExpanded && children}
    </>
  )
}

// ============================================================================
// Progress Circle Component
// ============================================================================

interface ProgressCircleProps {
  /** Процент готовности (0-100) */
  progress: number
  /** Размер круга в пикселях */
  size?: number
  /** Толщина линии */
  strokeWidth?: number
  /** Цвет прогресса (по умолчанию зелёный) */
  color?: string
}

/**
 * Круговой индикатор прогресса с процентом внутри
 * При 100% показывает зелёный круг с галочкой
 */
function ProgressCircle({
  progress,
  size = 24,
  strokeWidth = 2.5,
  color,
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  // Цвет на основе прогресса
  const progressColor = color || getProgressColor(progress)
  const isComplete = Math.round(progress) >= 100

  // При 100% показываем зелёный круг с галочкой
  if (isComplete) {
    return (
      <div
        className="relative shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: '#22c55e', // green-500
        }}
      >
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    )
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/10"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      {/* Percentage text */}
      <span
        className="absolute inset-0 flex items-center justify-center text-[8px] font-medium tabular-nums"
        style={{ color: progressColor }}
      >
        {Math.round(progress)}
      </span>
    </div>
  )
}

/**
 * Цвет прогресса на основе значения
 */
function getProgressColor(progress: number): string {
  if (progress >= 80) return '#22c55e' // green
  if (progress >= 50) return '#f59e0b' // amber
  if (progress >= 20) return '#f97316' // orange
  return '#ef4444' // red
}

// ============================================================================
// Decomposition Item Row (задача - без дат, но с work logs)
// ============================================================================

interface DecompositionItemRowProps {
  item: DecompositionItem
  dayCells: DayCell[]
  range: TimelineRange
  /** Work logs для этого раздела (фильтруем по itemId) */
  workLogs?: WorkLog[]
}

function DecompositionItemRow({ item, dayCells, range, workLogs }: DecompositionItemRowProps) {
  const label = item.description || 'Без описания'

  // Фильтруем work logs только для этого item
  const itemWorkLogs = useMemo(() => {
    return workLogs?.filter(log => log.itemId === item.id) || []
  }, [workLogs, item.id])

  // Считаем фактические часы из work logs
  const actualHours = useMemo(() => {
    return itemWorkLogs.reduce((sum, log) => sum + log.hours, 0)
  }, [itemWorkLogs])

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 5

  // Прогресс (0-100)
  const progress = item.progress ?? 0

  return (
    <>
      <div
        className="flex border-b border-border/50 hover:bg-muted/30 transition-colors"
        style={{ height: ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left */}
        <div
          className="flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-10 bg-background"
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Spacer for alignment with parent rows */}
          <div className="w-5 shrink-0" />

          {/* Progress Circle */}
          <ProgressCircle
            progress={progress}
            size={22}
            strokeWidth={2.5}
            color={item.status.color || undefined}
          />

          {/* Label - мелкий текст */}
          <span
            className="text-[11px] text-muted-foreground truncate flex-1 min-w-0"
            title={label}
          >
            {label}
          </span>

          {/* Hours: план / факт */}
          <div className="flex items-center gap-1 shrink-0 text-[10px] tabular-nums">
            {/* Фактические часы */}
            {actualHours > 0 && (
              <span className="text-emerald-500 font-medium">
                {formatHoursCompact(actualHours)}
              </span>
            )}
            {/* Разделитель */}
            {actualHours > 0 && item.plannedHours > 0 && (
              <span className="text-muted-foreground/50">/</span>
            )}
            {/* Плановые часы */}
            {item.plannedHours > 0 && (
              <span className="text-muted-foreground">
                {formatHoursCompact(item.plannedHours)}
              </span>
            )}
          </div>
        </div>

        {/* Timeline area */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
          {itemWorkLogs.length > 0 && (
            <WorkLogMarkers
              workLogs={itemWorkLogs}
              range={range}
              timelineWidth={timelineWidth}
            />
          )}
        </div>
      </div>
    </>
  )
}

/**
 * Компактный формат часов
 */
function formatHoursCompact(hours: number): string {
  if (hours % 1 === 0) return `${hours}ч`
  return `${hours.toFixed(1)}ч`
}

// ============================================================================
// Stage Readiness Calculation
// ============================================================================

interface StageStats {
  /** Готовность в % (0-100) */
  readiness: number
  /** Плановые часы (сумма по всем items) */
  plannedHours: number
  /** Фактические часы (сумма work logs) */
  actualHours: number
  /** Есть ли данные для расчёта */
  hasData: boolean
}

/**
 * Рассчитывает готовность этапа на основе его задач
 * Формула: SUM(item.progress * item.plannedHours) / SUM(item.plannedHours)
 */
function calculateStageReadiness(items: DecompositionItem[], workLogs?: WorkLog[]): StageStats {
  if (!items || items.length === 0) {
    return { readiness: 0, plannedHours: 0, actualHours: 0, hasData: false }
  }

  // Считаем плановые часы и взвешенный прогресс
  let totalWeightedProgress = 0
  let totalPlannedHours = 0

  for (const item of items) {
    if (item.plannedHours > 0) {
      const progress = item.progress ?? 0
      totalWeightedProgress += progress * item.plannedHours
      totalPlannedHours += item.plannedHours
    }
  }

  // Считаем фактические часы из work logs
  let totalActualHours = 0
  if (workLogs) {
    const itemIds = new Set(items.map(i => i.id))
    for (const log of workLogs) {
      if (itemIds.has(log.itemId)) {
        totalActualHours += log.hours
      }
    }
  }

  // Если нет плановых часов — возвращаем 0
  if (totalPlannedHours === 0) {
    return {
      readiness: 0,
      plannedHours: 0,
      actualHours: totalActualHours,
      hasData: false,
    }
  }

  // Взвешенное среднее
  const readiness = Math.round(totalWeightedProgress / totalPlannedHours)

  return {
    readiness,
    plannedHours: totalPlannedHours,
    actualHours: totalActualHours,
    hasData: true,
  }
}

// ============================================================================
// Decomposition Stage Row (этап - двухстрочный layout с загрузками и готовностью)
// ============================================================================

interface DecompositionStageRowProps {
  stage: DecompositionStage
  dayCells: DayCell[]
  range: TimelineRange
  /** Work logs для этого раздела */
  workLogs?: WorkLog[]
  /** Loadings (назначения сотрудников) для этого раздела */
  loadings?: Loading[]
  /** Readiness snapshots для этого этапа */
  stageReadiness?: ReadinessPoint[]
}

function DecompositionStageRow({ stage, dayCells, range, workLogs, loadings, stageReadiness }: DecompositionStageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = stage.items.length > 0
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 4

  // Фильтруем loadings только для этого этапа (активные)
  const stageLoadings = useMemo(() => {
    return loadings?.filter(l => l.stageId === stage.id && l.status === 'active' && !l.isShortage) || []
  }, [loadings, stage.id])

  // Расчёт готовности этапа из задач (взвешенное среднее по часам)
  const stageStats = useMemo(() => {
    return calculateStageReadiness(stage.items, workLogs)
  }, [stage.items, workLogs])

  // Форматирование даты в ДД.ММ
  const formatStageDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    try {
      return format(parseISO(dateStr), 'dd.MM')
    } catch {
      return '—'
    }
  }

  // Высоты зон в timeline (адаптивно под количество загрузок)
  const readinessZoneHeight = 32 // фиксированная нижняя зона для готовности
  const sidebarMinHeight = 44 // минимальная высота для двухстрочного sidebar
  // Загрузки: используем calculateLoadingsRowHeight для вычисления нужной высоты
  const loadingsZoneHeight = calculateLoadingsRowHeight(stageLoadings.length, 28)
  // Общая высота = max(базовая, loadings + readiness, sidebar)
  const rowHeight = Math.max(STAGE_ROW_HEIGHT, loadingsZoneHeight + readinessZoneHeight, sidebarMinHeight)

  return (
    <>
      <div
        className="flex border-b border-border/50 hover:bg-muted/30 transition-colors"
        style={{ height: rowHeight, minWidth: totalWidth }}
      >
        {/* Sidebar - двухстрочный layout */}
        <div
          className={cn(
            'flex flex-col justify-center gap-0.5 shrink-0 border-r border-border px-2',
            'sticky left-0 z-10 bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Первая строка: Expand + Icon + Name */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Expand/Collapse */}
            {hasChildren ? (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
              >
                <ChevronRight
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-90'
                  )}
                />
              </button>
            ) : (
              <div className="w-5 shrink-0" />
            )}

            {/* Icon */}
            <ListTodo className="w-4 h-4 text-muted-foreground shrink-0" />

            {/* Stage Name */}
            <span className="text-sm font-medium truncate min-w-0" title={stage.name}>
              {stage.name}
            </span>
          </div>

          {/* Вторая строка: Progress + Hours + Status + Dates */}
          <div className="flex items-center gap-2 pl-[26px]">
            {/* Progress Circle */}
            {stageStats.hasData && (
              <ProgressCircle
                progress={stageStats.readiness}
                size={18}
                strokeWidth={2}
                color={stage.status.color || undefined}
              />
            )}

            {/* Hours: факт / план */}
            {stageStats.plannedHours > 0 && (
              <div className="flex items-center gap-0.5 text-[9px] tabular-nums">
                {stageStats.actualHours > 0 && (
                  <span className="text-emerald-500 font-medium">
                    {formatHoursCompact(stageStats.actualHours)}
                  </span>
                )}
                {stageStats.actualHours > 0 && (
                  <span className="text-muted-foreground/50">/</span>
                )}
                <span className="text-muted-foreground">
                  {formatHoursCompact(stageStats.plannedHours)}
                </span>
              </div>
            )}

            {/* Status chip */}
            {stage.status.name && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium shrink-0"
                style={{
                  backgroundColor: stage.status.color
                    ? `${stage.status.color}1A`
                    : undefined,
                  borderColor: stage.status.color
                    ? `${stage.status.color}59`
                    : '#d1d5db',
                  color: stage.status.color || '#6b7280',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: stage.status.color || '#6b7280' }}
                />
                {stage.status.name}
              </span>
            )}

            {/* Dates */}
            {(stage.startDate || stage.finishDate) && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatStageDate(stage.startDate)} — {formatStageDate(stage.finishDate)}
              </span>
            )}
          </div>
        </div>

        {/* Timeline area - разделён на две зоны */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />

          {/* Фоновая заливка периода */}
          <PeriodBackground
            startDate={stage.startDate}
            endDate={stage.finishDate}
            range={range}
            color={stage.status.color}
          />

          {/* Верхняя зона: Загрузки сотрудников */}
          <div
            className="absolute left-0 right-0 top-0 overflow-hidden"
            style={{ height: loadingsZoneHeight }}
          >
            {stageLoadings.length > 0 && (
              <LoadingBars
                loadings={stageLoadings}
                range={range}
                timelineWidth={timelineWidth}
              />
            )}
          </div>

          {/* Нижняя зона: Столбики готовности */}
          <div
            className="absolute left-0 right-0 bottom-0 overflow-hidden"
            style={{ height: readinessZoneHeight }}
          >
            {stageReadiness && stageReadiness.length > 0 && (
              <ActualReadinessBars
                snapshots={stageReadiness}
                range={range}
                timelineWidth={timelineWidth}
                rowHeight={readinessZoneHeight}
              />
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {isExpanded && stage.items.map((item) => (
        <DecompositionItemRow
          key={item.id}
          item={item}
          dayCells={dayCells}
          range={range}
          workLogs={workLogs}
        />
      ))}
    </>
  )
}

// ============================================================================
// Period Background (фоновая заливка периода)
// ============================================================================

interface PeriodBackgroundProps {
  startDate: string | null
  endDate: string | null
  range: TimelineRange
  color?: string | null
}

/**
 * Фоновая заливка периода с вертикальными линиями по краям
 * Используется для разделов и этапов декомпозиции
 */
function PeriodBackground({ startDate, endDate, range, color }: PeriodBackgroundProps) {
  const position = calculateBarPosition(startDate, endDate, range)

  if (!position) return null

  // Цвет с низкой прозрачностью для фона
  const bgColor = color || '#3b82f6'

  return (
    <div
      className="absolute inset-y-0 pointer-events-none"
      style={{
        left: position.left,
        width: position.width,
        backgroundColor: `${bgColor}15`, // 8% opacity
        borderLeft: `2px solid ${bgColor}40`,
        borderRight: `2px solid ${bgColor}40`,
      }}
    />
  )
}

// ============================================================================
// Section Row (Двухстрочный layout)
// ============================================================================

interface SectionRowProps {
  section: Section
  dayCells: DayCell[]
  range: TimelineRange
}

function SectionRow({ section, dayCells, range }: SectionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = section.decompositionStages.length > 0

  // Lazy load work logs при развороте раздела
  const { data: workLogs, isLoading: workLogsLoading } = useWorkLogs(section.id, {
    enabled: isExpanded, // Загружаем только когда раздел развёрнут
  })

  // Lazy load loadings при развороте раздела
  const { data: loadings, isLoading: loadingsLoading } = useLoadings(section.id, {
    enabled: isExpanded, // Загружаем только когда раздел развёрнут
  })

  // Lazy load stage readiness при развороте раздела
  const { data: stageReadinessMap, isLoading: readinessLoading } = useStageReadiness(section.id, {
    enabled: isExpanded, // Загружаем только когда раздел развёрнут
  })

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 3

  // Инициалы для fallback аватара
  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0)?.toUpperCase() || ''
    const last = lastName?.charAt(0)?.toUpperCase() || ''
    return first + last || '?'
  }

  // Форматирование даты в ДД.ММ
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    try {
      return format(parseISO(dateStr), 'dd.MM')
    } catch {
      return '—'
    }
  }

  return (
    <>
      <div
        className="flex border-b border-border/50 hover:bg-muted/30 transition-colors"
        style={{ height: SECTION_ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left при горизонтальном скролле */}
        <div
          className={cn(
            'flex flex-col justify-center gap-0.5 shrink-0 border-r border-border px-2',
            'sticky left-0 z-10 bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Первая строка: Expand + Avatar + Name */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Expand/Collapse */}
            {hasChildren ? (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
              >
                <ChevronRight
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-90'
                  )}
                />
              </button>
            ) : (
              <div className="w-5 shrink-0" />
            )}

            {/* Avatar вместо иконки */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="w-5 h-5 shrink-0">
                    {section.responsible.avatarUrl ? (
                      <AvatarImage
                        src={section.responsible.avatarUrl}
                        alt={section.responsible.name || 'Ответственный'}
                      />
                    ) : null}
                    <AvatarFallback className="text-[9px] bg-muted">
                      {getInitials(
                        section.responsible.firstName,
                        section.responsible.lastName
                      )}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {section.responsible.name || 'Ответственный не указан'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Section Name */}
            <span className="text-sm font-medium truncate min-w-0" title={section.name}>
              {section.name}
            </span>
          </div>

          {/* Вторая строка: Status chip + Dates */}
          <div className="flex items-center gap-2 pl-[26px]">
            {/* Status chip - outlined style like in projects module */}
            {section.status.name && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium shrink-0"
                style={{
                  backgroundColor: section.status.color
                    ? `${section.status.color}1A` // 10% opacity
                    : undefined,
                  borderColor: section.status.color
                    ? `${section.status.color}59` // 35% opacity
                    : '#d1d5db',
                  color: section.status.color || '#6b7280',
                }}
                title={section.status.name}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: section.status.color || '#6b7280' }}
                />
                {section.status.name}
              </span>
            )}

            {/* Dates */}
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(section.startDate)} — {formatDate(section.endDate)}
            </span>
          </div>
        </div>

        {/* Timeline area - fixed width */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
          {/* Рамка периода раздела (прямоугольник) */}
          <SectionPeriodFrame
            startDate={section.startDate}
            endDate={section.endDate}
            range={range}
            color={section.status.color}
          />
          {/* Заливка плановой готовности с процентами */}
          {section.readinessCheckpoints.length > 0 && (
            <PlannedReadinessArea
              checkpoints={section.readinessCheckpoints}
              range={range}
              timelineWidth={timelineWidth}
            />
          )}
          {/* Заливка фактической готовности (синяя) */}
          {section.actualReadiness.length > 0 && (
            <ActualReadinessArea
              snapshots={section.actualReadiness}
              range={range}
              timelineWidth={timelineWidth}
            />
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && (
        <>
          {/* Индикатор загрузки данных */}
          {(workLogsLoading || loadingsLoading || readinessLoading) && (
            <div
              className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground border-b border-border/50"
              style={{ paddingLeft: 8 + (depth + 1) * 16 }}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Загрузка данных...
            </div>
          )}
          {section.decompositionStages.map((stage) => (
            <DecompositionStageRow
              key={stage.id}
              stage={stage}
              dayCells={dayCells}
              range={range}
              workLogs={workLogs}
              loadings={loadings}
              stageReadiness={stageReadinessMap?.[stage.id]}
            />
          ))}
        </>
      )}
    </>
  )
}

// ============================================================================
// Object Row
// ============================================================================

interface ObjectRowProps {
  object: ProjectObject
  dayCells: DayCell[]
  range: TimelineRange
}

function ObjectRow({ object, dayCells, range }: ObjectRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = object.sections.length > 0

  return (
    <BaseRow
      depth={2}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<Box className="w-4 h-4" />}
      label={object.name}
      dayCells={dayCells}
      range={range}
    >
      {object.sections.map((section) => (
        <SectionRow
          key={section.id}
          section={section}
          dayCells={dayCells}
          range={range}
        />
      ))}
    </BaseRow>
  )
}

// ============================================================================
// Stage Row
// ============================================================================

interface StageRowProps {
  stage: Stage
  dayCells: DayCell[]
  range: TimelineRange
}

function StageRow({ stage, dayCells, range }: StageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = stage.objects.length > 0

  return (
    <BaseRow
      depth={1}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<Layers className="w-4 h-4" />}
      label={stage.name}
      dayCells={dayCells}
      range={range}
    >
      {stage.objects.map((obj) => (
        <ObjectRow
          key={obj.id}
          object={obj}
          dayCells={dayCells}
          range={range}
        />
      ))}
    </BaseRow>
  )
}

// ============================================================================
// Project Row (Top Level)
// ============================================================================

interface ProjectRowProps {
  project: Project
  dayCells: DayCell[]
  range: TimelineRange
}

export function ProjectRow({ project, dayCells, range }: ProjectRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = project.stages.length > 0

  return (
    <BaseRow
      depth={0}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<FolderKanban className="w-4 h-4" />}
      label={project.name}
      dayCells={dayCells}
      range={range}
    >
      {project.stages.map((stage) => (
        <StageRow
          key={stage.id}
          stage={stage}
          dayCells={dayCells}
          range={range}
        />
      ))}
    </BaseRow>
  )
}
