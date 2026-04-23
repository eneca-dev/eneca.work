/**
 * Monthly Loading Bars Component
 *
 * Рендерит полоски загрузок в том же стиле, что и дневной режим,
 * но позиционирует их по месяцам.
 */

'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type { MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'
import { getSectionColor } from './loading-bars-utils'

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
// Constants
// ============================================================================

const BAR_HEIGHT = 24
const BAR_GAP = 3
const BAR_TOP_OFFSET = 4

// ============================================================================
// Position Calculation
// ============================================================================

interface BarPosition {
  left: number
  width: number
}

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

interface BarRender {
  loading: MonthlyBarLoading
  position: BarPosition
  row: number // вертикальный ряд (для стекинга)
}

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
          <Tooltip key={bar.loading.id}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'absolute rounded-sm flex items-center gap-1 px-1.5 cursor-pointer',
                  'hover:brightness-110 transition-all pointer-events-auto',
                  'text-white text-[10px] font-medium leading-none truncate'
                )}
                style={{
                  left: bar.position.left,
                  width: bar.position.width,
                  height: BAR_HEIGHT,
                  top: BAR_TOP_OFFSET + bar.row * (BAR_HEIGHT + BAR_GAP),
                  backgroundColor: getSectionColor(bar.loading.projectId, bar.loading.sectionId, bar.loading.stageId, true),
                }}
                onClick={() => onLoadingClick?.(bar.loading.id)}
              >
                <span className="shrink-0 font-semibold">{bar.loading.rate}</span>
                {bar.position.width > 50 && (
                  <span className="truncate opacity-80">
                    {bar.loading.projectName || bar.loading.sectionName || ''}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px]">
              <div className="text-xs space-y-1">
                {bar.loading.projectName && (
                  <p className="font-medium">{bar.loading.projectName}</p>
                )}
                {bar.loading.sectionName && (
                  <p className="text-muted-foreground">{bar.loading.sectionName}</p>
                )}
                <p>
                  Ставка: {bar.loading.rate} · {bar.loading.startDate} → {bar.loading.endDate}
                </p>
                {bar.loading.comment && (
                  <p className="text-muted-foreground italic">{bar.loading.comment}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
