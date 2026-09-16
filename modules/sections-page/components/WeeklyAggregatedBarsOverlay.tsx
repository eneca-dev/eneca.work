/**
 * WeeklyAggregatedBarsOverlay — недельная обёртка над PeriodAggregatedBarsOverlay.
 *
 * Вся логика (мини-бар X/Y, цвет, inline-редактор ёмкости с растягиванием
 * диапазона) живёт в общем компоненте — месячный режим (feature-AB-11)
 * переиспользует её один в один. Здесь остаётся только именование пропов
 * недельной сетки, чтобы вызывающие строки не менялись.
 */

'use client'

import { PeriodAggregatedBarsOverlay } from './PeriodAggregatedBarsOverlay'
import type { SectionLoading } from '../types'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

interface WeeklyAggregatedBarsOverlayProps {
  loadings: SectionLoading[]
  /** Базовая ёмкость (из данных ObjectSection) */
  defaultCapacity: number
  /** Per-date переопределения ёмкости (dateStr → capacity) */
  dateCapacityOverrides?: Record<string, number>
  weekCells: WeekCell[]
  weekCellWidth: number
  rowHeight: number
  /** Видимые колонки недели (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
  /** Включить inline-редактирование ёмкости */
  editable?: boolean
  /** Сохранить ёмкость на диапазон дат (границы недели) */
  onSaveCapacity?: (startDate: string, endDate: string, value: number) => void
  /** Знаков после запятой в тексте бара. По умолчанию 2. */
  decimals?: number
}

export function WeeklyAggregatedBarsOverlay({
  weekCells,
  weekCellWidth,
  ...rest
}: WeeklyAggregatedBarsOverlayProps) {
  // WeekCell структурно совместим с PeriodCell (startDate/endDate/label/workingDates)
  return <PeriodAggregatedBarsOverlay cells={weekCells} cellWidth={weekCellWidth} {...rest} />
}
