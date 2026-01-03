'use client'

import { useMemo, useState, useId } from 'react'
import { addDays, format, subDays } from 'date-fns'
import { parseMinskDate, formatMinskDate, getTodayMinsk } from '@/lib/timezone-utils'
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
  /** Дата начала этапа (для плановой линии) */
  stageStartDate?: string | null
  /** Дата окончания этапа (для плановой линии) */
  stageEndDate?: string | null
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
  stageStartDate,
  stageEndDate,
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

    // Границы данных (используем parseMinskDate для консистентности с range.start)
    const firstDataDate = parseMinskDate(sortedSnapshots[0].date)
    const lastDataDate = parseMinskDate(sortedSnapshots[sortedSnapshots.length - 1].date)

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

  // Вычисляем плановую линию (0% в начале этапа → 100% в конце)
  const plannedLine = useMemo(() => {
    if (!stageStartDate || !stageEndDate) return null

    const stageStart = parseMinskDate(stageStartDate)
    const stageEnd = parseMinskDate(stageEndDate)
    const stageDuration = Math.max(1, Math.ceil((stageEnd.getTime() - stageStart.getTime()) / (1000 * 60 * 60 * 24)))

    const graphHeight = rowHeight * 0.75
    const topPadding = rowHeight * 0.1
    const totalDays = Math.ceil(timelineWidth / DAY_CELL_WIDTH)

    // Находим X координаты для начала и конца этапа
    const startDayIndex = Math.ceil((stageStart.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24))
    const endDayIndex = Math.ceil((stageEnd.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24))

    // Проверяем что этап попадает в видимую область
    if (endDayIndex < 0 || startDayIndex >= totalDays) return null

    // Координаты точек
    const startX = Math.max(0, startDayIndex * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2)
    const endX = Math.min(timelineWidth, endDayIndex * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2)

    // Y: 0% внизу (topPadding + graphHeight), 100% вверху (topPadding)
    const startY = topPadding + graphHeight // 0%
    const endY = topPadding // 100%

    return {
      path: `M ${startX} ${startY} L ${endX} ${endY}`,
      startX,
      endX,
      stageDuration,
      // Функция для расчёта планового значения на конкретную дату
      getPlannedValue: (dateStr: string): number | null => {
        const date = parseMinskDate(dateStr)
        if (date < stageStart) return 0
        if (date > stageEnd) return 100
        const daysPassed = (date.getTime() - stageStart.getTime()) / (1000 * 60 * 60 * 24)
        return Math.round((daysPassed / stageDuration) * 100)
      }
    }
  }, [stageStartDate, stageEndDate, range.start, timelineWidth, rowHeight])

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
  const lastPoint = points.length > 0 ? points[points.length - 1] : null

  // Вычисляем прирост за сегодня (относительно вчера)
  const todayDelta = useMemo(() => {
    if (points.length < 2) return null
    const today = formatMinskDate(getTodayMinsk())
    const todayPoint = points.find(p => p.date === today)
    if (todayPoint?.delta !== null && todayPoint?.delta !== undefined) {
      return todayPoint.delta
    }
    // Если нет точки за сегодня, берём последнюю дельту
    return lastPoint?.delta ?? null
  }, [points, lastPoint])

  // Уникальный ID для градиента (React useId для стабильности)
  const uniqueId = useId()
  const gradientId = `stageReadiness-${uniqueId}`

  // Early return ПОСЛЕ всех хуков
  if (points.length === 0) return null

  // Ранний выход ПОСЛЕ всех хуков
  if (points.length === 0) return null

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

          {/* Плановая линия — пунктирная */}
          {plannedLine && (
            <path
              d={plannedLine.path}
              fill="none"
              stroke={color}
              strokeWidth="1"
              strokeDasharray="4 3"
              strokeOpacity="0.5"
            />
          )}

          {/* Верхняя граница — сплошная линия (факт) */}
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
                  {format(parseMinskDate(point.date), 'd MMMM', { locale: ru })}
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
                {/* План vs Факт */}
                {plannedLine && (() => {
                  const plannedValue = plannedLine.getPlannedValue(point.date)
                  if (plannedValue === null) return null
                  const diff = Math.round(point.value) - plannedValue
                  return (
                    <div className="flex items-center gap-2 pt-0.5 border-t border-border/50">
                      <span className="text-muted-foreground">
                        План: {plannedValue}%
                      </span>
                      {diff !== 0 && (
                        <span className={diff > 0 ? 'text-emerald-500' : 'text-red-400'}>
                          {diff > 0 ? '+' : ''}{diff}%
                        </span>
                      )}
                    </div>
                  )
                })()}
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

  const todayDate = getTodayMinsk()
  const today = formatMinskDate(todayDate)
  const yesterday = formatMinskDate(subDays(todayDate, 1))

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
