"use client"

import { useEffect, useState } from "react"
import { useCalendarStore } from "@/modules/calendar/store"
import { type CalendarEvent } from "@/modules/calendar/types"
import { useUserStore } from "@/stores/useUserStore"
import { useUiStore } from "@/stores/useUiStore"
import { getMonthDays, isWeekend, isSameDay, isSameMonth, getEventColor } from "@/modules/calendar/utils"
import { cn } from "@/lib/utils"
import { formatDateToString, parseDateFromString, isSameDateOnly, isDateInRange } from "@/modules/calendar/utils"
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"

export function CalendarGrid() {
  const calendarStore = useCalendarStore()
  const { events } = useCalendarEvents()
  const userStore = useUserStore()
  const uiStore = useUiStore()

  const selectedDate = calendarStore.selectedDate
  const setSelectedDate = calendarStore.setSelectedDate
  const showBirthdays = uiStore.showBirthdays
  const showPersonalEvents = uiStore.showPersonalEvents

  // Получаем данные авторизованного пользователя
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated

  const [visibleEvents, setVisibleEvents] = useState<CalendarEvent[]>([])

  // Filter events based on UI settings and user permissions
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return

    let filtered = [...events]

    // Filter by global flag and creator
    filtered = filtered.filter((event) => {
      // Always show global events (праздники, переносы и т.д.)
      if (event.calendar_event_is_global) {
        return true
      }

      // Show personal events only to their creator and only if the toggle is on
      // Это включает отпуска, отгулы, больничные и личные события
      return event.calendar_event_created_by === currentUserId && showPersonalEvents
    })

    // Filter birthdays if toggle is off - только для событий типа "Событие" с комментарием "день рождения"
    if (!showBirthdays) {
      filtered = filtered.filter(
        (event) => {
          // Если это не событие типа "Событие", то показываем его
          if (event.calendar_event_type !== "Событие") {
            return true
          }
          // Если это событие типа "Событие", то показываем только если это НЕ день рождения
          return !event.calendar_event_comment?.toLowerCase().includes("день рождения")
        }
      )
    }

    setVisibleEvents(filtered)
  }, [events, showBirthdays, showPersonalEvents, currentUserId, isAuthenticated])

  // Check if a date has events
  const getDateEvents = (date: Date) => {
    return visibleEvents.filter((event) => {
      const startDate = parseDateFromString(event.calendar_event_date_start)
      
      if (event.calendar_event_date_end) {
        const endDate = parseDateFromString(event.calendar_event_date_end)
        return isDateInRange(date, startDate, endDate)
      }

      return isSameDateOnly(date, startDate)
    })
  }

  // Check if a date is a working day
  const isWorkingDay = (date: Date) => {
    // First check for global calendar events that affect working days
    const dateEvents = visibleEvents.filter((event) => {
      const eventDate = parseDateFromString(event.calendar_event_date_start)
      return isSameDateOnly(date, eventDate) && event.calendar_event_is_global
    })

    // If we have a "Перенос" event, check its is_weekday value
    const transferEvent = dateEvents.find((event) => event.calendar_event_type === "Перенос")
    if (transferEvent && transferEvent.calendar_event_is_weekday !== null) {
      return transferEvent.calendar_event_is_weekday
    }

    // If we have a "Праздник" event, it's not a working day
    const holidayEvent = dateEvents.find((event) => event.calendar_event_type === "Праздник")
    if (holidayEvent) {
      return false
    }

    // Check for personal events that make this day non-working for the current user
    if (currentUserId) {
      const personalEvents = visibleEvents.filter((event) => {
        const eventDate = parseDateFromString(event.calendar_event_date_start)
        const eventEndDate = event.calendar_event_date_end ? parseDateFromString(event.calendar_event_date_end) : eventDate
        
        const isInRange = event.calendar_event_date_end 
          ? isDateInRange(date, eventDate, eventEndDate)
          : isSameDateOnly(date, eventDate)
        const isPersonalNonWorkingEvent = ["Отгул", "Больничный", "Отпуск"].includes(event.calendar_event_type)
        const isCreatedByCurrentUser = event.calendar_event_created_by === currentUserId
        
        return isInRange && isPersonalNonWorkingEvent && isCreatedByCurrentUser
      })

      if (personalEvents.length > 0) {
        return false
      }
    }

    // Otherwise, check if it's a weekend
    return !isWeekend(date)
  }

  // Helper function to format event display text
  const getEventDisplayText = (event: CalendarEvent) => {
    const personalEventTypes = ["Отгул", "Больничный", "Отпуск"]
    
    if (personalEventTypes.includes(event.calendar_event_type)) {
      // For personal events, always show the type name
      const baseText = event.calendar_event_type
      // Add comment if it exists
      if (event.calendar_event_comment && event.calendar_event_comment.trim()) {
        return `${baseText}: ${event.calendar_event_comment}`
      }
      return baseText
    }
    
    // For other events, show comment if exists, otherwise show type
    return event.calendar_event_comment || event.calendar_event_type
  }

  return (
    <div className="grid grid-cols-7 gap-1">
      {/* Weekday headers */}
      {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, index) => (
        <div key={day} className={cn("text-center font-medium py-2", index >= 5 ? "text-red-500 dark:text-red-400" : "text-card-foreground")}>
          {day}
        </div>
      ))}

      {/* Calendar days */}
      {getMonthDays(calendarStore.currentDate).map((day, index) => {
        const isToday = isSameDay(day, new Date())
        const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
        const isCurrentMonth = isSameMonth(day, new Date())
        const isWorkDay = isWorkingDay(day)
        const dayEvents = getDateEvents(day)

        return (
          <div
            key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
            className={cn(
              "min-h-24 p-1 border rounded-md cursor-pointer transition-colors hover:bg-accent/50",
              // Базовые цвета фона и более яркие границы - делаем ячейки светлее и обводку ярче в светлой теме
              isCurrentMonth 
                ? "bg-card dark:bg-gray-800 border-gray-300 dark:border-border/60 text-card-foreground" 
                : "bg-card/50 dark:bg-gray-800/50 border-gray-200 dark:border-muted/60 text-muted-foreground",
              // Нерабочие дни
              !isWorkDay && isCurrentMonth && "bg-red-50 dark:bg-red-900/40 border-red-400 dark:border-red-700/70",
              !isWorkDay && !isCurrentMonth && "bg-red-50/50 dark:bg-red-900/20 border-red-300 dark:border-red-700/50",
              // Выделение выбранного дня - более яркое
              isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary/70",
              // Выделение сегодняшнего дня - более яркое
              isToday && !isSelected && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background border-primary/50",
            )}
            onClick={() => setSelectedDate(day)}
          >
            <div className="flex justify-between items-start">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isToday && "bg-primary text-primary-foreground shadow-sm",
                  !isToday && isCurrentMonth && "text-card-foreground",
                  !isToday && !isCurrentMonth && "text-muted-foreground/70",
                )}
              >
                {day.getDate()}
              </span>
            </div>

            {/* Events */}
            <div className="mt-1 space-y-1 max-h-20 overflow-y-auto">
              {dayEvents.map((event, eventIndex) => (
                <div
                  key={`${event.calendar_event_id}-${eventIndex}`}
                  className={cn("text-xs px-1 py-0.5 rounded truncate", getEventColor(event.calendar_event_type))}
                  title={getEventDisplayText(event)}
                >
                  {getEventDisplayText(event)}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
