'use client'

import { useMemo, useCallback } from 'react'
import { ChevronRight, Box, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type { ProjectObject, TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { TimelineGrid } from '../shared'
import { PlannedReadinessArea } from '../PlannedReadinessArea'
import { ActualReadinessArea } from '../ActualReadinessArea'
import { BudgetSpendingArea } from '../BudgetSpendingArea'
import { SectionRow } from './SectionRow'
import { aggregateSectionsMetrics } from './calculations'
import { OBJECT_ROW_HEIGHT, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../../constants'
import { usePrefetchCheckpoints } from '@/modules/checkpoints'
import { useSectionsBatch, usePrefetchObjectData } from '../../../hooks'
import { useRowExpanded } from '../../../stores'

// ============================================================================
// Helpers
// ============================================================================

/** Форматирует сумму бюджета с разделителями тысяч */
function formatBudgetAmount(amount: number): string {
  return amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

// ============================================================================
// Object Row
// ============================================================================

interface ObjectRowProps {
  object: ProjectObject
  dayCells: DayCell[]
  range: TimelineRange
}

/**
 * Строка объекта - показывает агрегированные метрики из всех разделов
 */
export function ObjectRow({ object, dayCells, range }: ObjectRowProps) {
  const { isExpanded, toggle } = useRowExpanded('object', object.id)
  const hasChildren = object.sections.length > 0

  // Собираем ID секций для batch загрузки
  const sectionIds = useMemo(() => object.sections.map((s) => s.id), [object.sections])

  // Batch загрузка всех данных для секций объекта (1 запрос вместо 6×N)
  const { data: batchData, isLoading: batchLoading } = useSectionsBatch(
    object.id,
    sectionIds,
    { enabled: isExpanded }
  )

  // Prefetch чекпоинтов для всех разделов объекта
  const { prefetchForSections, prefetchProjectSections } = usePrefetchCheckpoints()

  // Prefetch batch данных объекта
  const prefetchObjectData = usePrefetchObjectData()

  // Prefetch данных при наведении на кнопку раскрытия (до клика)
  const handleMouseEnter = useCallback(() => {
    if (!isExpanded && object.sections.length > 0) {
      // Prefetch чекпоинтов
      prefetchForSections(sectionIds)
      prefetchProjectSections(object.sections[0].id)
      // Prefetch batch данных (workLogs, loadings, readiness, etc.)
      prefetchObjectData(object)
    }
  }, [isExpanded, object, sectionIds, prefetchForSections, prefetchProjectSections, prefetchObjectData])

  // Агрегированные метрики из всех разделов
  const aggregatedMetrics = useMemo(() => {
    return aggregateSectionsMetrics(object.sections)
  }, [object.sections])

  // Бюджет объекта из batch данных
  const objectBudget = batchData?.objectBudget ?? null

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 1

  return (
    <>
      <div
        className="flex border-b border-border/50"
        style={{ height: OBJECT_ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left при горизонтальном скролле */}
        <div
          className={cn(
            'flex items-center gap-1 shrink-0 border-r border-border px-2',
            'sticky left-0 z-40 bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={toggle}
              onMouseEnter={handleMouseEnter}
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
          <span className="text-muted-foreground shrink-0">
            <Box className="w-4 h-4" />
          </span>
          {/* Label */}
          <span className="text-sm truncate min-w-0" title={object.name}>
            {object.name}
          </span>

          {/* Бюджет */}
          {objectBudget && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-amber-500 flex items-center gap-0.5 shrink-0 ml-1.5">
                    <Wallet className="w-3 h-3" />
                    {formatBudgetAmount(objectBudget.planned_amount)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="space-y-1">
                    <div className="font-medium">{objectBudget.name}</div>
                    <div>Бюджет: {objectBudget.planned_amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BYN</div>
                    <div>Освоено: {objectBudget.spent_amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BYN ({Math.round(objectBudget.spent_percentage)}%)</div>
                    <div>Остаток: {objectBudget.remaining_amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BYN</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Timeline area - fixed width, isolate creates stacking context, overflow-hidden clips bleeding elements */}
        <div className="relative isolate overflow-hidden" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
          {/* Агрегированные графики объекта */}
          {aggregatedMetrics && (
            <div
              className={cn(
                'absolute inset-0 transition-all duration-200',
                // Серый и полупрозрачный когда объект развёрнут
                isExpanded && 'opacity-30 saturate-50'
              )}
            >
              {/* Плановая готовность (пунктирная линия) */}
              {aggregatedMetrics.plannedReadiness.length > 0 && (
                <PlannedReadinessArea
                  checkpoints={aggregatedMetrics.plannedReadiness}
                  range={range}
                  timelineWidth={timelineWidth}
                  rowHeight={OBJECT_ROW_HEIGHT}
                />
              )}
              {/* Фактическая готовность (синяя область) */}
              {aggregatedMetrics.actualReadiness.length > 0 && (
                <ActualReadinessArea
                  snapshots={aggregatedMetrics.actualReadiness}
                  range={range}
                  timelineWidth={timelineWidth}
                  rowHeight={OBJECT_ROW_HEIGHT}
                />
              )}
              {/* Освоение бюджета (оранжевая область) */}
              {aggregatedMetrics.budgetSpending.length > 0 && (
                <BudgetSpendingArea
                  spending={aggregatedMetrics.budgetSpending}
                  range={range}
                  timelineWidth={timelineWidth}
                  rowHeight={OBJECT_ROW_HEIGHT}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && object.sections.map((section) => (
        <SectionRow
          key={section.id}
          section={section}
          dayCells={dayCells}
          range={range}
          isObjectExpanded={isExpanded}
          objectId={object.id}
          batchData={batchData}
          batchLoading={batchLoading}
        />
      ))}
    </>
  )
}
