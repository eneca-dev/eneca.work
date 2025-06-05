"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { Button } from "@/modules/calendar/components/ui/button"
import { Calendar } from "@/modules/calendar/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/calendar/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  dateRange?: DateRange
  onSelect: (range: DateRange) => void
  placeholder?: string
}

export function DateRangePicker({ dateRange, onSelect, placeholder = "Выберите период" }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "PPP", { locale: ru })} - {format(dateRange.to, "PPP", { locale: ru })}
              </>
            ) : (
              format(dateRange.from, "PPP", { locale: ru })
            )
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={(range) => {
            if (range) {
              onSelect(range)
              if (range.to) {
                setOpen(false)
              }
            }
          }}
          initialFocus
          locale={ru}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
