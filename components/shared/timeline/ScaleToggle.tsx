/**
 * Scale Toggle Component
 *
 * Переключатель масштаба таймлайна: День / Неделя / Месяц.
 * Набор кнопок задаётся пропом `modes` (по умолчанию День/Месяц — как на «Отделах»,
 * чтобы поведение существующих потребителей не изменилось).
 * Отображается только для admin (обёрнут в AdminOnly снаружи) — там, где уже используется.
 */

'use client'

import { Calendar, CalendarDays, CalendarRange, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

export type TimelineScaleMode = 'day' | 'week' | 'month'

const MODE_CONFIG: Record<TimelineScaleMode, { icon: LucideIcon; label: string }> = {
  day: { icon: CalendarDays, label: 'По дням' },
  week: { icon: Calendar, label: 'По неделям' },
  month: { icon: CalendarRange, label: 'По месяцам' },
}

interface ScaleToggleProps {
  value: TimelineScaleMode
  onChange: (scale: TimelineScaleMode) => void
  /** Какие режимы показывать (по умолчанию — День/Месяц, как на «Отделах») */
  modes?: TimelineScaleMode[]
}

export function ScaleToggle({ value, onChange, modes = ['day', 'month'] }: ScaleToggleProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center rounded-md border border-border bg-muted/50 p-0.5">
        {modes.map((mode) => {
          const { icon: Icon, label } = MODE_CONFIG[mode]
          return (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-6 w-6 p-0 rounded-sm',
                    value === mode && 'bg-background shadow-sm'
                  )}
                  onClick={() => onChange(mode)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
