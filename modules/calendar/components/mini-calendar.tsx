"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"
import { useUserStore } from "@/stores/useUserStore"
import { CalendarEvent } from "@/modules/calendar/types"
import { 
  parseDateFromString, 
  isSameDateOnly, 
  isDateInRange,
  isWeekend
} from "@/modules/calendar/utils"
import { useWorkSchedule } from "@/modules/calendar/hooks/useWorkSchedule"

interface MiniCalendarProps {
  /** Диапазон выбранных дат */
  selectedRange: { from: Date | null; to: Date | null }
  /** Колбэк при клике по дате */
  onSelectDate: (date: Date) => void
  /** Режим выбора (single или range) */
  mode?: "single" | "range"
  /** Ширина календаря */
  width?: string
}

export const MiniCalendar: React.FC<MiniCalendarProps> = (props) => {
  const selectedRange = props.selectedRange
  const onSelectDate = props.onSelectDate
  const mode = props.mode || "range"
  const width = props.width || "650px"

  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  // Добавляем хуки для работы с событиями
  const { events, fetchEvents } = useCalendarEvents()
  const { workSchedules, fetchWorkSchedules } = useWorkSchedule()
  const userStore = useUserStore()
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated

  // Загружаем события при инициализации
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) {
      return
    }

    const abortController = new AbortController()
    let isMounted = true

    const loadData = async () => {
      return Sentry.startSpan(
        {
          op: "calendar.load_mini_data",
          name: "Load Mini Calendar Data",
        },
        async (span) => {
          try {
            span.setAttribute("user.id", currentUserId)
            span.setAttribute("user.authenticated", isAuthenticated)
            
            await Promise.allSettled([
              fetchEvents(currentUserId),
              fetchWorkSchedules(currentUserId)
            ]).then((results) => {
              if (!isMounted || abortController.signal.aborted) {
                return
              }

              let failedOperations = 0
              results.forEach((result, index) => {
                if (result.status === 'rejected') {
                  failedOperations++
                  const operationName = index === 0 ? 'events' : 'work schedules'
                  console.error(`Failed to fetch ${operationName}:`, result.reason)
                  
                  Sentry.captureException(result.reason, {
                    tags: {
                      module: 'calendar',
                      component: 'MiniCalendar',
                      action: `load_${operationName.replace(' ', '_')}`,
                      error_type: 'fetch_error'
                    },
                    extra: {
                      user_id: currentUserId,
                      operation: operationName,
                      timestamp: new Date().toISOString()
                    }
                  })
                }
              })
              
              span.setAttribute("load.success", failedOperations === 0)
              span.setAttribute("load.failed_operations", failedOperations)
              
              if (failedOperations === 0) {
                Sentry.addBreadcrumb({
                  message: 'Mini calendar data loaded successfully',
                  category: 'calendar',
                  level: 'info',
                  data: {
                    component: 'MiniCalendar',
                    user_id: currentUserId
                  }
                })
              }
            })
          } catch (error) {
            span.setAttribute("load.success", false)
            span.recordException(error as Error)
            Sentry.captureException(error, {
              tags: {
                module: 'calendar',
                component: 'MiniCalendar',
                action: 'load_data',
                error_type: 'unexpected_error'
              },
              extra: {
                user_id: currentUserId,
                timestamp: new Date().toISOString()
              }
            })
            if (isMounted && !abortController.signal.aborted) {
              console.error('Failed to load calendar data:', error)
            }
          }
        }
      )
    }

    loadData()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [currentUserId, isAuthenticated, fetchEvents, fetchWorkSchedules])

  // Проверяем, является ли день рабочим с учетом событий пользователя
  const isWorkingDay = (date: Date) => {
    if (!currentUserId) return !isWeekend(date)

    // Проверяем глобальные события (переносы, праздники)
    const globalEvents = events.filter((event) => {
      const eventDate = parseDateFromString(event.calendar_event_date_start)
      return isSameDateOnly(date, eventDate) && event.calendar_event_is_global
    })

    // Если есть перенос, проверяем его is_weekday значение
    const transferEvent = globalEvents.find((event) => event.calendar_event_type === "Перенос")
    if (transferEvent && transferEvent.calendar_event_is_weekday !== null) {
      return transferEvent.calendar_event_is_weekday
    }

    // Если есть праздник, это не рабочий день
    const holidayEvent = globalEvents.find((event) => event.calendar_event_type === "Праздник")
    if (holidayEvent) {
      return false
    }

    // Проверяем личные события пользователя (отпуск, больничный, отгул)
    const personalEvents = events.filter((event) => {
      const eventDate = parseDateFromString(event.calendar_event_date_start)
      const eventEndDate = event.calendar_event_date_end ? parseDateFromString(event.calendar_event_date_end) : eventDate
      
      const isInRange = event.calendar_event_date_end 
        ? isDateInRange(date, eventDate, eventEndDate)
        : isSameDateOnly(date, eventDate)
      const isPersonalNonWorkingEvent = ["Отгул", "Больничный", "Отпуск"].includes(event.calendar_event_type)
      const isCreatedByCurrentUser = event.calendar_event_created_by === currentUserId
      
      return isInRange && isPersonalNonWorkingEvent && isCreatedByCurrentUser
    })

    // Если есть личные события, делающие день нерабочим
    if (personalEvents.length > 0) {
      return false
    }

    // Иначе проверяем, выходной ли это день
    return !isWeekend(date)
  }

  // Получаем события для конкретного дня
  const getDayEvents = (date: Date): CalendarEvent[] => {
    if (!currentUserId) return []

    return events.filter((event) => {
      const eventDate = parseDateFromString(event.calendar_event_date_start)
      const eventEndDate = event.calendar_event_date_end ? parseDateFromString(event.calendar_event_date_end) : eventDate
      
      const isInRange = event.calendar_event_date_end 
        ? isDateInRange(date, eventDate, eventEndDate)
        : isSameDateOnly(date, eventDate)
      
      // Показываем глобальные события и личные события текущего пользователя
      return isInRange && (
        event.calendar_event_is_global || 
        event.calendar_event_created_by === currentUserId
      )
    })
  }

  // Получаем цвет для дня (аналогично weekly-calendar)
  const getDayColor = (date: Date) => {
    const isToday = isSameDateOnly(date, new Date())
    const isWorking = isWorkingDay(date)
    const dayEvents = getDayEvents(date)
    
    // Проверяем есть ли личные события (отпуск, больничный, отгул)
    const personalNonWorkingEvents = dayEvents.filter(event => 
      ["Отгул", "Больничный", "Отпуск"].includes(event.calendar_event_type) &&
      event.calendar_event_created_by === currentUserId
    )
    
    // Проверяем есть ли праздники
    const holidayEvents = dayEvents.filter(event => event.calendar_event_type === "Праздник")
    
    // Если есть личные события, праздники или это выходной - делаем красным
    if (personalNonWorkingEvents.length > 0 || holidayEvents.length > 0 || !isWorking) {
      return "text-red-300 dark:text-red-400"
    }
    
    // Обычный рабочий день
    return "text-foreground"
  }

  const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    e.currentTarget.blur()
  }
  
  const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    e.currentTarget.blur()
  }

  const renderMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const weeks: (Date | null)[][] = []
    let day = 1

    for (let w = 0; w < 6; w++) {
      const week: (Date | null)[] = []
      for (let d = 0; d < 7; d++) {
        if ((w === 0 && d < firstDayIndex) || day > daysInMonth) {
          week.push(null)
        } else {
          week.push(new Date(year, month, day++))
        }
      }
      weeks.push(week)
    }

    const from = selectedRange.from
    const to = selectedRange.to

    return (
      <div className="flex-1" key={`${year}-${month}`}>
        <div className="text-center font-bold mb-1.5 text-foreground">
          {date.toLocaleString("ru-RU", { month: "long", year: "numeric" })}
        </div>
        <div className="grid grid-cols-7 text-center">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div 
              key={d}
              className="w-8 h-8 flex items-center justify-center rounded font-bold text-sm text-muted-foreground m-0.5"
            >
              {d}
            </div>
          ))}
          {weeks.flat().map((d, idx) => {
            if (!d) {
              return (
                <div 
                  key={idx} 
                  className="w-8 h-8 flex items-center justify-center rounded cursor-default m-0.5"
                />
              )
            }
            
            const time = d.getTime()
            const isFrom = from && time === from.getTime()
            const isTo = to && time === to.getTime()
            const isBetween = from && to && time > from.getTime() && time < to.getTime()

            return (
              <div 
                key={idx} 
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full cursor-pointer border border-transparent text-sm m-0.5 transition-colors hover:bg-accent/50",
                  getDayColor(d),
                  (isFrom || isTo) && "bg-primary text-primary-foreground border-primary shadow-sm",
                  isBetween && "bg-primary/10 text-primary border-primary/20",
                )}
                onClick={() => {
                  try {
                    onSelectDate(d)
                    
                    Sentry.addBreadcrumb({
                      message: 'Date selected in mini calendar',
                      category: 'calendar',
                      level: 'info',
                      data: {
                        component: 'MiniCalendar',
                        selected_date: d.toISOString().split('T')[0],
                        user_id: currentUserId,
                        mode: mode
                      }
                    })
                  } catch (error) {
                    Sentry.captureException(error, {
                      tags: {
                        module: 'calendar',
                        component: 'MiniCalendar',
                        action: 'select_date',
                        error_type: 'unexpected_error'
                      },
                      extra: {
                        selected_date: d.toISOString(),
                        user_id: currentUserId,
                        mode: mode,
                        timestamp: new Date().toISOString()
                      }
                    })
                    console.error('Ошибка при выборе даты в мини-календаре:', error)
                    // Все равно вызываем обработчик
                    onSelectDate(d)
                  }
                }}
              >
                {d.getDate()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div 
      className="font-sans bg-background border border-border rounded-lg p-2"
      style={{ width }}
    >
      <div className="flex justify-between mb-3">
        <button 
          className="cursor-pointer border-none bg-transparent text-lg text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          onClick={handlePrev}
        >
          &lt;
        </button>
        <button 
          className="cursor-pointer border-none bg-transparent text-lg text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          onClick={handleNext}
        >
          &gt;
        </button>
      </div>
      <div className="flex gap-6">
        {renderMonth(currentMonth)}
        {renderMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
      </div>
    </div>
  )
}

// Обёртка: выбор диапазона дат
interface DatePickerProps {
  /** Выбранный диапазон дат */
  value: { from: Date | null; to: Date | null }
  /** Колбэк при изменении выбранных дат */
  onChange: (range: { from: Date | null; to: Date | null }) => void
  /** Режим выбора (single или range) */
  mode?: "single" | "range"
  /** Плейсхолдер для инпута */
  placeholder?: string
  /** Ширина календаря */
  calendarWidth?: string
  /** Ширина поля ввода */
  inputWidth?: string
}

export const DatePicker: React.FC<DatePickerProps> = (props) => {
  const value = props.value
  const onChange = props.onChange
  const mode = props.mode || "range"
  const placeholder = props.placeholder || "Выберите дату"
  const calendarWidth = props.calendarWidth || "650px"
  const inputWidth = props.inputWidth || "100%"

  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleDateSelect = (d: Date) => {
    if (mode === "single") {
      onChange({ from: d, to: null })
      setOpen(false)
    } else {
      const from = value.from
      const to = value.to

      if (!from || (from && to)) {
        onChange({ from: d, to: null })
      } else if (from && !to) {
        if (d.getTime() < from.getTime()) {
          onChange({ from: d, to: from })
        } else {
          onChange({ from, to: d })
        }
        setOpen(false)
      }
    }
  }

  // Формат для инпута
  let inputValue = ""
  if (value.from && value.to) {
    inputValue = `${value.from.toLocaleDateString("ru-RU")} - ${value.to.toLocaleDateString("ru-RU")}`
  } else if (value.from) {
    inputValue = value.from.toLocaleDateString("ru-RU")
  }

  return (
    <div className="relative" ref={wrapperRef} style={{ width: inputWidth }}>
      <input
        readOnly
        value={inputValue}
        placeholder={placeholder}
        onClick={() => setOpen(!open)}
        className="w-full p-2 border border-border rounded bg-gray-50 dark:bg-gray-700 text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-sm text-sm"
      />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 shadow-lg rounded-lg bg-background border border-border">
          <MiniCalendar
            selectedRange={value}
            onSelectDate={handleDateSelect}
            mode={mode}
            width={calendarWidth}
          />
        </div>
      )}
    </div>
  )
}
