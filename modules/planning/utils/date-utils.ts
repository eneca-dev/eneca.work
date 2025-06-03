export const isWeekend = (date: Date) => {
  const day = date.getDay()
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

// Функция для генерации массива дат для отображения
export const generateTimeUnits = (startDate: Date, daysToShow: number) => {
  const result: { date: Date; label: string; isWeekend?: boolean }[] = []
  const currentDate = new Date(startDate)

  // Генерируем дни
  for (let i = 0; i < daysToShow; i++) {
    const date = new Date(currentDate)
    const isWeekendDay = isWeekend(date)
    result.push({
      date,
      label: date.getDate().toString(),
      isWeekend: isWeekendDay,
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}

// Функция для получения текущей даты с началом в понедельник текущей недели
export const getCurrentWeekStart = () => {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Если сегодня воскресенье, то -6, иначе +1
  return new Date(today.setDate(diff))
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
