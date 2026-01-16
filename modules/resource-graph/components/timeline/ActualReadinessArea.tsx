'use client'

import { useMemo, useId } from 'react'
import { addDays, format } from 'date-fns'
import { parseMinskDate, getTodayMinsk } from '@/lib/timezone-utils'
import type { ReadinessPoint, TimelineRange } from '../../types'
import { DAY_CELL_WIDTH, SECTION_ROW_HEIGHT } from '../../constants'

interface ActualReadinessAreaProps {
  /** Снэпшоты фактической готовности */
  snapshots: ReadinessPoint[]
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
  value: number
  date: string
  isInterpolated: boolean
}

/**
 * Компонент заливки фактической готовности (синяя область)
 * При наведении показывает процент готовности
 */
export function ActualReadinessArea({
  snapshots,
  range,
  timelineWidth,
  rowHeight = SECTION_ROW_HEIGHT,
}: ActualReadinessAreaProps) {
  // Вычисляем точки БЕЗ интерполяции (ступеньки)
  const points = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []

    // Сортируем снэпшоты по дате
    const sortedSnapshots = [...snapshots].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Создаём Map для быстрого поиска
    const snapshotMap = new Map<string, number>()
    for (const snap of sortedSnapshots) {
      snapshotMap.set(snap.date, snap.value)
    }

    // Границы данных
    // Используем parseMinskDate для консистентности с range.start
    const firstDataDate = parseMinskDate(sortedSnapshots[0].date)
    const lastDataDate = parseMinskDate(sortedSnapshots[sortedSnapshots.length - 1].date)

    // График идёт до сегодняшнего дня (или до последней даты данных, если она позже)
    const today = getTodayMinsk()
    const endDate = lastDataDate > today ? lastDataDate : today

    const result: PointData[] = []
    const totalDays = Math.ceil(timelineWidth / DAY_CELL_WIDTH)
    const graphHeight = rowHeight * 0.75
    const topPadding = rowHeight * 0.1

    let lastKnownValue = sortedSnapshots[0].value

    for (let i = 0; i < totalDays; i++) {
      const dayDate = addDays(range.start, i)
      const dateKey = format(dayDate, 'yyyy-MM-dd')

      // Пропускаем дни до первых данных или после сегодня
      if (dayDate < firstDataDate || dayDate > endDate) continue

      let value: number
      let isInterpolated = false

      const exactValue = snapshotMap.get(dateKey)
      if (exactValue !== undefined) {
        value = exactValue
        lastKnownValue = exactValue
      } else {
        // Ступенька: используем последнее известное значение
        value = lastKnownValue
        isInterpolated = true
      }

      // X координата: центр ячейки
      const x = i * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2

      // Y координата
      const y = topPadding + graphHeight * (1 - value / 100)

      result.push({ x, y, value, date: dateKey, isInterpolated })
    }

    return result
  }, [snapshots, range.start, timelineWidth, rowHeight])

  // Создаём SVG paths для заливки и линии
  const baseY = rowHeight * 0.85
  const { areaPath, linePath } = useMemo(() => {
    if (points.length < 1) return { areaPath: '', linePath: '' }

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

    return { areaPath, linePath }
  }, [points, baseY])

  // Находим последнюю точку для отображения текущего значения
  const lastPoint = points.length > 0 ? points[points.length - 1] : null

  // Уникальный ID для градиента (React 18+ useId для SSR-safe уникальности)
  const gradientId = useId()

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
        {/* Градиентная заливка синим */}
        <defs>
          <linearGradient id={`actualReadiness-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.08} />
          </linearGradient>
        </defs>

        {/* Заливка */}
        {areaPath && (
          <path
            d={areaPath}
            fill={`url(#actualReadiness-${gradientId})`}
          />
        )}

        {/* Верхняя граница — сплошная линия */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
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
            fill="#3b82f6"
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
            className="text-[8px] font-medium tabular-nums text-blue-500"
            style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
          >
            {Math.round(lastPoint.value)}%
          </span>
        </div>
      )}
    </div>
  )
}

