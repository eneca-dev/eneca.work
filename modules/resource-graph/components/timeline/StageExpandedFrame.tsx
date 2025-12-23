'use client'

import { calculateBarPosition } from './TimelineBar'
import type { TimelineRange } from '../../types'
import { ROW_HEIGHT } from '../../constants'

interface StageExpandedFrameProps {
  /** Дата начала этапа */
  startDate: string | null
  /** Дата окончания этапа */
  endDate: string | null
  /** Диапазон таймлайна */
  range: TimelineRange
  /** Цвет рамки */
  color: string
  /** Количество задач (для расчёта высоты) */
  itemsCount: number
  /** Высота строки этапа */
  stageRowHeight: number
  /** Этап развёрнут */
  isExpanded: boolean
}

/**
 * Компонент расширенной рамки этапа при раскрытии
 * Показывает фоновую заливку с вертикальными границами
 */
export function StageExpandedFrame({
  startDate,
  endDate,
  range,
  color,
  itemsCount,
  stageRowHeight,
  isExpanded,
}: StageExpandedFrameProps) {
  // Если не развёрнут или нет задач - не рендерим
  if (!isExpanded || itemsCount === 0) return null

  const position = calculateBarPosition(startDate, endDate, range)
  if (!position) return null

  // Рассчитываем общую высоту: этап + все задачи
  const totalHeight = stageRowHeight + itemsCount * ROW_HEIGHT

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        left: position.left,
        width: position.width,
        top: 0,
        height: totalHeight,
      }}
    >
      {/* Фоновая заливка на весь блок с границами как у этапа */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `${color}08`, // 3% opacity
          borderLeft: `2px solid ${color}40`,
          borderRight: `2px solid ${color}40`,
        }}
      />
    </div>
  )
}
