"use client"

import { useTheme } from "next-themes"

export function Legend() {
  // Используем хук useTheme для реактивного отслеживания темы
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // Изменим компонент Legend, чтобы убрать разделение на категории

  // Обновим JSX для отображения только одного элемента
  return (
    <div className="flex items-center justify-end gap-6 p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm border-0 ring-1 ring-gray-200 dark:ring-gray-700">
      <div className="flex items-center">
        <div
          className="w-5 h-5 mr-2 rounded-md"
          style={{
            backgroundColor: isDarkTheme ? "#0C4A6E" : "#A7C7E7",
            border: `1px solid ${isDarkTheme ? "#0284C7" : "#8bafd3"}`,
          }}
        ></div>
        <span className="text-sm font-medium dark:text-gray-200">Загрузка</span>
      </div>
    </div>
  )
}

