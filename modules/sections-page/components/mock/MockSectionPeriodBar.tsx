/**
 * MOCK — фоновая подоснова плановых дат раздела на таймлайне.
 *
 * Отображает период section_start_date → section_end_date как полупрозрачный
 * фон с вертикальными границами (аналог SectionPeriodFrame в resource-graph).
 *
 * Удалить после реализации настоящего API.
 */

'use client'

import { useMemo } from 'react'
import { MOCK_SECTION_DATES } from '@/modules/resource-graph/mocks/stagePeriods'
import { calcMockPosition } from './utils'
import type { DayCell } from '../../types'

interface MockSectionPeriodBarProps {
  sectionId: string
  dayCells: DayCell[]
  rowHeight: number
}

export function MockSectionPeriodBar({
  sectionId,
  dayCells,
  rowHeight,
}: MockSectionPeriodBarProps) {
  const position = useMemo(() => {
    const entry = MOCK_SECTION_DATES.find((d) => d.sectionId === sectionId)
    if (!entry) return null
    return calcMockPosition(entry.startDate, entry.endDate, dayCells)
  }, [sectionId, dayCells])

  if (!position) return null

  return (
    <div
      className="absolute top-0 pointer-events-none"
      style={{
        left: position.left,
        width: position.width,
        height: rowHeight,
        zIndex: 0,
      }}
    >
      {/* Фоновая заливка */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(30, 114, 96, 0.07)' }}
      />
      {/* Левая граница */}
      <div
        className="absolute top-0 bottom-0 left-0"
        style={{ width: 2, background: 'rgba(30, 114, 96, 0.35)' }}
      />
      {/* Правая граница */}
      <div
        className="absolute top-0 bottom-0 right-0"
        style={{ width: 2, background: 'rgba(30, 114, 96, 0.35)' }}
      />
    </div>
  )
}
