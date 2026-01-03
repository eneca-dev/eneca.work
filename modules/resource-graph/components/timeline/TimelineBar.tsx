'use client'

import { differenceInDays, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { parseMinskDate } from '@/lib/timezone-utils'
import { DAY_CELL_WIDTH } from '../../constants'
import type { TimelineRange } from '../../types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface BarPosition {
  /** Позиция в пикселях от левого края */
  left: number
  /** Ширина в пикселях */
  width: number
  /** Количество дней (для определения отображения текста) */
  days: number
}

/**
 * Вычисляет позицию бара на timeline в пикселях
 */
export function calculateBarPosition(
  startDate: string | null,
  endDate: string | null,
  range: TimelineRange
): BarPosition | null {
  if (!startDate || !endDate) return null

  // Используем parseMinskDate для консистентности с getTodayMinsk() и range.start
  // parseISO создаёт дату в локальном timezone, что приводит к ошибке ±1 день
  const start = parseMinskDate(startDate)
  const end = parseMinskDate(endDate)

  // Проверяем что бар в видимом диапазоне
  if (end < range.start || start > range.end) return null

  // Ограничиваем видимым диапазоном
  const visibleStart = start < range.start ? range.start : start
  const visibleEnd = end > range.end ? range.end : end

  const dayFromStart = differenceInDays(visibleStart, range.start)
  const duration = differenceInDays(visibleEnd, visibleStart) + 1

  return {
    left: dayFromStart * DAY_CELL_WIDTH,
    width: duration * DAY_CELL_WIDTH,
    days: duration,
  }
}

interface TimelineBarProps {
  startDate: string | null
  endDate: string | null
  range: TimelineRange
  color?: string | null
  label?: string
  className?: string
}

/**
 * Бар на timeline для отображения периода
 */
export function TimelineBar({
  startDate,
  endDate,
  range,
  color,
  label,
  className,
}: TimelineBarProps) {
  const position = calculateBarPosition(startDate, endDate, range)

  if (!position) return null

  const formatDateRange = () => {
    const start = startDate ? format(parseMinskDate(startDate), 'd MMM yyyy', { locale: ru }) : '—'
    const end = endDate ? format(parseMinskDate(endDate), 'd MMM yyyy', { locale: ru }) : '—'
    return `${start} — ${end}`
  }

  // Определяем цвет бара
  const barColor = color || '#3b82f6' // default blue

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 h-6 rounded-md cursor-pointer',
              'transition-all duration-150 hover:brightness-110 hover:shadow-md',
              className
            )}
            style={{
              left: position.left,
              width: Math.max(position.width, DAY_CELL_WIDTH / 2),
              backgroundColor: barColor,
            }}
          >
            {/* Текст внутри бара если достаточно места (> 3 дней) */}
            {position.days > 3 && label && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-medium truncate px-1">
                {label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex flex-col gap-1">
            {label && <span className="font-medium">{label}</span>}
            <span className="text-muted-foreground">{formatDateRange()}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
