'use client'

import { useState, useCallback, useEffect } from 'react'
import { format, differenceInDays, addDays, endOfYear, startOfYear } from 'date-fns'
import { Calendar, RotateCcw } from 'lucide-react'
import { getTodayMinsk, formatMinskDate, parseMinskDate } from '@/lib/timezone-utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'

export interface CustomDateRange {
  startDate: string
  endDate: string
}

const MIN_YEAR = 2000
const MAX_YEAR = 2100

const DATE_PICKER_INPUT_CLASS =
  'w-full h-7 px-1.5 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary'

function dateStringToDate(s: string | undefined | null): Date | null {
  if (!s) return null
  const parts = s.split('-')
  if (parts.length !== 3) return null
  const [y, m, d] = parts.map(Number)
  if (!y || !m || !d || y < MIN_YEAR || y > MAX_YEAR) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return dt
}

function dateToString(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Проверяет, что пара YYYY-MM-DD строк образует валидный диапазон таймлайна.
 * Год должен быть в [MIN_YEAR, MAX_YEAR], даты разбираются без сдвига timezone,
 * и start ≤ end. Используется и в самом popover (self-heal), и в `resolveTimelineRange`.
 */
export function isValidCustomRange(range: { startDate: string; endDate: string }): boolean {
  const s = dateStringToDate(range.startDate)
  const e = dateStringToDate(range.endDate)
  return !!s && !!e && s.getTime() <= e.getTime()
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

  // Self-heal: если в localStorage остался битый customRange (например, после прошлых багов с ручным вводом года) — сбрасываем
  useEffect(() => {
    if (customRange && !isValidCustomRange(customRange)) {
      onRangeChange(null)
    }
  }, [customRange, onRangeChange])

  const today = getTodayMinsk()
  const defaultStart = formatMinskDate(addDays(today, -defaultDaysBefore))
  const defaultEnd = formatMinskDate(addDays(today, defaultDaysAfter - 1))

  const currentStart = customRange?.startDate ?? defaultStart
  const currentEnd = customRange?.endDate ?? defaultEnd

  const startDateValue = dateStringToDate(currentStart)
  const endDateValue = dateStringToDate(currentEnd)

  const handleStartChange = useCallback((date: Date) => {
    const newStart = dateToString(date)
    const endTime = dateStringToDate(currentEnd)?.getTime() ?? 0
    // Если новое начало позже конца — поднимаем конец, чтобы не было инверсии
    const newEnd = endTime < date.getTime() ? newStart : currentEnd
    onRangeChange({ startDate: newStart, endDate: newEnd })
  }, [currentEnd, onRangeChange])

  const handleEndChange = useCallback((date: Date) => {
    const newEnd = dateToString(date)
    const startTime = dateStringToDate(currentStart)?.getTime() ?? 0
    // Если новый конец раньше начала — опускаем начало
    const newStart = startTime > date.getTime() ? newEnd : currentStart
    onRangeChange({ startDate: newStart, endDate: newEnd })
  }, [currentStart, onRangeChange])

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
              <DatePicker
                value={startDateValue}
                onChange={handleStartChange}
                placeholder="дд.мм.гггг"
                renderToBody={false}
                placement="bottom"
                calendarWidth="220px"
                offsetX={0}
                offsetY={0}
                inputClassName={DATE_PICKER_INPUT_CLASS}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">
                Конец
              </Label>
              <DatePicker
                value={endDateValue}
                onChange={handleEndChange}
                placeholder="дд.мм.гггг"
                renderToBody={false}
                placement="bottom"
                calendarWidth="220px"
                offsetX={0}
                offsetY={0}
                inputClassName={DATE_PICKER_INPUT_CLASS}
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
