"use client"

import { cn } from "@/lib/utils"
import { isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import type { Employee, Loading, Team } from "../../types"
import { Avatar } from "../avatar"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

interface EmployeeRowsProps {
  employee: Employee
  team: Team
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  cellWidth: number
  isExpanded: boolean
  onToggleEmployee: () => void
}

export function EmployeeRows({
  employee,
  team,
  timeUnits,
  theme,
  cellWidth,
  isExpanded,
  onToggleEmployee,
}: EmployeeRowsProps) {
  // Состояние для тултипа аватара
  const [hoveredAvatar, setHoveredAvatar] = useState(false)

  // Функция для определения цвета ячейки в зависимости от загрузки
  const getWorkloadColor = (rate: number) => {
    if (rate === 0) return ""

    // Учитываем ставку сотрудника при определении цвета
    const employmentRate = employee.employmentRate || 1
    const relativeLoad = rate / employmentRate

    if (relativeLoad <= 0.5) return theme === "dark" ? "bg-blue-500/70" : "bg-blue-500/50"
    if (relativeLoad <= 1.0) return theme === "dark" ? "bg-green-500/70" : "bg-green-500/50"
    if (relativeLoad <= 1.5) return theme === "dark" ? "bg-yellow-500/70" : "bg-yellow-500/50"
    return theme === "dark" ? "bg-red-500/70" : "bg-red-500/50"
  }

  // Проверяем, есть ли у сотрудника загрузки
  const hasLoadings = employee.loadings && employee.loadings.length > 0

  return (
    <>
      {/* Строка сотрудника */}
      <tr
        className={cn(hasLoadings ? "cursor-pointer" : "cursor-default")}
        onClick={hasLoadings ? onToggleEmployee : undefined}
      >
        {/* Ячейка с информацией о сотруднике */}
        <td
          className={cn(
            "p-2 border-b",
            theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
          )}
          style={{ width: "320px", minWidth: "320px" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                {hasLoadings ? (
                  isExpanded ? (
                    <ChevronDown className={cn("h-4 w-4", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                  ) : (
                    <ChevronRight className={cn("h-4 w-4", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                  )
                ) : (
                  <div className="w-4 h-4"></div> // Пустое место для выравнивания
                )}
              </div>

              <Avatar
                name={employee.fullName}
                avatarUrl={employee.avatarUrl}
                theme={theme === "dark" ? "dark" : "light"}
                size="md"
              />

              <div className="ml-3 overflow-hidden flex-1">
                <div className="flex items-center justify-between">
                  <div className={cn("font-medium truncate", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
                    {employee.fullName}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className={cn("text-xs truncate", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                    {employee.position || "Не указана должность"}
                  </div>
                  <div
                    className={cn(
                      "ml-2 text-xs px-1.5 py-0.5 rounded",
                      theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {team.code ? `${team.code}` : team.name}
                  </div>
                </div>
              </div>
            </div>

            {employee.employmentRate && (
              <div
                className={cn(
                  "text-xs px-2 py-0.5 rounded ml-2",
                  theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600",
                )}
              >
                {employee.employmentRate} ставка
              </div>
            )}
          </div>
        </td>

        {/* Ячейки загрузки по дням */}
        {timeUnits.map((unit, i) => {
          const isWeekendDay = unit.isWeekend
          const isTodayDate = isToday(unit.date)
          const dateKey = unit.date.toISOString().split("T")[0]
          const workloadRate = employee.dailyWorkloads?.[dateKey] || 0

          return (
            <td
              key={i}
              className={cn(
                "border-b relative p-0",
                theme === "dark" ? "border-slate-700" : "border-slate-200",
                isWeekendDay ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                isTodayDate ? (theme === "dark" ? "bg-teal-900/20" : "bg-teal-100/40") : "",
                isFirstDayOfMonth(unit.date)
                  ? theme === "dark"
                    ? "border-l border-l-slate-600"
                    : "border-l border-l-slate-300"
                  : "",
              )}
              style={{
                width: `${cellWidth}px`,
                minWidth: `${cellWidth}px`,
                height: "48px",
              }}
            >
              {workloadRate > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                      getWorkloadColor(workloadRate),
                      "text-white", // Всегда белый текст для лучшей читаемости
                    )}
                  >
                    {workloadRate.toFixed(1)}
                  </div>
                </div>
              )}
            </td>
          )
        })}
      </tr>

      {/* Строки загрузок (когда раскрыты) */}
      {isExpanded &&
        employee.loadings &&
        employee.loadings.map((loading) => (
          <LoadingRow key={loading.id} loading={loading} timeUnits={timeUnits} theme={theme} cellWidth={cellWidth} />
        ))}
    </>
  )
}

// Компонент для отображения строки загрузки
interface LoadingRowProps {
  loading: Loading
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  cellWidth: number
}

function LoadingRow({ loading, timeUnits, theme, cellWidth }: LoadingRowProps) {
  // Функция для форматирования даты в коротком формате
  const formatShortDate = (date: Date): string => {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }).format(date)
  }

  // Функция для проверки, активна ли загрузка в указанную дату
  const isLoadingActiveInPeriod = (loading: Loading, date: Date): boolean => {
    try {
      const loadingStart = new Date(loading.startDate)
      const loadingEnd = new Date(loading.endDate)

      // Сбрасываем время для корректного сравнения
      loadingStart.setHours(0, 0, 0, 0)
      loadingEnd.setHours(23, 59, 59, 999)

      const periodDate = new Date(date)
      periodDate.setHours(0, 0, 0, 0)

      return periodDate >= loadingStart && periodDate <= loadingEnd
    } catch (error) {
      console.error("Ошибка при проверке активности загрузки:", error)
      return false
    }
  }

  return (
    <tr className={cn(theme === "dark" ? "bg-slate-900/50" : "bg-slate-50/50")}>
      {/* Ячейка с информацией о загрузке */}
      <td
        className={cn(
          "p-2 border-b",
          theme === "dark" ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50",
        )}
        style={{ width: "320px", minWidth: "320px" }}
      >
        <div className="flex items-center justify-between pl-8">
          <div className="flex items-center">
            <div className="ml-2">
              {/* Название проекта */}
              <div className={cn("text-xs font-medium", theme === "dark" ? "text-slate-300" : "text-slate-800")}>
                {loading.projectName || "Проект не указан"}
              </div>
              {/* Название раздела */}
              <div className={cn("text-[10px]", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                {loading.sectionName || "Раздел не указан"}
              </div>
            </div>

            {/* Период загрузки */}
            <div className="ml-4 flex items-center">
              <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-600")}>
                {formatShortDate(loading.startDate)} — {formatShortDate(loading.endDate)}
              </span>
            </div>
          </div>

          {/* Ставка загрузки */}
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded",
              theme === "dark" ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-700",
            )}
          >
            {loading.rate} ставка
          </span>
        </div>
      </td>

      {/* Ячейки загрузки по дням */}
      {timeUnits.map((unit, i) => {
        const isWeekendDay = unit.isWeekend
        const isTodayDate = isToday(unit.date)
        const isActive = isLoadingActiveInPeriod(loading, unit.date)

        return (
          <td
            key={i}
            className={cn(
              "border-b relative p-0",
              theme === "dark" ? "border-slate-700" : "border-slate-200",
              isWeekendDay ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
              isTodayDate ? (theme === "dark" ? "bg-teal-900/20" : "bg-teal-100/40") : "",
              isFirstDayOfMonth(unit.date)
                ? theme === "dark"
                  ? "border-l border-l-slate-600"
                  : "border-l border-l-slate-300"
                : "",
            )}
            style={{
              width: `${cellWidth}px`,
              minWidth: `${cellWidth}px`,
              height: "36px",
            }}
          >
            {isActive && (
              <div
                className={cn("absolute inset-1 rounded-sm", theme === "dark" ? "bg-blue-500/40" : "bg-blue-500/30")}
              ></div>
            )}
          </td>
        )
      })}
    </tr>
  )
}
