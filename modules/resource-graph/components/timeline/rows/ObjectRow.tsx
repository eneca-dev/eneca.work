'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronRight, Box } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = object.sections.length > 0

  // Prefetch чекпоинтов для всех разделов объекта
  const { prefetchForSections, prefetchProjectSections } = usePrefetchCheckpoints()

  // Prefetch данных при наведении на кнопку раскрытия (до клика)
  const handleMouseEnter = useCallback(() => {
    if (!isExpanded && object.sections.length > 0) {
      const sectionIds = object.sections.map((s) => s.id)
      prefetchForSections(sectionIds)
      prefetchProjectSections(object.sections[0].id)
    }
  }, [isExpanded, object.sections, prefetchForSections, prefetchProjectSections])

  // Агрегированные метрики из всех разделов
  const aggregatedMetrics = useMemo(() => {
    return aggregateSectionsMetrics(object.sections)
  }, [object.sections])

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 2

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
            'sticky left-0 z-20 bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              onMouseEnter={handleMouseEnter}
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
          <span className="text-muted-foreground">
            <Box className="w-4 h-4" />
          </span>
          {/* Label */}
          <span className="text-sm truncate flex-1 min-w-0" title={object.name}>
            {object.name}
          </span>
        </div>

        {/* Timeline area - fixed width */}
        <div className="relative" style={{ width: timelineWidth }}>
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
        />
      ))}
    </>
  )
}
