'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronRight, Calendar, Loader2, Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type { Section, TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { TimelineGrid } from '../shared'
import { SectionPeriodFrame } from '../SectionPeriodFrame'
import { PlannedReadinessArea } from '../PlannedReadinessArea'
import { ActualReadinessArea } from '../ActualReadinessArea'
import { BudgetSpendingArea } from '../BudgetSpendingArea'
import { BudgetsRow } from '../BudgetsRow'
import { SectionTooltipOverlay } from '../SectionTooltipOverlay'
import { DecompositionStageRow } from './DecompositionStageRow'
import {
  useWorkLogs,
  useLoadings,
  useStageReadiness,
  useStageResponsibles,
  useSectionBudgets,
  useUpdateSectionDates,
} from '../../../hooks'
import { getInitials, formatDateShort } from '../../../utils'
import { SECTION_ROW_HEIGHT, SECTION_ROW_HEIGHT_WITH_CHECKPOINTS, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../../constants'

// Dynamic imports
const SectionModal = dynamic(
  () => import('@/modules/modals/components/section/SectionModal').then(mod => mod.SectionModal),
  { ssr: false }
)

// Импорты для чекпоинтов
import { CheckpointCreateModal } from '@/modules/modals'
import { useCheckpoints, CheckpointMarkers } from '@/modules/checkpoints'

// ============================================================================
// Section Row
// ============================================================================

interface SectionRowProps {
  section: Section
  dayCells: DayCell[]
  range: TimelineRange
  /** Объект развёрнут - начинаем загрузку данных */
  isObjectExpanded: boolean
}

/**
 * Строка раздела - двухстрочный layout с графиками готовности
 */
export function SectionRow({ section, dayCells, range, isObjectExpanded }: SectionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false)
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false)
  const hasChildren = section.decompositionStages.length > 0

  // Ref для получения абсолютной позиции строки
  const rowRef = useRef<HTMLDivElement>(null)
  const [absoluteRowY, setAbsoluteRowY] = useState(0)

  // Вычисляем абсолютную Y позицию строки при монтировании и изменении размеров
  useEffect(() => {
    const updatePosition = () => {
      if (rowRef.current) {
        const rect = rowRef.current.getBoundingClientRect()
        // Находим родительский контейнер timeline
        const timelineContainer = rowRef.current.closest('[data-timeline-container]')
        if (timelineContainer) {
          const containerRect = timelineContainer.getBoundingClientRect()
          // Абсолютная позиция относительно timeline контейнера
          setAbsoluteRowY(rect.top - containerRect.top)
        }
      }
    }

    updatePosition()

    // Обновляем при скролле или resize
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isExpanded]) // Пересчитываем при разворачивании/сворачивании

  // Lazy load work logs при развороте объекта (не раздела!)
  const { data: workLogs, isLoading: workLogsLoading, refetch: refetchWorkLogs } = useWorkLogs(section.id, {
    enabled: isObjectExpanded,
  })

  // Загружаем checkpoints всегда (нужны для отображения маркеров на связанных разделах)
  const { data: checkpoints = [], refetch: refetchCheckpoints } = useCheckpoints({
    sectionId: section.id
  })

  // Lazy load loadings при развороте объекта
  const { data: loadings, isLoading: loadingsLoading } = useLoadings(section.id, {
    enabled: isObjectExpanded,
  })

  // Lazy load stage readiness при развороте объекта
  const { data: stageReadinessMap, isLoading: readinessLoading } = useStageReadiness(section.id, {
    enabled: isObjectExpanded,
  })

  // Lazy load stage responsibles при развороте объекта
  const { data: stageResponsiblesMap } = useStageResponsibles(section.id, {
    enabled: isObjectExpanded,
  })

  // Lazy load budgets при развороте объекта
  const { data: budgets, isLoading: budgetsLoading, refetch: refetchBudgets } = useSectionBudgets(
    'section',
    isObjectExpanded ? section.id : undefined
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
    const today = new Date().toISOString().split('T')[0]

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
  const depth = 3

  // Сегодняшние показатели для sidebar
  const todayIndicators = useMemo(() => {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')

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

  // Динамическая высота строки в зависимости от наличия чекпоинтов
  const hasCheckpoints = checkpoints.length > 0
  const rowHeight = hasCheckpoints ? SECTION_ROW_HEIGHT_WITH_CHECKPOINTS : SECTION_ROW_HEIGHT

  return (
    <>
      <div
        ref={rowRef}
        className="flex border-b border-border/50 hover:bg-muted/30 transition-colors group"
        style={{ height: rowHeight, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left */}
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

            {/* Кнопка добавления чекпоинта */}
            <TooltipProvider delayDuration={200}>
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

            {/* Avatar */}
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

          {/* Вторая строка: Dates + Today indicators */}
          <div className="flex items-center gap-2 pl-[26px]">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3" />
              {formatDateShort(section.startDate)} — {formatDateShort(section.endDate)}
            </span>

            {/* Сегодняшние показатели */}
            {todayIndicators && (
              <div className="flex items-center gap-1.5 ml-auto">
                {todayIndicators.planned !== null && (
                  <TooltipProvider delayDuration={200}>
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
                {todayIndicators.actual !== null && (
                  <TooltipProvider delayDuration={200}>
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
                {todayIndicators.budget !== null && (
                  <TooltipProvider delayDuration={200}>
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
                )}
              </div>
            )}
          </div>
        </div>

        {/* Timeline area */}
        <div className="relative" style={{ width: timelineWidth, height: rowHeight }}>
          <TimelineGrid dayCells={dayCells} />
          {/* Графики раздела - фиксированная высота, всегда 56px, прикреплены к низу */}
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 transition-all duration-200',
              isExpanded && 'opacity-30 saturate-50'
            )}
            style={{ height: SECTION_ROW_HEIGHT }}
          >
            <SectionPeriodFrame
              startDate={section.startDate}
              endDate={section.endDate}
              range={range}
              color={section.status.color}
              onResize={!isExpanded ? handleSectionResize : undefined}
            />
            {section.readinessCheckpoints.length > 0 && (
              <PlannedReadinessArea
                checkpoints={section.readinessCheckpoints}
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
            plannedCheckpoints={section.readinessCheckpoints}
            actualSnapshots={mergedSectionReadiness}
            budgetSpending={section.budgetSpending}
            range={range}
            timelineWidth={timelineWidth}
            sectionStartDate={section.startDate}
            sectionEndDate={section.endDate}
          />
          {/* Маркеры чекпоинтов - поверх всех графиков */}
          {checkpoints.length > 0 && (
            <CheckpointMarkers
              checkpoints={checkpoints}
              range={range}
              timelineWidth={timelineWidth}
              sectionId={section.id}
              absoluteRowY={absoluteRowY}
            />
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && (
        <>
          {(workLogsLoading || loadingsLoading || readinessLoading || budgetsLoading) && (
            <div
              className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground border-b border-border/50"
              style={{ paddingLeft: 8 + (depth + 1) * 16 }}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Загрузка данных...
            </div>
          )}
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
              responsibles={stageResponsiblesMap?.[stage.id]}
              sectionId={section.id}
              sectionName={section.name}
              onWorkLogCreated={() => refetchWorkLogs()}
            />
          ))}
        </>
      )}

      <SectionModal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        section={section}
        sectionId={section.id}
        onSuccess={() => {
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
