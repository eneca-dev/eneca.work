"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/modules/calendar/components/ui/button"
import { formatMonthYear, addMonthsToDate } from "@/modules/calendar/utils"
import { useCalendarStore } from "@/modules/calendar/store"

export function CalendarHeader() {
  const store = useCalendarStore()
  const currentDate = store.currentDate
  const setCurrentDate = store.setCurrentDate

  const handlePrevMonth = () => {
    setCurrentDate(addMonthsToDate(currentDate, -1))
  }

  const handleNextMonth = () => {
    setCurrentDate(addMonthsToDate(currentDate, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
<Button variant="outline" size="icon" onClick={handlePrevMonth}>
        <span className="sr-only">Previous month</span>
         <ChevronLeft className="h-4 w-4" />
       </Button>
       <Button variant="outline" size="icon" onClick={handleNextMonth}>
        <span className="sr-only">Next month</span>
         <ChevronRight className="h-4 w-4" />
       </Button>
        <h2 className="text-xl font-bold ml-2 capitalize">{formatMonthYear(currentDate)}</h2>
      </div>
      <Button variant="outline" onClick={handleToday}>
        Сегодня
      </Button>
    </div>
  )
}
