/**
 * Weekly Header Component
 *
 * Заголовок таймлайна в режиме "Неделя".
 * Структура аналогична TimelineHeader (дневной режим): месяцы → недели → рабочие дни.
 * Праздники внутри недели показаны маркером — чисто информативно (title-тултип), без интерактива.
 */

'use client'

import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import { TimelineDatePopover } from '@/modules/resource-graph/components/timeline/TimelineDatePopover'
import type { TimelineDatePopoverConfig } from '@/modules/resource-graph/components/timeline/TimelineHeader'

interface WeeklyHeaderProps {
  weekCells: WeekCell[]
  weekCellWidth: number
  /** Simple scroll-to-today button (legacy) */
  onScrollToToday?: () => void
  /** Full date range popover config (replaces onScrollToToday when provided) — та же логика, что и в дневном режиме (TimelineHeader) */
  datePopoverConfig?: TimelineDatePopoverConfig
}

// Минимальное число недель в месяце, чтобы уместилось название
const MIN_WEEKS_FOR_MONTH_NAME = 2

export function WeeklyHeader({
  weekCells,
  weekCellWidth,
  onScrollToToday,
  datePopoverConfig,
}: WeeklyHeaderProps) {
  const totalWidth = weekCells.length * weekCellWidth

  // Группировка по месяцам (используем monthIndex — см. weekly-cell-utils)
  const months = useMemo(() => {
    const result: { name: string; weeksCount: number }[] = []
    let prevIndex = -1

    weekCells.forEach((cell) => {
      if (cell.monthIndex !== prevIndex) {
        prevIndex = cell.monthIndex
        result.push({ name: cell.monthName, weeksCount: 1 })
      } else {
        result[result.length - 1].weeksCount++
      }
    })

    return result
  }, [weekCells])

  // Позиции месяцев для фоновых полос чередования (переиспользуется во всех 3 строках)
  const monthSpans = useMemo(() => {
    let left = 0
    return months.map((month, i) => {
      const span = { left, width: month.weeksCount * weekCellWidth, isOdd: i % 2 === 1 }
      left += span.width
      return span
    })
  }, [months, weekCellWidth])

  const monthAlternationBg = useMemo(() => (
    <>
      {monthSpans.map((span, i) => span.isOdd ? (
        <div
          key={`month-bg-${i}`}
          className="absolute top-0 bottom-0 bg-black/[0.07] dark:bg-white/[0.06] pointer-events-none"
          style={{ left: span.left, width: span.width }}
        />
      ) : null)}
      {monthSpans.slice(1).map((span, i) => (
        <div
          key={`month-border-${i}`}
          className="absolute top-0 bottom-0 w-0.5 bg-border pointer-events-none"
          style={{ left: span.left - 1 }}
        />
      ))}
    </>
  ), [monthSpans])

  return (
    <div className="flex flex-col bg-card border-b border-border" style={{ width: totalWidth }}>
      {/* Row 1: Месяцы */}
      <div className="flex h-7 border-b border-border/50 relative">
        {monthAlternationBg}
        {months.map((month, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-xs font-medium text-muted-foreground capitalize overflow-hidden relative z-[1]"
            style={{ width: month.weeksCount * weekCellWidth }}
          >
            {month.weeksCount >= MIN_WEEKS_FOR_MONTH_NAME && month.name}
          </div>
        ))}
        {/* Кнопка настройки дат / перехода к сегодня — та же логика, что и в дневном режиме */}
        {(datePopoverConfig || onScrollToToday) && (
          <div className="sticky right-0 ml-auto flex items-center pr-2 bg-card z-10 border-l border-border/50">
            {datePopoverConfig ? (
              <TimelineDatePopover {...datePopoverConfig} />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onScrollToToday}
                title="Перейти к сегодняшней дате"
              >
                <Calendar className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Недели */}
      <div className="relative h-7 border-b border-border/50">
        {monthAlternationBg}
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

      {/* Row 3: Диапазон дат недели (число месяца) */}
      <div className="relative h-5">
        {monthAlternationBg}
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
              className="flex items-center justify-center text-[9px] text-muted-foreground/60 truncate px-px whitespace-nowrap"
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
