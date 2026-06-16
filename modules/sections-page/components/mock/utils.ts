/**
 * MOCK utils — вспомогательные функции позиционирования на таймлайне
 */

import { format } from 'date-fns'
import { DAY_CELL_WIDTH } from '../../constants'
import type { DayCell } from '../../types'

/**
 * Вычисляет left/width в пикселях для диапазона дат на таймлайне.
 * Обрезает диапазон по видимой области.
 */
export function calcMockPosition(
  startDate: string,
  endDate: string,
  dayCells: DayCell[]
): { left: number; width: number } | null {
  if (!dayCells.length) return null

  const startIdx = dayCells.findIndex(
    (c) => format(c.date, 'yyyy-MM-dd') === startDate
  )
  const endIdx = dayCells.findIndex(
    (c) => format(c.date, 'yyyy-MM-dd') === endDate
  )

  // Полностью вне видимой области
  if (startIdx === -1 && endIdx === -1) {
    const firstDate = format(dayCells[0].date, 'yyyy-MM-dd')
    const lastDate = format(dayCells[dayCells.length - 1].date, 'yyyy-MM-dd')
    // Диапазон перекрывает всю видимую область
    if (startDate <= firstDate && endDate >= lastDate) {
      return { left: 0, width: dayCells.length * DAY_CELL_WIDTH }
    }
    return null
  }

  const visibleStart = startIdx === -1 ? 0 : startIdx
  const visibleEnd = endIdx === -1 ? dayCells.length - 1 : endIdx

  return {
    left: visibleStart * DAY_CELL_WIDTH,
    width: (visibleEnd - visibleStart + 1) * DAY_CELL_WIDTH,
  }
}
