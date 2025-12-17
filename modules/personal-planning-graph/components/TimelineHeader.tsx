"use client"

import { useMemo } from "react"
import { getDay } from "date-fns"
import { cn } from "@/lib/utils"
import type { DayCell } from "../utils"

interface TimelineHeaderProps {
  dayCells: DayCell[]
  theme: string
}

export function TimelineHeader({ dayCells, theme }: TimelineHeaderProps) {
  // Group cells by week for week number display
  const weeks = useMemo(() => {
    const result: { weekNum: number; startIdx: number; endIdx: number; daysCount: number }[] = []
    let currentWeekStart = 0
    let weekCounter = 1

    dayCells.forEach((cell, idx) => {
      // New week starts on Monday (dayOfWeek === 1) or at the beginning
      const dayNum = getDay(cell.date)
      if (dayNum === 1 && idx > 0) {
        result.push({
          weekNum: weekCounter,
          startIdx: currentWeekStart,
          endIdx: idx - 1,
          daysCount: idx - currentWeekStart,
        })
        weekCounter++
        currentWeekStart = idx
      }
    })

    // Add last week
    result.push({
      weekNum: weekCounter,
      startIdx: currentWeekStart,
      endIdx: dayCells.length - 1,
      daysCount: dayCells.length - currentWeekStart,
    })

    return result
  }, [dayCells])

  return (
    <div className="flex flex-col h-full">
      {/* Week numbers row */}
      <div className="flex h-6">
        {weeks.map((week, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center text-[10px] font-medium box-border",
              theme === "dark"
                ? "text-slate-400 bg-slate-800/50"
                : "text-slate-500 bg-slate-100/50"
            )}
            style={{
              flex: week.daysCount,
              borderRight: i < weeks.length - 1 ? `1px solid ${theme === "dark" ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 1)"}` : "none"
            }}
          >
            Неделя {week.weekNum}
          </div>
        ))}
      </div>

      {/* Days row */}
      <div className="flex flex-1">
        {dayCells.map((cell, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 flex flex-col items-center justify-center text-[10px] min-w-0 box-border",
              cell.isWeekend &&
                (theme === "dark" ? "bg-slate-800/70" : "bg-slate-100"),
              cell.isToday &&
                (theme === "dark"
                  ? "bg-teal-600/30"
                  : "bg-teal-100")
            )}
            style={{
              borderRight: i < dayCells.length - 1 ? `1px solid ${theme === "dark" ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 1)"}` : "none"
            }}
          >
            <span
              className={cn(
                "font-medium",
                cell.isToday
                  ? theme === "dark"
                    ? "text-teal-300"
                    : "text-teal-700"
                  : cell.isWeekend
                  ? theme === "dark"
                    ? "text-slate-500"
                    : "text-slate-400"
                  : theme === "dark"
                  ? "text-slate-300"
                  : "text-slate-700"
              )}
            >
              {cell.dayOfMonth}
            </span>
            <span
              className={cn(
                "uppercase",
                cell.isWeekend
                  ? theme === "dark"
                    ? "text-slate-600"
                    : "text-slate-400"
                  : theme === "dark"
                  ? "text-slate-500"
                  : "text-slate-500"
              )}
            >
              {cell.dayOfWeek}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
