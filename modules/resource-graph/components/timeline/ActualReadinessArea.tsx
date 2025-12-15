'use client'

import { useMemo } from 'react'
import { differenceInDays, parseISO, format, addDays } from 'date-fns'
import type { ReadinessPoint, TimelineRange } from '../../types'
import { DAY_CELL_WIDTH, SECTION_ROW_HEIGHT } from '../../constants'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface ActualReadinessAreaProps {
  /** Снэпшоты фактической готовности */
  snapshots: ReadinessPoint[]
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
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
}: ActualReadinessAreaProps) {
  // Вычисляем точки с интерполяцией
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
    const graphHeight = SECTION_ROW_HEIGHT * 0.75
    const topPadding = SECTION_ROW_HEIGHT * 0.1

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
      } else {
        value = interpolateValue(dayDate, sortedSnapshots)
        isInterpolated = true
      }

      // X координата: центр ячейки
      const x = i * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2

      // Y координата
      const y = topPadding + graphHeight * (1 - value / 100)

      result.push({ x, y, value, date: dateKey, isInterpolated })
    }

    return result
  }, [snapshots, range.start, timelineWidth])

  if (points.length === 0) return null

  // Создаём SVG path для заливки (от точек до низа)
  const baseY = SECTION_ROW_HEIGHT * 0.85
  const areaPath = useMemo(() => {
    if (points.length < 1) return ''

    // Начинаем с нижней левой точки
    let path = `M ${points[0].x} ${baseY}`

    // Идём вверх к первой точке
    path += ` L ${points[0].x} ${points[0].y}`

    // Соединяем все точки
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`
    }

    // Идём вниз к базовой линии и замыкаем
    path += ` L ${points[points.length - 1].x} ${baseY}`
    path += ' Z'

    return path
  }, [points, baseY])

  // Находим последнюю точку для отображения текущего значения
  const lastPoint = points[points.length - 1]

  return (
    <TooltipProvider delayDuration={50}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT }}
      >
        <svg
          className="absolute inset-0"
          style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT }}
        >
          {/* Градиентная заливка синим */}
          <defs>
            <linearGradient id="actualReadinessGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          {areaPath && (
            <path
              d={areaPath}
              fill="url(#actualReadinessGradient)"
            />
          )}
        </svg>

        {/* Подпись последнего значения */}
        {lastPoint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute flex flex-col items-center pointer-events-auto cursor-default"
                style={{
                  left: lastPoint.x,
                  top: lastPoint.y - 16,
                  transform: 'translateX(-50%)',
                }}
              >
                <span
                  className="text-[9px] font-medium tabular-nums px-1 py-0.5 rounded transition-colors hover:bg-blue-500/20"
                  style={{
                    color: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  }}
                >
                  {Math.round(lastPoint.value)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground text-[10px]">
                  {format(parseISO(lastPoint.date), 'dd.MM.yyyy')}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Факт:</span>
                  <span className="font-medium" style={{ color: '#3b82f6' }}>
                    {Math.round(lastPoint.value)}%
                  </span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

/**
 * Интерполирует фактическое значение
 */
function interpolateValue(date: Date, snapshots: ReadinessPoint[]): number {
  let leftPoint: ReadinessPoint | null = null
  let rightPoint: ReadinessPoint | null = null

  for (const snap of snapshots) {
    const snapDate = parseISO(snap.date)
    if (snapDate <= date) {
      leftPoint = snap
    }
    if (snapDate >= date && !rightPoint) {
      rightPoint = snap
      break
    }
  }

  if (!leftPoint && rightPoint) return rightPoint.value
  if (leftPoint && !rightPoint) return leftPoint.value
  if (!leftPoint || !rightPoint) return 0

  const leftDate = parseISO(leftPoint.date)
  const rightDate = parseISO(rightPoint.date)
  const totalDays = differenceInDays(rightDate, leftDate)
  if (totalDays === 0) return leftPoint.value

  const daysFromLeft = differenceInDays(date, leftDate)
  const ratio = daysFromLeft / totalDays

  return leftPoint.value + (rightPoint.value - leftPoint.value) * ratio
}
