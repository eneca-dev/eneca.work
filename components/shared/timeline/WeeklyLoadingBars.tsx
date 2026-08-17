/**
 * Weekly Loading Bars Component
 *
 * Рендерит полоски загрузок в том же стиле, что и дневной режим,
 * но позиционирует их по неделям (по образцу MonthlyLoadingBars).
 * Без resize-хендлов — редактирование дат только через клик по бару → модалка.
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
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import { getSectionColor } from './loading-bars-utils'
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

const BAR_HEIGHT = 24
const BAR_GAP = 3
const BAR_TOP_OFFSET = 4
const DAYS_IN_WEEK = 7

// ============================================================================
// Position Calculation
// ============================================================================

interface BarPosition {
  left: number
  width: number
}

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

interface BarRender {
  loading: WeeklyBarLoading
  position: BarPosition
  row: number // вертикальный ряд (для стекинга)
}

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
