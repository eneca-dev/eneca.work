"use client"

import { cn } from "@/lib/utils"
import { isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import type { Employee, Loading } from "../../types"
import { Avatar } from "../avatar"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

interface WorkloadRowProps {
  employee: Employee
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  cellWidth: number
  isExpanded: boolean
  onToggleEmployee: () => void
}

export function WorkloadRow({ employee, timeUnits, theme, cellWidth, isExpanded, onToggleEmployee }: WorkloadRowProps) {
  // State for avatar tooltip
  const [hoveredAvatar, setHoveredAvatar] = useState(false)

  // Function to determine cell color based on workload
  const getWorkloadColor = (rate: number) => {
    if (rate === 0) return ""

    // Consider employee's employment rate
    const employmentRate = employee.employmentRate || 1
    const relativeLoad = rate / employmentRate

    if (relativeLoad <= 0.5) return theme === "dark" ? "bg-blue-500/70" : "bg-blue-500/50"
    if (relativeLoad <= 1.0) return theme === "dark" ? "bg-green-500/70" : "bg-green-500/50"
    if (relativeLoad <= 1.5) return theme === "dark" ? "bg-yellow-500/70" : "bg-yellow-500/50"
    return theme === "dark" ? "bg-red-500/70" : "bg-red-500/50"
  }

  // Check if employee has loadings
  const hasLoadings = employee.loadings && employee.loadings.length > 0

  return (
    <>
      {/* Employee row */}
      <div
        className={cn(
          "flex border-b group/employee",
          hasLoadings ? "cursor-pointer" : "cursor-default",
          theme === "dark" ? "border-slate-700 hover:bg-slate-800/70" : "border-slate-200 hover:bg-slate-50/70",
        )}
        onClick={hasLoadings ? onToggleEmployee : undefined}
      >
        {/* Employee info */}
        <div
          className={cn(
            "flex items-center border-r p-2 min-w-[320px] w-[320px]",
            theme === "dark" ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white",
          )}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                {hasLoadings ? (
                  isExpanded ? (
                    <ChevronDown className={cn("h-4 w-4", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                  ) : (
                    <ChevronRight className={cn("h-4 w-4", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                  )
                ) : (
                  <div className="w-4 h-4"></div> // Empty space for alignment
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
                <div className={cn("text-xs truncate", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                  {employee.position || "Не указана должность"}
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
        </div>

        {/* Workload cells */}
        <div className="flex flex-1">
          {timeUnits.map((unit, i) => {
            const isWeekendDay = unit.isWeekend
            const isTodayDate = isToday(unit.date)
            const dateKey = unit.date.toISOString().split("T")[0]
            const workloadRate = employee.dailyWorkloads?.[dateKey] || 0

            return (
              <div
                key={i}
                className={cn(
                  "border-r border-b relative",
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
                        "text-white", // Always white text for better readability
                      )}
                    >
                      {workloadRate.toFixed(1)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Employee loadings (when expanded) */}
      {isExpanded &&
        employee.loadings &&
        employee.loadings.map((loading, index) => (
          <LoadingRow key={loading.id} loading={loading} timeUnits={timeUnits} theme={theme} cellWidth={cellWidth} />
        ))}
    </>
  )
}

// Loading row component
interface LoadingRowProps {
  loading: Loading
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  cellWidth: number
}

function LoadingRow({ loading, timeUnits, theme, cellWidth }: LoadingRowProps) {
  // Function to format date in short format
  const formatShortDate = (date: Date): string => {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }).format(date)
  }

  // Function to check if loading is active on a specific date
  const isLoadingActiveInPeriod = (loading: Loading, date: Date): boolean => {
    try {
      const loadingStart = new Date(loading.startDate)
      const loadingEnd = new Date(loading.endDate)

      // Reset time for correct comparison
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
    <div
      className={cn(
        "flex border-b group/loading",
        theme === "dark" ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-slate-50/50",
      )}
    >
      {/* Loading info */}
      <div
        className={cn(
          "flex items-center border-r p-2 min-w-[320px] w-[320px]",
          theme === "dark" ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50",
        )}
      >
        <div className="flex items-center justify-between w-full pl-8">
          <div className="flex items-center">
            <div className="ml-2">
              {/* Project name */}
              <div className={cn("text-xs font-medium", theme === "dark" ? "text-slate-300" : "text-slate-800")}>
                {loading.projectName || "Проект не указан"}
              </div>
              {/* Section name */}
              <div className={cn("text-[10px]", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                {loading.sectionName || "Раздел не указан"}
              </div>
            </div>

            {/* Loading period */}
            <div className="ml-4 flex items-center">
              <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-600")}>
                {formatShortDate(loading.startDate)} — {formatShortDate(loading.endDate)}
              </span>
            </div>
          </div>

          {/* Loading rate */}
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded",
              theme === "dark" ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-700",
            )}
          >
            {loading.rate} ставка
          </span>
        </div>
      </div>

      {/* Loading cells */}
      <div className="flex flex-1">
        {timeUnits.map((unit, i) => {
          const isWeekendDay = unit.isWeekend
          const isTodayDate = isToday(unit.date)
          const isActive = isLoadingActiveInPeriod(loading, unit.date)

          return (
            <div
              key={i}
              className={cn(
                "border-r border-b relative",
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
