"use client"

import { cn } from "@/lib/utils"
import { useMemo } from "react"
import { groupDatesByMonth, isToday, isFirstDayOfMonth } from "../../utils/date-utils"

interface WorkloadHeaderProps {
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  cellWidth: number
}

export function WorkloadHeader({ timeUnits, theme, cellWidth }: WorkloadHeaderProps) {
  // Группируем даты по месяцам
  const monthGroups = useMemo(() => {
    return groupDatesByMonth(timeUnits)
  }, [timeUnits])

  return (
    <thead className="sticky top-0 z-30">
      {/* Строка с месяцами */}
      <tr>
        {/* Ячейка для информации о сотруднике */}
        <th
          className={cn("border-b", theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200")}
          style={{
            width: "320px",
            minWidth: "320px",
            height: "40px",
          }}
        >
          <span className={cn("font-medium", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Сотрудник</span>
        </th>

        {/* Ячейки с месяцами */}
        {monthGroups.map((month, i) => {
          const width = month.length * cellWidth

          return (
            <th
              key={`month-${i}`}
              className={cn(
                "border-b",
                theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200",
                i > 0 ? (theme === "dark" ? "border-l border-l-slate-600" : "border-l border-l-slate-300") : "",
              )}
              style={{
                height: "40px",
                width: `${width}px`,
                minWidth: `${width}px`,
              }}
              colSpan={month.length}
            >
              <span className={cn("font-medium", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                {month.name}
              </span>
            </th>
          )
        })}
      </tr>

      {/* Строка с днями */}
      <tr>
        {/* Ячейка для информации о сотруднике */}
        <th
          className={cn("border-b", theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200")}
          style={{
            width: "320px",
            minWidth: "320px",
            height: "40px",
          }}
        >
          <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>Имя / Должность</span>
        </th>

        {/* Ячейки с днями */}
        {timeUnits.map((unit, i) => {
          const isTodayDate = isToday(unit.date)
          const isMonthStart = isFirstDayOfMonth(unit.date)

          return (
            <th
              key={i}
              className={cn(
                "border-b p-0",
                theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200",
                unit.isWeekend ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                isTodayDate ? (theme === "dark" ? "bg-teal-900/40" : "bg-teal-100") : "",
                isMonthStart ? (theme === "dark" ? "border-l border-l-slate-600" : "border-l border-l-slate-300") : "",
              )}
              style={{
                height: "40px",
                width: `${cellWidth}px`,
                minWidth: `${cellWidth}px`,
              }}
            >
              <span
                className={cn(
                  "w-5 h-5 flex items-center justify-center rounded-full text-xs",
                  isTodayDate
                    ? theme === "dark"
                      ? "bg-teal-500 text-white font-bold ring-2 ring-teal-400 ring-opacity-50"
                      : "bg-teal-500 text-white font-bold ring-2 ring-teal-400 ring-opacity-50"
                    : theme === "dark"
                      ? "text-slate-300"
                      : "text-slate-600",
                )}
              >
                {unit.label}
              </span>
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
