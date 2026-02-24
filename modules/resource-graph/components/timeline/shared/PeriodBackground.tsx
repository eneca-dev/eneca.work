'use client'

import type { TimelineRange } from '../../../types'
import { calculateBarPosition } from '../TimelineBar'
import { useTimelineResize } from '../../../hooks'
import { parseMinskDate } from '@/lib/timezone-utils'

// ============================================================================
// Period Background (фоновая заливка периода с поддержкой resize)
// ============================================================================

interface PeriodBackgroundProps {
  startDate: string | null
  endDate: string | null
  range: TimelineRange
  color?: string | null
  /** Callback для resize (если передан — включается drag-to-resize) */
  onResize?: (newStartDate: string, newEndDate: string) => void
}

// Константа для ширины resize handle
const PERIOD_RESIZE_HANDLE_WIDTH = 8

/**
 * Фоновая заливка периода с вертикальными линиями по краям
 * Используется для разделов и этапов декомпозиции
 * Поддерживает drag-to-resize если передан onResize callback
 */
export function PeriodBackground({ startDate, endDate, range, color, onResize }: PeriodBackgroundProps) {
  const position = calculateBarPosition(startDate, endDate, range)

  if (!position) return null

  // Если есть onResize и даты валидны — рендерим resizable версию
  if (onResize && startDate && endDate) {
    return (
      <ResizablePeriodBackground
        startDate={startDate}
        endDate={endDate}
        range={range}
        color={color}
        onResize={onResize}
        position={position}
      />
    )
  }

  // Иначе — обычная статичная версия
  const bgColor = color || '#3b82f6'

  return (
    <div
      className="absolute inset-y-0 pointer-events-none"
      style={{
        left: position.left,
        width: position.width,
        backgroundColor: `${bgColor}15`, // 8% opacity
        borderLeft: `2px solid ${bgColor}40`,
        borderRight: `2px solid ${bgColor}40`,
      }}
    />
  )
}

/**
 * Resizable версия PeriodBackground
 * Выделена в отдельный компонент чтобы хук вызывался безусловно
 */
function ResizablePeriodBackground({
  startDate,
  endDate,
  range,
  color,
  onResize,
  position,
}: {
  startDate: string
  endDate: string
  range: TimelineRange
  color?: string | null
  onResize: (newStartDate: string, newEndDate: string) => void
  position: { left: number; width: number }
}) {
  const {
    leftHandleProps,
    rightHandleProps,
    isResizing,
    previewPosition,
  } = useTimelineResize({
    startDate,
    endDate,
    range,
    onResize,
    minDays: 1,
  })

  // Используем preview позицию пока она есть (даже после окончания drag, пока ждём обновления props)
  const displayPosition = previewPosition ?? position

  // Если бар клипован — не показываем handle на клипованном крае
  const isClippedLeft = parseMinskDate(startDate) < range.start
  const isClippedRight = parseMinskDate(endDate) > range.end

  // Цвет с низкой прозрачностью для фона
  const bgColor = color || '#3b82f6'

  return (
    <div
      className={`absolute inset-y-0 ${isResizing ? 'z-40' : ''}`}
      style={{
        left: displayPosition.left,
        width: displayPosition.width,
        backgroundColor: isResizing ? `${bgColor}25` : `${bgColor}15`,
        borderLeft: `2px solid ${isResizing ? bgColor : `${bgColor}40`}`,
        borderRight: `2px solid ${isResizing ? bgColor : `${bgColor}40`}`,
      }}
    >
      {/* Left resize handle */}
      {!isClippedLeft && (
        <div
          {...leftHandleProps}
          className="absolute top-0 bottom-0 hover:bg-white/10 transition-colors cursor-ew-resize group"
          style={{
            left: -PERIOD_RESIZE_HANDLE_WIDTH / 2,
            width: PERIOD_RESIZE_HANDLE_WIDTH,
            zIndex: 10,
          }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-white/0 group-hover:bg-white/30 transition-colors"
          />
        </div>
      )}

      {/* Right resize handle */}
      {!isClippedRight && (
        <div
          {...rightHandleProps}
          className="absolute top-0 bottom-0 hover:bg-white/10 transition-colors cursor-ew-resize group"
          style={{
            right: -PERIOD_RESIZE_HANDLE_WIDTH / 2,
            width: PERIOD_RESIZE_HANDLE_WIDTH,
            zIndex: 10,
          }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-white/0 group-hover:bg-white/30 transition-colors"
          />
        </div>
      )}
    </div>
  )
}
