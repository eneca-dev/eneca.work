'use client'

import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { formatMinskDate, getTodayMinsk } from '@/lib/timezone-utils'
import {
  ChevronRight,
  FolderKanban,
  Layers,
  Box,
  ListTodo,
  Calendar,
  Loader2,
  Plus,
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
import { StageReadinessArea, calculateTodayDelta } from './StageReadinessArea'
import { WorkLogMarkers } from './WorkLogMarkers'
import { LoadingBadges } from './LoadingBadges'
import { LoadingBars, calculateLoadingsRowHeight } from './LoadingBars'
import { SectionPeriodFrame } from './SectionPeriodFrame'
import { PlannedReadinessArea } from './PlannedReadinessArea'
import { ActualReadinessArea } from './ActualReadinessArea'
import { BudgetSpendingArea } from './BudgetSpendingArea'
import { BudgetsRow } from './BudgetsRow'
import { SectionTooltipOverlay } from './SectionTooltipOverlay'
import { ProjectReportsRow } from '@/modules/project-reports'
import {
  useWorkLogs,
  useLoadings,
  useStageReadiness,
  useSectionBudgets,
  useUpdateLoadingDates,
  useUpdateStageDates,
  useUpdateSectionDates,
  useTimelineResize,
} from '../../hooks'
import dynamic from 'next/dynamic'
import { WorkLogCreateModal, ProgressUpdateDialog, CheckpointCreateModal } from '@/modules/modals'
import { useCheckpoints, CheckpointMarkers } from '@/modules/checkpoints'

// Dynamic import to avoid circular dependency during build
const SectionModal = dynamic(
  () => import('@/modules/modals/components/section/SectionModal').then(mod => mod.SectionModal),
  { ssr: false }
)
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
      {/* Фоновые подсветки */}
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
              cell.isToday && 'bg-primary/20',
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
      {/* Вертикальные линии разделителей */}
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
          'flex border-b border-border/50',
          depth === 0 && 'bg-muted/20'
        )}
        style={{ height, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left при горизонтальном скролле */}
        <div
          className={cn(
            'flex items-center gap-1 shrink-0 border-r border-border px-2',
            'sticky left-0 z-20',
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

  // При 100% показываем маленькую прозрачную галочку
  if (isComplete) {
    const completedSize = size * 0.7 // Уменьшаем размер на 30%
    return (
      <div
        className="relative shrink-0 flex items-center justify-center rounded-full opacity-50 hover:opacity-80 transition-opacity"
        style={{
          width: completedSize,
          height: completedSize,
          backgroundColor: '#22c55e40', // green-500 с 25% opacity
          border: '1px solid #22c55e60',
        }}
      >
        <svg
          width={completedSize * 0.5}
          height={completedSize * 0.5}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#22c55e"
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
  /** ID раздела (для модалки создания отчёта) */
  sectionId: string
  /** Название раздела (для модалки создания отчёта) */
  sectionName: string
  /** Callback для обновления данных после создания отчёта */
  onWorkLogCreated?: () => void
  /** Callback для обновления данных после изменения прогресса */
  onProgressUpdated?: () => void
}

function DecompositionItemRow({ item, dayCells, range, workLogs, sectionId, sectionName, onWorkLogCreated, onProgressUpdated }: DecompositionItemRowProps) {
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false)
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false)
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
        className="flex border-b border-border/50 group"
        style={{ height: ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left */}
        <div
          className="flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-20 bg-background"
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Spacer for alignment with parent rows */}
          <div className="w-5 shrink-0" />

          {/* Progress Circle - кликабельный для редактирования */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsProgressDialogOpen(true)}
                  className={cn(
                    'rounded-full transition-all shrink-0',
                    'hover:ring-2 hover:ring-primary/30 hover:scale-110',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50'
                  )}
                >
                  <ProgressCircle
                    progress={progress}
                    size={22}
                    strokeWidth={2.5}
                    color={item.status.color || undefined}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Готовность: {progress}% — нажмите для изменения
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

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

          {/* Кнопка добавления отчёта */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsWorkLogModalOpen(true)}
                  className={cn(
                    'p-0.5 rounded transition-all',
                    'text-muted-foreground/50 hover:text-green-500 hover:bg-green-500/10',
                    'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Добавить отчёт
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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

      {/* Модалка создания отчёта */}
      <WorkLogCreateModal
        isOpen={isWorkLogModalOpen}
        onClose={() => setIsWorkLogModalOpen(false)}
        sectionId={sectionId}
        sectionName={sectionName}
        defaultItemId={item.id}
        onSuccess={onWorkLogCreated}
      />

      {/* Диалог редактирования готовности */}
      <ProgressUpdateDialog
        isOpen={isProgressDialogOpen}
        onClose={() => setIsProgressDialogOpen(false)}
        itemId={item.id}
        itemName={label}
        currentProgress={progress}
        onSuccess={() => {
          setIsProgressDialogOpen(false)
          onProgressUpdated?.()
        }}
      />
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

/**
 * Компактный формат суммы бюджета (1234567 → 1.2M, 123456 → 123K)
 */
function formatBudgetAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M BYN`
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K BYN`
  }
  return `${Math.round(amount)} BYN`
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
  /** ID раздела (для модалки создания отчёта) */
  sectionId: string
  /** Название раздела (для модалки создания отчёта) */
  sectionName: string
  /** Callback для обновления данных после создания отчёта */
  onWorkLogCreated?: () => void
}

function DecompositionStageRow({ stage, dayCells, range, workLogs, loadings, stageReadiness, sectionId, sectionName, onWorkLogCreated }: DecompositionStageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = stage.items.length > 0
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 4

  // Mutation для обновления дат загрузки
  const updateLoadingDates = useUpdateLoadingDates()

  // Mutation для обновления дат этапа
  const updateStageDates = useUpdateStageDates()

  // Callback для resize загрузок
  const handleLoadingResize = (loadingId: string, startDate: string, finishDate: string) => {
    updateLoadingDates.mutate({
      loadingId,
      sectionId,
      startDate,
      finishDate,
    })
  }

  // Callback для resize этапа
  const handleStageResize = (newStartDate: string, newFinishDate: string) => {
    updateStageDates.mutate({
      stageId: stage.id,
      startDate: newStartDate,
      finishDate: newFinishDate,
    })
  }

  // Фильтруем loadings только для этого этапа (активные)
  const stageLoadings = useMemo(() => {
    return loadings?.filter(l => l.stageId === stage.id && l.status === 'active' && !l.isShortage) || []
  }, [loadings, stage.id])

  // Расчёт готовности этапа из задач (взвешенное среднее по часам)
  const stageStats = useMemo(() => {
    return calculateStageReadiness(stage.items, workLogs)
  }, [stage.items, workLogs])

  // Объединяем исторические снэпшоты с сегодняшним рассчитанным значением
  // Это позволяет графику обновляться при изменении прогресса задач
  const mergedStageReadiness = useMemo(() => {
    const today = formatMinskDate(getTodayMinsk())

    // Если нет данных для расчёта — возвращаем исторические как есть
    if (!stageStats.hasData) {
      return stageReadiness || []
    }

    // Фильтруем исторические данные (убираем сегодня, если есть)
    const historical = (stageReadiness || []).filter(p => p.date !== today)

    // Добавляем сегодняшнее значение из актуального расчёта
    return [
      ...historical,
      { date: today, value: stageStats.readiness }
    ]
  }, [stageReadiness, stageStats.hasData, stageStats.readiness])

  // Прирост за сегодня (относительно вчера)
  const todayDelta = useMemo(() => {
    return calculateTodayDelta(mergedStageReadiness)
  }, [mergedStageReadiness])

  // Определяем завершённость этапа (100% готовность или статус "завершён")
  const isCompleted = stageStats.readiness >= 100 ||
    stage.status.name?.toLowerCase().includes('заверш') ||
    stage.status.name?.toLowerCase().includes('готов')

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
        className={cn(
          'flex border-b border-border/50',
          // Завершённые этапы — полупрозрачные и серые
          isCompleted && 'opacity-50 grayscale-[30%]'
        )}
        style={{ height: rowHeight, minWidth: totalWidth }}
      >
        {/* Sidebar - двухстрочный layout */}
        <div
          className={cn(
            'flex flex-col justify-center gap-0.5 shrink-0 border-r border-border px-2',
            'sticky left-0 z-20 bg-background'
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
            {/* Progress Circle + Delta */}
            {stageStats.hasData && (
              <div className="flex items-center gap-1">
                <ProgressCircle
                  progress={stageStats.readiness}
                  size={18}
                  strokeWidth={2}
                  color={stage.status.color || undefined}
                />
                {/* Прирост за сегодня */}
                {todayDelta !== null && todayDelta !== 0 && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`text-[9px] font-medium tabular-nums ${
                            todayDelta > 0 ? 'text-emerald-500' : 'text-red-400'
                          }`}
                        >
                          {todayDelta > 0 ? '+' : ''}{Math.round(todayDelta)}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Прирост за сегодня
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
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

          {/* Фоновая заливка периода (с поддержкой resize) */}
          <PeriodBackground
            startDate={stage.startDate}
            endDate={stage.finishDate}
            range={range}
            color={stage.status.color}
            onResize={handleStageResize}
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
                sectionId={sectionId}
                onLoadingResize={handleLoadingResize}
              />
            )}
          </div>

          {/* Нижняя зона: График готовности (area chart) */}
          <div
            className="absolute left-0 right-0 bottom-0 overflow-hidden"
            style={{ height: readinessZoneHeight }}
          >
            {mergedStageReadiness.length > 0 && (
              <StageReadinessArea
                snapshots={mergedStageReadiness}
                range={range}
                timelineWidth={timelineWidth}
                rowHeight={readinessZoneHeight}
                color={stage.status.color || '#3b82f6'}
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
          sectionId={sectionId}
          sectionName={sectionName}
          onWorkLogCreated={onWorkLogCreated}
          onProgressUpdated={onWorkLogCreated} // Тот же callback — обновляет данные графика
        />
      ))}
    </>
  )
}

// ============================================================================
// Period Background (фоновая заливка периода с поддержкой resize)
// ============================================================================

interface PeriodBackgroundProps {
  startDate: string | null
  endDate: string | null
  range: TimelineRange
  color?: string | null
  /** Callback для resize (если передан — включается drag-to-resize) */
  onResize?: (newStartDate: string, newEndDate: string) => void
}

// Константа для ширины resize handle
const PERIOD_RESIZE_HANDLE_WIDTH = 8

/**
 * Фоновая заливка периода с вертикальными линиями по краям
 * Используется для разделов и этапов декомпозиции
 * Поддерживает drag-to-resize если передан onResize callback
 */
function PeriodBackground({ startDate, endDate, range, color, onResize }: PeriodBackgroundProps) {
  const position = calculateBarPosition(startDate, endDate, range)

  if (!position) return null

  // Если есть onResize и даты валидны — рендерим resizable версию
  if (onResize && startDate && endDate) {
    return (
      <ResizablePeriodBackground
        startDate={startDate}
        endDate={endDate}
        range={range}
        color={color}
        onResize={onResize}
        position={position}
      />
    )
  }

  // Иначе — обычная статичная версия
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

/**
 * Resizable версия PeriodBackground
 * Выделена в отдельный компонент чтобы хук вызывался безусловно
 */
function ResizablePeriodBackground({
  startDate,
  endDate,
  range,
  color,
  onResize,
  position,
}: {
  startDate: string
  endDate: string
  range: TimelineRange
  color?: string | null
  onResize: (newStartDate: string, newEndDate: string) => void
  position: { left: number; width: number }
}) {
  const {
    leftHandleProps,
    rightHandleProps,
    isResizing,
    previewPosition,
  } = useTimelineResize({
    startDate,
    endDate,
    range,
    onResize,
    minDays: 1,
  })

  // Используем preview позицию пока она есть (даже после окончания drag, пока ждём обновления props)
  const displayPosition = previewPosition ?? position

  // Цвет с низкой прозрачностью для фона
  const bgColor = color || '#3b82f6'

  return (
    <div
      className={`absolute inset-y-0 ${isResizing ? 'z-40' : ''}`}
      style={{
        left: displayPosition.left,
        width: displayPosition.width,
        backgroundColor: isResizing ? `${bgColor}25` : `${bgColor}15`,
        borderLeft: `2px solid ${isResizing ? bgColor : `${bgColor}40`}`,
        borderRight: `2px solid ${isResizing ? bgColor : `${bgColor}40`}`,
      }}
    >
      {/* Left resize handle */}
      <div
        {...leftHandleProps}
        className="absolute top-0 bottom-0 hover:bg-white/10 transition-colors cursor-ew-resize group"
        style={{
          left: -PERIOD_RESIZE_HANDLE_WIDTH / 2,
          width: PERIOD_RESIZE_HANDLE_WIDTH,
          zIndex: 10,
        }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-white/0 group-hover:bg-white/30 transition-colors"
        />
      </div>

      {/* Right resize handle */}
      <div
        {...rightHandleProps}
        className="absolute top-0 bottom-0 hover:bg-white/10 transition-colors cursor-ew-resize group"
        style={{
          right: -PERIOD_RESIZE_HANDLE_WIDTH / 2,
          width: PERIOD_RESIZE_HANDLE_WIDTH,
          zIndex: 10,
        }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-white/0 group-hover:bg-white/30 transition-colors"
        />
      </div>
    </div>
  )
}

// ============================================================================
// Section Row (Двухстрочный layout)
// ============================================================================

interface SectionRowProps {
  section: Section
  dayCells: DayCell[]
  range: TimelineRange
  /** Объект развёрнут - начинаем загрузку данных */
  isObjectExpanded: boolean
}

function SectionRow({ section, dayCells, range, isObjectExpanded }: SectionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false)
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false)
  const hasChildren = section.decompositionStages.length > 0

  // Lazy load work logs при развороте объекта (не раздела!)
  const { data: workLogs, isLoading: workLogsLoading, refetch: refetchWorkLogs } = useWorkLogs(section.id, {
    enabled: isObjectExpanded, // Загружаем когда объект развёрнут
  })

  // Lazy load checkpoints при развороте объекта
  const { data: checkpoints = [], refetch: refetchCheckpoints } = useCheckpoints(
    isObjectExpanded ? { sectionId: section.id } : undefined
  )

  // Lazy load loadings при развороте объекта
  const { data: loadings, isLoading: loadingsLoading } = useLoadings(section.id, {
    enabled: isObjectExpanded, // Загружаем когда объект развёрнут
  })

  // Lazy load stage readiness при развороте объекта
  const { data: stageReadinessMap, isLoading: readinessLoading } = useStageReadiness(section.id, {
    enabled: isObjectExpanded, // Загружаем когда объект развёрнут
  })

  // Lazy load budgets при развороте объекта
  const { data: budgets, isLoading: budgetsLoading, refetch: refetchBudgets } = useSectionBudgets(
    'section',
    isObjectExpanded ? section.id : undefined // Загружаем только когда объект развёрнут
  )

  // Mutation для обновления дат раздела
  const updateSectionDates = useUpdateSectionDates()

  // Callback для resize раздела
  const handleSectionResize = (newStartDate: string, newEndDate: string) => {
    updateSectionDates.mutate({
      sectionId: section.id,
      startDate: newStartDate,
      endDate: newEndDate,
    })
  }

  // Расчёт сегодняшней готовности секции из всех задач всех этапов
  const sectionTodayReadiness = useMemo(() => {
    let totalWeightedProgress = 0
    let totalPlannedHours = 0

    for (const stage of section.decompositionStages) {
      for (const item of stage.items) {
        if (item.plannedHours > 0) {
          const progress = item.progress ?? 0
          totalWeightedProgress += progress * item.plannedHours
          totalPlannedHours += item.plannedHours
        }
      }
    }

    if (totalPlannedHours === 0) return null

    return Math.round(totalWeightedProgress / totalPlannedHours)
  }, [section.decompositionStages])

  // Объединяем исторические снэпшоты секции с сегодняшним расчётом
  const mergedSectionReadiness = useMemo(() => {
    const today = formatMinskDate(getTodayMinsk())

    // Если нет данных для расчёта — возвращаем исторические как есть
    if (sectionTodayReadiness === null) {
      return section.actualReadiness
    }

    // Фильтруем исторические данные (убираем сегодня, если есть)
    const historical = section.actualReadiness.filter(p => p.date !== today)

    // Добавляем сегодняшнее значение из актуального расчёта
    return [
      ...historical,
      { date: today, value: sectionTodayReadiness }
    ]
  }, [section.actualReadiness, sectionTodayReadiness])

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

  // Сегодняшние показатели для sidebar
  const todayIndicators = useMemo(() => {
    const today = getTodayMinsk()
    const todayStr = formatMinskDate(today)

    // Проверяем, находится ли сегодня в периоде раздела
    let isTodayInSection = false
    if (section.startDate && section.endDate) {
      try {
        const start = parseISO(section.startDate)
        const end = parseISO(section.endDate)
        isTodayInSection = today >= start && today <= end
      } catch {
        isTodayInSection = false
      }
    }

    if (!isTodayInSection) return null

    // План: интерполируем между чекпоинтами
    let planned: number | null = null
    if (section.readinessCheckpoints.length > 0) {
      const sorted = [...section.readinessCheckpoints].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      const firstDate = parseISO(sorted[0].date)
      const lastDate = parseISO(sorted[sorted.length - 1].date)

      if (today >= firstDate && today <= lastDate) {
        // Ищем интервал для интерполяции
        for (let i = 0; i < sorted.length - 1; i++) {
          const left = sorted[i]
          const right = sorted[i + 1]
          const leftDate = parseISO(left.date)
          const rightDate = parseISO(right.date)

          if (today >= leftDate && today <= rightDate) {
            const totalDays = Math.max(1, (rightDate.getTime() - leftDate.getTime()) / (1000 * 60 * 60 * 24))
            const daysFromLeft = (today.getTime() - leftDate.getTime()) / (1000 * 60 * 60 * 24)
            planned = left.value + (right.value - left.value) * (daysFromLeft / totalDays)
            break
          }
        }
      } else if (today > lastDate) {
        planned = sorted[sorted.length - 1].value
      }
    }

    // Факт: берём сегодняшнее значение из mergedSectionReadiness
    const todayActual = mergedSectionReadiness.find(s => s.date === todayStr)
    const actual = todayActual?.value ?? (mergedSectionReadiness.length > 0
      ? mergedSectionReadiness[mergedSectionReadiness.length - 1].value
      : null)

    // Бюджет: берём сегодняшнее значение
    const todayBudget = section.budgetSpending.find(s => s.date === todayStr)
    const budget = todayBudget?.percentage ?? (section.budgetSpending.length > 0
      ? section.budgetSpending[section.budgetSpending.length - 1].percentage
      : null)

    return { planned, actual, budget }
  }, [section.readinessCheckpoints, mergedSectionReadiness, section.budgetSpending, section.startDate, section.endDate])

  return (
    <>
      <div
        className="flex border-b border-border/50 group"
        style={{ height: SECTION_ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left при горизонтальном скролле */}
        <div
          className={cn(
            'flex flex-col justify-center gap-0.5 shrink-0 border-r border-border px-2',
            'sticky left-0 z-20 bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Первая строка: Expand + Checkpoint Button + Avatar + Name */}
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

            {/* Кнопка добавления чекпоинта (появляется при hover) */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsCheckpointModalOpen(true)
                    }}
                    className={cn(
                      'p-0.5 rounded transition-all shrink-0',
                      'text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10',
                      'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Добавить чекпоинт
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Avatar вместо иконки */}
            <TooltipProvider delayDuration={300}>
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

            {/* Section Name - кликабельное для открытия модалки */}
            <button
              className={cn(
                'text-sm font-medium truncate min-w-0 text-left',
                'hover:text-primary hover:underline underline-offset-2',
                'transition-colors cursor-pointer'
              )}
              title={`${section.name} — нажмите для просмотра`}
              onClick={(e) => {
                e.stopPropagation()
                setIsSectionModalOpen(true)
              }}
            >
              {section.name}
            </button>
          </div>

          {/* Вторая строка: Dates + Today indicators */}
          <div className="flex items-center gap-2 pl-[26px]">
            {/* Dates */}
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3" />
              {formatDate(section.startDate)} — {formatDate(section.endDate)}
            </span>

            {/* Сегодняшние показатели: План / Факт / Бюджет */}
            {todayIndicators && (
              <div className="flex items-center gap-1.5 ml-auto">
                {/* План (зелёный) */}
                {todayIndicators.planned !== null && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] font-medium tabular-nums text-emerald-500">
                          П:{Math.round(todayIndicators.planned)}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Плановая готовность на сегодня
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* Факт (синий) */}
                {todayIndicators.actual !== null && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] font-medium tabular-nums text-blue-500">
                          Ф:{Math.round(todayIndicators.actual)}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <div className="space-y-1">
                          <div>Фактическая готовность</div>
                          {todayIndicators.planned !== null && (
                            <div className={todayIndicators.actual >= todayIndicators.planned ? 'text-emerald-400' : 'text-amber-400'}>
                              {todayIndicators.actual >= todayIndicators.planned
                                ? `+${Math.round(todayIndicators.actual - todayIndicators.planned)}% к плану`
                                : `-${Math.round(todayIndicators.planned - todayIndicators.actual)}% от плана`
                              }
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* Бюджет (оранжевый/красный) */}
                {todayIndicators.budget !== null && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-[10px] font-medium tabular-nums"
                          style={{ color: todayIndicators.budget > 100 ? '#ef4444' : '#f97316' }}
                        >
                          Б:{Math.round(todayIndicators.budget)}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <div className="space-y-1">
                          <div>Освоение бюджета</div>
                          {todayIndicators.budget > 100 && (
                            <div className="text-red-400 font-medium">Превышение бюджета!</div>
                          )}
                          {todayIndicators.budget > 80 && todayIndicators.budget <= 100 && (
                            <div className="text-amber-400">Близко к лимиту</div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Timeline area - fixed width */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
          {/* Рамка периода раздела (прямоугольник с поддержкой resize) */}
          <SectionPeriodFrame
            startDate={section.startDate}
            endDate={section.endDate}
            range={range}
            color={section.status.color}
            onResize={handleSectionResize}
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
          {mergedSectionReadiness.length > 0 && (
            <ActualReadinessArea
              snapshots={mergedSectionReadiness}
              range={range}
              timelineWidth={timelineWidth}
            />
          )}
          {/* Заливка освоения бюджета */}
          {section.budgetSpending.length > 0 && (
            <BudgetSpendingArea
              spending={section.budgetSpending}
              range={range}
              timelineWidth={timelineWidth}
            />
          )}
          {/* Прозрачный слой с тултипами по дням */}
          <SectionTooltipOverlay
            plannedCheckpoints={section.readinessCheckpoints}
            actualSnapshots={mergedSectionReadiness}
            budgetSpending={section.budgetSpending}
            range={range}
            timelineWidth={timelineWidth}
            sectionStartDate={section.startDate}
            sectionEndDate={section.endDate}
          />
          {/* Маркеры чекпоинтов */}
          {checkpoints.length > 0 && (
            <CheckpointMarkers
              checkpoints={checkpoints}
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
          {(workLogsLoading || loadingsLoading || readinessLoading || budgetsLoading) && (
            <div
              className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground border-b border-border/50"
              style={{ paddingLeft: 8 + (depth + 1) * 16 }}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Загрузка данных...
            </div>
          )}
          {/* Строка бюджетов (свёрнутая по умолчанию, над этапами) */}
          <BudgetsRow
            sectionId={section.id}
            sectionName={section.name}
            dayCells={dayCells}
            depth={depth + 1}
            range={range}
            sectionStartDate={section.startDate}
            sectionEndDate={section.endDate}
            budgets={budgets}
            budgetsLoading={budgetsLoading}
            onRefetch={refetchBudgets}
          />
          {section.decompositionStages.map((stage) => (
            <DecompositionStageRow
              key={stage.id}
              stage={stage}
              dayCells={dayCells}
              range={range}
              workLogs={workLogs}
              loadings={loadings}
              stageReadiness={stageReadinessMap?.[stage.id]}
              sectionId={section.id}
              sectionName={section.name}
              onWorkLogCreated={() => refetchWorkLogs()}
            />
          ))}
        </>
      )}

      {/* Section Modal */}
      <SectionModal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        section={section}
        sectionId={section.id}
        onSuccess={() => {
          // Invalidate section data after update
          refetchWorkLogs()
        }}
      />

      {/* Checkpoint Create Modal */}
      <CheckpointCreateModal
        isOpen={isCheckpointModalOpen}
        onClose={() => setIsCheckpointModalOpen(false)}
        sectionId={section.id}
        sectionName={section.name}
        onSuccess={() => {
          refetchCheckpoints()
        }}
      />
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
          isObjectExpanded={isExpanded}
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
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 1

  return (
    <BaseRow
      depth={depth}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<Layers className="w-4 h-4" />}
      label={stage.name}
      dayCells={dayCells}
      range={range}
    >
      {isExpanded && (
        <>
          {/* Stage Reports Row */}
          <ProjectReportsRow
            stageId={stage.id}
            stageName={stage.name}
            dayCells={dayCells}
            depth={depth + 1}
            range={range}
            stageStartDate={stage.startDate}
            stageEndDate={stage.finishDate}
          />

          {/* Objects */}
          {stage.objects.map((obj) => (
            <ObjectRow
              key={obj.id}
              object={obj}
              dayCells={dayCells}
              range={range}
            />
          ))}
        </>
      )}
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
