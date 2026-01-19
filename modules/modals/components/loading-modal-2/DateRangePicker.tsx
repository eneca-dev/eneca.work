'use client'

/**
 * Loading Modal 2 - Выбор диапазона дат
 *
 * Инпут с выбором диапазона дат (startDate - endDate)
 * Отображает количество рабочих дней и часов
 */

import { useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format, differenceInBusinessDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface DateRangePickerProps {
  /** Дата начала (YYYY-MM-DD) */
  startDate: string
  /** Дата окончания (YYYY-MM-DD) */
  endDate: string
  /** Callback при изменении дат */
  onChange: (startDate: string, endDate: string) => void
  /** Показывать ошибку */
  error?: string
  /** Disabled состояние */
  disabled?: boolean
  /** Ставка для расчёта часов */
  rate?: number
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  error,
  disabled = false,
  rate = 1.0,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Парсинг дат
  const start = startDate ? new Date(startDate) : undefined
  const end = endDate ? new Date(endDate) : undefined

  // Расчёт рабочих дней и часов
  const businessDays =
    start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())
      ? differenceInBusinessDays(end, start) + 1 // включая последний день
      : 0

  const totalHours = businessDays > 0 ? Math.round(businessDays * 8 * rate) : 0

  const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) {
      onChange('', '')
      return
    }

    const newStart = range.from ? format(range.from, 'yyyy-MM-dd') : ''
    const newEnd = range.to ? format(range.to, 'yyyy-MM-dd') : ''

    onChange(newStart, newEnd)

    // Закрыть попап, если выбраны обе даты
    if (range.from && range.to) {
      setIsOpen(false)
    }
  }

  const formatDateRange = () => {
    if (!start || !end) return 'Выберите период'

    try {
      const startFormatted = format(start, 'dd.MM.yyyy', { locale: ru })
      const endFormatted = format(end, 'dd.MM.yyyy', { locale: ru })
      return `${startFormatted} - ${endFormatted}`
    } catch {
      return 'Некорректная дата'
    }
  }

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              error && 'border-red-500',
              !start && !end && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: start, to: end }}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={ru}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>

      {/* Информация о периоде */}
      {businessDays > 0 && (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Количество рабочих дней: {businessDays}</p>
          <p>
            Количество рабочих часов с учётом ставки: {totalHours} ч
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
