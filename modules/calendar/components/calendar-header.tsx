"use client"

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@/modules/calendar/components/ui/button"
import { formatMonthYear, addMonthsToDate } from "@/modules/calendar/utils"
import { useCalendarStore } from "@/modules/calendar/store"

export function CalendarHeader() {
  const store = useCalendarStore()
  const currentDate = store.currentDate
  const setCurrentDate = store.setCurrentDate

  const handlePrevMonth = (e: React.MouseEvent<HTMLButtonElement>) => {
    setCurrentDate(addMonthsToDate(currentDate, -1))
    e.currentTarget.blur()
  }

  const handleNextMonth = (e: React.MouseEvent<HTMLButtonElement>) => {
    setCurrentDate(addMonthsToDate(currentDate, 1))
    e.currentTarget.blur()
  }

  const handleToday = (e: React.MouseEvent<HTMLButtonElement>) => {
    setCurrentDate(new Date())
    e.currentTarget.blur()
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handlePrevMonth}
          className="hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <span className="sr-only">Previous month</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          onClick={handleToday}
          className="hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <span className="sr-only">Сегодня</span>
          <Calendar className="h-4 w-4" />
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleNextMonth}
          className="hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <span className="sr-only">Next month</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold ml-2 capitalize">{formatMonthYear(currentDate)}</h2>
      </div>
    </div>
  )
}
