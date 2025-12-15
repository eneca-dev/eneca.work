'use client'

import type { TimelineRange } from '../../types'
import { calculateBarPosition } from './TimelineBar'

interface SectionPeriodFrameProps {
  startDate: string | null
  endDate: string | null
  range: TimelineRange
  color?: string | null
}

/**
 * Рамка периода раздела — серая заливка с вертикальными линиями по краям
 */
export function SectionPeriodFrame({ startDate, endDate, range, color }: SectionPeriodFrameProps) {
  const position = calculateBarPosition(startDate, endDate, range)

  if (!position) return null

  const frameColor = color || '#3b82f6'
  const borderWidth = 2

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: position.left,
        width: position.width,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(156, 163, 175, 0.08)', // gray fill
      }}
    >
      {/* Левая вертикальная линия */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: borderWidth,
          backgroundColor: `${frameColor}60`,
        }}
      />
      {/* Правая вертикальная линия */}
      <div
        className="absolute right-0 top-0 bottom-0"
        style={{
          width: borderWidth,
          backgroundColor: `${frameColor}60`,
        }}
      />
    </div>
  )
}
