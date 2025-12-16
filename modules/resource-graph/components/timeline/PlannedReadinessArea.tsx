'use client'

import { useMemo } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import type { ReadinessCheckpoint, TimelineRange } from '../../types'
import { DAY_CELL_WIDTH, SECTION_ROW_HEIGHT } from '../../constants'

interface PlannedReadinessAreaProps {
  checkpoints: ReadinessCheckpoint[]
  range: TimelineRange
  timelineWidth: number
}

/**
 * Компонент плановой готовности — пунктирная линия с процентами на ключевых точках
 */
export function PlannedReadinessArea({
  checkpoints,
  range,
  timelineWidth,
}: PlannedReadinessAreaProps) {
  // Вычисляем точки для SVG path
  const points = useMemo(() => {
    if (!checkpoints || checkpoints.length === 0) return []

    return checkpoints
      .map((cp) => {
        const cpDate = parseISO(cp.date)
        const dayOffset = differenceInDays(cpDate, range.start)

        // X координата: центр ячейки дня
        const x = dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2

        // Y координата: инвертируем (0% внизу, 100% вверху)
        const graphHeight = SECTION_ROW_HEIGHT * 0.75
        const topPadding = SECTION_ROW_HEIGHT * 0.1
        const y = topPadding + graphHeight * (1 - cp.value / 100)

        return { x, y, value: cp.value, date: cp.date }
      })
      .filter((p) => p.x >= 0 && p.x <= timelineWidth)
  }, [checkpoints, range, timelineWidth])

  if (points.length === 0) return null

  // Создаём SVG path для пунктирной линии
  const linePath = useMemo(() => {
    if (points.length < 1) return ''

    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`
    }

    return path
  }, [points])

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT }}
    >
      <svg
        className="absolute inset-0"
        style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT }}
      >
        {/* Пунктирная линия */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeOpacity={0.7}
          />
        )}
      </svg>

      {/* Подписи процентов на ключевых точках — маленькие метки рядом с линией */}
      {points.map((p, i) => (
        <div
          key={i}
          className="absolute flex flex-col items-center pointer-events-none"
          style={{
            left: p.x,
            top: p.y - 12,
            transform: 'translateX(-50%)',
          }}
        >
          <span
            className="text-[8px] font-medium tabular-nums text-emerald-500"
            style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
          >
            {p.value}%
          </span>
        </div>
      ))}
    </div>
  )
}
