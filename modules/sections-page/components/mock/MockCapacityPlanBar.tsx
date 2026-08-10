/**
 * MOCK — плановая ёмкость раздела в ставках (запрос РП).
 *
 * Отображает планируемое количество ставок как янтарный бар в верхней части строки.
 * Несколько периодов могут следовать подряд с разным значением ставок.
 *
 * Удалить после реализации настоящего API.
 */

'use client'

import { useMemo } from 'react'
import { MOCK_CAPACITY_PLANS } from '@/modules/resource-graph/mocks/stagePeriods'
import { calcMockPosition } from './utils'
import type { DayCell } from '../../types'

interface MockCapacityPlanBarProps {
  sectionId: string
  dayCells: DayCell[]
}

const BAR_HEIGHT = 14
const BAR_TOP = 3

export function MockCapacityPlanBar({
  sectionId,
  dayCells,
}: MockCapacityPlanBarProps) {
  const bars = useMemo(() => {
    return MOCK_CAPACITY_PLANS
      .filter((p) => p.sectionId === sectionId)
      .map((plan) => {
        const pos = calcMockPosition(plan.startDate, plan.endDate, dayCells)
        if (!pos) return null
        return { ...plan, ...pos }
      })
      .filter(Boolean)
  }, [sectionId, dayCells])

  if (!bars.length) return null

  return (
    <>
      {bars.map((bar, i) => (
        <div
          key={i}
          className="absolute pointer-events-none overflow-hidden flex items-center"
          style={{
            left: bar!.left + 1,
            width: bar!.width - 2,
            top: BAR_TOP,
            height: BAR_HEIGHT,
            background: 'rgba(251, 191, 36, 0.25)',
            borderRadius: 3,
            border: '1px solid rgba(251, 191, 36, 0.5)',
            zIndex: 1,
          }}
        >
          <span
            className="px-1 text-[9px] font-semibold leading-none truncate"
            style={{ color: 'rgba(180, 120, 0, 0.9)' }}
          >
            {bar!.plannedRates} ст
          </span>
        </div>
      ))}
    </>
  )
}
