import type { Loading, ChartType } from "@/types/project-types"
import { formatDate } from "@/lib/date-utils"

export function groupLoadingsByTimeRange(
  loadings: Loading[],
  workingDays: Date[],
  type?: ChartType,
): Record<string, Loading[]> {
  const loadingsByTimeRange: Record<string, Loading[]> = {}

  // Создаем карту дат для быстрого поиска
  const dateMap = new Map<string, Date>()
  workingDays.forEach((day) => {
    dateMap.set(formatDate(day), day)
  })

  loadings.forEach((loading) => {
    // Filter by type if specified
    if (type && loading.type && loading.type !== type) {
      return
    }

    const startDate = new Date(loading.date_start || loading.startDate)
    const endDate = new Date(loading.date_end || loading.endDate)

    // Проверяем, пересекается ли загрузка с видимым диапазоном
    if (endDate < workingDays[0] || startDate > workingDays[workingDays.length - 1]) {
      return // Загрузка полностью за пределами видимого диапазона
    }

    // Определяем видимый диапазон загрузки
    const visibleStartDate = startDate < workingDays[0] ? workingDays[0] : startDate
    const visibleEndDate = endDate > workingDays[workingDays.length - 1] ? workingDays[workingDays.length - 1] : endDate

    // Создаем временный массив дат в видимом диапазоне
    const visibleDays: Date[] = []
    const currentDate = new Date(visibleStartDate)

    while (currentDate <= visibleEndDate) {
      const dateKey = formatDate(currentDate)
      if (dateMap.has(dateKey)) {
        visibleDays.push(new Date(currentDate))
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Добавляем загрузку для каждого видимого дня
    visibleDays.forEach((day) => {
      const dateKey = formatDate(day)
      if (!loadingsByTimeRange[dateKey]) {
        loadingsByTimeRange[dateKey] = []
      }
      if (!loadingsByTimeRange[dateKey].includes(loading)) {
        loadingsByTimeRange[dateKey].push(loading)
      }
    })
  })

  return loadingsByTimeRange
}

export function calculateRowHeight(loadingsByTimeRange: Record<string, Loading[]>): number {
  // Find maximum number of loadings per day
  const maxLoadingsPerDay = Object.values(loadingsByTimeRange).reduce(
    (max, loadings) => Math.max(max, loadings.length),
    0,
  )

  // Row height depends on maximum number of loadings
  return Math.max(40, 5 + maxLoadingsPerDay * 26 + 5) // 5px padding top + (26px * count) + 5px padding bottom
}

