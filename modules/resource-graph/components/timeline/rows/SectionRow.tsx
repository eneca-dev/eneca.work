'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { parseMinskDate, formatMinskDate, getTodayMinsk } from '@/lib/timezone-utils'
import { ChevronRight, Flag, Wallet } from 'lucide-react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type { Section, TimelineRange, SectionsBatchData } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { TimelineGrid, InlineDateRangeSelect } from '../shared'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '../../../utils'
import { SectionPeriodFrame } from '../SectionPeriodFrame'
import { PlannedReadinessArea } from '../PlannedReadinessArea'
import { ActualReadinessArea } from '../ActualReadinessArea'
import { BudgetSpendingArea } from '../BudgetSpendingArea'
import { SectionTooltipOverlay } from '../SectionTooltipOverlay'
import { DecompositionStageRow } from './DecompositionStageRow'
import {
  useUpdateSectionDates,
} from '../../../hooks'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { openCheckpointEdit } from '@/modules/modals'
import { SECTION_ROW_HEIGHT, SECTION_ROW_HEIGHT_WITH_CHECKPOINTS, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../../constants'
import { useRowExpanded } from '../../../stores'

// Dynamic imports
const SectionModal = dynamic(
  () => import('@/modules/modals/components/section/SectionModal').then(mod => mod.SectionModal),
  { ssr: false }
)

// Импорты для чекпоинтов
import { CheckpointCreateModal } from '@/modules/modals'
import { CheckpointMarkers } from '@/modules/checkpoints'
import { mapBatchCheckpointToCheckpoint } from '../../../utils'

// ============================================================================
// Helpers
// ============================================================================

/** Форматирует сумму бюджета с разделителями тысяч */
function formatBudgetAmount(amount: number): string {
  return amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

// ============================================================================
// Section Row
// ============================================================================

interface SectionRowProps {
  section: Section
  dayCells: DayCell[]
  range: TimelineRange
  /** Объект развёрнут - начинаем загрузку данных */
  isObjectExpanded: boolean
  /** ID объекта (для инвалидации batch кеша) */
  objectId: string
  /** Batch данные для всех секций объекта (из ObjectRow) */
  batchData?: SectionsBatchData
  /** Загрузка batch данных */
  batchLoading?: boolean
}

/**
 * Строка раздела - двухстрочный layout с графиками готовности
 */
export function SectionRow({ section, dayCells, range, isObjectExpanded, objectId, batchData, batchLoading }: SectionRowProps) {
  const { isExpanded, toggle } = useRowExpanded('section', section.id)
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false)
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false)
  const hasChildren = section.decompositionStages.length > 0
  const queryClient = useQueryClient()

  // Оптимистичные даты для мгновенного рендеринга рамки
  const [optimisticDates, setOptimisticDates] = useState<{
    start: string
    end: string
  } | null>(null)

  // Оптимистичные контрольные точки плана (0% и 100%)
  const [optimisticPlan, setOptimisticPlan] = useState<Array<{
    date: string
    value: number
  }> | null>(null)

  // Эффективные даты (optimistic или реальные)
  const effectiveStartDate = optimisticDates?.start ?? section.startDate
  const effectiveEndDate = optimisticDates?.end ?? section.endDate

  // Эффективные контрольные точки плана (optimistic или реальные)
  const effectiveCheckpoints = optimisticPlan ?? section.readinessCheckpoints

  // Callbacks для оптимистичного обновления
  const handleOptimisticPlace = useCallback((start: string, end: string) => {
    setOptimisticDates({ start, end })
  }, [])

  const handleOptimisticRollback = useCallback(() => {
    setOptimisticDates(null)
    setOptimisticPlan(null)
  }, [])

  const handleOptimisticPlan = useCallback((checkpoints: Array<{ date: string; value: number }>) => {
    setOptimisticPlan(checkpoints)
  }, [])

  // Сбрасываем optimistic state когда приходят реальные данные
  useEffect(() => {
    if (section.startDate && section.endDate) {
      setOptimisticDates(null)
    }
  }, [section.startDate, section.endDate])

  // Сбрасываем optimistic plan когда приходят реальные чекпоинты
  useEffect(() => {
    if (section.readinessCheckpoints.length > 0) {
      setOptimisticPlan(null)
    }
  }, [section.readinessCheckpoints])

  // Данные из batch (загружены в ObjectRow одним запросом)
  const workLogs = batchData?.workLogs[section.id]
  const loadings = batchData?.loadings[section.id]
  const stageReadinessMap = batchData?.stageReadiness[section.id]
  const stageResponsiblesMap = batchData?.stageResponsibles[section.id]
  const workLogsLoading = batchLoading ?? false
  const loadingsLoading = batchLoading ?? false
  const readinessLoading = batchLoading ?? false

  // Функция для инвалидации batch кеша (вызывается при изменении данных)
  const invalidateBatchData = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.resourceGraph.sectionsBatch(objectId),
    })
  }

  // Checkpoints из batch данных (загружены в ObjectRow одним запросом)
  // Маппим BatchCheckpoint в Checkpoint для совместимости с CheckpointMarkers
  const batchCheckpoints = batchData?.checkpoints[section.id] ?? []
  const checkpoints = useMemo(
    () => batchCheckpoints.map(mapBatchCheckpointToCheckpoint),
    [batchCheckpoints]
  )

  // Бюджет раздела из batch данных (первый активный бюджет)
  const sectionBudget = batchData?.budgets[section.id]?.[0] ?? null

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

    if (sectionTodayReadiness === null) {
      return section.actualReadiness
    }

    const historical = section.actualReadiness.filter(p => p.date !== today)

    return [
      ...historical,
      { date: today, value: sectionTodayReadiness }
    ]
  }, [section.actualReadiness, sectionTodayReadiness])

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 2

  // Сегодняшние показатели для sidebar
  const todayIndicators = useMemo(() => {
    const today = getTodayMinsk()
    const todayStr = formatMinskDate(today)

    // Проверяем, находится ли сегодня в периоде раздела
    let isTodayInSection = false
    if (section.startDate && section.endDate) {
      try {
        const start = parseMinskDate(section.startDate)
        const end = parseMinskDate(section.endDate)
        isTodayInSection = today >= start && today <= end
      } catch {
        isTodayInSection = false
      }
    }

    if (!isTodayInSection) return null

    // План: интерполируем между чекпоинтами (используем effectiveCheckpoints для оптимистичного рендера)
    let planned: number | null = null
    if (effectiveCheckpoints.length > 0) {
      const sorted = [...effectiveCheckpoints].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      const firstDate = parseMinskDate(sorted[0].date)
      const lastDate = parseMinskDate(sorted[sorted.length - 1].date)

      if (today >= firstDate && today <= lastDate) {
        for (let i = 0; i < sorted.length - 1; i++) {
          const left = sorted[i]
          const right = sorted[i + 1]
          const leftDate = parseMinskDate(left.date)
          const rightDate = parseMinskDate(right.date)

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
  }, [effectiveCheckpoints, mergedSectionReadiness, section.budgetSpending, section.startDate, section.endDate])

  // Вычисляем максимальное количество чекпоинтов на одну дату для адаптивной высоты
  const { hasCheckpoints, maxCheckpointsOnDate } = useMemo(() => {
    if (checkpoints.length === 0) return { hasCheckpoints: false, maxCheckpointsOnDate: 0 }

    const byDate = new Map<string, number>()
    checkpoints.forEach((cp) => {
      const count = (byDate.get(cp.checkpoint_date) || 0) + 1
      byDate.set(cp.checkpoint_date, count)
    })

    return {
      hasCheckpoints: true,
      maxCheckpointsOnDate: Math.max(...Array.from(byDate.values())),
    }
  }, [checkpoints])

  // Адаптивная высота строки:
  // - Базовая: 56px (только график)
  // - С чекпоинтами: 56px + пространство для чекпоинтов
  // - Пространство для чекпоинтов: 24px базово + 12px * (maxStack - 1)
  const CHECKPOINT_BASE_SPACE = 24  // Компактное пространство для одного ряда чекпоинтов
  const CHECKPOINT_STACK_OFFSET = 12  // Дополнительное пространство для каждого стека

  const checkpointSpace = hasCheckpoints
    ? CHECKPOINT_BASE_SPACE + Math.max(0, maxCheckpointsOnDate - 1) * CHECKPOINT_STACK_OFFSET
    : 0
  const rowHeight = SECTION_ROW_HEIGHT + checkpointSpace

  return (
    <>
      <div
        className="flex border-b border-border/50 group"
        style={{ height: rowHeight, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left */}
        <div
          className={cn(
            'flex flex-col justify-center gap-0.5 shrink-0 border-r border-border px-2 relative',
            'sticky left-0 z-40 bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Create checkpoint button - positioned at right edge of sidebar (like loading in DecompositionStageRow) */}
          <button
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-1 hover:bg-muted rounded-r text-[9px] text-muted-foreground hover:text-amber-500 bg-background border-r border-t border-b border-border"
            onClick={(e) => {
              e.stopPropagation()
              setIsCheckpointModalOpen(true)
            }}
          >
            <Flag className="w-3 h-3" />
            <span>Чекпоинт</span>
          </button>

          {/* Первая строка: Expand + Avatar + Name */}
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button
                onClick={toggle}
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

            {/* Avatar ответственного - клик открывает модалку */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsSectionModalOpen(true)
                    }}
                    className="shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full transition-transform hover:scale-110"
                  >
                    <Avatar className="w-5 h-5">
                      {section.responsible.avatarUrl && (
                        <AvatarImage
                          src={section.responsible.avatarUrl}
                          alt={section.responsible.name || 'Ответственный'}
                        />
                      )}
                      <AvatarFallback className="text-[9px] bg-muted">
                        {section.responsible.id
                          ? getInitials(section.responsible.firstName, section.responsible.lastName)
                          : '?'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="space-y-0.5">
                    <div>{section.responsible.name || 'Ответственный не указан'}</div>
                    <div className="text-muted-foreground">Нажмите для изменения</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Section Name - кликабельное */}
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

          {/* Вторая строка: Dates + Budget + Today indicators - CSS Grid layout */}
          <div className="grid grid-cols-[auto_70px_1fr] items-center gap-1.5 pl-[26px]">
            {/* Колонка 1: Даты (auto width) */}
            <InlineDateRangeSelect
              sectionId={section.id}
              startDate={section.startDate}
              endDate={section.endDate}
              onSuccess={invalidateBatchData}
              onOpenModal={() => setIsSectionModalOpen(true)}
              onOptimisticPlace={handleOptimisticPlace}
              onOptimisticRollback={handleOptimisticRollback}
              onOptimisticPlan={handleOptimisticPlan}
            />

            {/* Колонка 2: Бюджет (fixed 70px) */}
            <div className="flex items-center justify-end">
              {sectionBudget ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                        <Wallet className="w-3 h-3" />
                        {formatBudgetAmount(sectionBudget.planned_amount)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="space-y-1">
                        <div className="font-medium">{sectionBudget.name}</div>
                        <div>Бюджет: {sectionBudget.planned_amount.toLocaleString('ru-RU')} BYN</div>
                        <div>Освоено: {sectionBudget.spent_amount.toLocaleString('ru-RU')} BYN ({Math.round(sectionBudget.spent_percentage)}%)</div>
                        <div>Остаток: {sectionBudget.remaining_amount.toLocaleString('ru-RU')} BYN</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">
                  <Wallet className="w-3 h-3" />
                  —
                </span>
              )}
            </div>

            {/* Колонка 3: Сегодняшние показатели (1fr, выровнены вправо) */}
            <div className="flex items-center gap-1.5 justify-end">
              {/* Плановая готовность */}
              {todayIndicators?.planned !== null && todayIndicators?.planned !== undefined ? (
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
              ) : (
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground/40">
                  П:—%
                </span>
              )}
              {/* Фактическая готовность */}
              {todayIndicators?.actual !== null && todayIndicators?.actual !== undefined ? (
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
              ) : (
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground/40">
                  Ф:—%
                </span>
              )}
              {/* Освоение бюджета */}
              {todayIndicators?.budget !== null && todayIndicators?.budget !== undefined ? (
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
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground/40">
                  Б:—%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Timeline area - isolate creates stacking context, overflow-hidden clips bleeding elements */}
        <div className="relative isolate overflow-hidden" style={{ width: timelineWidth, height: rowHeight }}>
          <TimelineGrid dayCells={dayCells} />

          {/* Рамка периода раздела - на всю высоту строки (оптимистичный рендер) */}
          <SectionPeriodFrame
            startDate={effectiveStartDate}
            endDate={effectiveEndDate}
            range={range}
            color={section.status.color}
            onResize={!isExpanded ? handleSectionResize : undefined}
          />

          {/* Графики раздела - фиксированная высота 56px, прикреплены к низу */}
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 transition-all duration-200',
              isExpanded && 'opacity-30 saturate-50'
            )}
            style={{ height: SECTION_ROW_HEIGHT }}
          >
            {effectiveCheckpoints.length > 0 && (
              <PlannedReadinessArea
                checkpoints={effectiveCheckpoints}
                range={range}
                timelineWidth={timelineWidth}
              />
            )}
            {mergedSectionReadiness.length > 0 && (
              <ActualReadinessArea
                snapshots={mergedSectionReadiness}
                range={range}
                timelineWidth={timelineWidth}
              />
            )}
            {section.budgetSpending.length > 0 && (
              <BudgetSpendingArea
                spending={section.budgetSpending}
                range={range}
                timelineWidth={timelineWidth}
              />
            )}
          </div>

          <SectionTooltipOverlay
            plannedCheckpoints={effectiveCheckpoints}
            actualSnapshots={mergedSectionReadiness}
            budgetSpending={section.budgetSpending}
            range={range}
            timelineWidth={timelineWidth}
            sectionStartDate={effectiveStartDate}
            sectionEndDate={effectiveEndDate}
          />

          {/* Маркеры чекпоинтов - в верхней части строки */}
          {checkpoints.length > 0 && (
            <CheckpointMarkers
              checkpoints={checkpoints}
              range={range}
              timelineWidth={timelineWidth}
              sectionId={section.id}
              rowHeight={rowHeight}
              onMarkerClick={(checkpoint) => openCheckpointEdit(checkpoint.checkpoint_id)}
            />
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && (
        <>
          {/* Skeleton loading - показываем пустые строки пока данные грузятся */}
          {(workLogsLoading || loadingsLoading || readinessLoading) && (
            <div className="space-y-px">
              {section.decompositionStages.slice(0, 3).map((stage, i) => (
                <div
                  key={`skeleton-${stage.id}`}
                  className="flex border-b border-border/50 animate-pulse"
                  style={{ height: 40, minWidth: totalWidth }}
                >
                  <div
                    className="shrink-0 border-r border-border px-2 sticky left-0 z-40 bg-background flex items-center"
                    style={{ width: SIDEBAR_WIDTH, paddingLeft: 8 + (depth + 1) * 16 }}
                  >
                    <div className="h-3 bg-muted/30 rounded w-24" />
                  </div>
                  <div className="flex-1 relative">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-4 bg-muted/20 rounded"
                      style={{ left: 50 + i * 30, width: 100 + i * 20 }}
                    />
                  </div>
                </div>
              ))}
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
              responsibles={stageResponsiblesMap?.[stage.id]}
              sectionId={section.id}
              sectionName={section.name}
              sectionBudget={sectionBudget}
              sectionBudgetSpending={section.budgetSpending}
              onWorkLogCreated={invalidateBatchData}
            />
          ))}
        </>
      )}

      <SectionModal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        section={section}
        sectionId={section.id}
        onSuccess={invalidateBatchData}
      />

      {/* Checkpoint Create Modal */}
      <CheckpointCreateModal
        isOpen={isCheckpointModalOpen}
        onClose={() => setIsCheckpointModalOpen(false)}
        sectionId={section.id}
        sectionName={section.name}
        onSuccess={invalidateBatchData}
      />
    </>
  )
}
