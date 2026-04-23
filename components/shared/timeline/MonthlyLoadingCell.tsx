/**
 * Monthly Loading Cell Component
 *
 * Ячейка месяца для сотрудника в режиме "Месяц".
 * Отображает чипы загрузок с возможностью создания новых.
 */

'use client'

import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type { MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'

// ============================================================================
// Types
// ============================================================================

/** Минимальный тип загрузки для ячейки */
export interface MonthlyLoading {
  id: string
  projectName?: string
  sectionName?: string
  startDate: string
  endDate: string
  rate: number
  comment?: string
}

interface MonthlyLoadingCellProps {
  loadings: MonthlyLoading[]
  monthCell: MonthCell
  monthCellWidth: number
  onLoadingClick: (loadingId: string) => void
  onCreateClick: () => void
}

// ============================================================================
// Constants
// ============================================================================

const MAX_VISIBLE_CHIPS = 3
const CHIP_HEIGHT = 20
const CHIP_GAP = 2

/** Цвет чипа по ставке */
function getChipColorClass(rate: number): string {
  if (rate >= 1) return 'bg-blue-600/90 dark:bg-blue-500/90 text-white'
  if (rate >= 0.75) return 'bg-blue-500/80 dark:bg-blue-500/70 text-white'
  if (rate >= 0.5) return 'bg-blue-400/70 dark:bg-blue-600/60 text-white'
  return 'bg-blue-200/80 dark:bg-blue-800/60 text-blue-900 dark:text-blue-200'
}

/** Сокращение названия проекта */
function abbreviateProject(name: string | undefined, maxLen: number = 12): string {
  if (!name) return '—'
  if (name.length <= maxLen) return name
  return name.slice(0, maxLen - 1) + '…'
}

// ============================================================================
// Component
// ============================================================================

export function MonthlyLoadingCell({
  loadings,
  monthCell,
  monthCellWidth,
  onLoadingClick,
  onCreateClick,
}: MonthlyLoadingCellProps) {
  const totalRate = useMemo(
    () => loadings.reduce((sum, l) => sum + l.rate, 0),
    [loadings]
  )

  const visibleLoadings = loadings.slice(0, MAX_VISIBLE_CHIPS)
  const overflowCount = loadings.length - MAX_VISIBLE_CHIPS
  const isOverloaded = totalRate > 1.0

  return (
    <TooltipProvider>
    <div
      className={cn(
        'relative flex flex-col gap-[2px] p-1 border-r border-border/30 min-h-[44px]',
        monthCell.isCurrentMonth && 'bg-primary/[0.03]'
      )}
      style={{ width: monthCellWidth }}
    >
      {/* Чипы загрузок */}
      {visibleLoadings.map((loading) => (
        <Tooltip key={loading.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onLoadingClick(loading.id)}
              className={cn(
                'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-tight font-medium cursor-pointer',
                'hover:ring-1 hover:ring-primary/50 transition-shadow truncate w-full text-left',
                getChipColorClass(loading.rate)
              )}
              style={{ height: CHIP_HEIGHT }}
            >
              <span className="shrink-0 font-semibold">{loading.rate}</span>
              <span className="truncate">
                {abbreviateProject(loading.projectName)}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px]">
            <div className="text-xs space-y-1">
              <p className="font-medium">{loading.projectName || '—'}</p>
              {loading.sectionName && (
                <p className="text-muted-foreground">{loading.sectionName}</p>
              )}
              <p>
                Ставка: {loading.rate} · {loading.startDate} → {loading.endDate}
              </p>
              {loading.comment && (
                <p className="text-muted-foreground italic">{loading.comment}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      ))}

      {/* Overflow */}
      {overflowCount > 0 && (
        <div className="text-[9px] text-muted-foreground pl-1">
          +{overflowCount} ещё
        </div>
      )}

      {/* Footer: суммарная ставка + кнопка создания */}
      <div className="flex items-center justify-between mt-auto pt-0.5">
        {loadings.length > 1 && (
          <span
            className={cn(
              'text-[9px] font-medium pl-0.5',
              isOverloaded
                ? 'text-red-500 dark:text-red-400'
                : 'text-muted-foreground'
            )}
          >
            Σ {totalRate.toFixed(2)}
          </span>
        )}

        {loadings.length <= 1 && <span />}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCreateClick}
              className={cn(
                'h-4 w-4 flex items-center justify-center rounded-sm',
                'text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors'
              )}
            >
              <Plus className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Создать загрузку</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
    </TooltipProvider>
  )
}

// ============================================================================
// Height Calculation
// ============================================================================

/**
 * Рассчитывает высоту строки в зависимости от количества загрузок
 */
export function calculateMonthlyRowHeight(maxLoadingsInRow: number): number {
  const chips = Math.min(maxLoadingsInRow, MAX_VISIBLE_CHIPS)
  const overflow = maxLoadingsInRow > MAX_VISIBLE_CHIPS ? 14 : 0
  const footer = 18 // суммарная ставка + кнопка
  const padding = 8 // p-1 top + bottom
  return Math.max(44, chips * (CHIP_HEIGHT + CHIP_GAP) + overflow + footer + padding)
}
