'use client'

import { useState, useCallback } from 'react'
import { format, differenceInDays, addDays, endOfYear, startOfYear } from 'date-fns'
import { Calendar, RotateCcw } from 'lucide-react'
import { getTodayMinsk, formatMinskDate, parseMinskDate } from '@/lib/timezone-utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'

export interface CustomDateRange {
  startDate: string
  endDate: string
}

interface TimelineDatePopoverProps {
  customRange: CustomDateRange | null
  onRangeChange: (range: CustomDateRange | null) => void
  onScrollToToday: () => void
  defaultDaysBefore: number
  defaultDaysAfter: number
}

export function TimelineDatePopover({
  customRange,
  onRangeChange,
  onScrollToToday,
  defaultDaysBefore,
  defaultDaysAfter,
}: TimelineDatePopoverProps) {
  const [open, setOpen] = useState(false)

  const today = getTodayMinsk()
  const defaultStart = formatMinskDate(addDays(today, -defaultDaysBefore))
  const defaultEnd = formatMinskDate(addDays(today, defaultDaysAfter - 1))

  const currentStart = customRange?.startDate ?? defaultStart
  const currentEnd = customRange?.endDate ?? defaultEnd

  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (!value) return
    onRangeChange({ startDate: value, endDate: customRange?.endDate ?? defaultEnd })
  }, [customRange, defaultEnd, onRangeChange])

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (!value) return
    onRangeChange({ startDate: customRange?.startDate ?? defaultStart, endDate: value })
  }, [customRange, defaultStart, onRangeChange])

  const handleReset = useCallback(() => {
    onRangeChange(null)
  }, [onRangeChange])

  const handlePreset = useCallback((startDate: string, endDate: string) => {
    onRangeChange({ startDate, endDate })
    setOpen(false)
  }, [onRangeChange])

  const handleScrollToTodayClick = useCallback(() => {
    onScrollToToday()
    setOpen(false)
  }, [onScrollToToday])

  // Presets
  const endOfYearDate = formatMinskDate(endOfYear(today))
  const startOfYearDate = formatMinskDate(startOfYear(today))
  const halfYearAhead = formatMinskDate(addDays(today, 182))

  const totalDays = differenceInDays(parseMinskDate(currentEnd), parseMinskDate(currentStart)) + 1
  const isCustom = customRange !== null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 relative"
          title="Настройка диапазона дат"
        >
          <Calendar className="h-3.5 w-3.5" />
          {isCustom && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-72 p-3">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Диапазон таймлайна
            </span>
            <span className="text-[10px] text-muted-foreground">
              {totalDays} дн.
            </span>
          </div>

          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">
                Начало
              </Label>
              <input
                type="date"
                value={currentStart}
                onChange={handleStartChange}
                max={currentEnd}
                className="w-full h-7 px-1.5 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">
                Конец
              </Label>
              <input
                type="date"
                value={currentEnd}
                onChange={handleEndChange}
                min={currentStart}
                className="w-full h-7 px-1.5 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Presets */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">
              Быстрый выбор
            </span>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => handlePreset(startOfYearDate, endOfYearDate)}
                className="h-7 px-2 text-[11px] rounded border border-border hover:bg-accent transition-colors text-left"
              >
                Весь {format(today, 'yyyy')} год
              </button>
              <button
                onClick={() => handlePreset(formatMinskDate(today), endOfYearDate)}
                className="h-7 px-2 text-[11px] rounded border border-border hover:bg-accent transition-colors text-left"
              >
                До конца года
              </button>
              <button
                onClick={() => handlePreset(formatMinskDate(addDays(today, -30)), halfYearAhead)}
                className="h-7 px-2 text-[11px] rounded border border-border hover:bg-accent transition-colors text-left"
              >
                Полгода вперёд
              </button>
              <button
                onClick={() => handlePreset(formatMinskDate(addDays(today, -365)), formatMinskDate(addDays(today, 365)))}
                className="h-7 px-2 text-[11px] rounded border border-border hover:bg-accent transition-colors text-left"
              >
                ±1 год
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 pt-1 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={handleScrollToTodayClick}
            >
              <Calendar className="h-3 w-3 mr-1.5" />
              К сегодня
            </Button>
            {isCustom && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs flex-1 text-muted-foreground"
                onClick={handleReset}
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Сбросить
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
