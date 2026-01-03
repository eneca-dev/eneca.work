'use client'

import { useMemo, useId } from 'react'
import { format, addDays } from 'date-fns'
import { parseMinskDate, getTodayMinsk } from '@/lib/timezone-utils'
import type { BudgetSpendingPoint, TimelineRange } from '../../types'
import { DAY_CELL_WIDTH, SECTION_ROW_HEIGHT } from '../../constants'

interface BudgetSpendingAreaProps {
  /** Данные расходования бюджета по дням */
  spending: BudgetSpendingPoint[]
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
  /** Высота строки (по умолчанию SECTION_ROW_HEIGHT) */
  rowHeight?: number
}

interface PointData {
  x: number
  y: number
  percentage: number
  spent: number
  date: string
  isInterpolated: boolean
}

// Оранжевая палитра
const BUDGET_COLOR = '#f97316' // orange-500
const BUDGET_COLOR_LIGHT = '#fb923c' // orange-400
const OVERSPEND_COLOR = '#ef4444' // red-500

/**
 * Форматирует сумму для отображения
 */
function formatMoney(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`
  }
  return value.toFixed(0)
}

/**
 * Определяет цвет в зависимости от процента освоения
 */
function getSpendingColor(percentage: number): string {
  if (percentage > 100) return OVERSPEND_COLOR
  return BUDGET_COLOR
}

/**
 * Компонент заливки расходования бюджета
 * Оранжевая область с диагональными полосками и чёткой верхней границей
 */
export function BudgetSpendingArea({
  spending,
  range,
  timelineWidth,
  rowHeight = SECTION_ROW_HEIGHT,
}: BudgetSpendingAreaProps) {
  // Вычисляем точки БЕЗ интерполяции (ступеньки) — как у ActualReadinessArea
  const points = useMemo(() => {
    if (!spending || spending.length === 0) return []

    // Сортируем по дате
    const sortedSpending = [...spending].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Создаём Map для быстрого поиска
    const spendingMap = new Map<string, BudgetSpendingPoint>()
    for (const point of sortedSpending) {
      spendingMap.set(point.date, point)
    }

    // Границы данных (используем parseMinskDate для консистентности с range.start)
    const firstDataDate = parseMinskDate(sortedSpending[0].date)
    const lastDataDate = parseMinskDate(sortedSpending[sortedSpending.length - 1].date)

    // График идёт до сегодняшнего дня (или до последней даты данных, если она позже)
    const today = getTodayMinsk()
    const endDate = lastDataDate > today ? lastDataDate : today

    const result: PointData[] = []
    const totalDays = Math.ceil(timelineWidth / DAY_CELL_WIDTH)
    const graphHeight = rowHeight * 0.75
    const topPadding = rowHeight * 0.1

    // Максимальный процент для масштабирования (если есть перерасход)
    const maxPercentage = Math.max(100, ...sortedSpending.map(s => s.percentage))

    // Начальные значения для ступенчатой интерполяции
    let lastKnownPercentage = sortedSpending[0].percentage
    let lastKnownSpent = sortedSpending[0].spent

    for (let i = 0; i < totalDays; i++) {
      const dayDate = addDays(range.start, i)
      const dateKey = format(dayDate, 'yyyy-MM-dd')

      // Пропускаем дни до первых данных или после сегодня
      if (dayDate < firstDataDate || dayDate > endDate) continue

      let percentage: number
      let spent: number
      let isInterpolated = false

      const exactPoint = spendingMap.get(dateKey)
      if (exactPoint) {
        percentage = exactPoint.percentage
        spent = exactPoint.spent
        lastKnownPercentage = percentage
        lastKnownSpent = spent
      } else {
        // Ступенька: используем последнее известное значение
        percentage = lastKnownPercentage
        spent = lastKnownSpent
        isInterpolated = true
      }

      // X координата: центр ячейки
      const x = i * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2

      // Y координата (масштабируем относительно maxPercentage для корректного отображения перерасхода)
      const y = topPadding + graphHeight * (1 - Math.min(percentage, maxPercentage) / maxPercentage)

      result.push({ x, y, percentage, spent, date: dateKey, isInterpolated })
    }

    return result
  }, [spending, range.start, timelineWidth, rowHeight])

  // Создаём SVG paths
  const baseY = rowHeight * 0.85
  const { areaPath, linePath, isOverspend } = useMemo(() => {
    if (points.length < 1) return { areaPath: '', linePath: '', isOverspend: false }

    // Area path (заливка)
    let areaPath = `M ${points[0].x} ${baseY}`
    areaPath += ` L ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      areaPath += ` L ${points[i].x} ${points[i].y}`
    }
    areaPath += ` L ${points[points.length - 1].x} ${baseY}`
    areaPath += ' Z'

    // Line path (верхняя граница)
    let linePath = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      linePath += ` L ${points[i].x} ${points[i].y}`
    }

    const isOverspend = points.length > 0 && points[points.length - 1].percentage > 100

    return { areaPath, linePath, isOverspend }
  }, [points, baseY])

  // Находим последнюю точку для отображения текущего значения
  const lastPoint = points.length > 0 ? points[points.length - 1] : null
  const mainColor = isOverspend ? OVERSPEND_COLOR : BUDGET_COLOR

  // Уникальный ID для паттерна (React useId для стабильности)
  const uniqueId = useId()
  const patternId = `budgetStripes-${uniqueId}`
  const gradientId = `budgetGradient-${uniqueId}`

  // Early return ПОСЛЕ всех хуков
  if (points.length === 0) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: timelineWidth, height: rowHeight }}
    >
      <svg
        className="absolute inset-0"
        style={{ width: timelineWidth, height: rowHeight }}
      >
        <defs>
          {/* Диагональный паттерн полосок */}
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke={mainColor}
              strokeWidth="2"
              strokeOpacity="0.3"
            />
          </pattern>

          {/* Вертикальный градиент для плавного перехода */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={mainColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={mainColor} stopOpacity={0.05} />
          </linearGradient>

          {/* Комбинированная заливка: градиент + полоски */}
          <mask id={`${patternId}-mask`}>
            <rect width="100%" height="100%" fill="white" />
          </mask>
        </defs>

        {/* Основная заливка с градиентом */}
        {areaPath && (
          <path
            d={areaPath}
            fill={`url(#${gradientId})`}
          />
        )}

        {/* Полосатый паттерн поверх */}
        {areaPath && (
          <path
            d={areaPath}
            fill={`url(#${patternId})`}
          />
        )}

        {/* Верхняя граница - чёткая линия */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={mainColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.8"
          />
        )}

        {/* Точка на конце линии */}
        {lastPoint && (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3"
            fill={mainColor}
            stroke="white"
            strokeWidth="1"
          />
        )}
      </svg>

      {/* Подпись последнего значения — простой текст как у плана */}
      {lastPoint && (
        <div
          className="absolute flex flex-col items-center pointer-events-none"
          style={{
            left: lastPoint.x,
            top: lastPoint.y - 12,
            transform: 'translateX(-50%)',
          }}
        >
          <span
            className="text-[8px] font-medium tabular-nums"
            style={{
              color: getSpendingColor(lastPoint.percentage),
              textShadow: '0 0 2px rgba(0,0,0,0.8)',
            }}
          >
            {Math.round(lastPoint.percentage)}%
          </span>
        </div>
      )}
    </div>
  )
}

