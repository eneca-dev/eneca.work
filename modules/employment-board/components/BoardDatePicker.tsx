'use client'

import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { ru } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  boardDateToCalendarDate,
  calendarDateToBoardDate,
  formatEmploymentBoardDateLabel,
} from '../lib/board-date'

interface BoardDatePickerProps {
  selectedDate: string
  currentMinskDate: string
  followsToday: boolean
  onSelectDate: (date: string) => void
  onSelectToday: () => void
}

export function BoardDatePicker({
  selectedDate,
  currentMinskDate,
  followsToday,
  onSelectDate,
  onSelectToday,
}: BoardDatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => boardDateToCalendarDate(selectedDate), [selectedDate])
  const label = useMemo(
    () => formatEmploymentBoardDateLabel(selectedDate, currentMinskDate),
    [currentMinskDate, selectedDate],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          aria-label={`Выбрать дату занятости. Выбрано: ${label}`}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[var(--radix-popover-content-available-height)] w-auto overflow-y-auto p-0"
        align="end"
      >
        <Calendar
          mode="single"
          locale={ru}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return
            onSelectDate(calendarDateToBoardDate(date))
            setOpen(false)
          }}
        />
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full text-xs"
            disabled={followsToday}
            onClick={() => {
              onSelectToday()
              setOpen(false)
            }}
          >
            Сегодня
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
