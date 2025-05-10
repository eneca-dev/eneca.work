"use client"

import { useRoadmap } from "../../context/roadmap-context"
import { AddLoadingButton } from "@/components/add-loading-button"
import { LoadingItem } from "./loading-item"
import { cn } from "@/lib/utils"
import { groupLoadingsByTimeRange } from "../../utils/loading-utils"
import type { Stage } from "@/types/project-types"
import { useMemo, useCallback, memo } from "react"
import { useTheme } from "next-themes"

// Добавим параметр responsibleColumnWidth в интерфейс
interface StageRowProps {
  stage: Stage
  responsibleColumnWidth?: number
}

// Обновим функцию StageRow, добавив параметр responsibleColumnWidth
export const StageRow = memo(function StageRow({ stage, responsibleColumnWidth = 150 }: StageRowProps) {
  const {
    workingDays,
    onAddLoading,
    onEditLoading,
    CELL_WIDTH,
    sidebarWidth = 264,
    allDays,
    responsibleColumnWidth: contextResponsibleColumnWidth,
  } = useRoadmap()

  // Перемещаем хук useTheme на верхний уровень компонента
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // Используем значение из контекста, если оно доступно
  const actualResponsibleColumnWidth = contextResponsibleColumnWidth || responsibleColumnWidth

  // Only use Fact loadings (filter out Plan loadings) - memoize this calculation
  const factLoadings = useMemo(() => {
    return stage.loadings.filter((l) => !l.type || l.type === "Fact")
  }, [stage.loadings])

  // Memoize the loadings by time range calculation
  const loadingsByTimeRange = useMemo(() => {
    return groupLoadingsByTimeRange(factLoadings, workingDays)
  }, [factLoadings, workingDays])

  // Memoize row height calculation
  const { rowHeight, maxLoadingsPerDay } = useMemo(() => {
    // Count the maximum number of overlapping loadings
    const loadingPositions = new Map<string, number>()
    let maxPosition = 0

    // First identify all visible loadings
    const visibleLoadings = factLoadings.filter((loading) => {
      const startDate = new Date(loading.date_start)
      const endDate = new Date(loading.date_end)
      return !(endDate < workingDays[0] || startDate > workingDays[workingDays.length - 1])
    })

    // Assign positions to loadings based on overlaps
    visibleLoadings.forEach((loading) => {
      const overlappingPositions = new Set<number>()

      for (const [loadingId, position] of loadingPositions.entries()) {
        const existingLoading = factLoadings.find((l) => l.id === loadingId)
        if (!existingLoading) continue

        const existingStart = new Date(existingLoading.date_start)
        const existingEnd = new Date(existingLoading.date_end)
        const currentStart = new Date(loading.date_start)
        const currentEnd = new Date(loading.date_end)

        if (!(existingEnd < currentStart || existingStart > currentEnd)) {
          overlappingPositions.add(position)
        }
      }

      let position = 0
      while (overlappingPositions.has(position)) {
        position++
      }

      loadingPositions.set(loading.id, position)
      maxPosition = Math.max(maxPosition, position)
    })

    // Calculate row height based on the maximum position + 1 (for zero-based index)
    const numLoadings = maxPosition + 1

    // Each loading is 24px tall with 2px gap, plus 10px padding (5px top + 5px bottom)
    const height = Math.max(40, 10 + numLoadings * 26)

    return { rowHeight: height, maxLoadingsPerDay: numLoadings }
  }, [factLoadings, workingDays])

  // Memoize the weekend columns
  const weekendColumns = useMemo(() => {
    return workingDays.map((day, index) => {
      const isWeekend = day.getDay() === 0 || day.getDay() === 6
      return isWeekend ? (
        <div
          key={`weekend-${index}`}
          className="absolute top-0 bottom-0 bg-slate-50 dark:bg-slate-800/50"
          style={{
            left: `${index * CELL_WIDTH}px`,
            width: `${CELL_WIDTH}px`,
            height: "100%",
            zIndex: -1, // Set to negative z-index so it appears behind loadings
          }}
        />
      ) : null
    })
  }, [workingDays, CELL_WIDTH])

  // Изменяем useMemo для gridLines, чтобы использовать isDarkTheme из верхнего уровня
  const gridLines = useMemo(() => {
    return workingDays.map((day, index) => (
      <div
        key={`grid-${index}`}
        className="absolute top-0 bottom-0"
        style={{
          left: `${index * CELL_WIDTH}px`,
          width: "1px",
          backgroundColor: isDarkTheme ? "rgba(51, 65, 85, 0.3)" : "rgba(226, 232, 240, 0.7)",
          zIndex: -1,
        }}
      />
    ))
  }, [workingDays, CELL_WIDTH, isDarkTheme])

  // Memoize the day cells
  const dayCells = useMemo(() => {
    return workingDays.map((day, index) => {
      const isToday = new Date().toDateString() === day.toDateString()

      return (
        <div
          key={index}
          className={cn(
            "p-1 text-center text-xs border-r border-slate-200 dark:border-slate-800",
            isToday ? "bg-primary/5 dark:bg-primary/10" : "",
          )}
          style={{ width: `${CELL_WIDTH}px`, minWidth: `${CELL_WIDTH}px` }}
        />
      )
    })
  }, [workingDays, CELL_WIDTH])

  // Memoize loading items - переработанная логика для стабильного отображения
  const loadingItems = useMemo(() => {
    // Создаем карту позиций для каждой задачи, чтобы они были стабильными
    const loadingPositions = new Map<string, number>()

    // Сначала определяем все задачи, которые видны в текущем диапазоне
    const visibleLoadings = factLoadings.filter((loading) => {
      const startDate = new Date(loading.date_start)
      const endDate = new Date(loading.date_end)

      // Задача видима, если она пересекается с видимым диапазоном
      return !(endDate < workingDays[0] || startDate > workingDays[workingDays.length - 1])
    })

    // Сортируем задачи по дате начала для стабильного порядка
    visibleLoadings.sort((a, b) => {
      const aStart = new Date(a.date_start).getTime()
      const bStart = new Date(b.date_start).getTime()
      if (aStart !== bStart) return aStart - bStart

      // Если даты начала одинаковые, сортируем по ID для стабильности
      return a.id.localeCompare(b.id)
    })

    // Назначаем позиции для каждой задачи
    let maxPosition = 0
    visibleLoadings.forEach((loading) => {
      // Находим все пересекающиеся задачи, которым уже назначены позиции
      const overlappingPositions = new Set<number>()

      for (const [loadingId, position] of loadingPositions.entries()) {
        const existingLoading = factLoadings.find((l) => l.id === loadingId)
        if (!existingLoading) continue

        // Проверяем, пересекаются ли задачи
        const existingStart = new Date(existingLoading.date_start)
        const existingEnd = new Date(existingLoading.date_end)
        const currentStart = new Date(loading.date_start)
        const currentEnd = new Date(loading.date_end)

        if (!(existingEnd < currentStart || existingStart > currentEnd)) {
          overlappingPositions.add(position)
        }
      }

      // Находим первую свободную позицию
      let position = 0
      while (overlappingPositions.has(position)) {
        position++
      }

      loadingPositions.set(loading.id, position)
      maxPosition = Math.max(maxPosition, position)
    })

    // Теперь создаем элементы LoadingItem с правильными позициями
    return visibleLoadings.map((loading) => {
      // Находим индексы начала и конца в видимом диапазоне
      const startDate = new Date(loading.date_start)
      const endDate = new Date(loading.date_end)

      // Находим индекс начала (может быть отрицательным, если задача начинается до видимого диапазона)
      let startIdx = -1
      if (startDate < workingDays[0]) {
        startIdx = -1
      } else {
        // Находим точный индекс дня в видимом диапазоне
        startIdx = workingDays.findIndex(
          (day) =>
            day.getFullYear() === startDate.getFullYear() &&
            day.getMonth() === startDate.getMonth() &&
            day.getDate() === startDate.getDate(),
        )
      }

      // Находим индекс конца
      let endIdx = workingDays.findIndex(
        (day) =>
          day.getFullYear() === endDate.getFullYear() &&
          day.getMonth() === endDate.getMonth() &&
          day.getDate() === endDate.getDate(),
      )

      if (endIdx === -1) {
        // Если конец задачи не найден в видимом диапазоне, используем последний день
        if (endDate > workingDays[workingDays.length - 1]) {
          endIdx = workingDays.length - 1
        }
      }

      // Используем стабильную позицию из нашей карты
      const position = loadingPositions.get(loading.id) || 0

      return (
        <LoadingItem
          key={loading.id}
          loading={loading}
          startIdx={startIdx}
          endIdx={endIdx}
          position={position}
          cellWidth={CELL_WIDTH}
          onEdit={(loading) => onEditLoading(loading, stage.id)}
        />
      )
    })
  }, [factLoadings, workingDays, CELL_WIDTH, onEditLoading, stage.id])

  // Use callback for the add loading handler
  const handleAddLoading = useCallback(() => {
    onAddLoading(stage.id)
  }, [onAddLoading, stage.id])

  // Обновим JSX в return, добавив пустую ячейку для столбца ответственного
  return (
    <div
      className="flex border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
      style={{ height: `${rowHeight}px` }}
    >
      <div
        className="border-r border-slate-200 dark:border-slate-800 flex items-center"
        style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
      >
        {/* Точный дизайн боковой панели, соответствующий скриншоту */}
        <div className="flex items-center w-full px-2 py-2">
          <div className="flex-grow">
            <div className="flex items-center">
              <span className="text-[14px] text-slate-700 dark:text-slate-300 font-medium truncate max-w-[220px] block ml-2">
                {stage.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 flex-shrink-0">
                {factLoadings.length}{" "}
                {factLoadings.length === 1
                  ? "загрузка"
                  : factLoadings.length >= 2 && factLoadings.length <= 4
                    ? "загрузки"
                    : "загрузок"}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 ml-auto">
            <AddLoadingButton onClick={handleAddLoading} label={`Добавить загрузку в ${stage.name}`} />
          </div>
        </div>
      </div>

      {/* Пустая ячейка для столбца ответственного */}
      <div
        className="border-r border-slate-200 dark:border-slate-800 flex items-center justify-start"
        style={{ width: `${actualResponsibleColumnWidth}px`, minWidth: `${actualResponsibleColumnWidth}px` }}
      ></div>

      <div className="flex-1 flex relative">
        {/* Weekend columns */}
        <div className="absolute inset-0 pointer-events-none">{weekendColumns}</div>

        {/* Вертикальная разметка */}
        <div className="absolute inset-0 pointer-events-none">{gridLines}</div>

        {dayCells}
        {loadingItems}
      </div>
    </div>
  )
})

