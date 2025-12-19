'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { format, parseISO } from 'date-fns'
import { ChevronRight, ListTodo, Calendar, Plus } from 'lucide-react'
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
} from '../../../types'
import type { StageResponsible } from '../../../actions'
import type { DayCell } from '../TimelineHeader'
import { TimelineGrid, ProgressCircle, PeriodBackground } from '../shared'
import { LoadingBars, calculateLoadingsRowHeight, LOADING_DRAG_TYPE, type LoadingDragData } from '../LoadingBars'
import { LoadingModal } from '@/modules/modals'
import { StageReadinessArea, calculateTodayDelta } from '../StageReadinessArea'
import { StageExpandedFrame } from '../StageExpandedFrame'
import { DecompositionItemRow } from './DecompositionItemRow'
import { calculateStageReadiness } from './calculations'
import { formatHoursCompact } from '../../../utils'
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
  onWorkLogCreated,
}: DecompositionStageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isStageModalOpen, setIsStageModalOpen] = useState(false)
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isStageHovered, setIsStageHovered] = useState(false)
  const hasChildren = stage.items.length > 0
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 4

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
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

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

  // Format date to DD.MM
  const formatStageDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    try {
      return format(parseISO(dateStr), 'dd.MM')
    } catch {
      return '—'
    }
  }

  // Zone heights in timeline (adaptive to loadings count)
  const readinessZoneHeight = 32 // fixed bottom zone for readiness
  const sidebarMinHeight = 56 // minimum height for three-line sidebar
  // Loadings: use calculateLoadingsRowHeight to compute needed height
  const loadingsZoneHeight = calculateLoadingsRowHeight(stageLoadings.length, 28)
  // Total height = max(base, loadings + readiness, sidebar)
  const rowHeight = Math.max(STAGE_ROW_HEIGHT, loadingsZoneHeight + readinessZoneHeight, sidebarMinHeight)

  return (
    <>
      <div
        className={cn(
          'flex border-b border-border/50 hover:bg-muted/30 transition-colors group',
          isDragOver && 'bg-primary/10 ring-2 ring-primary/30 ring-inset'
        )}
        style={{ height: rowHeight, minWidth: totalWidth }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsStageHovered(true)}
        onMouseLeave={() => setIsStageHovered(false)}
      >
        {/* Sidebar - three-line layout */}
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
          {/* First row: Expand + Icon + Name */}
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
            <button
              className={cn(
                'text-sm font-medium truncate min-w-0 text-left',
                'hover:text-primary transition-colors cursor-pointer'
              )}
              title={`${stage.name} — нажмите для просмотра`}
              onClick={(e) => {
                e.stopPropagation()
                setIsStageModalOpen(true)
              }}
            >
              {stage.name}
            </button>

            {/* Task count badge (when collapsed) */}
            {!isExpanded && hasChildren && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 ml-1"
                      style={{
                        backgroundColor: '#64748b20',
                        color: '#64748b',
                        border: '1px solid #64748b40',
                      }}
                    >
                      {stage.items.length}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {stage.items.length} {stage.items.length === 1 ? 'задача' : stage.items.length < 5 ? 'задачи' : 'задач'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Second row: Progress + Hours + Avatars + Status */}
          <div className="flex items-center gap-2 pl-[26px]">
            {/* Progress Circle + Delta */}
            <div className="flex items-center gap-1 w-[40px] shrink-0">
              {stageStats.hasData ? (
                <>
                  <ProgressCircle
                    progress={stageStats.readiness}
                    size={18}
                    strokeWidth={2}
                  />
                  {todayDelta !== null && todayDelta !== 0 && (
                    <TooltipProvider delayDuration={200}>
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
                </>
              ) : (
                <div className="w-[18px] h-[18px]" />
              )}
            </div>

            {/* Hours: fact / plan */}
            <div className="flex items-center gap-0.5 text-[9px] tabular-nums w-[55px] shrink-0 justify-end">
              <span className={stageStats.actualHours > 0 ? 'text-emerald-500 font-medium' : 'text-muted-foreground/40'}>
                {formatHoursCompact(stageStats.actualHours)}
              </span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-muted-foreground">
                {formatHoursCompact(stageStats.plannedHours)}
              </span>
            </div>

            {/* Avatars - responsibles */}
            <div className="flex items-center -space-x-1.5 min-w-[60px] shrink-0">
              {stageResponsibles.slice(0, 3).map((emp) => (
                <TooltipProvider key={emp.id} delayDuration={200}>
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
                <TooltipProvider delayDuration={200}>
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
              {stageResponsibles.length === 0 && (
                <span className="text-[9px] text-muted-foreground/40">—</span>
              )}
            </div>

            {/* Status chip */}
            {stage.status.name ? (
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
            ) : (
              <span className="text-[9px] text-muted-foreground/40">—</span>
            )}

            {/* Add loading button - visible on hover */}
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded shrink-0"
              title="Добавить загрузку"
              onClick={(e) => {
                e.stopPropagation()
                setIsLoadingModalOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Third row: Dates */}
          <div className="flex items-center gap-1 pl-[26px]">
            <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground">
              {formatStageDate(stage.startDate)} — {formatStageDate(stage.finishDate)}
            </span>
          </div>
        </div>

        {/* Timeline area - split into two zones */}
        <div className="relative" style={{ width: timelineWidth }}>
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

          {/* Lower zone: Readiness graph (area chart) */}
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
            onWorkLogCreated={onWorkLogCreated}
            isParentHovered={isStageHovered}
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
        defaultStartDate={stage.startDate || new Date().toISOString().split('T')[0]}
        defaultEndDate={stage.finishDate || new Date().toISOString().split('T')[0]}
        onSuccess={onWorkLogCreated}
      />
    </>
  )
}
