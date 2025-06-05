"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"
import { useUserStore } from "@/stores/useUserStore"
import { CalendarEvent } from "@/modules/calendar/types"
import { 
  formatDateToString, 
  parseDateFromString, 
  isSameDateOnly, 
  isDateInRange,
  getWeekDays,
  isWeekend,
  formatMonthYear
} from "@/modules/calendar/utils"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWorkSchedule } from "@/modules/calendar/hooks/useWorkSchedule"
import { useCalendarStore } from "@/modules/calendar/store"
import { startOfWeek, addDays, subWeeks, addWeeks } from "date-fns"

interface WeeklyCalendarProps {
  collapsed: boolean
}

export function WeeklyCalendar({ collapsed }: WeeklyCalendarProps) {
  const { events, fetchEvents } = useCalendarEvents()
  const { workSchedules, fetchWorkSchedules } = useWorkSchedule()
  const { selectedDate, setSelectedDate } = useCalendarStore()
  const userStore = useUserStore()
  const router = useRouter()
  
  // Получаем данные авторизованного пользователя
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated

  const [calendarDate, setCalendarDate] = useState<Date>(selectedDate || new Date())

  // Загружаем события и график только при инициализации
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) {
      return
    }

    // Создаем AbortController для отмены запросов при размонтировании компонента
    const abortController = new AbortController()
    let isMounted = true

    const loadData = async () => {
      try {
        // Запускаем запросы параллельно
        await Promise.allSettled([
          fetchEvents(currentUserId),
          fetchWorkSchedules(currentUserId)
        ]).then((results) => {
          // Проверяем, что компонент все еще монтирован
          if (!isMounted || abortController.signal.aborted) {
            return
          }

          // Обрабатываем результаты
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              const operationName = index === 0 ? 'events' : 'work schedules'
              console.error(`Failed to fetch ${operationName}:`, result.reason)
            }
          })
        })
      } catch (error) {
        // Проверяем, что компонент все еще монтирован и запрос не был отменен
        if (isMounted && !abortController.signal.aborted) {
          console.error('Failed to load calendar data:', error)
        }
      }
    }

    loadData()

    // Функция очистки
    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [currentUserId, isAuthenticated, fetchEvents, fetchWorkSchedules])

  // Обновляем дату календаря при изменении выбранной даты
  useEffect(() => {
    if (selectedDate) {
      setCalendarDate(selectedDate)
    }
  }, [selectedDate])

  const weekStart = startOfWeek(calendarDate, { weekStartsOn: 1 })
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i))

  const navigateWeek = (direction: 'prev' | 'next', e?: React.MouseEvent<HTMLButtonElement>) => {
    const newDate = new Date(calendarDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCalendarDate(newDate)
    if (e) e.currentTarget.blur()
  }

  const goToCurrentWeek = (e?: React.MouseEvent<HTMLButtonElement>) => {
    const today = new Date()
    setCalendarDate(today)
    setSelectedDate(today)
    if (e) e.currentTarget.blur()
  }

  const handleCalendarClick = () => {
    setSelectedDate(calendarDate)
    router.push('/dashboard/calendar')
  }

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

  // Получаем цвет для дня (минималистичный дизайн)
  const getDayColor = (date: Date) => {
    const isToday = isSameDateOnly(date, new Date())
    const isWorking = isWorkingDay(date)
    const dayEvents = getDayEvents(date)
    
    // Если сегодня
    if (isToday) {
      return "text-gray-900 dark:text-gray-100 font-semibold bg-gray-50 dark:bg-gray-800/100"
    }
    
    // Проверяем есть ли личные события (отпуск, больничный, отгул)
    const personalNonWorkingEvents = dayEvents.filter(event => 
      ["Отгул", "Больничный", "Отпуск"].includes(event.calendar_event_type) &&
      event.calendar_event_created_by === currentUserId
    )
    
    // Проверяем есть ли праздники
    const holidayEvents = dayEvents.filter(event => event.calendar_event_type === "Праздник")
    
    // Если есть личные события, праздники или это выходной - делаем бледно-красным
    if (personalNonWorkingEvents.length > 0 || holidayEvents.length > 0 || !isWorking) {
      return "text-red-300 dark:text-red-400"
    }
    
    // Обычный рабочий день
    return "text-gray-700 dark:text-gray-300"
  }

  // Получаем короткое название дня недели
  const getDayName = (date: Date) => {
    const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
    return dayNames[date.getDay()]
  }

  // Получаем название месяца для текущей недели
  const getMonthName = () => {
    const monthYear = formatMonthYear(calendarDate)
    return monthYear.charAt(0).toUpperCase() + monthYear.slice(1)
  }

  if (collapsed) {
    return null // Не показываем календарь в свернутом состоянии
  }

  return (
    <div className="px-2 py-3">
      {/* Заголовок с навигацией */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            {getMonthName()}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-foreground transition-colors"
            onClick={(e) => navigateWeek('prev', e)}
            title="Предыдущая неделя"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-foreground transition-colors"
            onClick={goToCurrentWeek}
            title="Текущая неделя"
          >
            <Calendar className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-foreground transition-colors"
            onClick={(e) => navigateWeek('next', e)}
            title="Следующая неделя"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Календарная сетка */}
      <div 
        className="grid grid-cols-7 gap-1 cursor-pointer" 
        onClick={handleCalendarClick}
        title="Нажмите для перехода к календарю"
      >
        {weekDays.map((day, index) => {
          const dayEvents = getDayEvents(day)
          const hasEventTypeEvents = dayEvents.some(event => event.calendar_event_type === "Событие")
          
          return (
            <div
              key={index}
              className={cn(
                "text-center text-xs rounded p-1 transition-colors hover:opacity-70 relative",
                getDayColor(day)
              )}
            >
                
                <div className="font-medium">{getDayName(day)}</div>
                <div className="text-xs opacity-80">{day.getDate()}</div>
                
                {/* Точка для событий снизу */}
                {hasEventTypeEvents && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-current rounded-full opacity-40" />
                )}
            </div>
          )
        })}
      </div>
    </div>
  )
} 