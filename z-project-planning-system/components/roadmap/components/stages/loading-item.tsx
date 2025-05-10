"use client"

import type React from "react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/date-utils"
import type { Loading } from "@/types/project-types"
import { useTheme } from "next-themes"
import { getProfileById, getFullName, getTeamName, getCategoryCode } from "@/data/mock-profiles"

interface LoadingItemProps {
  loading: Loading
  startIdx: number
  endIdx: number
  position: number
  cellWidth: number
  onEdit: (loading: Loading) => void
}

export function LoadingItem({ loading, startIdx, endIdx, position, cellWidth, onEdit }: LoadingItemProps) {
  // Используем хук useTheme для реактивного отслеживания темы
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // Получаем данные о сотруднике по ID
  const profile = getProfileById(loading.user_id || loading.executorId)
  const executorName = profile ? getFullName(profile) : "Unknown"
  const teamName = profile ? getTeamName(profile) : ""
  const categoryCode = profile ? getCategoryCode(profile) : ""

  // Если startIdx отрицательный (задача начинается до видимого диапазона),
  // устанавливаем его в 0 для отображения
  const visibleStartIdx = startIdx < 0 ? 0 : startIdx

  // Рассчитываем ширину и позицию с учетом видимого диапазона
  const width = (endIdx - visibleStartIdx + 1) * cellWidth
  const left = visibleStartIdx * cellWidth

  // Fixed height and offset for each Loading - ensure consistent spacing
  const itemHeight = 24 // Height of each loading item
  const verticalPadding = 5 // Padding at top of row
  const top = verticalPadding + position * (itemHeight + 2) // 2px gap between items

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(loading)
  }

  // Добавляем специальный стиль для задач, начинающихся до видимого диапазона
  const isPartiallyVisible = startIdx < 0

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute h-6 flex items-center justify-start text-xs font-medium px-2 truncate transition-all",
              loading.type === "Plan" ? "border-dashed" : "",
              isPartiallyVisible ? "border-l-0" : "",
              "hover:shadow-md hover:z-10 cursor-pointer",
            )}
            style={{
              left: `${left}px`,
              width: `${width}px`,
              top: `${top}px`,
              height: `${itemHeight}px`,
              backgroundColor: isDarkTheme ? "#0c4a6e" : "#bfdbfe", // Простой синий цвет
              borderTop: `1px solid ${isDarkTheme ? "#0369a1" : "#93c5fd"}`,
              borderRight: `1px solid ${isDarkTheme ? "#0369a1" : "#93c5fd"}`,
              borderBottom: `1px solid ${isDarkTheme ? "#0369a1" : "#93c5fd"}`,
              borderLeft: isPartiallyVisible ? "none" : `1px solid ${isDarkTheme ? "#0369a1" : "#93c5fd"}`,
              color: isDarkTheme ? "#e0f2fe" : "#1e40af",
              transition: "all 0.15s ease",
              zIndex: 5, // Ensure loadings are above grid lines
            }}
            onClick={handleClick}
          >
            {/* Добавляем индикатор для задач, начинающихся за пределами видимого диапазона */}
            {isPartiallyVisible && (
              <div className="absolute -left-1 top-0 bottom-0 flex items-center" style={{ zIndex: 1 }}>
                <div className="w-1 h-4 bg-slate-400 dark:bg-slate-300"></div>
              </div>
            )}
            <div className="flex items-center w-full overflow-hidden gap-1">
              {width > 60 ? (
                <>
                  <span className="truncate">{executorName}</span>
                  <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                    <span className="bg-white/20 dark:bg-black/20 px-1 text-[10px] font-medium">{loading.rate}</span>
                    <span className="bg-white/20 dark:bg-black/20 px-1 text-[10px] font-medium">{categoryCode}</span>
                  </div>
                </>
              ) : width > 40 ? (
                <>
                  <span className="font-medium">{loading.rate}</span>
                  <span className="bg-white/20 dark:bg-black/20 px-1 text-[10px] font-medium">{categoryCode}</span>
                </>
              ) : (
                <span className="font-medium">{loading.rate}</span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-white dark:bg-slate-800 shadow-lg border-0 p-3">
          <div className="space-y-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {executorName} {loading.type === "Plan" ? "(Plan)" : "(Fact)"}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Category</p>
                <p className="font-medium dark:text-gray-200 flex items-center gap-1">{categoryCode}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Rate</p>
                <p className="font-medium dark:text-gray-200">{loading.rate}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Team</p>
              <p className="font-medium text-sm dark:text-gray-200">{teamName}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Period</p>
              <p className="font-medium text-sm dark:text-gray-200">
                {formatDate(new Date(loading.date_start || loading.startDate))} -{" "}
                {formatDate(new Date(loading.date_end || loading.endDate))}
              </p>
            </div>
            <div className="pt-1 text-center">
              <p className="text-[#1e7260] dark:text-[#5eead4] text-xs font-medium">Click to edit</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

