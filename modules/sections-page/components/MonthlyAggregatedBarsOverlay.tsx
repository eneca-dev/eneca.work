/**
 * MonthlyAggregatedBarsOverlay — месячная обёртка над PeriodAggregatedBarsOverlay
 * (feature-AB-11). Симметрична недельной: вся логика в общем компоненте, здесь
 * только именование пропов месячной сетки.
 *
 * Число на баре — среднедневная ставка за рабочие дни месяца, тот же смысл, что
 * и в недельном режиме, поэтому цвета и проценты сравнимы между масштабами.
 */

'use client'

import { PeriodAggregatedBarsOverlay } from './PeriodAggregatedBarsOverlay'
import type { SectionLoading } from '../types'
import type { MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

interface MonthlyAggregatedBarsOverlayProps {
  loadings: SectionLoading[]
  /** Базовая ёмкость (из данных ObjectSection) */
  defaultCapacity: number
  /** Per-date переопределения ёмкости (dateStr → capacity) */
  dateCapacityOverrides?: Record<string, number>
  monthCells: MonthCell[]
  monthCellWidth: number
  rowHeight: number
  /** Видимые колонки месяца (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
  /** Включить inline-редактирование ёмкости */
  editable?: boolean
  /**
   * Сохранить ёмкость на диапазон дат (границы месяца — 1-е число первого
   * месяца … последний день последнего). Осознанно перезатирает дневные и
   * недельные значения внутри диапазона — см. feature-AB-11, решение 6.
   */
  onSaveCapacity?: (startDate: string, endDate: string, value: number) => void
  /** Знаков после запятой в тексте бара. По умолчанию 2. */
  decimals?: number
}

export function MonthlyAggregatedBarsOverlay({
  monthCells,
  monthCellWidth,
  ...rest
}: MonthlyAggregatedBarsOverlayProps) {
  // MonthCell структурно совместим с PeriodCell (startDate/endDate/label/workingDates)
  return <PeriodAggregatedBarsOverlay cells={monthCells} cellWidth={monthCellWidth} {...rest} />
}
