'use client'

import { useMemo, useId } from 'react'
import { differenceInDays } from 'date-fns'
import { parseMinskDate } from '@/lib/timezone-utils'
import type { ReadinessCheckpoint, TimelineRange } from '../../types'
import { DAY_CELL_WIDTH, SECTION_ROW_HEIGHT } from '../../constants'

interface ReadinessGraphProps {
  checkpoints: ReadinessCheckpoint[]
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
}

/**
 * Компонент графика плановой готовности
 * Отрисовывает линию прогресса поверх timeline строки раздела
 */
export function ReadinessGraph({
  checkpoints,
  range,
  timelineWidth,
}: ReadinessGraphProps) {
  // Вычисляем точки для SVG path
  const points = useMemo(() => {
    if (!checkpoints || checkpoints.length === 0) return []

    return checkpoints
      .map((cp) => {
        const cpDate = parseMinskDate(cp.date)
        const dayOffset = differenceInDays(cpDate, range.start)

        // X координата: центр ячейки дня
        const x = dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2

        // Y координата: инвертируем (0% внизу, 100% вверху)
        // Используем 80% высоты строки для графика (отступы сверху и снизу)
        const graphHeight = SECTION_ROW_HEIGHT * 0.7
        const topPadding = SECTION_ROW_HEIGHT * 0.15
        const y = topPadding + graphHeight * (1 - cp.value / 100)

        return { x, y, value: cp.value, date: cp.date }
      })
      .filter((p) => p.x >= 0 && p.x <= timelineWidth)
  }, [checkpoints, range, timelineWidth])

  // Создаём SVG paths
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' }

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')

    const areaPath =
      points.length > 1
        ? `${linePath} L ${points[points.length - 1].x} ${SECTION_ROW_HEIGHT * 0.85} L ${points[0].x} ${SECTION_ROW_HEIGHT * 0.85} Z`
        : ''

    return { linePath, areaPath }
  }, [points])

  // Уникальный ID для градиента
  const gradientId = useId()

  // Early return ПОСЛЕ всех хуков
  if (points.length === 0) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT }}
    >
      {/* Градиент для заливки — сначала defs */}
      <defs>
        <linearGradient id={`readiness-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
        </linearGradient>
      </defs>

      {/* Заливка под графиком */}
      {areaPath && (
        <path
          d={areaPath}
          fill={`url(#readiness-${gradientId})`}
          opacity={0.3}
        />
      )}

      {/* Линия графика */}
      <path
        d={linePath}
        fill="none"
        stroke="#10b981"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Точки на графике */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="#10b981"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  )
}
