/**
 * MOCK — плановые даты проекта на таймлайне (два показателя).
 *
 * Мануальный ввод РП (синий) и вычисленные из суммы разделов (бирюзовый).
 * Рендерится в строке проекта за агрегированными барами загрузок.
 *
 * Удалить после реализации настоящего API.
 */

'use client'

import { useMemo } from 'react'
import {
  MOCK_PROJECT_DATES,
  MOCK_PROJECT_ID,
} from '@/modules/resource-graph/mocks/stagePeriods'
import { calcMockPosition } from './utils'
import type { DayCell } from '../../types'

interface MockProjectDateBarsProps {
  projectId: string
  dayCells: DayCell[]
  rowHeight: number
}

export function MockProjectDateBars({
  projectId,
  dayCells,
  rowHeight,
}: MockProjectDateBarsProps) {
  const positions = useMemo(() => {
    if (projectId !== MOCK_PROJECT_ID) return null
    const { manual, calculated } = MOCK_PROJECT_DATES
    return {
      manual: calcMockPosition(manual.startDate, manual.endDate, dayCells),
      calculated: calcMockPosition(calculated.startDate, calculated.endDate, dayCells),
    }
  }, [projectId, dayCells])

  if (!positions) return null

  const halfHeight = Math.floor(rowHeight / 2)

  return (
    <>
      {/* Мануальные даты (РП вводит вручную) — верхняя полоса */}
      {positions.manual && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: positions.manual.left,
            width: positions.manual.width,
            top: 0,
            height: halfHeight,
            background: 'rgba(99, 102, 241, 0.12)',
            borderLeft: '2px solid rgba(99, 102, 241, 0.4)',
            borderRight: '2px solid rgba(99, 102, 241, 0.4)',
            zIndex: 0,
          }}
        >
          <span
            className="absolute left-1.5 top-1 text-[9px] font-medium leading-none"
            style={{ color: 'rgba(99, 102, 241, 0.8)' }}
          >
            РП план
          </span>
        </div>
      )}

      {/* Вычисленные даты (из разделов) — нижняя полоса */}
      {positions.calculated && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: positions.calculated.left,
            width: positions.calculated.width,
            top: halfHeight,
            height: halfHeight,
            background: 'rgba(30, 114, 96, 0.1)',
            borderLeft: '2px solid rgba(30, 114, 96, 0.4)',
            borderRight: '2px solid rgba(30, 114, 96, 0.4)',
            zIndex: 0,
          }}
        >
          <span
            className="absolute left-1.5 bottom-1 text-[9px] font-medium leading-none"
            style={{ color: 'rgba(30, 114, 96, 0.8)' }}
          >
            из разделов
          </span>
        </div>
      )}
    </>
  )
}
