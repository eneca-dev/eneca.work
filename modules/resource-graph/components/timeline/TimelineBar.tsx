'use client'

import { differenceInDays, parseISO, startOfDay, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { TimelineRange } from '../../types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface BarPosition {
  left: number
  width: number
}

/**
 * Вычисляет позицию бара на timeline в процентах
 */
export function calculateBarPosition(
  startDate: string | null,
  endDate: string | null,
  range: TimelineRange
): BarPosition | null {
  if (!startDate || !endDate) return null

  const start = startOfDay(parseISO(startDate))
  const end = startOfDay(parseISO(endDate))

  // Проверяем что бар в видимом диапазоне
  if (end < range.start || start > range.end) return null

  // Ограничиваем видимым диапазоном
  const visibleStart = start < range.start ? range.start : start
  const visibleEnd = end > range.end ? range.end : end

  const dayFromStart = differenceInDays(visibleStart, range.start)
  const duration = differenceInDays(visibleEnd, visibleStart) + 1

  return {
    left: (dayFromStart / range.totalDays) * 100,
    width: (duration / range.totalDays) * 100,
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
    const start = startDate ? format(parseISO(startDate), 'd MMM yyyy', { locale: ru }) : '—'
    const end = endDate ? format(parseISO(endDate), 'd MMM yyyy', { locale: ru }) : '—'
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
              left: `${position.left}%`,
              width: `${Math.max(position.width, 0.5)}%`,
              backgroundColor: barColor,
            }}
          >
            {/* Текст внутри бара если достаточно места */}
            {position.width > 8 && label && (
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
