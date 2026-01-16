"use client" 

import { cn } from "@/lib/utils"
import { Calendar } from "lucide-react"

// Обновляем интерфейс, добавляя startDate, daysToShow и onTodayClick
interface NavigationControlsProps {
  theme: string
  onScrollBackward: () => void
  onScrollForward: () => void
  startDate: Date | string
  daysToShow: number
  onTodayClick: () => void // Добавляем обработчик для кнопки "Сегодня"
}

export function NavigationControls({
  theme,
  onScrollBackward,
  onScrollForward,
  startDate,
  daysToShow,
  onTodayClick,
}: NavigationControlsProps) {
  // Исправляем функцию форматирования даты, добавляя проверку и преобразование типа
  const formatDate = (date: Date | string): string => {
    try {
      // Преобразуем в объект Date, если это строка
      const dateObj = date instanceof Date ? date : new Date(date)

      // Проверяем, что дата валидна
      if (isNaN(dateObj.getTime())) {
        return "Некорректная дата"
      }

      // Форматируем дату с использованием API Intl для большей совместимости
      return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(dateObj)
    } catch (error) {
      console.error("Ошибка форматирования даты:", error)
      return "Ошибка даты"
    }
  }

  // Вычисляем конечную дату с проверкой
  let endDate
  try {
    // Преобразуем startDate в объект Date, если это не так
    const startDateObj = startDate instanceof Date ? startDate : new Date(startDate)
    endDate = new Date(startDateObj)
    endDate.setDate(endDate.getDate() + daysToShow - 1)
  } catch (error) {
    console.error("Ошибка вычисления конечной даты:", error)
    endDate = new Date() // Используем текущую дату как запасной вариант
  }

  return (
    <div className="flex items-center gap-2">
      {/* Информация о диапазоне дат с кнопкой "Сегодня" */}
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <span className="text-xs font-medium whitespace-nowrap">
            {formatDate(startDate)} — {formatDate(endDate)} ({daysToShow} дней)
          </span>
        </div>

        {/* Кнопка "Сегодня" */}
        <button
          className={cn(
            "p-1.5 rounded border",
            theme === "dark"
              ? "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
              : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200",
          )}
          onClick={onTodayClick}
          title="Перейти к сегодняшнему дню"
        >
          <Calendar size={14} />
        </button>
      </div>

      {/* Кнопки прокрутки */}
      <div className="flex">
        <button
          className={cn(
            "p-1.5 rounded-l border",
            theme === "dark"
              ? "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
              : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200",
          )}
          onClick={onScrollBackward}
          title="Прокрутить назад"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button
          className={cn(
            "p-1.5 rounded-r border-t border-r border-b",
            theme === "dark"
              ? "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
              : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200",
          )}
          onClick={onScrollForward}
          title="Прокрутить вперед"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  )
}
