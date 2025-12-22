import type { CalendarEvent } from "@/modules/calendar/types"
import { formatMinskDate, getMinskDayOfWeek, parseMinskDate } from '@/lib/timezone-utils'

export const isWeekend = (date: Date) => {
  // ✅ Определяем день недели в часовом поясе Минска
  const day = getMinskDayOfWeek(date)
  return day === 0 || day === 6 // 0 - воскресенье, 6 - суббота
}

// Функция для определения, является ли дата сегодняшней
export const isToday = (date: Date) => {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

// Функция группировки дат по месяцам
export const groupDatesByMonth = (dates: { date: Date; label: string; isWeekend?: boolean }[]) => {
  const months: { name: string; startIndex: number; length: number }[] = []

  dates.forEach((dateObj, index) => {
    const date = dateObj.date
    const monthYear = date.toLocaleString("ru-RU", { month: "long", year: "numeric" })

    // Если это первый элемент или новый месяц
    if (
      index === 0 ||
      date.getMonth() !== dates[index - 1].date.getMonth() ||
      date.getFullYear() !== dates[index - 1].date.getFullYear()
    ) {
      months.push({
        name: monthYear,
        startIndex: index,
        length: 1,
      })
    } else {
      // Увеличиваем длину текущего месяца
      months[months.length - 1].length += 1
    }
  })

  return months
}

/**
 * Определяет, является ли день рабочим, используя логику из working-days.ts
 * Приоритеты:
 * 1. Перенос с is_weekday (переопределяет всё)
 * 2. Праздник (всегда нерабочий)
 * 3. Выходные дни (Сб/Вс)
 */
export const isWorkingDay = (date: Date, calendarEvents: CalendarEvent[]): boolean => {
  // ✅ Форматируем дату в часовом поясе Минска
  const dateString = formatMinskDate(date)

  // Приоритет 1: Проверяем переносы
  const transferEvent = calendarEvents.find(
    (event) =>
      event.calendar_event_type === 'Перенос' &&
      event.calendar_event_is_global &&
      // ✅ Парсим и форматируем дату события в часовом поясе Минска для корректного сравнения
      formatMinskDate(parseMinskDate(event.calendar_event_date_start)) === dateString &&
      event.calendar_event_is_weekday !== null
  )

  if (transferEvent) {
    return transferEvent.calendar_event_is_weekday === true
  }

  // Приоритет 2: Проверяем праздники
  const holidayEvent = calendarEvents.find(
    (event) =>
      event.calendar_event_type === 'Праздник' &&
      event.calendar_event_is_global &&
      // ✅ Парсим и форматируем дату события в часовом поясе Минска для корректного сравнения
      formatMinskDate(parseMinskDate(event.calendar_event_date_start)) === dateString
  )

  if (holidayEvent) {
    return false // Праздник всегда нерабочий
  }

  // Приоритет 3: Стандартная проверка выходных
  return !isWeekend(date)
}

// Константы для ширины ячеек
const WORKING_DAY_WIDTH = 30 // Рабочие дни (~36% шире)
const NON_WORKING_DAY_WIDTH = 22 // Выходные/праздники

// Функция для генерации массива дат для отображения
export const generateTimeUnits = (
  startDate: Date,
  daysToShow: number,
  calendarEvents: CalendarEvent[] = []
) => {
  const result: {
    date: Date
    label: string
    isWeekend?: boolean
    isWorkingDay?: boolean
    width: number
    left: number // Накопленная позиция слева
  }[] = []
  const currentDate = new Date(startDate)
  let accumulatedLeft = 0

  // Генерируем дни
  for (let i = 0; i < daysToShow; i++) {
    const date = new Date(currentDate)
    const isWeekendDay = isWeekend(date)
    const isWorking = isWorkingDay(date, calendarEvents)
    const width = isWorking ? WORKING_DAY_WIDTH : NON_WORKING_DAY_WIDTH

    result.push({
      date,
      label: date.getDate().toString(),
      isWeekend: isWeekendDay,
      isWorkingDay: isWorking,
      width,
      left: accumulatedLeft,
    })

    accumulatedLeft += width
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}

// Функция для получения текущей даты с началом в понедельник текущей недели
export const getCurrentWeekStart = () => {
  const today = new Date()
  // ✅ Используем день недели в часовом поясе Минска
  const day = getMinskDayOfWeek(today)
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Если сегодня воскресенье, то -6, иначе +1

  // Создаем новый объект Date, чтобы не мутировать исходный
  const weekStart = new Date(today)
  weekStart.setDate(diff)
  return weekStart
}

// Функция для определения, является ли дата первым днем месяца
export const isFirstDayOfMonth = (date: Date) => {
  return date.getDate() === 1
}

// Add this function to check if a date is the last day of the month
export const isLastDayOfMonth = (date: Date) => {
  const nextDay = new Date(date)
  nextDay.setDate(date.getDate() + 1)
  return nextDay.getMonth() !== date.getMonth()
}
