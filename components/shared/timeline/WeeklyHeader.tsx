/**
 * Weekly Header Component
 *
 * Заголовок таймлайна в режиме "Неделя".
 * Структура аналогична MonthlyHeader: недели → рабочие дни.
 * Праздники внутри недели показаны маркером — чисто информативно (title-тултип), без интерактива.
 */

'use client'

import { cn } from '@/lib/utils'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'

interface WeeklyHeaderProps {
  weekCells: WeekCell[]
  weekCellWidth: number
}

export function WeeklyHeader({
  weekCells,
  weekCellWidth,
}: WeeklyHeaderProps) {
  const totalWidth = weekCells.length * weekCellWidth

  return (
    <div className="flex flex-col bg-card border-b border-border" style={{ width: totalWidth }}>
      {/* Row 1: Недели */}
      <div className="relative h-7 border-b border-border/50">
        {/* Фон чередования */}
        {weekCells.map((_, i) => (
          <div
            key={`bg-${i}`}
            className={cn(
              'absolute top-0 bottom-0 pointer-events-none',
              i % 2 === 1 && 'bg-black/[0.07] dark:bg-white/[0.06]'
            )}
            style={{ left: i * weekCellWidth, width: weekCellWidth }}
          />
        ))}
        {/* Разделители недель — 2px, полный border */}
        {weekCells.slice(1).map((_, i) => (
          <div
            key={`sep-${i}`}
            className="absolute top-0 bottom-0 w-0.5 bg-border pointer-events-none"
            style={{ left: (i + 1) * weekCellWidth - 1 }}
          />
        ))}
        {/* Названия + информационный маркер праздников */}
        <div className="flex h-full relative z-[1]">
          {weekCells.map((cell, i) => (
            <div
              key={`label-${i}`}
              className={cn(
                'flex items-center justify-center gap-1 text-xs font-medium overflow-hidden',
                cell.isCurrentWeek
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground'
              )}
              style={{ width: weekCellWidth }}
              title={
                cell.holidayDates.length > 0
                  ? `Праздники: ${cell.holidayDates.join(', ')}`
                  : undefined
              }
            >
              <span className="truncate">{cell.shortLabel}</span>
              {cell.holidayDates.length > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Диапазон дат недели (число месяца) */}
      <div className="relative h-5">
        {/* Фон чередования */}
        {weekCells.map((_, i) => (
          <div
            key={`wd-bg-${i}`}
            className={cn(
              'absolute top-0 bottom-0 pointer-events-none',
              i % 2 === 1 && 'bg-black/[0.07] dark:bg-white/[0.06]'
            )}
            style={{ left: i * weekCellWidth, width: weekCellWidth }}
          />
        ))}
        {/* Разделители недель — 2px, полный border */}
        {weekCells.slice(1).map((_, i) => (
          <div
            key={`wd-sep-${i}`}
            className="absolute top-0 bottom-0 w-0.5 bg-border pointer-events-none"
            style={{ left: (i + 1) * weekCellWidth - 1 }}
          />
        ))}
        <div className="flex h-full relative z-[1]">
          {weekCells.map((cell, i) => (
            <div
              key={`wd-${i}`}
              className="flex items-center justify-center text-[10px] text-muted-foreground/60 truncate px-0.5"
              style={{ width: weekCellWidth }}
              title={cell.label}
            >
              {cell.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
