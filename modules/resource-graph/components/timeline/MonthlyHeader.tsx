/**
 * Monthly Header Component
 *
 * Заголовок таймлайна в режиме "Месяц".
 * Структура аналогична TimelineHeader (дневному): месяцы → рабочие дни.
 * Горизонтальный скролл как в дневном режиме.
 */

'use client'

import { cn } from '@/lib/utils'
import type { MonthCell } from '../../utils/monthly-cell-utils'

interface MonthlyHeaderProps {
  monthCells: MonthCell[]
  monthCellWidth: number
}

export function MonthlyHeader({
  monthCells,
  monthCellWidth,
}: MonthlyHeaderProps) {
  const totalWidth = monthCells.length * monthCellWidth

  return (
    <div className="flex flex-col bg-card border-b border-border" style={{ width: totalWidth }}>
      {/* Row 1: Названия месяцев */}
      <div className="relative h-7 border-b border-border/50">
        {/* Фон чередования */}
        {monthCells.map((_, i) => (
          <div
            key={`bg-${i}`}
            className={cn(
              'absolute top-0 bottom-0 pointer-events-none',
              i % 2 === 1 && 'bg-black/[0.07] dark:bg-white/[0.06]'
            )}
            style={{ left: i * monthCellWidth, width: monthCellWidth }}
          />
        ))}
        {/* Разделители месяцев — 2px, полный border */}
        {monthCells.slice(1).map((_, i) => (
          <div
            key={`sep-${i}`}
            className="absolute top-0 bottom-0 w-0.5 bg-border pointer-events-none"
            style={{ left: (i + 1) * monthCellWidth - 1 }}
          />
        ))}
        {/* Названия */}
        <div className="flex h-full relative z-[1]">
          {monthCells.map((cell, i) => (
            <div
              key={`label-${i}`}
              className={cn(
                'flex items-center justify-center text-xs font-medium capitalize overflow-hidden',
                cell.isCurrentMonth
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground'
              )}
              style={{ width: monthCellWidth }}
            >
              {cell.label}
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Рабочие дни */}
      <div className="relative h-5">
        {/* Фон чередования */}
        {monthCells.map((_, i) => (
          <div
            key={`wd-bg-${i}`}
            className={cn(
              'absolute top-0 bottom-0 pointer-events-none',
              i % 2 === 1 && 'bg-black/[0.07] dark:bg-white/[0.06]'
            )}
            style={{ left: i * monthCellWidth, width: monthCellWidth }}
          />
        ))}
        {/* Разделители месяцев — 2px, полный border */}
        {monthCells.slice(1).map((_, i) => (
          <div
            key={`wd-sep-${i}`}
            className="absolute top-0 bottom-0 w-0.5 bg-border pointer-events-none"
            style={{ left: (i + 1) * monthCellWidth - 1 }}
          />
        ))}
        <div className="flex h-full relative z-[1]">
          {monthCells.map((cell, i) => (
            <div
              key={`wd-${i}`}
              className="flex items-center justify-center text-[10px] text-muted-foreground/60"
              style={{ width: monthCellWidth }}
            >
              {cell.workingDays} р.д.
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
