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

interface ActualReadinessBarsProps {
  /** Снэпшоты фактической готовности */
  snapshots: ReadinessPoint[]
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
  /** Высота строки (по умолчанию SECTION_ROW_HEIGHT) */
  rowHeight?: number
}

interface BarData {
  x: number
  height: number
  value: number
  date: string
  /** Является ли значение интерполированным */
  isInterpolated: boolean
}

/**
 * Компонент столбиков фактической готовности
 * Отрисовывает столбик в каждой ячейке дня, высота = % готовности
 * Интерполирует значения между известными точками
 */
export function ActualReadinessBars({
  snapshots,
  range,
  timelineWidth,
  rowHeight = SECTION_ROW_HEIGHT,
}: ActualReadinessBarsProps) {
  // Вычисляем позиции баров с интерполяцией
  const bars = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []

    // Сортируем снэпшоты по дате
    const sortedSnapshots = [...snapshots].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Создаём Map для быстрого поиска по дате
    const snapshotMap = new Map<string, number>()
    for (const snap of sortedSnapshots) {
      snapshotMap.set(snap.date, snap.value)
    }

    // Находим границы данных
    const firstDataDate = parseISO(sortedSnapshots[0].date)
    const lastDataDate = parseISO(sortedSnapshots[sortedSnapshots.length - 1].date)

    const result: BarData[] = []
    const totalDays = Math.ceil(timelineWidth / DAY_CELL_WIDTH)
    const maxBarHeight = rowHeight * 0.7

    for (let i = 0; i < totalDays; i++) {
      const dayDate = addDays(range.start, i)
      const dateKey = format(dayDate, 'yyyy-MM-dd')

      // Пропускаем дни до первой точки данных
      if (dayDate < firstDataDate) continue
      // Пропускаем дни после последней точки данных
      if (dayDate > lastDataDate) continue

      let value: number
      let isInterpolated = false

      // Проверяем есть ли точное значение
      const exactValue = snapshotMap.get(dateKey)
      if (exactValue !== undefined) {
        value = exactValue
      } else {
        // Интерполируем между ближайшими точками
        value = interpolateValue(dayDate, sortedSnapshots)
        isInterpolated = true
      }

      // X координата: левый край ячейки + небольшой отступ
      const x = i * DAY_CELL_WIDTH + 4

      // Высота бара: % от доступной высоты
      const height = (value / 100) * maxBarHeight

      result.push({ x, height, value, date: dateKey, isInterpolated })
    }

    return result
  }, [snapshots, range.start, timelineWidth, rowHeight])

  if (bars.length === 0) return null

  // Ширина каждого бара
  const barWidth = DAY_CELL_WIDTH - 8

  // Базовая линия (низ баров)
  const baseY = rowHeight * 0.85

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ width: timelineWidth, height: rowHeight }}
      >
        {bars.map((bar, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                className="
                  absolute pointer-events-auto cursor-default
                  transition-all duration-150 ease-out
                  hover:scale-x-110 hover:brightness-125
                "
                style={{
                  left: bar.x,
                  bottom: rowHeight - baseY,
                  width: barWidth,
                  height: bar.height,
                  // Серый outline стиль
                  backgroundColor: bar.isInterpolated
                    ? 'transparent'
                    : 'rgba(156, 163, 175, 0.15)', // gray-400 с 15% opacity
                  border: '1px solid',
                  borderColor: bar.isInterpolated
                    ? 'rgba(156, 163, 175, 0.3)' // более прозрачный для интерполированных
                    : 'rgba(156, 163, 175, 0.5)', // gray-400 с 50% opacity
                  borderRadius: '2px 2px 0 0',
                  opacity: bar.isInterpolated ? 0.5 : 0.7,
                  transformOrigin: 'bottom center',
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="text-muted-foreground text-[10px] mb-0.5">
                Процент готовности на дату:
              </div>
              <div className="font-medium">
                {Math.round(bar.value)}%
                {bar.isInterpolated && (
                  <span className="text-muted-foreground ml-1">(~)</span>
                )}
              </div>
              <div className="text-muted-foreground">
                {format(parseISO(bar.date), 'dd.MM.yyyy')}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}

/**
 * Интерполирует значение для указанной даты между ближайшими известными точками
 */
function interpolateValue(date: Date, snapshots: ReadinessPoint[]): number {
  // Находим ближайшие точки слева и справа
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

  // Если нет левой точки, используем правую
  if (!leftPoint && rightPoint) return rightPoint.value
  // Если нет правой точки, используем левую
  if (leftPoint && !rightPoint) return leftPoint.value
  // Если нет обеих точек, возвращаем 0
  if (!leftPoint || !rightPoint) return 0

  // Линейная интерполяция
  const leftDate = parseISO(leftPoint.date)
  const rightDate = parseISO(rightPoint.date)

  const totalDays = differenceInDays(rightDate, leftDate)
  if (totalDays === 0) return leftPoint.value

  const daysFromLeft = differenceInDays(date, leftDate)
  const ratio = daysFromLeft / totalDays

  return leftPoint.value + (rightPoint.value - leftPoint.value) * ratio
}
