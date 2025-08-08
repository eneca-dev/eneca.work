"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
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

// Константа для типов личных нерабочих событий
const PERSONAL_NON_WORKING_EVENT_TYPES = [
  "Отгул", 
  "Больничный", 
  "Отпуск запрошен", 
  "Отпуск одобрен", 
  "Отпуск отклонен"
] as const

type PersonalNonWorkingEventType = typeof PERSONAL_NON_WORKING_EVENT_TYPES[number]

interface MiniCalendarProps {
  /** Диапазон выбранных дат */
  selectedRange: { from: Date | null; to: Date | null } | null
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
      try {
        await Promise.allSettled([
          fetchEvents(currentUserId),
          fetchWorkSchedules(currentUserId)
        ]).then((results) => {
          if (!isMounted || abortController.signal.aborted) {
            return
          }

          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              const operationName = index === 0 ? 'events' : 'work schedules'
              console.error(`Failed to fetch ${operationName}:`, result.reason)
            }
          })
        })
      } catch (error) {
        if (isMounted && !abortController.signal.aborted) {
          console.error('Failed to load calendar data:', error)
        }
      }
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
      const isPersonalNonWorkingEvent = PERSONAL_NON_WORKING_EVENT_TYPES.includes(event.calendar_event_type as PersonalNonWorkingEventType)
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
      PERSONAL_NON_WORKING_EVENT_TYPES.includes(event.calendar_event_type as PersonalNonWorkingEventType) &&
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

    const from = selectedRange?.from || null
    const to = selectedRange?.to || null

    return (
      <div className="flex-1" key={`${year}-${month}`}>
        <div className="text-center font-bold mb-1 text-foreground text-sm">
          {date.toLocaleString("ru-RU", { month: "long", year: "numeric" })}
        </div>
        <div className="grid grid-cols-7 text-center">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div 
              key={d}
              className="w-6 h-6 flex items-center justify-center rounded font-bold text-xs text-muted-foreground m-0.5"
            >
              {d}
            </div>
          ))}
          {weeks.flat().map((d, idx) => {
            if (!d) {
                          return (
              <div 
                key={idx} 
                className="w-6 h-6 flex items-center justify-center rounded cursor-default m-0.5"
              />
            )
            }
            
            // Нормализуем даты для корректного сравнения (убираем время)
            const currentDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
            const fromDate = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()) : null
            const toDate = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate()) : null
            
            const isFrom = fromDate && currentDate.getTime() === fromDate.getTime()
            const isTo = toDate && currentDate.getTime() === toDate.getTime()
            const isBetween = fromDate && toDate && currentDate.getTime() > fromDate.getTime() && currentDate.getTime() < toDate.getTime()

            return (
              <div 
                key={idx} 
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full cursor-pointer border border-transparent text-xs m-0.5 transition-colors hover:bg-accent/50",
                  getDayColor(d),
                  (isFrom || isTo) && "bg-primary text-primary-foreground border-primary shadow-sm",
                  isBetween && "bg-primary/10 text-primary border-primary/20",
                )}
                onClick={() => onSelectDate(d)}
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
      className="font-sans bg-background border border-border rounded-lg p-2 dark:bg-slate-700 dark:border-slate-500"
      style={{ width }}
    >
      <div className="flex justify-between mb-2">
        <button 
          className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
          onClick={handlePrev}
        >
          ←
        </button>
        <button 
          className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
          onClick={handleNext}
        >
          →
        </button>
      </div>
      <div className="flex gap-4">
        {renderMonth(currentMonth)}
        {renderMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
      </div>
    </div>
  )
}

// Обёртка: выбор диапазона дат
interface DatePickerProps {
  /** Выбранный диапазон дат */
  value: { from: Date | null; to: Date | null } | null
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
  const [openUpward, setOpenUpward] = useState(false)
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

  const handleInputClick = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const calendarHeight = 280 // уменьшенная высота компактного календаря
      
      // Открываем вверх, если снизу недостаточно места, а сверху достаточно
      setOpenUpward(spaceBelow < calendarHeight && spaceAbove > calendarHeight)
    }
    setOpen(!open)
  }

  const handleDateSelect = (d: Date) => {
    if (mode === "single") {
      onChange({ from: d, to: null })
      setOpen(false)
    } else {
      const from = value?.from || null
      const to = value?.to || null

      if (!from || (from && to)) {
        onChange({ from: d, to: null })
      } else if (from && !to) {
        // Нормализуем даты для корректного сравнения
        const selectedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        const fromDate = new Date(from.getFullYear(), from.getMonth(), from.getDate())
        
        if (selectedDate.getTime() < fromDate.getTime()) {
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
  if (value && value.from && value.to) {
    inputValue = `${value.from.toLocaleDateString("ru-RU")} - ${value.to.toLocaleDateString("ru-RU")}`
  } else if (value && value.from) {
    inputValue = value.from.toLocaleDateString("ru-RU")
  }

  return (
    <div className="relative" ref={wrapperRef} style={{ width: inputWidth }}>
      <input
        readOnly
        value={inputValue}
        placeholder={placeholder}
        onClick={handleInputClick}
        className="w-full p-2 border border-border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-500 text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-sm text-sm"
      />
      {open && (
        <div 
          className="absolute left-0 z-50 shadow-lg rounded-lg bg-background border border-border dark:bg-slate-700 dark:border-slate-500"
          style={openUpward ? {
            bottom: '100%',
            marginBottom: '4px',
          } : {
            top: '100%',
            marginTop: '4px',
          }}
        >
          <MiniCalendar
            selectedRange={value || { from: null, to: null }}
            onSelectDate={handleDateSelect}
            mode={mode}
            width={calendarWidth}
          />
        </div>
      )}
    </div>
  )
}
