"use client"

import { cn } from "@/lib/utils"
import type { DayCell } from "../utils"

interface TimelineGridBackgroundProps {
  dayCells: DayCell[]
  theme: string
}

export function TimelineGridBackground({ dayCells, theme }: TimelineGridBackgroundProps) {
  const cellWidth = 100 / dayCells.length

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Weekend and today highlights */}
      {dayCells.map((cell, i) => {
        if (!cell.isWeekend && !cell.isToday) return null
        return (
          <div
            key={i}
            className={cn(
              "absolute top-0 bottom-0",
              cell.isToday
                ? theme === "dark" ? "bg-teal-600/10" : "bg-teal-50/50"
                : cell.isWeekend
                ? theme === "dark" ? "bg-slate-800/40" : "bg-slate-100/80"
                : ""
            )}
            style={{
              left: `${i * cellWidth}%`,
              width: `${cellWidth}%`,
            }}
          />
        )
      })}
      {/* Vertical grid lines */}
      {dayCells.slice(0, -1).map((_, i) => (
        <div
          key={`line-${i}`}
          className={cn(
            "absolute top-0 bottom-0 w-px",
            theme === "dark" ? "bg-slate-800" : "bg-slate-100"
          )}
          style={{
            left: `${(i + 1) * cellWidth}%`,
          }}
        />
      ))}
    </div>
  )
}
