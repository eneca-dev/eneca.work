'use client'

import { useMemo } from 'react'
import { differenceInDays, parseISO, format, addDays, isWithinInterval } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ReadinessCheckpoint, ReadinessPoint, BudgetSpendingPoint, TimelineRange } from '../../types'
import { DAY_CELL_WIDTH, SECTION_ROW_HEIGHT } from '../../constants'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface SectionTooltipOverlayProps {
  /** Checkpoints плановой готовности */
  plannedCheckpoints: ReadinessCheckpoint[]
  /** Снэпшоты фактической готовности */
  actualSnapshots: ReadinessPoint[]
  /** Данные расходования бюджета */
  budgetSpending: BudgetSpendingPoint[]
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
  /** Даты раздела для определения активной зоны */
  sectionStartDate: string | null
  sectionEndDate: string | null
  /** Высота строки (динамическая, зависит от наличия чекпоинтов) */
  rowHeight?: number
}

interface DayMetrics {
  date: string
  dayIndex: number
  plannedReadiness: number | null
  actualReadiness: number | null
  budgetPercent: number | null
  budgetSpent: number | null
}

/**
 * Прозрачный слой поверх графиков раздела
 * При наведении на любой день показывает тултип со всеми 3 метриками
 */
export function SectionTooltipOverlay({
  plannedCheckpoints,
  actualSnapshots,
  budgetSpending,
  range,
  timelineWidth,
  sectionStartDate,
  sectionEndDate,
  rowHeight = SECTION_ROW_HEIGHT,
}: SectionTooltipOverlayProps) {
  // Вычисляем метрики для каждого дня в диапазоне раздела
  const dayMetrics = useMemo(() => {
    if (!sectionStartDate || !sectionEndDate) return []

    const sectionStart = parseISO(sectionStartDate)
    const sectionEnd = parseISO(sectionEndDate)

    // Создаём Maps для быстрого поиска
    const plannedMap = new Map<string, number>()
    const sortedPlanned = [...(plannedCheckpoints || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    for (const cp of sortedPlanned) {
      plannedMap.set(cp.date, cp.value)
    }

    const actualMap = new Map<string, number>()
    const sortedActual = [...(actualSnapshots || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    for (const snap of sortedActual) {
      actualMap.set(snap.date, snap.value)
    }

    const budgetMap = new Map<string, { percent: number; spent: number }>()
    const sortedBudget = [...(budgetSpending || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    for (const point of sortedBudget) {
      budgetMap.set(point.date, { percent: point.percentage, spent: point.spent })
    }

    const result: DayMetrics[] = []
    const totalDays = Math.ceil(timelineWidth / DAY_CELL_WIDTH)

    for (let i = 0; i < totalDays; i++) {
      const dayDate = addDays(range.start, i)
      const dateKey = format(dayDate, 'yyyy-MM-dd')

      // Проверяем, находится ли день в диапазоне раздела
      if (!isWithinInterval(dayDate, { start: sectionStart, end: sectionEnd })) {
        continue
      }

      // Плановая готовность (интерполируем между checkpoints)
      let plannedReadiness: number | null = null
      if (sortedPlanned.length > 0) {
        plannedReadiness = interpolateValue(dayDate, sortedPlanned)
      }

      // Фактическая готовность
      let actualReadiness: number | null = null
      const exactActual = actualMap.get(dateKey)
      if (exactActual !== undefined) {
        actualReadiness = exactActual
      } else if (sortedActual.length > 0) {
        // Интерполируем только если дата в пределах данных
        const firstActual = parseISO(sortedActual[0].date)
        const lastActual = parseISO(sortedActual[sortedActual.length - 1].date)
        if (dayDate >= firstActual && dayDate <= lastActual) {
          actualReadiness = interpolateValue(dayDate, sortedActual)
        }
      }

      // Бюджет — ступенчатая интерполяция до сегодня (как график)
      let budgetPercent: number | null = null
      let budgetSpent: number | null = null
      const exactBudget = budgetMap.get(dateKey)
      if (exactBudget) {
        budgetPercent = exactBudget.percent
        budgetSpent = exactBudget.spent
      } else if (sortedBudget.length > 0) {
        const firstBudget = parseISO(sortedBudget[0].date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        // Показываем значение от первой даты данных до сегодня
        if (dayDate >= firstBudget && dayDate <= today) {
          // Ступенчатая интерполяция — последнее известное значение
          const lastKnown = getLastKnownBudget(dayDate, sortedBudget)
          budgetPercent = lastKnown.percent
          budgetSpent = lastKnown.spent
        }
      }

      // Добавляем день, только если есть хотя бы одна метрика
      if (plannedReadiness !== null || actualReadiness !== null || budgetPercent !== null) {
        result.push({
          date: dateKey,
          dayIndex: i,
          plannedReadiness,
          actualReadiness,
          budgetPercent,
          budgetSpent,
        })
      }
    }

    return result
  }, [
    plannedCheckpoints,
    actualSnapshots,
    budgetSpending,
    range.start,
    timelineWidth,
    sectionStartDate,
    sectionEndDate,
  ])

  if (dayMetrics.length === 0) return null

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ width: timelineWidth, height: rowHeight }}
      >
        {dayMetrics.map((day) => (
          <DayTooltip key={day.date} day={day} />
        ))}
      </div>
    </TooltipProvider>
  )
}

/**
 * Тултип для одного дня
 */
interface DayTooltipProps {
  day: DayMetrics
}

function DayTooltip({ day }: DayTooltipProps) {
  const left = day.dayIndex * DAY_CELL_WIDTH
  const formattedDate = format(parseISO(day.date), 'd MMMM', { locale: ru })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute top-0 bottom-0 cursor-default hover:bg-primary/5 transition-colors pointer-events-auto"
          style={{
            left,
            width: DAY_CELL_WIDTH,
          }}
        />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="backdrop-blur-md bg-background/90 border-border/50"
      >
        <div className="space-y-2 min-w-[140px]">
          {/* Дата */}
          <div className="text-xs font-medium text-foreground pb-1 border-b border-border/30">
            {formattedDate}
          </div>

          {/* Метрики */}
          <div className="space-y-1.5 text-xs">
            {/* Плановая готовность */}
            {day.plannedReadiness !== null && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="w-2 h-0.5 rounded"
                    style={{ backgroundColor: '#10b981', opacity: 0.7 }}
                  />
                  План
                </span>
                <span className="font-medium tabular-nums" style={{ color: '#10b981' }}>
                  {Math.round(day.plannedReadiness)}%
                </span>
              </div>
            )}

            {/* Фактическая готовность */}
            {day.actualReadiness !== null && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: '#3b82f6', opacity: 0.5 }}
                  />
                  Факт
                </span>
                <span className="font-medium tabular-nums" style={{ color: '#3b82f6' }}>
                  {Math.round(day.actualReadiness)}%
                </span>
              </div>
            )}

            {/* Бюджет */}
            {day.budgetPercent !== null && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="w-2 h-2 rounded-sm"
                    style={{
                      backgroundColor: day.budgetPercent > 100 ? '#ef4444' : '#f97316',
                      opacity: 0.5,
                    }}
                  />
                  Бюджет
                </span>
                <span
                  className="font-medium tabular-nums"
                  style={{ color: day.budgetPercent > 100 ? '#ef4444' : '#f97316' }}
                >
                  {Math.round(day.budgetPercent)}%
                  {day.budgetSpent !== null && (
                    <span className="text-muted-foreground ml-1 font-normal">
                      ({formatMoney(day.budgetSpent)})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Интерполирует значение готовности между точками
 */
function interpolateValue(
  date: Date,
  points: { date: string; value: number }[]
): number | null {
  if (points.length === 0) return null

  let leftPoint: { date: string; value: number } | null = null
  let rightPoint: { date: string; value: number } | null = null

  for (const point of points) {
    const pointDate = parseISO(point.date)
    if (pointDate <= date) {
      leftPoint = point
    }
    if (pointDate >= date && !rightPoint) {
      rightPoint = point
      break
    }
  }

  if (!leftPoint && rightPoint) return rightPoint.value
  if (leftPoint && !rightPoint) return leftPoint.value
  if (!leftPoint || !rightPoint) return null

  const leftDate = parseISO(leftPoint.date)
  const rightDate = parseISO(rightPoint.date)
  const totalDays = differenceInDays(rightDate, leftDate)
  if (totalDays === 0) return leftPoint.value

  const daysFromLeft = differenceInDays(date, leftDate)
  const ratio = daysFromLeft / totalDays

  return leftPoint.value + (rightPoint.value - leftPoint.value) * ratio
}

/**
 * Возвращает последнее известное значение бюджета до указанной даты (ступенчатая интерполяция)
 */
function getLastKnownBudget(
  date: Date,
  points: BudgetSpendingPoint[]
): { percent: number; spent: number } {
  let lastKnown: BudgetSpendingPoint | null = null

  for (const point of points) {
    const pointDate = parseISO(point.date)
    if (pointDate <= date) {
      lastKnown = point
    } else {
      break
    }
  }

  if (lastKnown) {
    return { percent: lastKnown.percentage, spent: lastKnown.spent }
  }

  // Если дата раньше первой точки, берём первую
  return { percent: points[0].percentage, spent: points[0].spent }
}

/**
 * Форматирует сумму для отображения
 */
function formatMoney(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M BYN`
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K BYN`
  }
  return `${Math.round(value)} BYN`
}
