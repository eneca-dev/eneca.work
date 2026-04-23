/**
 * Scale Toggle Component
 *
 * Переключатель масштаба таймлайна: День / Месяц.
 * Отображается только для admin (обёрнут в AdminOnly снаружи).
 */

'use client'

import { CalendarDays, CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

export type TimelineScaleMode = 'day' | 'month'

interface ScaleToggleProps {
  value: TimelineScaleMode
  onChange: (scale: TimelineScaleMode) => void
}

export function ScaleToggle({ value, onChange }: ScaleToggleProps) {
  return (
    <TooltipProvider>
    <div className="flex items-center rounded-md border border-border bg-muted/50 p-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 w-6 p-0 rounded-sm',
              value === 'day' && 'bg-background shadow-sm'
            )}
            onClick={() => onChange('day')}
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>По дням</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 w-6 p-0 rounded-sm',
              value === 'month' && 'bg-background shadow-sm'
            )}
            onClick={() => onChange('month')}
          >
            <CalendarRange className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>По месяцам</p>
        </TooltipContent>
      </Tooltip>
    </div>
    </TooltipProvider>
  )
}
