import type { Section } from "../types"

// Функция для определения, попадает ли раздел в указанный период
export const isSectionActiveInPeriod = (section: Section, periodStart: Date) => {
  if (!section.startDate || !section.endDate) return false

  try {
    // Используем объекты Date напрямую, так как они уже должны быть преобразованы в usePlanningStore
    const sectionStart = section.startDate
    const sectionEnd = section.endDate

    // Проверяем валидность дат
    if (isNaN(sectionStart.getTime()) || isNaN(sectionEnd.getTime())) {
      return false
    }

    // Сбрасываем время для корректного сравнения
    const startDateCopy = new Date(sectionStart)
    startDateCopy.setHours(0, 0, 0, 0)

    const endDateCopy = new Date(sectionEnd)
    endDateCopy.setHours(23, 59, 59, 999)

    const periodStartCopy = new Date(periodStart)
    periodStartCopy.setHours(0, 0, 0, 0)

    const periodEndCopy = new Date(periodStart)
    periodEndCopy.setHours(23, 59, 59, 999)

    // Проверяем, пересекаются ли периоды
    return (
      (startDateCopy <= periodEndCopy && endDateCopy >= periodStartCopy) || // Раздел пересекается с периодом
      (startDateCopy >= periodStartCopy && endDateCopy <= periodEndCopy) // Раздел полностью внутри периода
    )
  } catch (error) {
    console.error("Ошибка при проверке активности раздела:", error, section)
    return false
  }
}

// Функция для получения цвета статуса раздела
export const getSectionStatusColor = (status?: string) => {
  switch (status) {
    case "active":
      return "bg-green-500"
    case "delayed":
      return "bg-red-500"
    case "completed":
      return "bg-blue-500"
    default:
      return "bg-gray-400"
  }
}
