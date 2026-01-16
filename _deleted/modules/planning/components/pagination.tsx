"use client"

import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  theme: string
}

export function Pagination({ currentPage, totalPages, onPageChange, theme }: PaginationProps) {
  // Если всего одна страница, не показываем пагинацию
  if (totalPages <= 1) return null

  // Создаем массив страниц для отображения
  const getPageNumbers = () => {
    const pages = []

    // Всегда показываем первую страницу
    pages.push(1)

    // Определяем диапазон страниц вокруг текущей
    let startPage = Math.max(2, currentPage - 1)
    let endPage = Math.min(totalPages - 1, currentPage + 1)

    // Если текущая страница близка к началу
    if (currentPage <= 3) {
      endPage = Math.min(4, totalPages - 1)
    }

    // Если текущая страница близка к концу
    if (currentPage >= totalPages - 2) {
      startPage = Math.max(2, totalPages - 3)
    }

    // Добавляем многоточие перед диапазоном, если нужно
    if (startPage > 2) {
      pages.push("...")
    }

    // Добавляем страницы диапазона
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    // Добавляем многоточие после диапазона, если нужно
    if (endPage < totalPages - 1) {
      pages.push("...")
    }

    // Всегда показываем последнюю страницу, если страниц больше одной
    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex items-center space-x-1">
      {/* Кнопка "Предыдущая страница" */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(
          "p-1.5 rounded-md",
          theme === "dark"
            ? "text-slate-400 hover:bg-slate-700 disabled:text-slate-600 disabled:hover:bg-transparent"
            : "text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent",
          "disabled:cursor-not-allowed",
        )}
        aria-label="Предыдущая страница"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Номера страниц */}
      {pageNumbers.map((page, index) => (
        <button
          key={index}
          onClick={() => typeof page === "number" && onPageChange(page)}
          disabled={page === "..." || page === currentPage}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs min-w-[28px] h-[28px] flex items-center justify-center",
            page === currentPage
              ? theme === "dark"
                ? "bg-teal-600 text-white font-semibold"
                : "bg-teal-500 text-white font-semibold"
              : page === "..."
                ? theme === "dark"
                  ? "text-slate-400 cursor-default"
                  : "text-slate-500 cursor-default"
                : theme === "dark"
                  ? "text-slate-300 hover:bg-slate-700/70"
                  : "text-slate-600 hover:bg-slate-200/70",
          )}
        >
          {page}
        </button>
      ))}

      {/* Кнопка "Следующая страница" */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(
          "p-1.5 rounded-md",
          theme === "dark"
            ? "text-slate-400 hover:bg-slate-700 disabled:text-slate-600 disabled:hover:bg-transparent"
            : "text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent",
          "disabled:cursor-not-allowed",
        )}
        aria-label="Следующая страница"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
