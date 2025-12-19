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
  /** Горизонтальное смещение для вертикальных линий (левый отступ) */
  leftOffset?: number
}

/**
 * Компонент расширенной рамки этапа при раскрытии
 * Показывает фоновую заливку и вертикальные линии связи до задач
 */
export function StageExpandedFrame({
  startDate,
  endDate,
  range,
  color,
  itemsCount,
  stageRowHeight,
  isExpanded,
  leftOffset = 24,
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
      {/* Фоновая заливка на весь блок */}
      <div
        className="absolute inset-0 rounded-sm"
        style={{
          backgroundColor: `${color}08`, // 3% opacity
          border: `1px solid ${color}20`,
        }}
      />

      {/* Вертикальные линии связи от этапа к задачам */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ overflow: 'visible' }}
      >
        {/* Линии для каждой задачи */}
        {Array.from({ length: itemsCount }).map((_, index) => {
          const taskY = stageRowHeight + index * ROW_HEIGHT + ROW_HEIGHT / 2

          return (
            <g key={index}>
              {/* Горизонтальная линия от левого края к задаче */}
              <line
                x1={0}
                y1={taskY}
                x2={leftOffset}
                y2={taskY}
                stroke={color}
                strokeWidth="1"
                strokeOpacity="0.2"
                strokeDasharray="2,2"
              />
              {/* Вертикальная линия от этапа до начала горизонтальной */}
              {index === 0 && (
                <line
                  x1={0}
                  y1={stageRowHeight}
                  x2={0}
                  y2={stageRowHeight + itemsCount * ROW_HEIGHT}
                  stroke={color}
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
