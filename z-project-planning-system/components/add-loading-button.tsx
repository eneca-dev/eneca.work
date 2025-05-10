"use client"

import { Plus } from "lucide-react"

// Переводим подсказку для кнопки добавления загрузки, если этот компонент содержит текст

// Предполагаем, что компонент выглядит примерно так:
export function AddLoadingButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
      title={label || "Добавить загрузку"}
    >
      <Plus size={14} />
    </button>
  )
}

