'use client'

import { useMemo, useState } from 'react'
import { parseISO, addDays, format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ReadinessPoint, TimelineRange } from '../../types'
import { DAY_CELL_WIDTH } from '../../constants'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface StageReadinessAreaProps {
  /** Снэпшоты фактической готовности */
  snapshots: ReadinessPoint[]
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
  /** Высота зоны графика */
  rowHeight: number
  /** Цвет линии и заливки (по умолчанию синий) */
  color?: string
}

interface PointData {
  x: number
  y: number
  value: number
  date: string
  isInterpolated: boolean
  /** Прирост относительно предыдущего дня */
  delta: number | null
}

/**
 * Компонент area chart готовности этапа
 * С тултипами при наведении показывающими прирост за день
 */
export function StageReadinessArea({
  snapshots,
  range,
  timelineWidth,
  rowHeight,
  color = '#3b82f6',
}: StageReadinessAreaProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

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
    const firstDataDate = parseISO(sortedSnapshots[0].date)
    const lastDataDate = parseISO(sortedSnapshots[sortedSnapshots.length - 1].date)

    const result: PointData[] = []
    const totalDays = Math.ceil(timelineWidth / DAY_CELL_WIDTH)
    const graphHeight = rowHeight * 0.75
    const topPadding = rowHeight * 0.1

    let prevValue: number | null = null
    let lastKnownValue = sortedSnapshots[0].value

    for (let i = 0; i < totalDays; i++) {
      const dayDate = addDays(range.start, i)
      const dateKey = format(dayDate, 'yyyy-MM-dd')

      // Пропускаем дни до/после данных
      if (dayDate < firstDataDate || dayDate > lastDataDate) continue

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

      // Дельта относительно предыдущего дня (только для реальных точек)
      const delta = prevValue !== null && !isInterpolated ? value - prevValue : null

      result.push({ x, y, value, date: dateKey, isInterpolated, delta })
      prevValue = value
    }

    return result
  }, [snapshots, range.start, timelineWidth, rowHeight])

  if (points.length === 0) return null

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

  // Последняя точка для отображения текущего значения и прироста
  const lastPoint = points[points.length - 1]

  // Вычисляем прирост за сегодня (относительно вчера)
  const todayDelta = useMemo(() => {
    if (points.length < 2) return null
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayPoint = points.find(p => p.date === today)
    if (todayPoint?.delta !== null && todayPoint?.delta !== undefined) {
      return todayPoint.delta
    }
    // Если нет точки за сегодня, берём последнюю дельту
    return lastPoint?.delta ?? null
  }, [points, lastPoint])

  // Уникальный ID для градиента
  const gradientId = `stageReadinessGradient-${Math.random().toString(36).substr(2, 9)}`

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className="absolute inset-0"
        style={{ width: timelineWidth, height: rowHeight }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: timelineWidth, height: rowHeight }}
        >
          {/* Градиентная заливка */}
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.08} />
            </linearGradient>
          </defs>

          {/* Заливка */}
          {areaPath && (
            <path
              d={areaPath}
              fill={`url(#${gradientId})`}
            />
          )}

          {/* Верхняя граница — сплошная линия */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
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
              fill={color}
              stroke="white"
              strokeWidth="1"
            />
          )}
        </svg>

        {/* Интерактивные зоны для тултипов */}
        {points.map((point, i) => (
          <Tooltip key={i} open={hoveredIndex === i}>
            <TooltipTrigger asChild>
              <div
                className="absolute cursor-default"
                style={{
                  left: point.x - DAY_CELL_WIDTH / 2,
                  top: 0,
                  width: DAY_CELL_WIDTH,
                  height: rowHeight,
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground text-[10px]">
                  {format(parseISO(point.date), 'd MMMM', { locale: ru })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color }}>
                    {Math.round(point.value)}%
                  </span>
                  {point.isInterpolated && (
                    <span className="text-muted-foreground">(~)</span>
                  )}
                  {point.delta !== null && point.delta !== 0 && (
                    <span
                      className={
                        point.delta > 0
                          ? 'text-emerald-500'
                          : 'text-red-400'
                      }
                    >
                      {point.delta > 0 ? '+' : ''}
                      {Math.round(point.delta)}%
                    </span>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Подпись последнего значения с приростом */}
        {lastPoint && (
          <div
            className="absolute flex items-center gap-1 pointer-events-none"
            style={{
              left: lastPoint.x,
              // Если значение > 70%, показываем подпись снизу чтобы не обрезалась
              top: lastPoint.value > 70 ? lastPoint.y + 8 : lastPoint.y - 14,
              transform: 'translateX(-50%)',
            }}
          >
            <span
              className="text-[9px] font-medium tabular-nums"
              style={{ color, textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
            >
              {Math.round(lastPoint.value)}%
            </span>
            {todayDelta !== null && todayDelta !== 0 && (
              <span
                className={`text-[8px] font-medium tabular-nums ${
                  todayDelta > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
                style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
              >
                {todayDelta > 0 ? '+' : ''}
                {Math.round(todayDelta)}
              </span>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

/**
 * Хелпер для вычисления прироста за сегодня
 * Используется в sidebar этапа
 *
 * Без интерполяции: сравнивает только реальные снэпшоты
 */
export function calculateTodayDelta(snapshots: ReadinessPoint[]): number | null {
  if (!snapshots || snapshots.length === 0) return null

  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  // Сортируем
  const sorted = [...snapshots].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Ищем точные значения за сегодня и вчера
  let todayValue: number | null = null
  let yesterdayValue: number | null = null

  for (const snap of sorted) {
    if (snap.date === today) todayValue = snap.value
    if (snap.date === yesterday) yesterdayValue = snap.value
  }

  // Если нет точного значения за сегодня, берём последнее известное
  if (todayValue === null && sorted.length > 0) {
    todayValue = sorted[sorted.length - 1].value
  }

  // Если нет точного значения за вчера, ищем последнее известное до вчера
  if (yesterdayValue === null && sorted.length > 0) {
    const yesterdayDate = new Date(yesterday)
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (new Date(sorted[i].date) < yesterdayDate) {
        yesterdayValue = sorted[i].value
        break
      }
    }
    // Если не нашли ничего до вчера, берём первое значение
    if (yesterdayValue === null) {
      yesterdayValue = sorted[0].value
    }
  }

  if (todayValue !== null && yesterdayValue !== null) {
    return todayValue - yesterdayValue
  }

  return null
}
