/**
 * Monthly Loading Bars Component
 *
 * Рендерит полоски загрузок в том же стиле, что и дневной режим,
 * но позиционирует их по месяцам.
 */

'use client'

import { useMemo } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'
import { LoadingBarButton, BAR_HEIGHT, BAR_GAP, BAR_TOP_OFFSET, type BarPosition, type BarRender } from './LoadingBarButton'

// ============================================================================
// Types
// ============================================================================

export interface MonthlyBarLoading {
  id: string
  startDate: string
  endDate: string
  rate: number
  projectId?: string
  projectName?: string
  sectionId?: string | null
  sectionName?: string
  stageId?: string
  stageName?: string
  comment?: string
  employeeId?: string
}

interface MonthlyLoadingBarsProps {
  loadings: MonthlyBarLoading[]
  monthCells: MonthCell[]
  monthCellWidth: number
  onLoadingClick?: (loadingId: string) => void
}

// ============================================================================
// Position Calculation
// ============================================================================

/**
 * Рассчитывает позицию полоски загрузки на месячной сетке.
 *
 * Если загрузка начинается/заканчивается внутри месяца —
 * позиция пропорциональна дню внутри месяца.
 */
function calculateMonthlyBarPosition(
  startDate: string,
  endDate: string,
  monthCells: MonthCell[],
  monthCellWidth: number
): BarPosition | null {
  if (monthCells.length === 0) return null

  const firstMonthStart = monthCells[0].startDate
  const lastMonthEnd = monthCells[monthCells.length - 1].endDate

  // Загрузка полностью вне видимого диапазона
  if (endDate < firstMonthStart || startDate > lastMonthEnd) return null

  // Обрезаем до видимого диапазона
  const clampedStart = startDate < firstMonthStart ? firstMonthStart : startDate
  const clampedEnd = endDate > lastMonthEnd ? lastMonthEnd : endDate

  let left = 0
  let right = 0
  let foundStart = false
  let foundEnd = false

  for (let i = 0; i < monthCells.length; i++) {
    const mc = monthCells[i]
    const colLeft = i * monthCellWidth

    // Количество дней в месяце (endDate включительно)
    const daysInMonth = daysBetween(mc.startDate, mc.endDate) + 1

    if (!foundStart && clampedStart >= mc.startDate && clampedStart <= mc.endDate) {
      const dayOffset = daysBetween(mc.startDate, clampedStart)
      left = colLeft + (dayOffset / daysInMonth) * monthCellWidth
      foundStart = true
    }

    if (!foundEnd && clampedEnd >= mc.startDate && clampedEnd <= mc.endDate) {
      const dayOffset = daysBetween(mc.startDate, clampedEnd) + 1
      right = colLeft + (dayOffset / daysInMonth) * monthCellWidth
      foundEnd = true
    }
  }

  // Если start раньше первого месяца
  if (!foundStart) left = 0
  // Если end позже последнего месяца
  if (!foundEnd) right = monthCells.length * monthCellWidth

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
  loadings: MonthlyBarLoading[],
  monthCells: MonthCell[],
  monthCellWidth: number
): BarRender[] {
  const bars: BarRender[] = []

  // Сортируем по дате начала
  const sorted = [...loadings].sort((a, b) => a.startDate.localeCompare(b.startDate))

  // Трекаем правую границу каждого ряда
  const rowEnds: number[] = []

  for (const loading of sorted) {
    const position = calculateMonthlyBarPosition(
      loading.startDate,
      loading.endDate,
      monthCells,
      monthCellWidth
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

export function calculateMonthlyBarsRowHeight(loadings: MonthlyBarLoading[], monthCells: MonthCell[], monthCellWidth: number): number {
  const bars = layoutBars(loadings, monthCells, monthCellWidth)
  if (bars.length === 0) return 44
  const maxRow = Math.max(...bars.map((b) => b.row))
  return Math.max(44, BAR_TOP_OFFSET + (maxRow + 1) * (BAR_HEIGHT + BAR_GAP) + BAR_TOP_OFFSET)
}

// ============================================================================
// Component
// ============================================================================

export function MonthlyLoadingBars({
  loadings,
  monthCells,
  monthCellWidth,
  onLoadingClick,
}: MonthlyLoadingBarsProps) {
  const bars = useMemo(
    () => layoutBars(loadings, monthCells, monthCellWidth),
    [loadings, monthCells, monthCellWidth]
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
