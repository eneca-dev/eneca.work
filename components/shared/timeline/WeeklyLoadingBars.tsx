/**
 * Weekly Loading Bars Component
 *
 * Рендерит полоски загрузок в том же стиле, что и дневной режим,
 * но позиционирует их по неделям (по образцу MonthlyLoadingBars).
 * Без resize-хендлов — редактирование дат только через клик по бару → модалка.
 */

'use client'

import { useMemo } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import { LoadingBarButton, BAR_HEIGHT, BAR_GAP, BAR_TOP_OFFSET, type BarPosition, type BarRender } from './LoadingBarButton'
import type { MonthlyBarLoading } from './MonthlyLoadingBars'

// ============================================================================
// Types
// ============================================================================

/** Совпадает по форме с MonthlyBarLoading — общий контракт для бара загрузки на широкой сетке. */
export type WeeklyBarLoading = MonthlyBarLoading

interface WeeklyLoadingBarsProps {
  loadings: WeeklyBarLoading[]
  weekCells: WeekCell[]
  weekCellWidth: number
  onLoadingClick?: (loadingId: string) => void
}

// ============================================================================
// Constants
// ============================================================================

const DAYS_IN_WEEK = 7

// ============================================================================
// Position Calculation
// ============================================================================

/**
 * Рассчитывает позицию полоски загрузки на недельной сетке.
 *
 * Если загрузка начинается/заканчивается внутри недели —
 * позиция пропорциональна дню внутри недели (неделя всегда 7 дней).
 */
function calculateWeeklyBarPosition(
  startDate: string,
  endDate: string,
  weekCells: WeekCell[],
  weekCellWidth: number
): BarPosition | null {
  if (weekCells.length === 0) return null

  const firstWeekStart = weekCells[0].startDate
  const lastWeekEnd = weekCells[weekCells.length - 1].endDate

  // Загрузка полностью вне видимого диапазона
  if (endDate < firstWeekStart || startDate > lastWeekEnd) return null

  // Обрезаем до видимого диапазона
  const clampedStart = startDate < firstWeekStart ? firstWeekStart : startDate
  const clampedEnd = endDate > lastWeekEnd ? lastWeekEnd : endDate

  let left = 0
  let right = 0
  let foundStart = false
  let foundEnd = false

  for (let i = 0; i < weekCells.length; i++) {
    const wc = weekCells[i]
    const colLeft = i * weekCellWidth

    if (!foundStart && clampedStart >= wc.startDate && clampedStart <= wc.endDate) {
      const dayOffset = daysBetween(wc.startDate, clampedStart)
      left = colLeft + (dayOffset / DAYS_IN_WEEK) * weekCellWidth
      foundStart = true
    }

    if (!foundEnd && clampedEnd >= wc.startDate && clampedEnd <= wc.endDate) {
      const dayOffset = daysBetween(wc.startDate, clampedEnd) + 1
      right = colLeft + (dayOffset / DAYS_IN_WEEK) * weekCellWidth
      foundEnd = true
    }
  }

  // Если start раньше первой недели
  if (!foundStart) left = 0
  // Если end позже последней недели
  if (!foundEnd) right = weekCells.length * weekCellWidth

  const width = Math.max(right - left, 4) // минимум 4px

  return { left, width }
}

/** Количество дней между двумя YYYY-MM-DD строками */
function daysBetween(a: string, b: string): number {
  const da = new Date(a)
  const db = new Date(b)
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24))
}

// ============================================================================
// Row height calculation
// ============================================================================

/**
 * Раскладывает загрузки по рядам, чтобы не перекрывались
 */
function layoutBars(
  loadings: WeeklyBarLoading[],
  weekCells: WeekCell[],
  weekCellWidth: number
): BarRender[] {
  const bars: BarRender[] = []

  // Сортируем по дате начала
  const sorted = [...loadings].sort((a, b) => a.startDate.localeCompare(b.startDate))

  // Трекаем правую границу каждого ряда
  const rowEnds: number[] = []

  for (const loading of sorted) {
    const position = calculateWeeklyBarPosition(
      loading.startDate,
      loading.endDate,
      weekCells,
      weekCellWidth
    )
    if (!position) continue

    // Ищем первый ряд, где бар не перекрывается
    let row = 0
    while (row < rowEnds.length && rowEnds[row] > position.left) {
      row++
    }

    rowEnds[row] = position.left + position.width
    bars.push({ loading, position, row })
  }

  return bars
}

export function calculateWeeklyBarsRowHeight(loadings: WeeklyBarLoading[], weekCells: WeekCell[], weekCellWidth: number): number {
  const bars = layoutBars(loadings, weekCells, weekCellWidth)
  if (bars.length === 0) return 44
  const maxRow = Math.max(...bars.map((b) => b.row))
  return Math.max(44, BAR_TOP_OFFSET + (maxRow + 1) * (BAR_HEIGHT + BAR_GAP) + BAR_TOP_OFFSET)
}

// ============================================================================
// Component
// ============================================================================

export function WeeklyLoadingBars({
  loadings,
  weekCells,
  weekCellWidth,
  onLoadingClick,
}: WeeklyLoadingBarsProps) {
  const bars = useMemo(
    () => layoutBars(loadings, weekCells, weekCellWidth),
    [loadings, weekCells, weekCellWidth]
  )

  return (
    <TooltipProvider>
      <div className="absolute inset-0" style={{ zIndex: 4 }}>
        {bars.map((bar) => (
          <LoadingBarButton key={bar.loading.id} bar={bar} onLoadingClick={onLoadingClick} />
        ))}
      </div>
    </TooltipProvider>
  )
}
