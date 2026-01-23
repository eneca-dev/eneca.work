'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { parseMinskDate, formatMinskDate, getTodayMinsk } from '@/lib/timezone-utils'
import { ChevronRight, ListTodo, Plus, UserPlus, SquarePlus, Calendar, MapPin, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type {
  DecompositionStage,
  TimelineRange,
  WorkLog,
  Loading,
  ReadinessPoint,
  StageResponsible,
  BatchBudget,
  BudgetSpendingPoint,
} from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { TimelineGrid, ProgressCircle, PeriodBackground } from '../shared'
import { LoadingBars, calculateLoadingsRowHeight, LOADING_DRAG_TYPE, type LoadingDragData } from '../LoadingBars'
import { LoadingModal, TaskCreateModal } from '@/modules/modals'
import { StageReadinessArea, calculateTodayDelta } from '../StageReadinessArea'
import { StageExpandedFrame } from '../StageExpandedFrame'
import { BudgetSpendingArea } from '../BudgetSpendingArea'
import { DecompositionItemRow } from './DecompositionItemRow'
import { calculateStageReadiness } from './calculations'
import {
  useUpdateLoadingDates,
  useUpdateStageDates,
  useUpdateLoading,
} from '../../../hooks'
import { STAGE_ROW_HEIGHT, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../../constants'

// Dynamic import for StageModal
const StageModal = dynamic(
  () => import('@/modules/modals/components/stage/StageModal').then(mod => mod.StageModal),
  { ssr: false }
)

// ============================================================================
// Decomposition Stage Row
// ============================================================================

interface DecompositionStageRowProps {
  stage: DecompositionStage
  dayCells: DayCell[]
  range: TimelineRange
  /** Work logs for this section */
  workLogs?: WorkLog[]
  /** Loadings (employee assignments) for this section */
  loadings?: Loading[]
  /** Readiness snapshots for this stage */
  stageReadiness?: ReadinessPoint[]
  /** Responsibles for this stage */
  responsibles?: StageResponsible[]
  /** Section ID (for work log modal) */
  sectionId: string
  /** Section name (for work log modal) */
  sectionName: string
  /** Бюджет раздела (для отображения в sidebar) */
  sectionBudget?: BatchBudget | null
  /** История расхода бюджета раздела (для графика) */
  sectionBudgetSpending?: BudgetSpendingPoint[]
  /** Callback after work log created */
  onWorkLogCreated?: () => void
}

/**
 * Decomposition stage row - two-line layout with loadings and readiness
 */
export function DecompositionStageRow({
  stage,
  dayCells,
  range,
  workLogs,
  loadings,
  stageReadiness,
  responsibles,
  sectionId,
  sectionName,
  sectionBudget,
  sectionBudgetSpending,
  onWorkLogCreated,
}: DecompositionStageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isStageModalOpen, setIsStageModalOpen] = useState(false)
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const hasChildren = stage.items.length > 0
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 3

  // Mutation for updating loading dates
  const updateLoadingDates = useUpdateLoadingDates()

  // Mutation for updating stage dates
  const updateStageDates = useUpdateStageDates()

  // Mutation for moving loading to this stage
  const updateLoading = useUpdateLoading()

  // Callback for loading resize
  const handleLoadingResize = (loadingId: string, startDate: string, finishDate: string) => {
    updateLoadingDates.mutate({
      loadingId,
      sectionId,
      startDate,
      finishDate,
    })
  }

  // Callback for stage resize
  const handleStageResize = (newStartDate: string, newFinishDate: string) => {
    updateStageDates.mutate({
      stageId: stage.id,
      startDate: newStartDate,
      finishDate: newFinishDate,
    })
  }

  // Drag-and-drop handlers for loading movement between stages
  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Only accept loading drag type
    if (!e.dataTransfer.types.includes(LOADING_DRAG_TYPE)) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(LOADING_DRAG_TYPE)) return
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only trigger if leaving the row entirely (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null
    const currentTarget = e.currentTarget as HTMLElement
    if (relatedTarget && currentTarget.contains(relatedTarget)) return

    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const rawData = e.dataTransfer.getData(LOADING_DRAG_TYPE)
    if (!rawData) return

    try {
      const dragData: LoadingDragData = JSON.parse(rawData)

      // Don't move to the same stage
      if (dragData.currentStageId === stage.id) return

      // Don't move loadings from a different section
      if (dragData.sectionId !== sectionId) return

      // Move loading to this stage
      updateLoading.mutate({
        loadingId: dragData.loadingId,
        sectionId: dragData.sectionId,
        updates: { stageId: stage.id },
      })
    } catch {
      // Invalid JSON - ignore
    }
  }, [stage.id, sectionId, updateLoading])

  // Filter loadings for this stage only (active)
  const stageLoadings = useMemo(() => {
    return loadings?.filter(l => l.stageId === stage.id && l.status === 'active' && !l.isShortage) || []
  }, [loadings, stage.id])

  // Stage responsibles from props
  const stageResponsibles = responsibles || []

  // Calculate stage readiness from tasks (weighted average by hours)
  const stageStats = useMemo(() => {
    return calculateStageReadiness(stage.items, workLogs)
  }, [stage.items, workLogs])

  // Merge historical snapshots with today's calculated value
  const mergedStageReadiness = useMemo(() => {
    const today = formatMinskDate(getTodayMinsk())

    // If no data for calculation — return historical as is
    if (!stageStats.hasData) {
      return stageReadiness || []
    }

    // Filter historical data (remove today if present)
    const historical = (stageReadiness || []).filter(p => p.date !== today)

    // Add today's value from actual calculation
    return [
      ...historical,
      { date: today, value: stageStats.readiness }
    ]
  }, [stageReadiness, stageStats.hasData, stageStats.readiness])

  // Today's delta (relative to yesterday)
  const todayDelta = useMemo(() => {
    return calculateTodayDelta(mergedStageReadiness)
  }, [mergedStageReadiness])

  // Filter budget spending to stage period
  const stageBudgetSpending = useMemo(() => {
    if (!sectionBudgetSpending || sectionBudgetSpending.length === 0) return []
    if (!stage.startDate || !stage.finishDate) return []

    const stageStart = parseMinskDate(stage.startDate)
    const stageEnd = parseMinskDate(stage.finishDate)

    return sectionBudgetSpending.filter(point => {
      const pointDate = parseMinskDate(point.date)
      return pointDate >= stageStart && pointDate <= stageEnd
    })
  }, [sectionBudgetSpending, stage.startDate, stage.finishDate])

  // Format budget amount with thousand separators
  const formatBudgetAmount = (amount: number): string => {
    return amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
  }

  // Format date to DD.MM
  const formatStageDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    try {
      return format(parseMinskDate(dateStr), 'dd.MM')
    } catch {
      return '—'
    }
  }

  // Zone heights in timeline (adaptive to loadings count)
  const readinessZoneHeight = 32 // fixed bottom zone for readiness
  const sidebarMinHeight = 48 // minimum height for two-line sidebar
  // Loadings: use calculateLoadingsRowHeight to compute needed height
  const loadingsZoneHeight = calculateLoadingsRowHeight(stageLoadings.length, 28)
  // Total height = max(base, loadings + readiness, sidebar)
  const rowHeight = Math.max(STAGE_ROW_HEIGHT, loadingsZoneHeight + readinessZoneHeight, sidebarMinHeight)

  return (
    <>
      <div
        className={cn(
          'flex border-b border-border/50 group',
          isDragOver && 'bg-primary/10 ring-2 ring-primary/30 ring-inset'
        )}
        style={{ height: rowHeight, minWidth: totalWidth }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Sidebar - compact two-line layout */}
        <div
          className={cn(
            'flex flex-col justify-center gap-1 shrink-0 border-r border-border px-2 relative',
            'sticky left-0 z-40 bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Create loading button - positioned at right edge of sidebar */}
          <button
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-1 hover:bg-muted rounded-r text-[9px] text-muted-foreground hover:text-foreground bg-background border-r border-t border-b border-border"
            onClick={(e) => {
              e.stopPropagation()
              setIsLoadingModalOpen(true)
            }}
          >
            <UserPlus className="w-3 h-3" />
            <span>Загрузка</span>
          </button>
          {/* First row: Expand + Icon + Name + Create loading button */}
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

            {/* Stage Name - clickable to open StageModal */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'text-sm font-medium truncate min-w-0 text-left flex-1',
                      'hover:text-primary transition-colors cursor-pointer'
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsStageModalOpen(true)
                    }}
                  >
                    {stage.name}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[300px]">
                  <div className="space-y-1">
                    <div className="font-medium">{stage.name}</div>
                    <div className="text-muted-foreground">
                      {formatStageDate(stage.startDate)} — {formatStageDate(stage.finishDate)}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Second row: Progress + Status + Avatars + Task count + Create task button */}
          <div className="flex items-center gap-2 pl-[26px]">
            {/* Progress Circle */}
            {stageStats.hasData ? (
              <ProgressCircle
                progress={stageStats.readiness}
                size={18}
                strokeWidth={2}
              />
            ) : (
              <div className="w-[18px] h-[18px] rounded-full bg-muted/30" />
            )}

            {/* Delta (if any) */}
            {todayDelta !== null && todayDelta !== 0 && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        'text-[9px] font-medium tabular-nums',
                        todayDelta > 0 ? 'text-emerald-500' : 'text-red-400'
                      )}
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

            {/* Dates display or "Разместить" button */}
            {stage.startDate && stage.finishDate ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                <Calendar className="w-3 h-3" />
                {formatStageDate(stage.startDate)} — {formatStageDate(stage.finishDate)}
              </span>
            ) : (
              <button
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/50 text-[9px] text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsStageModalOpen(true)
                }}
              >
                <MapPin className="w-3 h-3" />
                Разместить
              </button>
            )}

            {/* Budget indicator */}
            {sectionBudget && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[9px] text-amber-500 flex items-center gap-0.5 shrink-0">
                      <Wallet className="w-3 h-3" />
                      {formatBudgetAmount(sectionBudget.planned_amount)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div className="space-y-1">
                      <div className="font-medium">{sectionBudget.name}</div>
                      <div>Бюджет: {sectionBudget.planned_amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BYN</div>
                      <div>Освоено: {sectionBudget.spent_amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BYN ({Math.round(sectionBudget.spent_percentage)}%)</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Responsibles avatars */}
            {stageResponsibles.length > 0 && (
              <div className="flex items-center -space-x-1.5 shrink-0">
                {stageResponsibles.slice(0, 3).map((emp) => (
                  <TooltipProvider key={emp.id} delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="w-5 h-5 border border-background">
                          {emp.avatarUrl ? (
                            <AvatarImage src={emp.avatarUrl} alt={`${emp.firstName} ${emp.lastName}`} />
                          ) : null}
                          <AvatarFallback className="text-[8px] bg-muted">
                            {(emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {emp.firstName} {emp.lastName}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
                {stageResponsibles.length > 3 && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium border border-background">
                          +{stageResponsibles.length - 3}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {stageResponsibles.slice(3).map(e => `${e.firstName} ${e.lastName}`).join(', ')}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}

            {/* Create task button - visible on hover */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsTaskModalOpen(true)
                    }}
                  >
                    <SquarePlus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Создать задачу
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Timeline area - split into two zones, isolate for z-index containment, overflow-hidden clips bleeding elements */}
        <div className="relative isolate overflow-hidden" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />

          {/* Period background (with resize support) */}
          <PeriodBackground
            startDate={stage.startDate}
            endDate={stage.finishDate}
            range={range}
            color="#64748b"
            onResize={handleStageResize}
          />

          {/* Expanded frame (covers tasks) */}
          <StageExpandedFrame
            startDate={stage.startDate}
            endDate={stage.finishDate}
            range={range}
            color="#64748b"
            itemsCount={stage.items.length}
            stageRowHeight={rowHeight}
            isExpanded={isExpanded}
          />

          {/* Upper zone: Employee loadings */}
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

          {/* Lower zone: Readiness + Budget graphs */}
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
                color="#64748b"
                stageStartDate={stage.startDate}
                stageEndDate={stage.finishDate}
              />
            )}
            {stageBudgetSpending.length > 0 && (
              <BudgetSpendingArea
                spending={stageBudgetSpending}
                range={range}
                timelineWidth={timelineWidth}
                rowHeight={readinessZoneHeight}
              />
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      <div
        className={cn(
          'transition-all duration-200 ease-in-out',
          isExpanded ? 'opacity-100 max-h-[10000px]' : 'opacity-0 max-h-0 overflow-hidden'
        )}
        style={{ minWidth: totalWidth }}
      >
        {stage.items.map((item) => (
          <DecompositionItemRow
            key={item.id}
            item={item}
            dayCells={dayCells}
            range={range}
            workLogs={workLogs}
            sectionId={sectionId}
            sectionName={sectionName}
            stageStartDate={stage.startDate}
            stageEndDate={stage.finishDate}
            onWorkLogCreated={onWorkLogCreated}
            onProgressUpdated={onWorkLogCreated} // Same callback — updates graph data
          />
        ))}
      </div>

      {/* StageModal for viewing and editing */}
      <StageModal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        stage={stage}
        stageId={stage.id}
        sectionId={sectionId}
        onSuccess={onWorkLogCreated}
      />

      {/* LoadingModal for creating new loading */}
      <LoadingModal
        mode="create"
        isOpen={isLoadingModalOpen}
        onClose={() => setIsLoadingModalOpen(false)}
        sectionId={sectionId}
        stageId={stage.id}
        defaultStartDate={stage.startDate || formatMinskDate(getTodayMinsk())}
        defaultEndDate={stage.finishDate || formatMinskDate(getTodayMinsk())}
        onSuccess={onWorkLogCreated}
      />

      {/* TaskCreateModal for creating new task */}
      <TaskCreateModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        sectionId={sectionId}
        stageId={stage.id}
        stageName={stage.name}
        onSuccess={onWorkLogCreated}
      />
    </>
  )
}
