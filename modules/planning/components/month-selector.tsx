"use client"

interface MonthSelectorProps {
  currentDate: Date
  onSelectMonth: (date: Date) => void
  theme: string
}

export function MonthSelector({ currentDate, onSelectMonth, theme }: MonthSelectorProps) {
  // Возвращаем пустой фрагмент вместо селектора месяцев
  return null
}
