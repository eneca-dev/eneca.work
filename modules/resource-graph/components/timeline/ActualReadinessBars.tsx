'use client'

import { useMemo } from 'react'
import { differenceInDays, parseISO, format } from 'date-fns'
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
}

/**
 * Компонент столбиков фактической готовности
 * Отрисовывает столбик в каждой ячейке дня, высота = % готовности
 */
export function ActualReadinessBars({
  snapshots,
  range,
  timelineWidth,
}: ActualReadinessBarsProps) {
  // Создаём Map для быстрого поиска по дате
  const snapshotMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const snap of snapshots) {
      map.set(snap.date, snap.value)
    }
    return map
  }, [snapshots])

  // Вычисляем позиции баров
  const bars = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []

    const result: Array<{
      x: number
      height: number
      value: number
      date: string
    }> = []

    // Проходим по всем дням в диапазоне
    const totalDays = Math.ceil(timelineWidth / DAY_CELL_WIDTH)

    for (let i = 0; i < totalDays; i++) {
      const dayDate = new Date(range.start)
      dayDate.setDate(dayDate.getDate() + i)
      const dateKey = format(dayDate, 'yyyy-MM-dd')

      const value = snapshotMap.get(dateKey)
      if (value === undefined) continue

      // X координата: левый край ячейки + небольшой отступ
      const x = i * DAY_CELL_WIDTH + 4 // 4px отступ слева

      // Высота бара: % от доступной высоты (80% от высоты строки)
      const maxBarHeight = SECTION_ROW_HEIGHT * 0.7
      const height = (value / 100) * maxBarHeight

      result.push({ x, height, value, date: dateKey })
    }

    return result
  }, [snapshots, snapshotMap, range.start, timelineWidth])

  if (bars.length === 0) return null

  // Ширина каждого бара
  const barWidth = DAY_CELL_WIDTH - 8 // 4px отступ с каждой стороны

  // Базовая линия (низ баров)
  const baseY = SECTION_ROW_HEIGHT * 0.85

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT }}
      >
        {bars.map((bar, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                className="absolute pointer-events-auto cursor-default"
                style={{
                  left: bar.x,
                  bottom: SECTION_ROW_HEIGHT - baseY,
                  width: barWidth,
                  height: bar.height,
                  backgroundColor: getBarColor(bar.value),
                  borderRadius: '2px 2px 0 0',
                  opacity: 0.7,
                  transition: 'opacity 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7'
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="font-medium">{bar.value}%</div>
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
 * Возвращает цвет бара в зависимости от процента готовности
 */
function getBarColor(value: number): string {
  if (value >= 80) return '#22c55e' // green-500
  if (value >= 50) return '#eab308' // yellow-500
  if (value >= 20) return '#f97316' // orange-500
  return '#ef4444' // red-500
}
