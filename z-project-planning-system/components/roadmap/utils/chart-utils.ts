import type { ExecutorCategory } from "@/types/project-types"

// Function to generate SVG path for chart area - modified to use cell edges instead of centers
export function generateAreaPath(
  days: Date[],
  valueGetter: (day: Date, index: number) => number,
  height: number,
  cellWidth: number,
): string {
  if (days.length === 0) return ""

  // Collect points with non-zero values
  const points: [number, number][] = []
  let hasPoints = false

  for (let i = 0; i < days.length; i++) {
    const value = valueGetter(days[i], i)
    if (value > 0) {
      // Use left edge of cell instead of center
      const x = i * cellWidth
      const y = height - value * height * 0.8
      points.push([x, y])
      hasPoints = true
    }
  }

  // If no points have values, return empty path
  if (!hasPoints) return ""

  // Start the path
  let path = `M ${points[0][0]} ${height}`

  // Add vertical line up to first point
  path += ` L ${points[0][0]} ${points[0][1]}`

  // Add all points
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i][0]} ${points[i][1]}`
  }

  // Add the right edge of the last cell
  const lastPoint = points[points.length - 1]
  const lastX = lastPoint[0] + cellWidth
  path += ` L ${lastX} ${lastPoint[1]}`

  // Add vertical line down to bottom
  path += ` L ${lastX} ${height}`

  // Close the path
  path += " Z"

  return path
}

// Обновляем функции для работы с цветами категорий в темной теме
export function getColorForCategory(category: ExecutorCategory): string {
  switch (category) {
    case "К1":
      return "text-gray-800 dark:text-gray-100" // Pastel green style will be added via inline style
    case "ВС1":
      return "text-gray-800 dark:text-gray-100" // Pastel blue style will be added via inline style
    case "ГС1":
      return "text-gray-800 dark:text-gray-100" // Pastel orange style will be added via inline style (ГС - Главный специалист)
    default:
      return "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
  }
}

// Обновляем функции для работы с цветами категорий, чтобы они принимали параметр isDarkTheme
// вместо проверки DOM
export function getCategoryBackgroundColor(category: ExecutorCategory, isDarkTheme: boolean): string {
  switch (category) {
    case "К1":
      return isDarkTheme ? "#1A4731" : "#B5E3C1" // Темно-зеленый в темной теме, светло-зеленый в светлой
    case "ВС1":
      return isDarkTheme ? "#0C4A6E" : "#A7C7E7" // Темно-синий в темной теме, светло-синий в светлой
    case "ГС1":
      return isDarkTheme ? "#451A03" : "#F4CDA5" // Темно-оранжевый в темной теме, светло-оранжевый в светлой
    default:
      return isDarkTheme ? "#262626" : "#e5e7eb" // Темно-серый в темной теме, светло-серый в светлой
  }
}

export function getCategoryBorderColor(category: ExecutorCategory, isDarkTheme: boolean): string {
  switch (category) {
    case "К1":
      return isDarkTheme ? "#22C55E" : "#8fcca3" // Яркий зеленый в темной теме, приглушенный в светлой
    case "ВС1":
      return isDarkTheme ? "#0284C7" : "#8bafd3" // Яркий синий в темной теме, приглушенный в светлой
    case "ГС1":
      return isDarkTheme ? "#F97316" : "#e0b989" // Яркий оранжевый в темной теме, приглушенный в светлой
    default:
      return isDarkTheme ? "#525252" : "#d1d5db" // Серый для обоих тем
  }
}

export function getCategoryTextColor(category: ExecutorCategory, isDarkTheme: boolean): string {
  switch (category) {
    case "К1":
      return isDarkTheme ? "#86EFAC" : "#1e3a29" // Светло-зеленый в темной теме, темно-зеленый в светлой
    case "ВС1":
      return isDarkTheme ? "#7DD3FC" : "#1e3a5a" // Светло-синий в темной теме, темно-синий в светлой
    case "ГС1":
      return isDarkTheme ? "#FDBA74" : "#3a2a1e" // Светло-оранжевый в темной теме, темно-оранжевый в светлой
    default:
      return isDarkTheme ? "#A3A3A3" : "#374151" // Светло-серый в темной теме, темно-серый в светлой
  }
}

