"use client"
import type { ColumnVisibility } from "../../stores/usePlanningColumnsStore"

interface ColumnVisibilityMenuProps {
  theme: string
}

// Функция для получения названия столбца на русском
const getColumnName = (columnKey: keyof ColumnVisibility): string => {
  switch (columnKey) {
    case "project":
      return "Проект"
    case "object":
      return "Объект"
    case "stage":
      return "Стадия"
    case "startDate":
      return "Дата начала"
    case "endDate":
      return "Дата окончания"
    case "sectionResponsible":
      return "Отдел"
    case "specialist":
      return "Специалист" // Оставляем для совместимости, но скрываем в меню
    default:
      return columnKey
  }
}

export function ColumnVisibilityMenu({ theme }: ColumnVisibilityMenuProps) {
  // Возвращаем пустой фрагмент, чтобы компонент ничего не отображал
  return null
}
